import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { IaConsumoService } from '../chatbot/ia/ia-consumo.service';
import { DatosVoucherExtraidos } from './semaforo.util';

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

@Injectable()
export class VouchersIaService {
  private readonly logger = new Logger(VouchersIaService.name);
  private readonly apiKey: string;
  private readonly visionModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly iaConsumoService: IaConsumoService,
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
   * - Nunca registra el contenido de la imagen en logs.
   * - Registra el consumo con origen 'VOUCHER' sin corte por tope mensual.
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

    // 5. Preparar llamada a OpenAI Vision con timeout de 20 segundos
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
        throw new Error(`OpenAI Vision error [${res.status}]: ${errText}`);
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

      return {
        sinLectura: false,
        extraido,
      };
    } catch (err: any) {
      // NUNCA loguear la imagen base64
      this.logger.error(`Error en análisis de voucher con IA: ${err.message}`);
      return {
        sinLectura: true,
        extraido: null,
        motivo: err.message,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
