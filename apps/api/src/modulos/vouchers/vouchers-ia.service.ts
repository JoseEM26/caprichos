import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';
import { IaConsumoService } from '../chatbot/ia/ia-consumo.service';
import { DatosVoucherExtraidos } from './semaforo.util';
import {
  clasificarExcepcionIa,
  ErrorOpenAI,
  FalloIa,
} from './vouchers-ia-corte.util';

const PROMPT_SISTEMA_VOUCHER = `Eres un asistente experto en análisis y extracción estricta de vouchers y comprobantes de pago digitales (Yape y Plin de Perú).
Extrae SOLO lo que se ve, no inventes; si no se ve pon null y legible=false.
Tu respuesta debe ser exclusivamente un objeto JSON con los siguientes campos exactos:
- legible: boolean (true si la captura muestra claramente un voucher o comprobante, false si es borroso, recortado o ininteligible)
- monto: number | null (el monto numérico pagado en soles sin letras ni símbolos, ej. 25.50)
- moneda: string | null ("PEN" o "USD", por defecto "PEN")
- operacion: string | null (número de operación o referencia que aparece en el comprobante)
- fecha: string | null (fecha de la transacción en formato YYYY-MM-DD si es determinable o el texto que figure)
- hora: string | null (hora de la transacción en formato HH:MM si figura)
- titular: string | null (nombre del destinatario o titular que recibió el pago tal como se lee)
- destinoNumero: string | null (número de teléfono o cuenta de destino si aparece)
- medioDetectado: "YAPE" | "PLIN" | "OTRO" | null (medio identificado según diseño, colores y logos del voucher)
- confianza: number (valor decimal entre 0 y 1 indicando la certeza de la extracción)
- notas: string (observaciones breves sobre la calidad o elementos visuales)`;

export const MOTIVO_PAUSA_IA = 'Lectura de IA en pausa por saldo o clave; revisión visual requerida';
export const MOTIVO_TOPE_IA = 'Tope mensual de IA alcanzado';

const CLAVE_CORTE = 'voucher:ia:corte';
const CLAVE_FALLOS_SALDO = 'voucher:ia:fallos:saldo';
const CLAVE_FALLOS_ERROR = 'voucher:ia:fallos:error';
const CLAVE_SONDA = 'voucher:ia:sonda';
const CLAVE_AVISO_CAIDA = 'voucher:ia:aviso:caida';
const UMBRAL_SALDO_CLAVE = 3;
const UMBRAL_ERROR = 5;
const CORTE_MIN_DEFECTO = 10;
const TTL_SONDA_SEG = 120;
const TTL_AVISO_TOPE_SEG = 35 * 86400;

type CausaCorte = 'SALDO' | 'CLAVE' | 'ERRORES';
interface EstadoCorte {
  causa: CausaCorte;
  /** Hasta cuándo el corte bloquea. Pasado este instante, la siguiente lectura es la prueba (half-open). */
  hastaMs: number;
}

