import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TEXTO_CONSENTIMIENTO, leerTextosLegales } from './textos-legales';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  CrearReclamoDto,
  FiltrarReclamosDto,
  ResponderReclamoDto,
} from './dto';
import {
  calcularDiasHabilesRestantes,
  enmascararDocumento,
  enmascararTelefono,
  formatearFechaIso,
  formatearTextoPlazo,
  obtenerAnioLima,
  obtenerHoyLima,
  sumarDiasHabiles,
} from './reclamos.util';

export interface ConstanciaReclamo {
  numero: string;
  fechaRegistro: string;
  tipo: string;
  fechaLimite: string;
  mensaje: string;
}

@Injectable()
export class ReclamosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /**
   * Verifica el límite de tasa de 5 solicitudes por hora por IP usando Redis.
   * Lanza 429 TOO_MANY con mensaje en español si se supera.
   */
  async verificarLimiteIp(ip: string): Promise<void> {
    const redis = this.redisService.obtenerCliente();
    const clave = `reclamos:ip:${ip}`;
    const total = await redis.incr(clave);
    if (total === 1) {
      await redis.expire(clave, 3600); // 1 hora
    }
    if (total > 5) {
      throw new HttpException(
        {
          codigo: 'TOO_MANY',
          mensaje: 'Ha superado el límite de 5 solicitudes por hora. Por favor, intente más tarde.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Registra un nuevo reclamo o queja en el Libro de Reclamaciones virtual.
   * - Límite de 5 solicitudes/hora por IP.
   * - Aceptación obligatoria de política de privacidad (400 PRIVACIDAD_REQUERIDA).
   * - Correlativo oficial 'LR-AAAA-000001' concurrente sin huecos con pg_advisory_xact_lock.
   * - Cálculo de fecha límite según parámetro reclamo_plazo_dias_habiles (días hábiles Lima).
   * - Emite evento 'reclamo:nuevo' y registra auditoría.
   */
  async crear(dto: CrearReclamoDto, ip?: string): Promise<ConstanciaReclamo> {
    if (dto.aceptaPrivacidad !== true) {
      throw new BadRequestException({
        codigo: 'PRIVACIDAD_REQUERIDA',
        mensaje: 'Debe aceptar la política de privacidad para enviar el reclamo',
      });
    }

    if (!dto.detalle || dto.detalle.trim().length < 20) {
      throw new BadRequestException({
        codigo: 'DETALLE_INVALIDO',
        mensaje: 'El detalle debe tener al menos 20 caracteres',
      });
    }

    if (dto.montoReclamado !== undefined && dto.montoReclamado !== null && dto.montoReclamado < 0) {
      throw new BadRequestException({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'El monto reclamado no puede ser negativo',
      });
    }

    const ipLimpia = (ip || '127.0.0.1').trim();
    await this.verificarLimiteIp(ipLimpia);

    let pedidoId: bigint | null = null;
    if (dto.pedidoCodigo) {
      const pedido = await this.prisma.pedido.findUnique({
        where: { codigo: dto.pedidoCodigo.trim() },
        select: { id: true },
      });
      if (pedido) {
        pedidoId = pedido.id;
      }
    }

    const ahora = new Date();
    const hoyLimaIso = obtenerHoyLima(ahora);
    const anio = obtenerAnioLima(ahora);

    const reclamo = await this.prisma.$transaction(async (tx) => {
      // Bloqueo consultivo a nivel de transacción para el año (evita condiciones de carrera y duplicados)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'reclamo_' + anio}))`;

      // Obtener el último reclamo del año para calcular el correlativo
      const ultimo = await tx.reclamo.findFirst({
        where: {
          numero: {
            startsWith: `LR-${anio}-`,
          },
        },
        orderBy: {
          numero: 'desc',
        },
        select: {
          numero: true,
        },
      });

      let siguiente = 1;
      if (ultimo?.numero) {
        const partes = ultimo.numero.split('-');
        if (partes.length === 3) {
          const num = parseInt(partes[2], 10);
          if (!isNaN(num)) {
            siguiente = num + 1;
          }
        }
      }

      const numero = `LR-${anio}-${String(siguiente).padStart(6, '0')}`;

      // Plazo legal configurado (por defecto 15 días hábiles según RN-CAP-099 y FT-LEG-02)
      const paramPlazo = await tx.parametro.findUnique({
        where: { clave: 'reclamo_plazo_dias_habiles' },
      });
      const diasHabiles = typeof paramPlazo?.valor === 'number' ? paramPlazo.valor : 15;

      const fechaLimiteIso = sumarDiasHabiles(hoyLimaIso, diasHabiles);
      const fechaLimite = new Date(`${fechaLimiteIso}T00:00:00.000Z`);

      return tx.reclamo.create({
        data: {
          numero,
          tipo: dto.tipo,
          nombre: dto.nombre.trim(),
          documento: dto.documento.trim(),
          domicilio: dto.domicilio.trim(),
          telefono: dto.telefono.trim(),
          correo: dto.correo ? dto.correo.trim() : null,
          pedido_id: pedidoId,
          detalle: dto.detalle.trim(),
          monto_reclamado:
            dto.montoReclamado !== undefined && dto.montoReclamado !== null
              ? dto.montoReclamado
              : null,
          estado: 'RECIBIDO',
          fecha_limite: fechaLimite,
          aceptacion_privacidad: true,
          aceptado_en: ahora,
          creado_en: ahora,
        },
      });
    });

    const fechaLimiteStr = formatearFechaIso(reclamo.fecha_limite);

    // Auditoría de creación
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reclamos',
      accion: 'REGISTRAR',
      resultado: 'OK',
      entidad: 'reclamo',
      entidadId: reclamo.id,
      despues: {
        numero: reclamo.numero,
        tipo: reclamo.tipo,
        nombre: reclamo.nombre,
        documento: enmascararDocumento(reclamo.documento),
      },
      ip: ipLimpia,
    });

    // Emisión de evento en tiempo real
    this.eventosGateway?.emitirAdmin('reclamo:nuevo', {
      id: reclamo.id.toString(),
      numero: reclamo.numero,
      tipo: reclamo.tipo,
      nombre: reclamo.nombre,
      fechaRegistro: reclamo.creado_en.toISOString(),
      fechaLimite: fechaLimiteStr,
    });

    return {
      numero: reclamo.numero,
      fechaRegistro: reclamo.creado_en.toISOString(),
      tipo: reclamo.tipo,
      fechaLimite: fechaLimiteStr,
      mensaje:
        'Su solicitud ha sido registrada formalmente en el Libro de Reclamaciones virtual. Conserve su número de constancia para el seguimiento de su trámite.',
    };
  }

  /**
   * Consulta pública de constancia por número y documento.
   * Devuelve 404 genérico sin revelar si el número existe si el documento no coincide.
   */
  async obtenerConstanciaPublica(numero: string, documento?: string) {
    if (!numero || !documento || !documento.trim()) {
      throw new NotFoundException({
        codigo: 'RECLAMO_NO_ENCONTRADO',
        mensaje: 'Reclamo no encontrado',
      });
    }

    const reclamo = await this.prisma.reclamo.findUnique({
      where: { numero: numero.trim() },
    });

    if (!reclamo || reclamo.documento.trim() !== documento.trim()) {
      throw new NotFoundException({
        codigo: 'RECLAMO_NO_ENCONTRADO',
        mensaje: 'Reclamo no encontrado',
      });
    }

    return {
      numero: reclamo.numero,
      fechaRegistro: reclamo.creado_en.toISOString(),
      tipo: reclamo.tipo,
      fechaLimite: formatearFechaIso(reclamo.fecha_limite),
      estado: reclamo.estado,
      nombre: reclamo.nombre,
      detalle: reclamo.detalle,
      montoReclamado: reclamo.monto_reclamado ? Number(reclamo.monto_reclamado) : null,
      respuesta: reclamo.respuesta,
      respondidoEn: reclamo.respondido_en ? reclamo.respondido_en.toISOString() : null,
      mensaje: 'Constancia oficial del Libro de Reclamaciones',
    };
  }

  /**
   * Lee términos, privacidad y plazo legal desde los parámetros del sistema (GET /carta/legal).
   */
  async obtenerCartaLegal() {
    const [textos, plazo] = await Promise.all([
      leerTextosLegales(this.prisma, 'carta'),
      this.prisma.parametro.findUnique({ where: { clave: 'reclamo_plazo_dias_habiles' } }),
    ]);
    return {
      terminos: textos.terminos.texto,
      terminosVersion: textos.terminos.version,
      privacidad: textos.privacidad.texto,
      privacidadVersion: textos.privacidad.version,
      textoConsentimiento: TEXTO_CONSENTIMIENTO,
      reclamoPlazoDiasHabiles: typeof plazo?.valor === 'number' ? plazo.valor : 15,
    };
  }

  /**
   * Lista paginada para administración con filtros, cálculo de días hábiles restantes y enmascaramiento.
   * Ordena con los más urgentes primero (fecha_limite asc).
   */
  async listarAdmin(filtros: FiltrarReclamosDto, usuarioActual?: UsuarioAutenticado) {
    const where: any = {};

    if (filtros.estado) {
      where.estado = filtros.estado;
    }
    if (filtros.tipo) {
      where.tipo = filtros.tipo;
    }
    if (filtros.desde || filtros.hasta) {
      where.creado_en = {};
      if (filtros.desde) {
        where.creado_en.gte = new Date(filtros.desde);
      }
      if (filtros.hasta) {
        where.creado_en.lte = new Date(filtros.hasta);
      }
    }

    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(filtros.limite) || 20));
    const skip = (pagina - 1) * limite;

    const [total, reclamos] = await Promise.all([
      this.prisma.reclamo.count({ where }),
      this.prisma.reclamo.findMany({
        where,
        skip,
        take: limite,
        orderBy: [{ fecha_limite: 'asc' }, { creado_en: 'asc' }],
      }),
    ]);

    const hoyIso = obtenerHoyLima(new Date());
    const esAdmin = usuarioActual?.rol === 'ADMIN';

    const items = reclamos.map((r) => {
      const fechaLimIso = formatearFechaIso(r.fecha_limite);
      const diasHabilesRestantes = calcularDiasHabilesRestantes(hoyIso, fechaLimIso);
      const texto = formatearTextoPlazo(diasHabilesRestantes);

      return {
        id: r.id.toString(),
        numero: r.numero,
        tipo: r.tipo,
        nombre: r.nombre,
        documento: esAdmin ? r.documento : enmascararDocumento(r.documento),
        domicilio: r.domicilio,
        telefono: esAdmin ? r.telefono : enmascararTelefono(r.telefono),
        correo: r.correo,
        pedido_id: r.pedido_id ? r.pedido_id.toString() : null,
        pedidoId: r.pedido_id ? r.pedido_id.toString() : null,
        detalle: r.detalle,
        monto_reclamado: r.monto_reclamado ? Number(r.monto_reclamado) : null,
        montoReclamado: r.monto_reclamado ? Number(r.monto_reclamado) : null,
        estado: r.estado,
        respuesta: r.respuesta,
        respondido_por: r.respondido_por ? r.respondido_por.toString() : null,
        respondidoPor: r.respondido_por ? r.respondido_por.toString() : null,
        respondido_en: r.respondido_en ? r.respondido_en.toISOString() : null,
        respondidoEn: r.respondido_en ? r.respondido_en.toISOString() : null,
        fecha_limite: fechaLimIso,
        fechaLimite: fechaLimIso,
        diasHabilesRestantes,
        plazoTexto: texto,
        textoPlazo: texto,
        diasHabilesTexto: texto,
        creado_en: r.creado_en.toISOString(),
        creadoEn: r.creado_en.toISOString(),
      };
    });

    return {
      total,
      pagina,
      limite,
      items,
    };
  }

  /**
   * Obtiene el detalle completo de un reclamo en administración.
   * Audita la lectura sensible con acción VER_RECLAMO.
   */
  async obtenerPorIdAdmin(
    id: string | bigint,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const idBigInt = BigInt(id);
    const reclamo = await this.prisma.reclamo.findUnique({
      where: { id: idBigInt },
      include: {
        pedido: {
          select: {
            id: true,
            codigo: true,
            creado_en: true,
            total: true,
          },
        },
        respondidoPor: {
          select: {
            id: true,
            usuario: { select: { rol: true } },
            persona: { select: { nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!reclamo) {
      throw new NotFoundException({
        codigo: 'RECLAMO_NO_ENCONTRADO',
        mensaje: 'Reclamo no encontrado',
      });
    }

    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'reclamos',
      accion: 'VER_RECLAMO',
      resultado: 'OK',
      entidad: 'reclamo',
      entidadId: reclamo.id,
      partyId: usuarioActual?.partyId,
      ip,
    });

    const hoyIso = obtenerHoyLima(new Date());
    const fechaLimIso = formatearFechaIso(reclamo.fecha_limite);
    const diasHabilesRestantes = calcularDiasHabilesRestantes(hoyIso, fechaLimIso);
    const texto = formatearTextoPlazo(diasHabilesRestantes);

    return {
      id: reclamo.id.toString(),
      numero: reclamo.numero,
      tipo: reclamo.tipo,
      nombre: reclamo.nombre,
      documento: reclamo.documento,
      domicilio: reclamo.domicilio,
      telefono: reclamo.telefono,
      correo: reclamo.correo,
      pedido_id: reclamo.pedido_id ? reclamo.pedido_id.toString() : null,
      pedido: reclamo.pedido
        ? {
            id: reclamo.pedido.id.toString(),
            codigo: reclamo.pedido.codigo,
            total: Number(reclamo.pedido.total),
            creadoEn: reclamo.pedido.creado_en.toISOString(),
          }
        : null,
      detalle: reclamo.detalle,
      monto_reclamado: reclamo.monto_reclamado ? Number(reclamo.monto_reclamado) : null,
      montoReclamado: reclamo.monto_reclamado ? Number(reclamo.monto_reclamado) : null,
      estado: reclamo.estado,
      respuesta: reclamo.respuesta,
      respondido_por: reclamo.respondido_por ? reclamo.respondido_por.toString() : null,
      respondidoPor: reclamo.respondidoPor
        ? {
            id: reclamo.respondidoPor.id.toString(),
            rol: reclamo.respondidoPor.usuario?.rol ?? null,
            nombres: reclamo.respondidoPor.persona
              ? `${reclamo.respondidoPor.persona.nombres} ${reclamo.respondidoPor.persona.apellidos || ''}`.trim()
              : null,
          }
        : null,
      respondido_en: reclamo.respondido_en ? reclamo.respondido_en.toISOString() : null,
      respondidoEn: reclamo.respondido_en ? reclamo.respondido_en.toISOString() : null,
      fecha_limite: fechaLimIso,
      fechaLimite: fechaLimIso,
      diasHabilesRestantes,
      plazoTexto: texto,
      textoPlazo: texto,
      diasHabilesTexto: texto,
      aceptacion_privacidad: reclamo.aceptacion_privacidad,
      aceptado_en: reclamo.aceptado_en.toISOString(),
      creado_en: reclamo.creado_en.toISOString(),
      creadoEn: reclamo.creado_en.toISOString(),
    };
  }

  /**
   * Cambia el estado del reclamo a EN_REVISION.
   */
  async marcarEnRevision(
    id: string | bigint,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const idBigInt = BigInt(id);
    const reclamo = await this.prisma.reclamo.findUnique({
      where: { id: idBigInt },
    });

    if (!reclamo) {
      throw new NotFoundException({
        codigo: 'RECLAMO_NO_ENCONTRADO',
        mensaje: 'Reclamo no encontrado',
      });
    }

    if (reclamo.estado === 'RESPONDIDO') {
      throw new HttpException(
        {
          codigo: 'YA_RESPONDIDO',
          mensaje: 'El reclamo ya ha sido respondido',
        },
        HttpStatus.CONFLICT,
      );
    }

    const actualizado = await this.prisma.reclamo.update({
      where: { id: idBigInt },
      data: {
        estado: 'EN_REVISION',
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reclamos',
      accion: 'EN_REVISION',
      resultado: 'OK',
      entidad: 'reclamo',
      entidadId: reclamo.id,
      antes: { estado: reclamo.estado },
      despues: { estado: 'EN_REVISION' },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return this.formatearReclamoSimple(actualizado);
  }

  /**
   * Registra la respuesta formal al reclamo y cambia su estado a RESPONDIDO.
   * No se puede responder dos veces (409 YA_RESPONDIDO).
   */
  async responder(
    id: string | bigint,
    dto: ResponderReclamoDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const idBigInt = BigInt(id);
    const reclamo = await this.prisma.reclamo.findUnique({
      where: { id: idBigInt },
    });

    if (!reclamo) {
      throw new NotFoundException({
        codigo: 'RECLAMO_NO_ENCONTRADO',
        mensaje: 'Reclamo no encontrado',
      });
    }

    if (reclamo.estado === 'RESPONDIDO' || reclamo.respuesta) {
      throw new HttpException(
        {
          codigo: 'YA_RESPONDIDO',
          mensaje: 'El reclamo ya ha sido respondido previamente',
        },
        HttpStatus.CONFLICT,
      );
    }

    if (!dto.respuesta || dto.respuesta.trim().length < 20) {
      throw new BadRequestException({
        codigo: 'RESPUESTA_INVALIDA',
        mensaje: 'La respuesta debe tener al menos 20 caracteres',
      });
    }

    const ahora = new Date();
    const actualizado = await this.prisma.reclamo.update({
      where: { id: idBigInt },
      data: {
        estado: 'RESPONDIDO',
        respuesta: dto.respuesta.trim(),
        respondido_por: usuarioActual?.partyId ?? null,
        respondido_en: ahora,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reclamos',
      accion: 'RESPONDER',
      resultado: 'OK',
      entidad: 'reclamo',
      entidadId: reclamo.id,
      antes: { estado: reclamo.estado, respuesta: reclamo.respuesta },
      despues: {
        estado: 'RESPONDIDO',
        respuesta: dto.respuesta.trim(),
        respondido_por: usuarioActual?.partyId?.toString(),
        respondido_en: ahora.toISOString(),
      },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return this.formatearReclamoSimple(actualizado);
  }

  private formatearReclamoSimple(r: any) {
    const hoyIso = obtenerHoyLima(new Date());
    const fechaLimIso = formatearFechaIso(r.fecha_limite);
    const diasHabilesRestantes = calcularDiasHabilesRestantes(hoyIso, fechaLimIso);
    const texto = formatearTextoPlazo(diasHabilesRestantes);

    return {
      id: r.id.toString(),
      numero: r.numero,
      tipo: r.tipo,
      nombre: r.nombre,
      documento: r.documento,
      domicilio: r.domicilio,
      telefono: r.telefono,
      correo: r.correo,
      pedido_id: r.pedido_id ? r.pedido_id.toString() : null,
      detalle: r.detalle,
      monto_reclamado: r.monto_reclamado ? Number(r.monto_reclamado) : null,
      montoReclamado: r.monto_reclamado ? Number(r.monto_reclamado) : null,
      estado: r.estado,
      respuesta: r.respuesta,
      respondido_por: r.respondido_por ? r.respondido_por.toString() : null,
      respondido_en: r.respondido_en ? r.respondido_en.toISOString() : null,
      fecha_limite: fechaLimIso,
      fechaLimite: fechaLimIso,
      diasHabilesRestantes,
      plazoTexto: texto,
      textoPlazo: texto,
      diasHabilesTexto: texto,
      creado_en: r.creado_en.toISOString(),
    };
  }
}
