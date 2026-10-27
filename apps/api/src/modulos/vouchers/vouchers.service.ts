import {
  BadRequestException,
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
  origen?: 'MOZO' | 'WHATSAPP' | 'CAJA';
}

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
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!file || !file.buffer) {
      throw new HttpException(
        { codigo: 'ARCHIVO_REQUERIDO', mensaje: 'Debes proporcionar un archivo de imagen de voucher' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Guardar archivo en almacenamiento privado
    const archivoSubido = await this.archivosService.subirArchivo(file, true, usuario, ip);
    const archivoId = BigInt(archivoSubido.id);

    // 2. Calcular SHA256 del contenido de la imagen
    const hashImagen = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 3. Obtener pedido si aplica
    let pedido: any = null;
    let pedidoIdBigInt: bigint | null = null;
    if (opciones.pedidoId) {
      pedidoIdBigInt = this.parsearId(opciones.pedidoId);
      pedido = await this.prisma.pedido.findUnique({
        where: { id: pedidoIdBigInt },
        select: { id: true, codigo: true, total: true, pago_preferido: true, pago_metodo: true },
      });
    }

    // 4. Parámetros de validación y fecha de Lima
    const config = await this.obtenerParametrosConfiguracion();
    const { fechaIso } = obtenerFechaHoraLima();

    // 5. Análisis con IA de Visión (reutilizando client / token / config)
    const analisisIa = await this.vouchersIaService.analizarVoucher(
      file.buffer,
      file.mimetype,
      {
        identificadorRateLimit: usuario.partyId.toString(),
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

    const origen = opciones.origen || (usuario.rol === 'MOZO' ? 'MOZO' : 'CAJA');

    // 8. Guardar registro en la tabla voucher_pago
    const voucher = await this.prisma.voucherPago.create({
      data: {
        pedido_id: pedidoIdBigInt,
        archivo_id: archivoId,
        origen,
        medio: opciones.medio || extraido?.medioDetectado || null,
        subido_por: usuario.partyId,
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
      partyId: usuario.partyId,
      ip,
      despues: {
        pedidoId: pedidoIdBigInt ? pedidoIdBigInt.toString() : null,
        medio: voucher.medio,
        semaforo: voucher.semaforo,
        origen,
      },
    });

    // 10. Respuesta según el rol:
    // Al mozo SOLO se le entrega legible y mensaje, NUNCA el semáforo ni los datos extraídos
    if (usuario.rol === 'MOZO') {
      const legible = extraido ? extraido.legible : voucher.semaforo !== 'ILEGIBLE';
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
      legible: extraido ? extraido.legible : true,
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
            rol_destino: 'CAJA',
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