@Injectable()
export class VouchersIaService {
  private readonly logger = new Logger(VouchersIaService.name);
  private readonly apiKey: string;
  private readonly visionModel: string;
  /** Respaldo del corte y de los avisos cuando Redis no responde (solo vive en este proceso). */
  private readonly memoria = new Map<string, { valor: string; expiraMs: number | null }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly iaConsumoService: IaConsumoService,
    private readonly avisosInternos: AvisosInternosService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    this.visionModel = this.configService
      .get<string>('OPENAI_VISION_MODEL', 'gpt-4o-mini')
      .trim();
  }

  /**
   * Consulta el parámetro de configuración 'voucher_ia_activo' (default: false).
   */
  async estaParametroVoucherIaActivo(): Promise<boolean> {
    try {
      const p = await this.prisma.parametro.findUnique({
        where: { clave: 'voucher_ia_activo' },
      });
      if (!p || p.valor === null || p.valor === undefined) return false;
      const v = p.valor;
      return (
        v === true ||
        String(v).toLowerCase().trim() === 'true' ||
        String(v).toLowerCase().trim() === 'si'
      );
    } catch (err: any) {
      this.logger.error(`Error consultando voucher_ia_activo: ${err.message}`);
      return false;
    }
  }

  /**
   * Límite técnico anti-abuso: máximo 10 lecturas por minuto por usuario/teléfono/IP (Redis).
   */
  async verificarRateLimit(identificador?: string | null): Promise<boolean> {
    if (!identificador) return true;
    const clave = `voucher:ia:rate_min:${identificador.trim()}`;

    try {
      const redis = this.redisService.obtenerCliente();
      const llamadas = await redis.incr(clave);
      if (llamadas === 1) {
        await redis.expire(clave, 60); // 1 minuto
      }
      return llamadas <= 10;
    } catch (err: any) {
      this.logger.warn(`Redis no disponible para rate limit de vouchers: ${err.message}`);
      return true;
    }
  }

  /**
   * Analiza una imagen de voucher mediante OpenAI Vision con salida JSON estricta y temperatura 0.
   * Reglas de contrato:
   * - Solo se envía la IMAGEN (sin datos personales ni del pedido).
   * - Timeout de 20 segundos.
   * - Si la IA está apagada, sin clave o falla: retorna sinLectura=true (SIN_LECTURA) y el voucher se guarda igual.
   * - Corte automático: tras 3 fallos de saldo/clave (o 5 errores) seguidos, no se llama a OpenAI durante
   *   voucher_ia_corte_min minutos. Pasado ese tiempo, una sola lectura hace de prueba.
   * - Tope mensual: si el gasto VOUCHER del mes supera chatbot_ia_tope_mensual_usd, no se llama a OpenAI.
   * - Nunca registra el contenido de la imagen en logs.
   * - Registra el consumo con origen 'VOUCHER'.
   */
  async analizarVoucher(
    buffer: Buffer,
    mimeType: string,
    opciones?: {
      conversacionId?: bigint | string | null;
      identificadorRateLimit?: string | null;
    },
  ): Promise<{
    sinLectura: boolean;
    extraido: DatosVoucherExtraidos | null;
    motivo?: string;
  }> {
    // 1. Verificar si la IA de vouchers está activa por configuración
    const activo = await this.estaParametroVoucherIaActivo();
    if (!activo) {
      return {
        sinLectura: true,
        extraido: null,
        motivo: 'Lectura de vouchers con IA desactivada (voucher_ia_activo=false)',
      };
    }

    // 2. Verificar clave de OpenAI
    if (!this.apiKey) {
      return {
        sinLectura: true,
        extraido: null,
        motivo: 'OPENAI_API_KEY no configurada en el servidor',
      };
    }

    // 3. Rate limit anti-abuso: no lanza. El voucher se guarda igual (SIN_LECTURA) y el equipo lo revisa.
    const rateOk = await this.verificarRateLimit(opciones?.identificadorRateLimit);
    if (!rateOk) {
      return {
        sinLectura: true,
        extraido: null,
        motivo: 'Límite de lecturas de vouchers por minuto excedido (máximo 10 por minuto)',
      };
    }

    // 4. Validar tamaño máximo 5 MB
    if (buffer.length > 5 * 1024 * 1024) {
      return {
        sinLectura: true,
        extraido: null,
        motivo: 'Tamaño de imagen excede los 5 MB permitidos',
      };
    }

    // 5. Tope mensual de gasto en IA para vouchers
    if (await this.topeMensualSuperado()) {
      return { sinLectura: true, extraido: null, motivo: MOTIVO_TOPE_IA };
    }

    // 6. Corte por saldo, clave o errores: si está abierto, OpenAI no se llama
    const paso = await this.pedirPaso();
    if (!paso.libre) {
      return { sinLectura: true, extraido: null, motivo: MOTIVO_PAUSA_IA };
    }

    // 7. Preparar llamada a OpenAI Vision con timeout de 20 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s

    const base64Img = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Img}`;

    const cuerpo = {
      model: this.visionModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: PROMPT_SISTEMA_VOUCHER,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analiza esta imagen y extrae estrictamente los datos visibles del comprobante.',
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
    };

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(cuerpo),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new ErrorOpenAI(res.status, errText);
      }

      const respuestaJson = await res.json();
      const contenidoTexto = respuestaJson.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(contenidoTexto);

      const usage = respuestaJson.usage || {};
      const tokensEntrada = Number(usage.prompt_tokens || 0);
      const tokensSalida = Number(usage.completion_tokens || 0);

      // Registrar consumo en ia_consumo con origen 'VOUCHER' (sin restricción de tope)
      await this.iaConsumoService.registrarConsumo({
        conversacionId: opciones?.conversacionId,
        modelo: this.visionModel,
        tokensEntrada,
        tokensSalida,
        resultado: 'EXITO',
        origen: 'VOUCHER',
      });

      const extraido: DatosVoucherExtraidos = {
        legible: Boolean(parsed.legible),
        monto: parsed.monto !== null && parsed.monto !== undefined && !isNaN(Number(parsed.monto))
          ? Number(parsed.monto)
          : null,
        moneda: parsed.moneda || 'PEN',
        operacion: parsed.operacion ? String(parsed.operacion).trim() : null,
        fecha: parsed.fecha ? String(parsed.fecha).trim() : null,
        hora: parsed.hora ? String(parsed.hora).trim() : null,
        titular: parsed.titular ? String(parsed.titular).trim() : null,
        destinoNumero: parsed.destinoNumero ? String(parsed.destinoNumero).trim() : null,
        medioDetectado:
          parsed.medioDetectado === 'YAPE' || parsed.medioDetectado === 'PLIN' || parsed.medioDetectado === 'OTRO'
            ? parsed.medioDetectado
            : null,
        confianza:
          typeof parsed.confianza === 'number' && !isNaN(parsed.confianza)
            ? Math.max(0, Math.min(1, parsed.confianza))
            : 0,
        notas: parsed.notas ? String(parsed.notas).trim() : '',
      };

      await this.registrarExito(paso.sonda);

      return {
        sinLectura: false,
        extraido,
      };
    } catch (err: any) {
      // NUNCA loguear la imagen base64
      this.logger.error(`Error en análisis de voucher con IA: ${err.message}`);
      await this.registrarFallo(clasificarExcepcionIa(err), paso.sonda);
      return {
        sinLectura: true,
        extraido: null,
        motivo: err.message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Estado para la franja de Caja y la tarjeta de configuración (GET /admin/vouchers/estado-ia). */
  async estadoIa(): Promise<{
    activa: boolean;
    enPausa: boolean;
    causa: CausaCorte | null;
    hastaEn: string | null;
    topeMensual: { usadoUsd: number; topeUsd: number; superado: boolean };
  }> {
    const activa = await this.estaParametroVoucherIaActivo();
    const corte = await this.leerCorte();
    const { costoUsdEstimado } = await this.agregadoMesVoucher(new Date());
    const topeUsd = await this.iaConsumoService.obtenerTopeMensualUsd();
    return {
      activa,
      enPausa: corte !== null,
      causa: corte?.causa ?? null,
      hastaEn: corte ? new Date(corte.hastaMs).toISOString() : null,
      topeMensual: {
        usadoUsd: costoUsdEstimado,
        topeUsd,
        superado: costoUsdEstimado >= topeUsd,
      },
    };
  }

  /**
   * Resumen de consumo de OpenAI exclusivo para origen VOUCHER del mes en curso.
   */
  async obtenerConsumoMesVoucher(fecha = new Date()) {
    const agregado = await this.agregadoMesVoucher(fecha);
    const activo = await this.estaParametroVoucherIaActivo();
    return { ...agregado, iaActiva: activo };
  }

  private async agregadoMesVoucher(fecha: Date) {
    const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0);
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    const agregados = await this.prisma.iaConsumo.aggregate({
      where: {
        fecha: { gte: inicioMes },
        origen: 'VOUCHER',
      },
      _count: { id: true },
      _sum: {
        tokens_entrada: true,
        tokens_salida: true,
        costo_usd_estimado: true,
      },
    });

    const llamadasTotal = agregados._count.id || 0;
    const tokensEntrada = agregados._sum.tokens_entrada || 0;
    const tokensSalida = agregados._sum.tokens_salida || 0;
    const costoUsdEstimado = Number(agregados._sum.costo_usd_estimado || 0);

    return {
      periodo,
      llamadasTotal,
      tokensEntrada,
      tokensSalida,
      tokensTotal: tokensEntrada + tokensSalida,
      costoUsdEstimado: Math.round(costoUsdEstimado * 10000) / 10000,
    };
  }

  /** Si el gasto VOUCHER del mes ya llegó al tope, avisa una vez por mes. Si la consulta falla, no bloquea. */
  private async topeMensualSuperado(): Promise<boolean> {
    try {
      const { periodo, costoUsdEstimado } = await this.agregadoMesVoucher(new Date());
      const topeUsd = await this.iaConsumoService.obtenerTopeMensualUsd();
      if (costoUsdEstimado < topeUsd) return false;

      const primero = await this.kvCrearSiNoExiste(`voucher:ia:aviso:tope:${periodo}`, '1', TTL_AVISO_TOPE_SEG);
      if (primero) {
        await this.avisarAdmin(
          'VOUCHER_IA_TOPE',
          'Tope mensual de IA alcanzado en vouchers',
          `La lectura de vouchers con IA llegó a $${costoUsdEstimado.toFixed(2)} de $${topeUsd.toFixed(2)} este mes. ` +
            'Los vouchers se guardan y Caja los revisa a mano hasta el próximo mes.',
          `voucher-ia-tope:${periodo}`,
        );
      }
      return true;
    } catch (err: any) {
      this.logger.warn(`No se pudo revisar el tope mensual de vouchers con IA: ${err.message}`);
      return false;
    }
  }

  /** Decide si esta lectura puede llamar a OpenAI. Con el corte vencido, solo una lectura es la prueba. */
  private async pedirPaso(): Promise<{ libre: boolean; sonda: boolean }> {
    const corte = await this.leerCorte();
    if (!corte) return { libre: true, sonda: false };
    if (Date.now() < corte.hastaMs) return { libre: false, sonda: false };

    const sonda = await this.kvCrearSiNoExiste(CLAVE_SONDA, '1', TTL_SONDA_SEG);
    return { libre: sonda, sonda };
  }

  private async registrarExito(sonda: boolean): Promise<void> {
    if (sonda) {
      await this.cerrarCorte();
      return;
    }
    // Un éxito siempre reinicia los contadores de fallos seguidos
    await this.kvBorrar(CLAVE_FALLOS_SALDO);
    await this.kvBorrar(CLAVE_FALLOS_ERROR);
  }

  private async registrarFallo(falloIa: FalloIa, sonda: boolean): Promise<void> {
    if (falloIa === 'NO_CUENTA') {
      // 429 de límite por minuto u otro error del cliente: no dice nada de saldo ni de caída
      if (sonda) await this.kvBorrar(CLAVE_SONDA);
      return;
    }

    if (sonda) {
      // La prueba falló: el corte se reabre (misma episodio, sin aviso nuevo)
      await this.abrirCorte(falloIa === 'ERROR' ? 'ERRORES' : falloIa);
      return;
    }

    if (falloIa === 'ERROR') {
      const n = await this.kvIncrementar(CLAVE_FALLOS_ERROR);
      if (n >= UMBRAL_ERROR) await this.abrirCorte('ERRORES');
      return;
    }

    const n = await this.kvIncrementar(CLAVE_FALLOS_SALDO);
    if (n >= UMBRAL_SALDO_CLAVE) await this.abrirCorte(falloIa);
  }

  private async abrirCorte(causa: CausaCorte): Promise<void> {
    const minutos = await this.obtenerCorteMin();
    const estado: EstadoCorte = { causa, hastaMs: Date.now() + minutos * 60_000 };
    await this.kvEscribir(CLAVE_CORTE, JSON.stringify(estado));
    await this.kvBorrar(CLAVE_SONDA);
    // Un solo aviso por episodio: el NX lo garantiza aunque haya varias instancias
    if (await this.kvCrearSiNoExiste(CLAVE_AVISO_CAIDA, '1')) {
      const saldoOClave = causa === 'SALDO' || causa === 'CLAVE';
      await this.avisarAdmin(
        'VOUCHER_IA_CAIDA',
        'Lectura de vouchers con IA en pausa',
        saldoOClave
          ? 'Sin saldo o clave inválida en OpenAI. Los vouchers se guardan y Caja los revisa a mano.'
          : 'OpenAI no responde o devuelve errores. Los vouchers se guardan y Caja los revisa a mano.',
        `voucher-ia-caida:${Date.now()}`,
      );
    }
  }

  private async cerrarCorte(): Promise<void> {
    await this.kvBorrar(CLAVE_CORTE);
    await this.kvBorrar(CLAVE_FALLOS_SALDO);
    await this.kvBorrar(CLAVE_FALLOS_ERROR);
    await this.kvBorrar(CLAVE_SONDA);
    // Solo quien borra la clave de aviso notifica la recuperación: una sola vez por episodio
    if ((await this.kvBorrar(CLAVE_AVISO_CAIDA)) > 0) {
      await this.avisarAdmin(
        'VOUCHER_IA_RECUPERADA',
        'Lectura de vouchers con IA recuperada',
        'OpenAI volvió a responder. La lectura automática de vouchers se reanudó.',
        `voucher-ia-recuperada:${Date.now()}`,
      );
    }
  }

  private async leerCorte(): Promise<EstadoCorte | null> {
    const crudo = await this.kvLeer(CLAVE_CORTE);
    if (!crudo) return null;
    try {
      const estado = JSON.parse(crudo) as EstadoCorte;
      return typeof estado?.hastaMs === 'number' ? estado : null;
    } catch {
      return null;
    }
  }

  private async obtenerCorteMin(): Promise<number> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: 'voucher_ia_corte_min' } });
      const n = Number(p?.valor);
      return Number.isFinite(n) && n > 0 ? n : CORTE_MIN_DEFECTO;
    } catch {
      return CORTE_MIN_DEFECTO;
    }
  }

  /** Notifica a la campana (rol ADMIN) y, si las alertas están activas, al WhatsApp de los administradores. */
  private async avisarAdmin(tipo: string, titulo: string, mensaje: string, claveWhatsapp: string): Promise<void> {
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo,
          rol_destino: 'ADMIN',
          titulo,
          mensaje,
          enlace: '/admin/configuracion',
        },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err: any) {
      this.logger.error(`No se pudo crear el aviso de vouchers con IA: ${err.message}`);
    }
    try {
      await this.avisosInternos.enviarAvisoAdmin(titulo, mensaje, '/admin/configuracion', undefined, claveWhatsapp, {
        sinCampana: true,
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo enviar el aviso de vouchers con IA por WhatsApp: ${err.message}`);
    }
  }

  // --- Almacén del corte: Redis; si Redis no responde, memoria del proceso. Nunca lanza. ---

  private memLeer(clave: string): string | null {
    const e = this.memoria.get(clave);
    if (!e) return null;
    if (e.expiraMs !== null && Date.now() >= e.expiraMs) {
      this.memoria.delete(clave);
      return null;
    }
    return e.valor;
  }

  private memEscribir(clave: string, valor: string, ttlSeg?: number): void {
    this.memoria.set(clave, { valor, expiraMs: ttlSeg ? Date.now() + ttlSeg * 1000 : null });
  }

  private async kvLeer(clave: string): Promise<string | null> {
    try {
      return await this.redisService.obtenerCliente().get(clave);
    } catch (err: any) {
      this.logger.warn(`Redis no disponible para el corte de vouchers con IA: ${err.message}`);
      return this.memLeer(clave);
    }
  }

  private async kvEscribir(clave: string, valor: string, ttlSeg?: number): Promise<void> {
    try {
      const redis = this.redisService.obtenerCliente();
      if (ttlSeg) await redis.set(clave, valor, 'EX', ttlSeg);
      else await redis.set(clave, valor);
    } catch {
      this.memEscribir(clave, valor, ttlSeg);
    }
  }

  /** SET NX: true solo si la clave no existía. */
  private async kvCrearSiNoExiste(clave: string, valor: string, ttlSeg?: number): Promise<boolean> {
    try {
      const redis = this.redisService.obtenerCliente();
      const res = ttlSeg
        ? await redis.set(clave, valor, 'EX', ttlSeg, 'NX')
        : await redis.set(clave, valor, 'NX');
      return res === 'OK';
    } catch {
      if (this.memLeer(clave) !== null) return false;
      this.memEscribir(clave, valor, ttlSeg);
      return true;
    }
  }

  private async kvIncrementar(clave: string): Promise<number> {
    try {
      return await this.redisService.obtenerCliente().incr(clave);
    } catch {
      const n = Number(this.memLeer(clave) ?? 0) + 1;
      this.memEscribir(clave, String(n));
      return n;
    }
  }

  /** Devuelve cuántas claves borró (0 o 1). */
  private async kvBorrar(clave: string): Promise<number> {
    try {
      return await this.redisService.obtenerCliente().del(clave);
    } catch {
      const existia = this.memLeer(clave) !== null ? 1 : 0;
      this.memoria.delete(clave);
      return existia;
    }
  }
}
