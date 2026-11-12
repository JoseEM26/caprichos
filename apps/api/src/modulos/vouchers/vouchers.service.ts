import { esSoloMozo, rolEfectivoMozo } from '../acceso/roles-usuario';
import { totalCobrable } from '../propinas/propinas.util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { mismoCliente, pedidoAceptaVoucher, ultimos9 } from './voucher-reasignacion.util';
import { puedeCambiarVoucher, puedeSubirVoucher } from './regla-cambio-voucher';
import { ArchivosService } from '../archivos/archivos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { obtenerFechaHoraLima } from '../local/local.util';
import { VouchersIaService } from './vouchers-ia.service';
import { esComprobanteElegible, validarDocumentoComprobante } from '../comprobantes/comprobantes.util';
import {
  montoDeMedioDigital,
  mediosDigitalesDelPedido,
  montoDigitalDePlan,
  montoEsperadoVoucher,
  PagoPlanService,
  PlanPagoItem,
} from '../pedidos/pago-plan.service';
import {
  avisosMozo,
  calcularSemaforo,
  ContextoSemaforo,
  DatosVoucherExtraidos,
  ResultadoSemaforo,
} from './semaforo.util';

export interface SubirVoucherOpciones {
  pedidoId?: string | number | bigint;
  medio?: 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'TARJETA';
  origen?: 'MOZO' | 'WHATSAPP' | 'CAJA' | 'CARTA' | 'REPARTIDOR';
  /** Plan que se espera en vez del guardado en el pedido (cambio de cobro en la puerta: aún no está aprobado). */
  planEsperado?: PlanPagoItem[];
  /** Obligatorio (≥5 caracteres) para CAJERO/ADMIN cuando reemplaza un voucher vigente. */
  motivoCambio?: string;
}

/** Medios que el mozo puede enviar a Caja desde la mesa. */
const MEDIOS_ENVIO_CAJA = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'] as const;
/** Medios que llevan captura (voucher o foto de la copia del POS): no son solo efectivo. */
export const MEDIOS_CON_VOUCHER_CAJA = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

