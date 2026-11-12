import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import { enmascararTelefono } from '../utilidades/enmascarar.util';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { obtenerNombreMostrar } from '../../mensajes/utilidades/nombre-contacto.util';

@Injectable()
export class QuejasWhatsappService {
  private readonly logger = new Logger(QuejasWhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador de la queja no es válido',
      });
    }
  }

  /**
   * Últimas encuestas de calificación (enviadas u omitidas, con motivo) y el estado real del envío en el outbox.
   * Un envío FALLIDO con error de plantilla casi siempre es que la plantilla no existe o no está aprobada en Meta.
   */
  async listarEnvios(limite = 30) {
    const filas = await this.prisma.encuestaPosventa.findMany({
      orderBy: { enviada_en: 'desc' },
      take: Math.min(100, Math.max(1, Number(limite) || 30)),
      include: { pedido: { select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true } } },
    });
    const salientes = await this.prisma.salienteWhatsapp.findMany({
      where: { origen: 'ENCUESTA', pedido_id: { in: filas.map((f) => f.pedido_id) } },
      select: { pedido_id: true, estado: true, ultimo_error: true, motivo_descarte: true },
    });
    const porPedido = new Map(salientes.map((x) => [String(x.pedido_id), x]));
    const plantilla = CATALOGO_PLANTILLAS.ENCUESTA_POSVENTA;
    return {
      plantilla: { nombre: plantilla.nombre, idioma: plantilla.idioma, categoria: plantilla.categoria },
      envios: filas.map((f) => {
        const out = porPedido.get(String(f.pedido_id));
        return {
          id: String(f.id),
          pedidoCodigo: f.pedido.codigo,
          cliente: f.pedido.cliente_nombre,
          telefonoEnmascarado: f.pedido.cliente_telefono ? enmascararTelefono(f.pedido.cliente_telefono) : null,
          estado: f.estado,
          motivo: f.motivo ?? out?.motivo_descarte ?? null,
          envio: out?.estado ?? null,
          errorEnvio: out?.ultimo_error ?? null,
          fecha: f.enviada_en.toISOString(),
        };
      }),
    };
  }

  /**
   * Lista quejas de WhatsApp y calcula el resumen de satisfacción para el módulo de Reclamos.
   */
  async listarQuejas(
    filtros: { estado?: string; pagina?: number; limite?: number },
    _usuario?: UsuarioAutenticado,
  ) {
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const limite = Math.min(50, Math.max(1, Number(filtros.limite) || 20));
    const skip = (pagina - 1) * limite;

    const where: any = {};
    if (filtros.estado && filtros.estado !== 'todos') {
      where.estado = filtros.estado.toUpperCase();
    }

    const [quejasDb, total, todasQuejas, encuestasRespondidas] = await Promise.all([
      this.prisma.quejaWhatsapp.findMany({
        where,
        orderBy: { creada_en: 'desc' },
        skip,
        take: limite,
        include: {
          pedido: {
            select: {
              codigo: true,
              cliente_nombre: true,
              cliente_telefono: true,
              total: true,
            },
          },
        },
      }),
      this.prisma.quejaWhatsapp.count({ where }),
      this.prisma.quejaWhatsapp.findMany({
        select: { estado: true },
      }),
      this.prisma.encuestaPosventa.findMany({
        where: { estado: 'RESPONDIDA', puntaje: { not: null } },
        select: { puntaje: true },
      }),
    ]);

    // Resumen de satisfacción
    const totalEncuestas = encuestasRespondidas.length;
    let sumaPuntajes = 0;
    for (const e of encuestasRespondidas) {
      sumaPuntajes += e.puntaje || 0;
    }
    const promedio = totalEncuestas > 0 ? Number((sumaPuntajes / totalEncuestas).toFixed(1)) : 0;

    const conteosEstado = {
      todas: todasQuejas.length,
      nuevas: todasQuejas.filter((q) => q.estado === 'NUEVA').length,
      enRevision: todasQuejas.filter((q) => q.estado === 'EN_REVISION').length,
      resueltas: todasQuejas.filter((q) => q.estado === 'RESUELTA').length,
    };

    const pedidoIds = quejasDb.map((q) => q.pedido_id).filter(Boolean) as bigint[];
    const msgs =
      pedidoIds.length > 0 && this.prisma?.whatsappMensaje
        ? await this.prisma.whatsappMensaje.findMany({
            where: { pedido_id: { in: pedidoIds } },
            select: {
              pedido_id: true,
              conversacion: {
                include: { party: { include: { persona: true } } },
              },
            },
          })
        : [];
    const convPorPedido = new Map<string, any>();
    for (const m of msgs) {
      if (m.pedido_id && m.conversacion && !convPorPedido.has(m.pedido_id.toString())) {
        convPorPedido.set(m.pedido_id.toString(), m.conversacion);
      }
    }

    const quejasFormateadas = quejasDb.map((q) => {
      const conv = q.pedido_id ? convPorPedido.get(q.pedido_id.toString()) : null;
      const clienteNombre = conv ? obtenerNombreMostrar(conv) : q.cliente;
      const esSinTel = conv?.identificador_tipo === 'USUARIO_WA';

      return {
        id: q.id.toString(),
        origen: q.origen,
        pedidoId: q.pedido_id ? q.pedido_id.toString() : null,
        pedidoCodigo: q.pedido?.codigo || null,
        cliente: clienteNombre,
        telefonoEnmascarado: esSinTel
          ? 'Usuario de WhatsApp'
          : q.pedido?.cliente_telefono
          ? enmascararTelefono(q.pedido.cliente_telefono)
          : '***',
        puntaje: q.puntaje,
        texto: q.texto,
        estado: q.estado,
        atendidaPor: q.atendida_por,
        resolucion: q.resolucion,
        creadaEn: q.creada_en.toISOString(),
        actualizadaEn: q.actualizada_en.toISOString(),
      };
    });

    return {
      resumen: {
        promedio,
        totalEncuestas,
        totalQuejas: todasQuejas.length,
        ...conteosEstado,
      },
      quejas: quejasFormateadas,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  /**
   * Obtiene el detalle de una queja específica.
   */
  async obtenerDetalle(id: string | bigint) {
    const bigId = this.parsearId(id);
    const q = await this.prisma.quejaWhatsapp.findUnique({
      where: { id: bigId },
      include: {
        pedido: {
          select: {
            id: true,
            codigo: true,
            cliente_nombre: true,
            cliente_telefono: true,
            modalidad: true,
            total: true,
            creado_en: true,
          },
        },
      },
    });

    if (!q) {
      throw new NotFoundException({
        codigo: 'QUEJA_NO_ENCONTRADA',
        mensaje: 'La queja de WhatsApp no existe',
      });
    }

    let conv: any = null;
    if (q.pedido_id && this.prisma?.whatsappMensaje) {
      const msg = await this.prisma.whatsappMensaje.findFirst({
        where: { pedido_id: q.pedido_id },
        select: {
          conversacion: {
            include: { party: { include: { persona: true } } },
          },
        },
      });
      conv = msg?.conversacion;
    }
    const clienteNombre = conv ? obtenerNombreMostrar(conv) : q.cliente;
    const esSinTel = conv?.identificador_tipo === 'USUARIO_WA';

    return {
      id: q.id.toString(),
      origen: q.origen,
      pedidoId: q.pedido_id ? q.pedido_id.toString() : null,
      pedidoCodigo: q.pedido?.codigo || null,
      cliente: clienteNombre,
      telefonoEnmascarado: esSinTel
        ? 'Usuario de WhatsApp'
        : q.pedido?.cliente_telefono
        ? enmascararTelefono(q.pedido.cliente_telefono)
        : '***',
      puntaje: q.puntaje,
      texto: q.texto,
      estado: q.estado,
      atendidaPor: q.atendida_por,
      resolucion: q.resolucion,
      creadaEn: q.creada_en.toISOString(),
      actualizadaEn: q.actualizada_en.toISOString(),
    };
  }

  /**
   * Cambia el estado de una queja (EN_REVISION o RESUELTA) con nota y registro de auditoría.
   */
  async cambiarEstado(
    id: string | bigint,
    dto: { estado: 'EN_REVISION' | 'RESUELTA'; nota?: string },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const bigId = this.parsearId(id);
    const anterior = await this.prisma.quejaWhatsapp.findUnique({
      where: { id: bigId },
    });

    if (!anterior) {
      throw new NotFoundException({
        codigo: 'QUEJA_NO_ENCONTRADA',
        mensaje: 'La queja de WhatsApp no existe',
      });
    }

    const nuevoEstado = dto.estado;
    const resolucion = dto.nota ? dto.nota.trim() : anterior.resolucion;
    const atendidaPor = usuario.rol;

    const actualizada = await this.prisma.quejaWhatsapp.update({
      where: { id: bigId },
      data: {
        estado: nuevoEstado,
        atendida_por: atendidaPor,
        resolucion,
        actualizada_en: new Date(),
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reclamos',
      accion: 'CAMBIAR_ESTADO_QUEJA_WHATSAPP',
      resultado: 'OK',
      entidad: 'queja_whatsapp',
      entidadId: bigId,
      antes: { estado: anterior.estado, resolucion: anterior.resolucion },
      despues: { estado: nuevoEstado, resolucion, atendidaPor },
      partyId: usuario.partyId,
      ip,
    });

    return {
      ok: true,
      id: actualizada.id.toString(),
      estado: actualizada.estado,
      resolucion: actualizada.resolucion,
    };
  }
}
