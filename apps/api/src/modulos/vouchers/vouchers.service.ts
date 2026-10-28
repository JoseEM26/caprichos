import {
  BadRequestException,
  ConflictException,
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
import { ArchivosService } from '../archivos/archivos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { obtenerFechaHoraLima } from '../local/local.util';
import { VouchersIaService } from './vouchers-ia.service';
import {
  calcularSemaforo,
  ContextoSemaforo,
  DatosVoucherExtraidos,
  ResultadoSemaforo,
} from './semaforo.util';

export interface SubirVoucherOpciones {
  pedidoId?: string | number | bigint;
  medio?: 'YAPE' | 'PLIN';
  origen?: 'MOZO' | 'WHATSAPP' | 'CAJA' | 'CARTA';
}

/** Medios que el mozo puede enviar a Caja desde la mesa. */
const MEDIOS_ENVIO_CAJA = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'] as const;

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly archivosService: ArchivosService,
    private readonly auditoria: AuditoriaService,
    private readonly vouchersIaService: VouchersIaService,
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

    // 1. Guardar archivo en almacenamiento privado
    const archivoSubido = await this.archivosService.subirArchivo(file, true, usuario ?? undefined, ip);
    const archivoId = BigInt(archivoSubido.id);

    // 2. Calcular SHA256 del contenido de la imagen
    const hashImagen = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 3. Obtener pedido si aplica (un pedido inexistente no deja un voucher huérfano)
    let pedido: any = null;
    let pedidoIdBigInt: bigint | null = null;
    if (opciones.pedidoId) {
      pedidoIdBigInt = this.parsearId(opciones.pedidoId);
      pedido = await this.prisma.pedido.findUnique({
        where: { id: pedidoIdBigInt },
        select: { id: true, codigo: true, total: true, pago_preferido: true, pago_metodo: true },
      });
      if (!pedido) {
        throw new HttpException(
          { codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 4. Parámetros de validación y fecha de Lima
    const config = await this.obtenerParametrosConfiguracion();
    const { fechaIso } = obtenerFechaHoraLima();

    // 5. Análisis con IA de Visión (reutilizando client / token / config). Sin usuario (carta) se limita por IP.
    const analisisIa = await this.vouchersIaService.analizarVoucher(
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
    const contexto: ContextoSemaforo = {
      pedidoTotal: pedido?.total != null ? Number(pedido.total) : null,
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

    const origen = opciones.origen || (usuario?.rol === 'MOZO' ? 'MOZO' : usuario ? 'CAJA' : 'CARTA');

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
      },
    });

    // 9. Registrar auditoría
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

    // 10. Respuesta según el rol:
    // Al mozo y al cliente de la carta SOLO se entrega legible y mensaje, NUNCA el semáforo ni los datos extraídos
    // legible sigue la misma regla que el cobro: un ILEGIBLE (aunque la IA lo lea) no cuenta como comprobante
    if (!usuario || usuario.rol === 'MOZO') {
      const legible = voucher.semaforo !== 'ILEGIBLE';
      return {
        id: voucher.id.toString(),
        legible,
        ...(voucher.semaforo === 'ILEGIBLE'
          ? { mensaje: 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.' }
          : {}),
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

      const medioEsperado = (pedido?.pago_preferido as any) || (pedido?.pago_metodo as any) || null;

      const contexto: ContextoSemaforo = {
        pedidoTotal: pedido?.total != null ? Number(pedido.total) : null,
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
    const where: any = {};

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
          },
        },
      },
    });

    // Contar cuántos faltan revisar si se consulta por fecha
    let faltanRevisar = 0;
    if (filtros.fecha) {
      const f = filtros.fecha.trim();
      faltanRevisar = await this.prisma.voucherPago.count({
        where: {
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
      clienteTelefono: v.pedido?.cliente_telefono || null,
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
   * El mozo envía a Caja el cobro de una mesa. No cobra ni marca el pedido como pagado:
   * Caja revisa el voucher (con su semáforo) y es quien cobra. Efectivo: aviso de cobro en efectivo.
   * Digital: aviso con el voucher ya enlazado, o sin foto legible (Caja resuelve con su excepción).
   * Al mozo solo se le responde ok: nunca el semáforo ni los datos del voucher.
   */
  async enviarACaja(pedidoId: string, medio: string, usuario: UsuarioAutenticado, ip?: string) {
    const medioNormalizado = String(medio || '').trim().toUpperCase();
    if (!MEDIOS_ENVIO_CAJA.includes(medioNormalizado as (typeof MEDIOS_ENVIO_CAJA)[number])) {
      throw new BadRequestException({ codigo: 'MEDIO_INVALIDO', mensaje: 'Elige Efectivo, Yape, Plin o Transferencia' });
    }
    const id = this.parsearId(pedidoId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      select: { id: true, codigo: true, pago_estado: true },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }
    if (pedido.pago_estado === 'PAGADO') {
      throw new ConflictException({ codigo: 'PEDIDO_YA_PAGADO', mensaje: 'El pedido ya está cobrado' });
    }

    let aviso: { tipo: string; titulo: string; mensaje: string };
    if (medioNormalizado === 'EFECTIVO') {
      aviso = {
        tipo: 'PAGO_EFECTIVO_MOZO',
        titulo: 'Mesa paga en efectivo',
        mensaje: `El mozo avisa que el pedido ${pedido.codigo} se paga en efectivo en mesa. Cóbralo en Caja.`,
      };
    } else {
      const ultimo = await this.prisma.voucherPago.findFirst({
        where: { pedido_id: id },
        orderBy: { creado_en: 'desc' },
        select: { semaforo: true },
      });
      const legible = !!ultimo && ultimo.semaforo !== 'ILEGIBLE';
      aviso = legible
        ? {
            tipo: 'VOUCHER_PENDIENTE_MOZO',
            titulo: 'Voucher listo para revisar',
            mensaje: `El mozo envía el pedido ${pedido.codigo} (${medioNormalizado}) con la foto del voucher. Revísala y cobra.`,
          }
        : {
            tipo: 'VOUCHER_PENDIENTE_MOZO',
            titulo: 'Pago digital sin foto legible',
            mensaje: `El mozo envía el pedido ${pedido.codigo} (${medioNormalizado}) sin foto legible. Pide la foto o cobra con tu excepción.`,
          };
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

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'vouchers',
      accion: 'ENVIADO_CAJA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario.partyId,
      ip,
      despues: { pedidoId: pedido.id.toString(), medio: medioNormalizado },
    });

    return { ok: true };
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
                monto: Number(destino.total),
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
    this.eventos?.emitirAdmin('vouchers:actualizado', { pedidoIds });
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
    const tokensTotal = tokensEntrada + tokensSalida;
    const costoUsdEstimado = Number(agregados._sum.costo_usd_estimado || 0);

    const activo = await this.vouchersIaService.estaParametroVoucherIaActivo();

    return {
      periodo,
      llamadasTotal,
      tokensEntrada,
      tokensSalida,
      tokensTotal,
      costoUsdEstimado: Math.round(costoUsdEstimado * 10000) / 10000,
      iaActiva: activo,
    };
  }
}