/** Lo que el mozo elige al enviar a Caja: vuelto (efectivo) y comprobante (boleta o factura, obligatorio). */
export interface EnviarACajaOpciones {
  recibido?: unknown;
  comprobante?: { tipo?: unknown; doc?: unknown; razon?: unknown; direccion?: unknown };
  /** Casilla única «ya hablé con el cliente y pagó (sin captura)»: sustituye a la foto en pedidos del local. */
  confirmaSinCaptura?: unknown;
}
const NOMBRE_MEDIO_CAJA: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly archivosService: ArchivosService,
    private readonly auditoria: AuditoriaService,
    private readonly vouchersIaService: VouchersIaService,
    private readonly pagoPlan: PagoPlanService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'Identificador no válido',
      });
    }
  }

  /**
   * Obtiene los parámetros operativos para la comparación del semáforo.
   */
  /**
   * Avisa a Caja/Cocina/Mozo (sala admin) que cambió algo del voucher o del plan de pago de un pedido.
   * Se llama SIEMPRE después de guardar. Payload mínimo: pedidoIds, código y qué cambió.
   * motivo: subido | reemplazado | quitado | reasignado | revisado | plan | enviado_caja
   */
  private avisarVoucher(pedidoIds: Array<bigint | string | number>, motivo: string, codigo?: string | null, origen?: string) {
    const ids = pedidoIds.filter((i) => i != null).map((i) => i.toString());
    if (ids.length === 0) return;
    this.eventos?.emitirAdmin('vouchers:actualizado', { pedidoIds: ids, codigo: codigo ?? undefined, motivo, origen });
  }

  async obtenerParametrosConfiguracion(): Promise<{
    titularEsperado: string;
    yapeNumeroEsperado: string;
    plinNumeroEsperado: string;
  }> {
    const params = await this.prisma.parametro.findMany({
      where: {
        clave: {
          in: ['voucher_titular_nombre', 'voucher_yape_numero', 'voucher_plin_numero'],
        },
      },
    });

    const mapa = new Map(params.map((p) => [p.clave, p.valor]));

    const titularRaw = mapa.get('voucher_titular_nombre');
    const yapeRaw = mapa.get('voucher_yape_numero');
    const plinRaw = mapa.get('voucher_plin_numero');

    return {
      titularEsperado: titularRaw ? String(titularRaw).replace(/^"|"$/g, '').trim() : 'Maria Jose Morillo Ruiz',
      yapeNumeroEsperado: yapeRaw ? String(yapeRaw).replace(/^"|"$/g, '').trim() : '977503006',
      plinNumeroEsperado: plinRaw ? String(plinRaw).replace(/^"|"$/g, '').trim() : '977503006',
    };
  }

  /**
   * Sube un archivo de voucher en privado, lo analiza con IA, evalúa el semáforo y lo guarda.
   */
  async subirYProcesar(
    file: Express.Multer.File | undefined,
    opciones: SubirVoucherOpciones,
    usuario: UsuarioAutenticado | null,
    ip?: string,
  ) {
    if (!file || !file.buffer) {
      throw new HttpException(
        { codigo: 'ARCHIVO_REQUERIDO', mensaje: 'Debes proporcionar un archivo de imagen de voucher' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Obtener pedido si aplica (antes de guardar nada: un pedido inexistente o un cambio bloqueado no deja archivos huérfanos)
    let pedido: any = null;
    let pedidoIdBigInt: bigint | null = null;
    if (opciones.pedidoId) {
      pedidoIdBigInt = this.parsearId(opciones.pedidoId);
      pedido = await this.prisma.pedido.findUnique({
        where: { id: pedidoIdBigInt },
        select: {
          id: true,
          codigo: true,
          total: true,
          monto_credito: true,
          pago_preferido: true,
          pago_metodo: true,
          estado: true,
          modalidad: true,
          pago_estado: true,
          pago_coordinado_en: true,
          propina: true,
          planPago: { select: { medio: true, monto: true } },
        },
      });
      if (!pedido) {
        throw new HttpException(
          { codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 2. Cambio de voucher: si el pedido ya tiene uno vigente, subir otro lo reemplaza (el anterior se marca, no se borra).
    // Solo aplica a subidas con usuario; la carta y WhatsApp siguen agregando como antes.
    const motivoCambio = opciones.motivoCambio?.trim() || null;
    // Un voucher por medio digital: la captura de Plin no reemplaza la de Yape
    const vigentesReemplazados: { id: bigint }[] =
      pedidoIdBigInt && usuario
        ? (await this.prisma.voucherPago.findMany({
            where: { pedido_id: pedidoIdBigInt, reemplazado_en: null, ...(opciones.medio ? { medio: opciones.medio } : {}) },
            orderBy: { creado_en: 'desc' },
            select: { id: true },
          })) ?? []
        : [];
    if (usuario && pedido) {
      // Primer voucher: puedeSubirVoucher. Reemplazo: puedeCambiarVoucher. Mismo criterio que quitar.
      const esReemplazo = vigentesReemplazados.length > 0;
      const permitido = esReemplazo
        ? puedeCambiarVoucher(pedido, rolEfectivoMozo(usuario))
        : puedeSubirVoucher(pedido, rolEfectivoMozo(usuario));
      if (!permitido) {
        throw new HttpException(
          {
            codigo: 'VOUCHER_CAMBIO_BLOQUEADO',
            mensaje:
              esSoloMozo(usuario)
                ? 'Caja ya aprobó el pago de este pedido; pide a Caja que cambie el voucher'
                : 'El pago ya está cobrado; no se puede cambiar el voucher',
          },
          HttpStatus.CONFLICT,
        );
      }
    }
    if (usuario && pedido && vigentesReemplazados.length > 0) {
      const faltaMotivo = !esSoloMozo(usuario) && !motivoCambio;
      if (faltaMotivo || (motivoCambio && motivoCambio.length < 5)) {
        throw new HttpException(
          { codigo: 'MOTIVO_CAMBIO_REQUERIDO', mensaje: 'Escribe el motivo del cambio (mínimo 5 caracteres)' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // 3. Guardar archivo en almacenamiento privado
    const archivoSubido = await this.archivosService.subirArchivo(file, true, usuario ?? undefined, ip);
    const archivoId = BigInt(archivoSubido.id);

    // 4. Calcular SHA256 del contenido de la imagen
    const hashImagen = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 4. Parámetros de validación y fecha de Lima
    const config = await this.obtenerParametrosConfiguracion();
    const { fechaIso } = obtenerFechaHoraLima();

    // 5. Análisis con IA de Visión (reutilizando client / token / config). Sin usuario (carta) se limita por IP.
    // Tarjeta: la copia del POS no se lee con IA (el validador es de Yape/Plin); basta la foto, queda SIN_LECTURA
    const analisisIa =
      opciones.medio === 'TARJETA'
        ? { extraido: null, sinLectura: true }
        : await this.vouchersIaService.analizarVoucher(
            file.buffer,
            file.mimetype,
            {
              identificadorRateLimit: usuario?.partyId?.toString() ?? ip ?? null,
            },
          );

    const extraido: DatosVoucherExtraidos | null = analisisIa.extraido;

    // 6. Detección de duplicados
    let hashDuplicado = false;
    let operacionDuplicada = false;

    if (hashImagen) {
      const existentePorHash = await this.prisma.voucherPago.findFirst({
        where: {
          hash_imagen: hashImagen,
          ...(pedidoIdBigInt ? { pedido_id: { not: pedidoIdBigInt } } : {}),
        },
      });
      if (existentePorHash) hashDuplicado = true;
    }

    if (extraido?.operacion) {
      const opLimpia = extraido.operacion.trim();
      const existentePorOp = await this.prisma.voucherPago.findFirst({
        where: {
          operacion: opLimpia,
          ...(pedidoIdBigInt ? { pedido_id: { not: pedidoIdBigInt } } : {}),
        },
      });
      if (existentePorOp) operacionDuplicada = true;
    }

    // 7. Evaluar semáforo con función pura
    const planDelPedido = opciones.planEsperado ?? pedido?.planPago;
    const contexto: ContextoSemaforo = {
      // Con medio: se compara contra el renglón de ESE medio del plan; sin medio, contra la parte digital total
      pedidoTotal: pedido
        ? opciones.medio && planDelPedido?.length
          ? montoDeMedioDigital(planDelPedido, opciones.medio) || null
          : montoEsperadoVoucher(planDelPedido, pedido.total != null ? totalCobrable(pedido) : null)
        : null,
      medioEsperado: opciones.medio || (pedido?.pago_preferido as any) || (pedido?.pago_metodo as any) || null,
      titularEsperado: config.titularEsperado,
      yapeNumeroEsperado: config.yapeNumeroEsperado,
      plinNumeroEsperado: config.plinNumeroEsperado,
      fechaActual: fechaIso,
      operacionDuplicada,
      hashDuplicado,
      sinLectura: analisisIa.sinLectura,
    };

    const evaluacion: ResultadoSemaforo = calcularSemaforo(extraido, contexto);

    const origen = opciones.origen || ((usuario ? esSoloMozo(usuario) : false) ? 'MOZO' : usuario ? 'CAJA' : 'CARTA');

    // 8. Guardar registro en la tabla voucher_pago (siempre, sea cual sea la lectura de la IA)
    const voucher = await this.prisma.voucherPago.create({
      data: {
        pedido_id: pedidoIdBigInt,
        archivo_id: archivoId,
        origen,
        medio: opciones.medio || extraido?.medioDetectado || null,
        subido_por: usuario?.partyId ?? null,
        hash_imagen: hashImagen,
        operacion: extraido?.operacion ? extraido.operacion.trim() : null,
        extraido: extraido as any,
        semaforo: evaluacion.semaforo,
        motivos: evaluacion.motivos,
        reemplaza_a: vigentesReemplazados[0]?.id ?? null,
        motivo_cambio: vigentesReemplazados.length > 0 ? motivoCambio : null,
      },
    });

    // 9. Marcar los anteriores como reemplazados (no se borran: quedan en el historial)
    if (usuario && vigentesReemplazados.length > 0) {
      const ahora = new Date();
      const idsReemplazados = vigentesReemplazados.map((v) => v.id);
      await this.prisma.voucherPago.updateMany({
        where: { id: { in: idsReemplazados }, reemplazado_en: null },
        data: { reemplazado_en: ahora, reemplazado_por: usuario.partyId },
      });
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'vouchers',
        accion: 'REEMPLAZAR_VOUCHER',
        resultado: 'OK',
        entidad: 'voucher_pago',
        entidadId: voucher.id,
        partyId: usuario.partyId,
        ip,
        antes: { vouchersReemplazados: idsReemplazados.map((v) => v.toString()) },
        despues: {
          pedidoId: pedidoIdBigInt ? pedidoIdBigInt.toString() : null,
          medio: opciones.medio ?? null,
          motivo: motivoCambio,
          rol: usuario.rol,
          reemplazaA: vigentesReemplazados[0]?.id.toString() ?? null,
        },
      });
    }

    if (pedidoIdBigInt) {
      this.avisarVoucher([pedidoIdBigInt], vigentesReemplazados.length ? 'reemplazado' : 'subido', pedido?.codigo, origen);
    }

    // 10. Registrar auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'SUBIR',
      resultado: 'OK',
      entidad: 'voucher_pago',
      entidadId: voucher.id,
      partyId: usuario?.partyId,
      ip,
      despues: {
        pedidoId: pedidoIdBigInt ? pedidoIdBigInt.toString() : null,
        medio: voucher.medio,
        semaforo: voucher.semaforo,
        origen,
      },
    });

    // 11. Respuesta según el rol:
    // Al mozo y al cliente de la carta SOLO se entrega legible y mensaje, NUNCA el semáforo ni los datos extraídos
    // legible sigue la misma regla que el cobro: un ILEGIBLE (aunque la IA lo lea) no cuenta como comprobante
    if (!usuario || esSoloMozo(usuario)) {
      const legible = voucher.semaforo !== 'ILEGIBLE';
      return {
        id: voucher.id.toString(),
        legible,
        ...(voucher.semaforo === 'ILEGIBLE'
          ? { mensaje: 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.' }
          : {}),
        // Solo al mozo (la carta no lo recibe): lectura automática no disponible, Caja lo revisa a mano
        ...(usuario ? { revisionManual: voucher.semaforo === 'SIN_LECTURA' } : {}),
        // Avisos en texto de lo que no cuadra; sin lectura de IA no hay avisos
        ...(usuario ? { avisos: legible ? avisosMozo(extraido, contexto) : [] } : {}),
      };
    }

    // Para Cajero y Administrador: respuesta completa
    return {
      id: voucher.id.toString(),
      legible: voucher.semaforo !== 'ILEGIBLE',
      semaforo: voucher.semaforo,
      motivos: voucher.motivos,
      extraido: voucher.extraido,
    };
  }

  /**
   * Registra y analiza en segundo plano un comprobante recibido por WhatsApp.
   * Sin bloquear ni cambiar la respuesta del bot.
   */
  async registrarDesdeWhatsapp(
    buffer: Buffer,
    mimeType: string,
    archivoId: bigint | string,
    pedido: any,
    conversacion: any,
    mensajeId?: bigint | string,
  ): Promise<void> {
    try {
      const archivoIdBigInt = typeof archivoId === 'bigint' ? archivoId : BigInt(archivoId);
      const pedidoIdBigInt = pedido?.id ? BigInt(pedido.id) : null;
      const conversacionIdBigInt = conversacion?.id ? BigInt(conversacion.id) : null;
      const mensajeIdBigInt = mensajeId ? BigInt(mensajeId) : null;

      // SHA256
      const hashImagen = crypto.createHash('sha256').update(buffer).digest('hex');

      // Configuración y fecha
      const config = await this.obtenerParametrosConfiguracion();
      const { fechaIso } = obtenerFechaHoraLima();

      // Análisis con IA de Visión
      const analisisIa = await this.vouchersIaService.analizarVoucher(buffer, mimeType, {
        conversacionId: conversacionIdBigInt,
        identificadorRateLimit: conversacion?.telefono,
      });

      const extraido = analisisIa.extraido;

      // Duplicados
      let hashDuplicado = false;
      let operacionDuplicada = false;

      if (hashImagen) {
        const existente = await this.prisma.voucherPago.findFirst({
          where: {
            hash_imagen: hashImagen,
            ...(pedidoIdBigInt ? { pedido_id: { not: pedidoIdBigInt } } : {}),
          },
        });
        if (existente) hashDuplicado = true;
      }

      if (extraido?.operacion) {
        const opLimpia = extraido.operacion.trim();
        const existenteOp = await this.prisma.voucherPago.findFirst({
          where: {
            operacion: opLimpia,
            ...(pedidoIdBigInt ? { pedido_id: { not: pedidoIdBigInt } } : {}),
          },
        });
        if (existenteOp) operacionDuplicada = true;
      }

      // Pago dividido: cada captura va a un medio digital del plan que aún no tenga voucher vigente
      let medioDelPlan: string | null = null;
      const digitales = mediosDigitalesDelPedido(pedido?.planPago, null, 0);
      if (pedidoIdBigInt && digitales.length > 1) {
        const vigentes = await this.prisma.voucherPago.findMany({
          where: { pedido_id: pedidoIdBigInt, reemplazado_en: null },
          select: { medio: true },
        });
        const usados = new Set(vigentes.map((v) => v.medio));
        medioDelPlan = (digitales.find((d) => !usados.has(d.medio)) ?? digitales[0]).medio;
      }
      const medioEsperado = medioDelPlan || (pedido?.pago_preferido as any) || (pedido?.pago_metodo as any) || null;

      const contexto: ContextoSemaforo = {
        pedidoTotal: pedido
          ? medioDelPlan
            ? montoDeMedioDigital(pedido.planPago, medioDelPlan) || null
            : montoEsperadoVoucher(pedido.planPago, pedido.total != null ? totalCobrable(pedido) : null)
          : null,
        medioEsperado,
        titularEsperado: config.titularEsperado,
        yapeNumeroEsperado: config.yapeNumeroEsperado,
        plinNumeroEsperado: config.plinNumeroEsperado,
        fechaActual: fechaIso,
        operacionDuplicada,
        hashDuplicado,
        sinLectura: analisisIa.sinLectura,
      };

      const evaluacion = calcularSemaforo(extraido, contexto);

      const voucher = await this.prisma.voucherPago.create({
        data: {
          pedido_id: pedidoIdBigInt,
          conversacion_id: conversacionIdBigInt,
          mensaje_id: mensajeIdBigInt,
          archivo_id: archivoIdBigInt,
          origen: 'WHATSAPP',
          medio: medioEsperado || extraido?.medioDetectado || null,
          hash_imagen: hashImagen,
          operacion: extraido?.operacion ? extraido.operacion.trim() : null,
          extraido: extraido as any,
          semaforo: evaluacion.semaforo,
          motivos: evaluacion.motivos,
        },
      });

      this.logger.log(
        `Voucher de WhatsApp registrado (id: ${voucher.id}, semáforo: ${voucher.semaforo}) para pedido ${pedido?.codigo || 'N/A'}`,
      );

      if (pedidoIdBigInt) this.avisarVoucher([pedidoIdBigInt], 'subido', pedido?.codigo, 'WHATSAPP');

      // Si queda ILEGIBLE: crear notificación de campana para Caja y emitir actualización
      if (evaluacion.semaforo === 'ILEGIBLE') {
        const notif = await this.prisma.notificacion.create({
          data: {
            tipo: 'VOUCHER_ILEGIBLE',
            rol_destino: 'CAJERO',
            titulo: 'Voucher no legible recibido',
            mensaje: `El voucher enviado para el pedido ${pedido?.codigo || ''} no se lee bien. Pide al cliente que envíe otra foto.`,
            enlace: '/admin/mensajes',
          },
        });

        this.eventos?.emitirAdmin('notificaciones:nueva', {
          id: notif.id.toString(),
          titulo: notif.titulo,
        });
      }

      // Emitir evento para refrescar la consola de mensajes en tiempo real
      if (conversacionIdBigInt) {
        this.eventos?.emitirAdmin('mensajes:actualizado', {
          id: conversacionIdBigInt.toString(),
        });
      }
    } catch (err: any) {
      this.logger.error(`Error procesando voucher desde WhatsApp en segundo plano: ${err.message}`);
    }
  }

  /**
   * Lista vouchers filtrados por pedidoId, conversacionId, fecha o estado (pendientes|todos).
   */
  async listar(filtros: {
    pedidoId?: string;
    conversacionId?: string;
    fecha?: string;
    estado?: 'pendientes' | 'todos' | string;
  }) {
    // Solo vouchers vigentes: los reemplazados quedan en el historial del pedido, no en las listas de decisión
    const where: any = { reemplazado_en: null };

    if (filtros.pedidoId) {
      where.pedido_id = this.parsearId(filtros.pedidoId);
    }

    if (filtros.conversacionId) {
      where.conversacion_id = this.parsearId(filtros.conversacionId);
    }

    if (filtros.fecha) {
      const f = filtros.fecha.trim();
      const inicio = new Date(`${f}T00:00:00.000Z`);
      const fin = new Date(`${f}T23:59:59.999Z`);
      where.creado_en = { gte: inicio, lte: fin };
    }

    if (filtros.estado === 'pendientes') {
      where.revisado_en = null;
    }

    const vouchers = await this.prisma.voucherPago.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      include: {
        pedido: {
          select: {
            id: true,
            codigo: true,
            total: true,
            cliente_nombre: true,
            cliente_telefono: true,
            estado: true,
            pago_estado: true,
            modalidad: true,
          },
        },
        // Voucher huérfano (llegó por chat sin pedido): el teléfono sale de la conversación
        conversacion: { select: { telefono: true } },
      },
    });
    const nombresSubio = await this.nombresCortos(vouchers.filter((v) => v.subido_por).map((v) => v.subido_por as bigint));

    // Contar cuántos faltan revisar si se consulta por fecha
    let faltanRevisar = 0;
    if (filtros.fecha) {
      const f = filtros.fecha.trim();
      faltanRevisar = await this.prisma.voucherPago.count({
        where: {
          reemplazado_en: null,
          creado_en: {
            gte: new Date(`${f}T00:00:00.000Z`),
            lte: new Date(`${f}T23:59:59.999Z`),
          },
          revisado_en: null,
        },
      });
    }

    const items = vouchers.map((v) => ({
      id: v.id.toString(),
      pedidoId: v.pedido_id ? v.pedido_id.toString() : null,
      pedidoCodigo: v.pedido?.codigo || null,
      pedidoTotal: v.pedido?.total ? v.pedido.total.toString() : null,
      clienteNombre: v.pedido?.cliente_nombre || null,
      clienteTelefono: v.pedido?.cliente_telefono || v.conversacion?.telefono || null,
      pedidoEstado: v.pedido?.estado ?? null,
      pedidoPagoEstado: v.pedido?.pago_estado ?? null,
      pedidoModalidad: v.pedido?.modalidad ?? null,
      subidoPorNombre: v.subido_por ? nombresSubio.get(v.subido_por.toString()) || null : null,
      conversacionId: v.conversacion_id ? v.conversacion_id.toString() : null,
      mensajeId: v.mensaje_id ? v.mensaje_id.toString() : null,
      archivoId: v.archivo_id.toString(),
      origen: v.origen,
      medio: v.medio,
      subidoPor: v.subido_por ? v.subido_por.toString() : null,
      hashImagen: v.hash_imagen,
      operacion: v.operacion,
      extraido: v.extraido,
      semaforo: v.semaforo,
      motivos: v.motivos,
      revisadoEn: v.revisado_en ? v.revisado_en.toISOString() : null,
      revisadoPor: v.revisado_por ? v.revisado_por.toString() : null,
      creadoEn: v.creado_en.toISOString(),
    }));

    return {
      vouchers: items,
      faltanRevisar,
      total: items.length,
    };
  }

  /**
   * El mozo no tiene la foto de un pago digital: avisa a Caja (no tiene excepción propia para cobrar sin foto).
   */
  async avisarFaltaVoucher(pedidoId: string, usuario: UsuarioAutenticado, ip?: string) {
    const id = this.parsearId(pedidoId);
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, select: { id: true, codigo: true } });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }

    const notif = await this.prisma.notificacion.create({
      data: {
        tipo: 'VOUCHER_PENDIENTE_MOZO',
        rol_destino: 'CAJERO',
        titulo: 'Pago digital sin foto del voucher',
        mensaje: `El mozo avisa que el pedido ${pedido.codigo} se paga digital y aún no tiene la foto del voucher. Pide la foto antes de cobrar.`,
        enlace: '/admin/caja',
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: notif.titulo });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'AVISO_SIN_FOTO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario.partyId,
      ip,
      despues: { pedidoId: pedido.id.toString() },
    });

    return { ok: true };
  }

  /**
   * El mozo envía a Caja el cobro de la mesa (plan de pago, vuelto y comprobante). No cobra: Caja revisa y cobra.
   * - Efectivo: «Pagó con» (recibido) no puede ser menor que lo que va en efectivo; se guarda para el vuelto.
   * - Comprobante: boleta o factura obligatoria. El mozo no lo emite: Caja lo emite al cobrar.
   * - Tarjeta y medios digitales llevan captura: un voucher vigente y legible ya cubre el aviso.
   * Sin `plan` se usa solo `medio` (forma anterior) y no se toca el plan guardado.
   * Al mozo solo se le responde ok: nunca el semáforo ni los datos del voucher.
   */
  async enviarACaja(
    pedidoId: string,
    medio: string,
    usuario: UsuarioAutenticado,
    ip?: string,
    plan?: unknown,
    opciones: EnviarACajaOpciones = {},
  ) {
    if (plan != null && !Array.isArray(plan)) {
      throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'El plan de pago debe ser una lista de medios y montos' });
    }
    const conPlan = Array.isArray(plan) && plan.length > 0;
    let medioNormalizado = String(medio || '').trim().toUpperCase();
    if (!conPlan && !MEDIOS_ENVIO_CAJA.includes(medioNormalizado as (typeof MEDIOS_ENVIO_CAJA)[number])) {
      throw new BadRequestException({ codigo: 'MEDIO_INVALIDO', mensaje: 'Elige Efectivo, Yape, Plin, Tarjeta o Transferencia' });
    }
    const id = this.parsearId(pedidoId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        total: true,
        monto_credito: true,
        propina: true,
        pago_estado: true,
        canal: true,
        modalidad: true,
        comprobante_tipo: true,
        comprobante_doc: true,
        comprobante_razon: true,
        comprobante_direccion: true,
      },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }
    if (pedido.pago_estado === 'PAGADO') {
      throw new ConflictException({ codigo: 'PEDIDO_YA_PAGADO', mensaje: 'El pedido ya está cobrado' });
    }

    // Pago dividido: el plan debe sumar el total del pedido (lo valida PagoPlanService)
    const planValidado = conPlan ? this.pagoPlan.validar(plan as PlanPagoItem[], totalCobrable(pedido)) : null;
    const desglose = planValidado
      ? planValidado.map((f) => `${NOMBRE_MEDIO_CAJA[f.medio]} S/ ${f.monto.toFixed(2)}`).join(' · ')
      : null;
    if (planValidado) medioNormalizado = this.pagoPlan.pagoPrincipal(planValidado);

    // Validaciones antes de tocar nada: efectivo recibido y comprobante elegido
    const montoEfectivo = planValidado
      ? planValidado.filter((f) => f.medio === 'EFECTIVO').reduce((acc, f) => acc + f.monto, 0)
      : medioNormalizado === 'EFECTIVO'
        ? totalCobrable(pedido)
        : 0;
    const recibido = this.recibidoEfectivo(opciones.recibido, montoEfectivo);
    const comprobante = this.comprobanteDelEnvio(pedido, opciones.comprobante);
    // Una nota de venta emitida antes del cambio de regla (cobro del mozo) bloquea el cambio hasta que Caja la rechace
    const notaVigente = await this.prisma.comprobante.findFirst({
      where: { pedido_id: id, tipo: 'NOTA_VENTA', anulado_en: null },
      select: { id: true },
    });
    if (notaVigente) {
      throw new ConflictException({
        codigo: 'NOTA_YA_EMITIDA',
        mensaje: 'Ya se emitió la nota de venta de este pedido. Pide a Caja que rechace el cobro del mozo antes de cambiar a boleta o factura',
      });
    }

    // Medios que llevan captura: digitales (voucher) y tarjeta (copia del POS, sin lectura IA)
    const mediosConFoto = planValidado
      ? [...new Set(planValidado.map((f) => f.medio))].filter((m) => MEDIOS_CON_VOUCHER_CAJA.includes(m))
      : MEDIOS_CON_VOUCHER_CAJA.includes(medioNormalizado)
        ? [medioNormalizado]
        : [];
    const conVoucher = mediosConFoto.length > 0;
    // Sin la foto vigente (no ILEGIBLE) de cada medio que la lleva, no se envía: nada se guarda ni se avisa
    const sinFoto: string[] = [];
    for (const medio of mediosConFoto) {
      const foto = await this.prisma.voucherPago.findFirst({
        where: {
          pedido_id: id,
          reemplazado_en: null,
          semaforo: { not: 'ILEGIBLE' },
          OR: [{ medio }, { medio: null }],
        },
        select: { id: true },
      });
      if (!foto) sinFoto.push(medio);
    }
    // La foto es opcional en todos los canales y medios: sin ella el envío igual sale a Caja («Pagado sin captura»)
    // y la captura se puede subir después. La casilla solo deja el registro de quién lo confirmó.
    const sinCaptura = sinFoto.length > 0;

    const aviso = sinCaptura
      ? {
          tipo: 'PAGO_SIN_CAPTURA_MOZO',
          titulo: opciones.confirmaSinCaptura === true ? 'Pagado sin captura' : 'Falta captura (opcional)',
          mensaje:
            opciones.confirmaSinCaptura === true
              ? `El mozo confirma que el cliente ya pagó el pedido ${pedido.codigo} (${desglose ?? medioNormalizado}) sin captura. Cuadra con el Excel al cierre.`
              : `El mozo envía el pedido ${pedido.codigo} (${desglose ?? medioNormalizado}) sin captura todavía. No es urgente: se le puede pedir con amabilidad o confirmar el pago en Caja.`,
        }
      : conVoucher
      ? {
          tipo: 'VOUCHER_PENDIENTE_MOZO',
          titulo: 'Voucher listo para revisar',
          mensaje: `El mozo envía el pedido ${pedido.codigo} (${desglose ?? medioNormalizado}) con la foto del voucher. Revísala y cobra.`,
        }
      : {
          tipo: 'PAGO_EFECTIVO_MOZO',
          titulo: 'Mesa paga en efectivo',
          mensaje: `El mozo avisa que el pedido ${pedido.codigo} se paga en efectivo en mesa. Cóbralo en Caja.`,
        };
    if (planValidado && !conVoucher) {
      aviso.mensaje = `${aviso.mensaje} Desglose: ${desglose}.`;
    }

    if (planValidado) {
      await this.prisma.$transaction(async (tx) => {
        await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: id } });
        await this.pagoPlan.guardar(tx, id, planValidado);
        await tx.pedido.update({
          where: { id },
          data: { pago_preferido: medioNormalizado, pago_metodo: medioNormalizado },
        });
      });
    }

    const notif = await this.prisma.notificacion.create({
      data: {
        tipo: aviso.tipo,
        rol_destino: 'CAJERO',
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        enlace: `/admin/caja?pedido=${pedido.id.toString()}`,
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: notif.titulo });
    this.avisarVoucher([pedido.id], 'enviado_caja', pedido.codigo);

    // Marca de cobro del mozo y comprobante elegido. No cambia pago_estado ni la mesa (lo cobra el cajero).
    // Va antes de emitir la nota: la emisión lee el tipo que quedó guardado en el pedido.
    const medioCobro = planValidado
      ? [...new Set(planValidado.map((f) => f.medio))].join('+')
      : medioNormalizado;
    const datosMozo = {
      cobro_mozo_en: new Date(),
      cobro_mozo_medio: medioCobro,
      cobro_mozo_party_id: usuario.partyId,
      cobro_mozo_recibido: recibido,
      comprobante_tipo: comprobante.tipo,
      comprobante_doc: comprobante.doc,
      comprobante_razon: comprobante.razon,
      comprobante_direccion: comprobante.direccion,
    };
    await this.prisma.pedido.update({ where: { id }, data: datosMozo });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'ENVIADO_CAJA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario.partyId,
      ip,
      despues: {
        pedidoId: pedido.id.toString(),
        medio: medioNormalizado,
        comprobante: comprobante.tipo,
        ...(sinCaptura ? { sin_captura: { medios: sinFoto, confirmo: String(usuario.partyId), en: new Date().toISOString() } } : {}),
        ...(recibido != null ? { recibido } : {}),
        ...(desglose ? { plan: desglose } : {}),
      },
    });

    return { ok: true };
  }

  /** Efectivo con el que paga el cliente: null si no hay efectivo o no lo escribieron. Nunca menor que el efectivo. */
  private recibidoEfectivo(raw: unknown, montoEfectivo: number): number | null {
    if (montoEfectivo <= 0 || raw == null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException({ codigo: 'RECIBIDO_INVALIDO', mensaje: 'Escribe con cuánto paga (un número)' });
    }
    if (Math.round(n * 100) < Math.round(montoEfectivo * 100)) {
      throw new BadRequestException({
        codigo: 'EFECTIVO_INSUFICIENTE',
        mensaje: `Con S/ ${n.toFixed(2)} no alcanza: el efectivo es S/ ${montoEfectivo.toFixed(2)}`,
      });
    }
    return Math.round(n * 100) / 100;
  }

  /**
   * Comprobante del envío: el elegido o, si no llega, el que ya guardó el pedido al crearse.
   * Tiene que ser boleta o factura (obligatorio). Boleta: DNI opcional; factura exige RUC y razón social.
   */
  private comprobanteDelEnvio(
    pedido: {
      comprobante_tipo: string | null;
      comprobante_doc: string | null;
      comprobante_razon: string | null;
      comprobante_direccion?: string | null;
      total?: unknown;
    },
    elegido?: EnviarACajaOpciones['comprobante'],
  ): { tipo: string; doc: string | null; razon: string | null; direccion: string | null } {
    const elegidoTipo = String(elegido?.tipo ?? '').trim().toUpperCase();
    const usaElegido = elegidoTipo !== '';
    const tipo = usaElegido ? elegidoTipo : String(pedido.comprobante_tipo ?? '').trim().toUpperCase();
    if (!esComprobanteElegible(tipo)) {
      throw new BadRequestException({ codigo: 'COMPROBANTE_OBLIGATORIO', mensaje: 'Elige comprobante simple, boleta o factura antes de enviar a Caja' });
    }
    if (tipo === 'SIMPLE') return { tipo, doc: null, razon: null, direccion: null };
    const doc = usaElegido ? String(elegido?.doc ?? '').trim() || null : pedido.comprobante_doc?.trim() || null;
    const razon = usaElegido ? String(elegido?.razon ?? '').trim() || null : pedido.comprobante_razon?.trim() || null;
    const direccion = usaElegido ? String(elegido?.direccion ?? '').trim() || null : pedido.comprobante_direccion?.trim() || null;
    // Sin total: el envío a Caja no bloquea la venta por el DNI (la boleta > S/ 700 la exige el cobro)
    const validacion = validarDocumentoComprobante(tipo, doc, razon);
    if (!validacion.valido) {
      throw new BadRequestException({ codigo: 'COMPROBANTE_INVALIDO', mensaje: validacion.motivo });
    }
    return { tipo, doc, razon: tipo === 'FACTURA' ? razon : null, direccion: tipo === 'FACTURA' ? direccion : null };
  }

  /**
   * Marca un voucher como revisado registrando revisado_por, revisado_en y auditoría.
   */
  async marcarRevisado(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const voucherId = this.parsearId(id);

    const voucherExistente = await this.prisma.voucherPago.findUnique({
      where: { id: voucherId },
    });

    if (!voucherExistente) {
      throw new NotFoundException({
        codigo: 'VOUCHER_NO_ENCONTRADO',
        mensaje: 'El voucher especificado no existe',
      });
    }

    const ahora = new Date();
    const actualizado = await this.prisma.voucherPago.update({
      where: { id: voucherId },
      data: {
        revisado_en: ahora,
        revisado_por: usuario.partyId,
      },
    });

    if (actualizado.pedido_id) this.avisarVoucher([actualizado.pedido_id], 'revisado');

    // Registrar en auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'REVISAR',
      resultado: 'OK',
      entidad: 'voucher_pago',
      entidadId: actualizado.id,
      partyId: usuario.partyId,
      ip,
      despues: {
        revisadoEn: ahora.toISOString(),
      },
    });

    return {
      ok: true,
      id: actualizado.id.toString(),
      revisado_en: actualizado.revisado_en?.toISOString() || null,
      revisado_por: actualizado.revisado_por?.toString() || null,
    };
  }

  /**
   * Pedidos del mismo cliente a los que Caja puede mover este voucher. El voucher ya usado para aprobar
   * un pago no se mueve (bloqueado: true).
   */
  async destinosReasignacion(id: string) {
    const voucherId = this.parsearId(id);
    const voucher = await this.prisma.voucherPago.findUnique({ where: { id: voucherId } });
    if (!voucher) {
      throw new NotFoundException({ codigo: 'VOUCHER_NO_ENCONTRADO', mensaje: 'El voucher especificado no existe' });
    }
    const origen = voucher.pedido_id
      ? await this.prisma.pedido.findUnique({ where: { id: voucher.pedido_id } })
      : null;
    const conversacion = voucher.conversacion_id
      ? await this.prisma.conversacion.findUnique({ where: { id: voucher.conversacion_id }, select: { telefono: true } })
      : null;
    const telefonoBase = origen?.cliente_telefono ?? conversacion?.telefono ?? null;
    const fin = ultimos9(telefonoBase);

    const candidatos =
      fin.length === 9
        ? await this.prisma.pedido.findMany({
            where: {
              cliente_telefono: { endsWith: fin },
              estado: { notIn: ['ANULADO', 'ENTREGADO'] },
              pago_estado: 'PENDIENTE',
              es_personal: false,
              ...(origen ? { id: { not: origen.id } } : {}),
            },
            orderBy: { creado_en: 'desc' },
            take: 20,
            select: {
              id: true,
              codigo: true,
              estado: true,
              total: true,
              pago_estado: true,
              pago_preferido: true,
              pago_metodo: true,
              es_personal: true,
              creado_en: true,
            },
          })
        : [];

    const bloqueado = origen ? ['COORDINADO', 'PAGADO'].includes(String(origen.pago_estado)) : false;
    return {
      voucherId: voucher.id.toString(),
      pedidoActual: origen ? { id: origen.id.toString(), codigo: origen.codigo } : null,
      bloqueado,
      destinos: bloqueado
        ? []
        : candidatos
            .filter((p) => pedidoAceptaVoucher(p))
            .map((p) => ({
              id: p.id.toString(),
              codigo: p.codigo,
              total: Number(p.total),
              medio: String(p.pago_preferido || p.pago_metodo || '').toUpperCase(),
              creadoEn: p.creado_en.toISOString(),
            })),
    };
  }

  /**
   * Mueve el voucher a otro pedido del mismo cliente con pago digital pendiente. Solo cambia el comprobante
   * (y el pedido de la conversación si apuntaba al anterior). No aprueba el pago. Con auditoría REASIGNAR_VOUCHER.
   */
  async reasignar(id: string, pedidoId: string, usuario: UsuarioAutenticado, ip?: string) {
    const voucherId = this.parsearId(id);
    const destinoId = this.parsearId(pedidoId);

    const voucher = await this.prisma.voucherPago.findUnique({ where: { id: voucherId } });
    if (!voucher) {
      throw new NotFoundException({ codigo: 'VOUCHER_NO_ENCONTRADO', mensaje: 'El voucher especificado no existe' });
    }
    const destino = await this.prisma.pedido.findUnique({ where: { id: destinoId } });
    if (!destino) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido destino no existe' });
    }
    if (voucher.pedido_id !== null && voucher.pedido_id === destino.id) {
      throw new BadRequestException({ codigo: 'MISMO_PEDIDO', mensaje: 'El voucher ya está en ese pedido' });
    }

    if (voucher.reemplazado_en != null) {
      throw new ConflictException({
        codigo: 'VOUCHER_REEMPLAZADO',
        mensaje: 'Ese voucher fue reemplazado por otro; solo se pueden mover los vigentes',
      });
    }
    const origen = voucher.pedido_id ? await this.prisma.pedido.findUnique({ where: { id: voucher.pedido_id } }) : null;
    if (origen && ['COORDINADO', 'PAGADO'].includes(String(origen.pago_estado))) {
      throw new ConflictException({
        codigo: 'VOUCHER_YA_USADO',
        mensaje: `El pago de ${origen.codigo} ya fue aprobado con este voucher; no se puede mover`,
      });
    }
    if (!pedidoAceptaVoucher(destino)) {
      throw new ConflictException({
        codigo: 'PEDIDO_DESTINO_NO_VALIDO',
        mensaje: `${destino.codigo} no espera un pago digital (pago pendiente, no anulado)`,
      });
    }

    const conversacion = voucher.conversacion_id
      ? await this.prisma.conversacion.findUnique({ where: { id: voucher.conversacion_id } })
      : null;
    const telefonoBase = origen?.cliente_telefono ?? conversacion?.telefono ?? null;
    const mismoTelefono = mismoCliente(destino.cliente_telefono, telefonoBase);
    const otroParty =
      origen?.party_id != null && destino.party_id != null && String(origen.party_id) !== String(destino.party_id);
    if (!mismoTelefono || otroParty) {
      throw new ConflictException({
        codigo: 'CLIENTE_DISTINTO',
        mensaje: 'Solo se puede mover un voucher a un pedido del mismo cliente',
      });
    }

    const flujo = (conversacion?.flujo as any) || {};
    const apuntaAOrigen = origen && String(flujo?.pago?.pedidoId ?? '') === origen.id.toString();

    await this.prisma.$transaction(async (tx) => {
      await tx.voucherPago.update({ where: { id: voucher.id }, data: { pedido_id: destino.id } });
      if (conversacion && apuntaAOrigen) {
        await tx.conversacion.update({
          where: { id: conversacion.id },
          data: {
            flujo: {
              ...flujo,
              pago: {
                ...(flujo.pago || {}),
                pedidoId: destino.id.toString(),
                pedidoCodigo: destino.codigo,
                monto: totalCobrable(destino),
              },
            },
          },
        });
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'REASIGNAR_VOUCHER',
      resultado: 'OK',
      entidad: 'voucher_pago',
      entidadId: voucher.id,
      partyId: usuario.partyId,
      ip,
      antes: { pedidoId: origen ? origen.id.toString() : null, pedidoCodigo: origen?.codigo ?? null },
      despues: { pedidoId: destino.id.toString(), pedidoCodigo: destino.codigo },
    });

    const pedidoIds = [origen?.id, destino.id].filter((x): x is bigint => x != null).map((x) => x.toString());
    this.avisarVoucher(pedidoIds, 'reasignado');
    if (conversacion) this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });

    return {
      ok: true,
      voucherId: voucher.id.toString(),
      pedidoAnterior: origen?.codigo ?? null,
      pedidoNuevo: destino.codigo,
    };
  }

  /**
   * Resumen de consumo de OpenAI exclusivo para origen VOUCHER del mes en curso.
   */
  async obtenerConsumoMesVoucher(fecha = new Date()) {
    return this.vouchersIaService.obtenerConsumoMesVoucher(fecha);
  }

  /**
   * Guarda el plan de pago que armó el mozo ANTES de subir la captura, para que el servidor compare
   * cada captura contra el monto de su medio. Solo mientras el pago no esté aprobado (puedeSubirVoucher).
   * El mozo solo toca sus pedidos. Audita GUARDAR_PLAN_PAGO.
   */
  async guardarPlanMozo(pedidoId: string, plan: unknown, usuario: UsuarioAutenticado, ip?: string) {
    if (!Array.isArray(plan) || plan.length === 0) {
      throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'El plan de pago debe ser una lista de medios y montos' });
    }
    const id = this.parsearId(pedidoId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      select: { id: true, codigo: true, party_id: true, total: true, monto_credito: true, propina: true, estado: true, modalidad: true, pago_metodo: true, pago_estado: true, pago_coordinado_en: true },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }
    if (esSoloMozo(usuario) && (pedido.party_id == null || BigInt(pedido.party_id) !== BigInt(usuario.partyId))) {
      throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Solo puedes cambiar el plan de tus pedidos' });
    }
    if (esSoloMozo(usuario) && !puedeSubirVoucher(pedido, 'MOZO')) {
      throw new ConflictException({ codigo: 'PLAN_BLOQUEADO', mensaje: 'El pago ya fue aprobado; pide a Caja cualquier cambio del plan' });
    }
    const planValidado = this.pagoPlan.validar(plan as PlanPagoItem[], totalCobrable(pedido));
    if (!planValidado) {
      throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'El plan de pago no es válido' });
    }
    const medioPrincipal = this.pagoPlan.pagoPrincipal(planValidado);
    await this.prisma.$transaction(async (tx) => {
      await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: id } });
      await this.pagoPlan.guardar(tx, id, planValidado);
      await tx.pedido.update({
        where: { id },
        data: { pago_preferido: medioPrincipal, pago_metodo: medioPrincipal },
      });
    });
    this.avisarVoucher([pedido.id], 'plan', pedido.codigo);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'GUARDAR_PLAN_PAGO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario.partyId,
      ip,
      despues: { pedidoId: pedido.id.toString(), plan: planValidado.map((f) => `${f.medio} ${f.monto.toFixed(2)}`).join(' · ') },
    });
    return { ok: true, plan: planValidado.map((f) => ({ medio: f.medio, monto: f.monto })) };
  }

  /**
   * Quita un voucher del pedido sin borrarlo: queda retirado en el historial y deja de contar como vigente.
   * Mozo: solo sus pedidos y mientras el pago esté pendiente. Caja/Admin: con motivo ≥5 mientras no esté PAGADO.
   * Audita QUITAR_VOUCHER.
   */
  async quitarVoucher(id: string, motivo: unknown, usuario: UsuarioAutenticado, ip?: string) {
    const voucherId = this.parsearId(id);
    const voucher = await this.prisma.voucherPago.findUnique({
      where: { id: voucherId },
      select: { id: true, pedido_id: true, reemplazado_en: true },
    });
    if (!voucher) {
      throw new NotFoundException({ codigo: 'VOUCHER_NO_ENCONTRADO', mensaje: 'El voucher especificado no existe' });
    }
    if (voucher.reemplazado_en != null) {
      throw new ConflictException({ codigo: 'VOUCHER_YA_RETIRADO', mensaje: 'Ese voucher ya no está vigente' });
    }
    const pedido = voucher.pedido_id
      ? await this.prisma.pedido.findUnique({
          where: { id: voucher.pedido_id },
          select: { id: true, party_id: true, estado: true, modalidad: true, pago_metodo: true, pago_estado: true, pago_coordinado_en: true, total: true, monto_credito: true, propina: true },
        })
      : null;
    if (esSoloMozo(usuario) && (!pedido || pedido.party_id == null || BigInt(pedido.party_id) !== BigInt(usuario.partyId))) {
      throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Solo puedes quitar vouchers de tus pedidos' });
    }
    if (pedido && !puedeCambiarVoucher(pedido, rolEfectivoMozo(usuario))) {
      throw new ConflictException({
        codigo: 'VOUCHER_CAMBIO_BLOQUEADO',
        mensaje:
          esSoloMozo(usuario)
            ? 'Caja ya aprobó el pago de este pedido; pide a Caja que cambie el voucher'
            : 'El pago ya está cobrado; no se puede quitar el voucher',
      });
    }
    const motivoTexto = typeof motivo === 'string' ? motivo.trim() : '';
    if (!esSoloMozo(usuario) && motivoTexto.length < 5) {
      throw new BadRequestException({ codigo: 'MOTIVO_CAMBIO_REQUERIDO', mensaje: 'Escribe el motivo (mínimo 5 caracteres)' });
    }
    const ahora = new Date();
    await this.prisma.voucherPago.updateMany({
      where: { id: voucherId, reemplazado_en: null },
      data: {
        retirado: true,
        reemplazado_en: ahora,
        reemplazado_por: usuario.partyId,
        motivo_cambio: motivoTexto || null,
      },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'QUITAR_VOUCHER',
      resultado: 'OK',
      entidad: 'voucher_pago',
      entidadId: voucherId,
      partyId: usuario.partyId,
      ip,
      antes: { pedidoId: pedido?.id.toString() ?? null },
      despues: { rol: usuario.rol, motivo: motivoTexto || null },
    });
    if (pedido) this.avisarVoucher([pedido.id], 'quitado');
    return { ok: true, id: voucherId.toString() };
  }

  /**
   * Historial de vouchers de un pedido (vigentes y reemplazados), más reciente primero. Nada se borra.
   * El mozo solo ve sus pedidos y, de cada voucher, si es legible: nunca semáforo ni datos extraídos.
   */
  async historialPedido(pedidoId: string, usuario: UsuarioAutenticado) {
    const id = this.parsearId(pedidoId);
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, select: { id: true, party_id: true } });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }
    const esMozo = esSoloMozo(usuario);
    if (esMozo && (pedido.party_id == null || BigInt(pedido.party_id) !== BigInt(usuario.partyId))) {
      throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Solo puedes ver los vouchers de tus pedidos' });
    }

    const vouchers = await this.prisma.voucherPago.findMany({
      where: { pedido_id: id },
      orderBy: { creado_en: 'desc' },
      select: {
        id: true,
        archivo_id: true,
        subido_por: true,
        semaforo: true,
        medio: true,
        creado_en: true,
        reemplazado_en: true,
        retirado: true,
        motivo_cambio: true,
      },
    });

    const nombres = await this.nombresCortos(vouchers.map((v) => v.subido_por).filter((x): x is bigint => x != null));
    return {
      items: vouchers.map((v) => {
        const base = {
          id: v.id.toString(),
          subidoEn: v.creado_en.toISOString(),
          subidoPor: v.subido_por != null ? (nombres.get(v.subido_por.toString()) ?? null) : null,
          medio: v.medio ?? null,
          estado: v.retirado ? 'RETIRADO' : v.reemplazado_en ? 'REEMPLAZADO' : 'VIGENTE',
          reemplazadoEn: v.reemplazado_en ? v.reemplazado_en.toISOString() : null,
          motivoCambio: v.motivo_cambio ?? null,
          legible: v.semaforo !== 'ILEGIBLE',
        };
        return esMozo ? base : { ...base, semaforo: v.semaforo, archivoId: v.archivo_id.toString() };
      }),
    };
  }

  /** «Nombre I.» de cada party (para el historial). Sin datos de identidad más allá del nombre corto. */
  private async nombresCortos(partyIds: bigint[]): Promise<Map<string, string>> {
    const unicos = [...new Set(partyIds.map((x) => x.toString()))].map((x) => BigInt(x));
    if (unicos.length === 0) return new Map();
    const personas = await this.prisma.person.findMany({
      where: { party_id: { in: unicos } },
      select: { party_id: true, nombres: true, apellidos: true },
    });
    return new Map(
      personas.map((p) => {
        const nombre = p.nombres.trim().split(/\s+/)[0] ?? '';
        const inicial = p.apellidos?.trim() ? `${p.apellidos.trim()[0]}.` : '';
        return [p.party_id.toString(), `${nombre} ${inicial}`.trim()];
      }),
    );
  }

  /** Estado de la lectura con IA para la franja de Caja (pausa por saldo/clave y tope mensual). */
  async estadoIa() {
    return this.vouchersIaService.estadoIa();
  }
}
