import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AgotarDto } from './dto/agotar.dto';
import {
  calcularSiguienteMedianocheLima,
  FECHA_HASTA_REACTIVAR,
} from './cocina.util';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';

export interface AgotadosActivos {
  productos: string[];
  sabores: string[];
  opciones: string[];
  productoIds: string[];
  saborIds: string[];
  opcionIds: string[];
}

@Injectable()
export class AgotadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional()
    @Inject(forwardRef(() => AvisosInternosService))
    private readonly avisosInternosService?: AvisosInternosService,
  ) {}

  private parsearId(id: bigint | string | number, entidad = 'agotado'): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: `El identificador de ${entidad} no es válido`,
      });
    }
  }

  /**
   * Método público que devuelve los IDs de productos, sabores y opciones agotados en este momento.
   * Calculado desde agotado_hasta > ahora de las tres tablas (incluye lo agotado desde Productos o Cocina),
   * realizando una consulta por tabla.
   */
  async activos(): Promise<AgotadosActivos> {
    const ahora = new Date();

    const [productosAgotados, saboresAgotados, opcionesAgotadas] = await Promise.all([
      this.prisma.producto.findMany({
        where: {
          agotado_hasta: {
            gt: ahora,
          },
        },
        select: { id: true },
      }),
      this.prisma.sabor.findMany({
        where: {
          agotado_hasta: {
            gt: ahora,
          },
        },
        select: { id: true },
      }),
      this.prisma.opcion.findMany({
        where: {
          agotado_hasta: {
            gt: ahora,
          },
        },
        select: { id: true },
      }),
    ]);

    const productos = productosAgotados.map((p) => p.id.toString());
    const sabores = saboresAgotados.map((s) => s.id.toString());
    const opciones = opcionesAgotadas.map((o) => o.id.toString());

    return {
      productos,
      sabores,
      opciones,
      productoIds: productos,
      saborIds: sabores,
      opcionIds: opciones,
    };
  }

  /**
   * GET /admin/cocina/agotados
   * Devuelve los agotados vigentes leyendo la tabla agotado (reactivado_en nulo y hasta > ahora).
   */
  async listar() {
    const ahora = new Date();

    const registros = await this.prisma.agotado.findMany({
      where: {
        reactivado_en: null,
        OR: [
          { hasta: { gt: ahora } },
          { hasta: null, alcance: { in: ['HASTA_REACTIVAR', 'INDEFINIDO'] } },
        ],
      },
      include: {
        producto: true,
        sabor: true,
        opcion: {
          include: {
            valor: true,
          },
        },
      },
      orderBy: {
        desde: 'desc',
      },
    });

    return registros.map((reg) => ({
      id: reg.id.toString(),
      tipo: reg.tipo,
      alcance: reg.alcance,
      duracion: reg.alcance,
      productoId: reg.producto_id?.toString() ?? null,
      producto_id: reg.producto_id?.toString() ?? null,
      productoNombre: reg.producto?.nombre ?? null,
      saborId: reg.sabor_id?.toString() ?? null,
      sabor_id: reg.sabor_id?.toString() ?? null,
      saborNombre: reg.sabor?.nombre ?? null,
      opcionId: reg.opcion_id?.toString() ?? null,
      opcion_id: reg.opcion_id?.toString() ?? null,
      opcionNombre: reg.opcion?.valor?.nombre ?? null,
      desde: reg.desde,
      hasta: reg.hasta,
      por: reg.por.toString(),
    }));
  }

  /**
   * POST /admin/cocina/agotados
   * Agota un producto, sabor u opción con duración HOY o HASTA_REACTIVAR.
   * Actualiza agotado_hasta en la entidad correspondiente y crea fila en agotado en la MISMA transacción.
   * 'HASTA_REACTIVAR' sólo permitido para rol ADMIN (403 SOLO_ADMIN).
   * 404 si el id no existe (PRODUCTO_NO_ENCONTRADO / SABOR_NO_ENCONTRADO / OPCION_NO_ENCONTRADA).
   */
  async agotar(
    dto: AgotarDto,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    if (dto.duracion === 'HASTA_REACTIVAR' && usuarioActual.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'La duración HASTA_REACTIVAR sólo está permitida para el rol de administrador',
      });
    }

    const entidadId = this.parsearId(dto.id, dto.tipo.toLowerCase());
    const ahora = new Date();

    const fechaAgotadoHasta =
      dto.duracion === 'HOY'
        ? calcularSiguienteMedianocheLima(ahora)
        : FECHA_HASTA_REACTIVAR;

    const nuevoAgotado = await this.prisma.$transaction(async (tx: any) => {
      // 1. Validar existencia y actualizar agotado_hasta en la entidad
      if (dto.tipo === 'PRODUCTO') {
        const prod = await tx.producto.findUnique({ where: { id: entidadId } });
        if (!prod) {
          throw new NotFoundException({
            codigo: 'PRODUCTO_NO_ENCONTRADO',
            mensaje: 'El producto no existe',
          });
        }
        await tx.producto.update({
          where: { id: entidadId },
          data: { agotado_hasta: fechaAgotadoHasta },
        });
      } else if (dto.tipo === 'SABOR') {
        const sab = await tx.sabor.findUnique({ where: { id: entidadId } });
        if (!sab) {
          throw new NotFoundException({
            codigo: 'SABOR_NO_ENCONTRADO',
            mensaje: 'El sabor no existe',
          });
        }
        await tx.sabor.update({
          where: { id: entidadId },
          data: { agotado_hasta: fechaAgotadoHasta },
        });
      } else if (dto.tipo === 'OPCION') {
        const opc = await tx.opcion.findUnique({ where: { id: entidadId } });
        if (!opc) {
          throw new NotFoundException({
            codigo: 'OPCION_NO_ENCONTRADA',
            mensaje: 'La opción no existe',
          });
        }
        await tx.opcion.update({
          where: { id: entidadId },
          data: { agotado_hasta: fechaAgotadoHasta },
        });
      }

      // 2. Registrar en la tabla de historial agotado
      return tx.agotado.create({
        data: {
          producto_id: dto.tipo === 'PRODUCTO' ? entidadId : null,
          sabor_id: dto.tipo === 'SABOR' ? entidadId : null,
          opcion_id: dto.tipo === 'OPCION' ? entidadId : null,
          tipo: dto.tipo,
          alcance: dto.duracion,
          desde: ahora,
          hasta: fechaAgotadoHasta,
          reactivado_en: null,
          por: usuarioActual.partyId,
        },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'AGOTAR',
      resultado: 'OK',
      entidad: 'agotado',
      entidadId: nuevoAgotado.id,
      despues: {
        tipo: dto.tipo,
        id: entidadId.toString(),
        duracion: dto.duracion,
        agotado_hasta: fechaAgotadoHasta.toISOString(),
      },
      partyId: usuarioActual.partyId,
      ip,
    });

    // Emite disponibilidad actualizada
    const disponibles = await this.activos();
    this.eventosGateway?.emitirAdmin('carta:disponibilidad', disponibles);

    // Aviso interno a Almacén/Equipo (asíncrono, best-effort)
    if (this.avisosInternosService) {
      setImmediate(() => {
        this.avisosInternosService?.notificarElementoAgotado(dto.tipo, entidadId).catch(() => {});
      });
    }

    return {
      ok: true,
      id: nuevoAgotado.id.toString(),
      tipo: nuevoAgotado.tipo,
      duracion: nuevoAgotado.alcance,
      alcance: nuevoAgotado.alcance,
      desde: nuevoAgotado.desde,
      hasta: nuevoAgotado.hasta,
      por: nuevoAgotado.por.toString(),
    };
  }

  /**
   * POST /admin/cocina/agotados/:id/reactivar
   * Reactiva un ítem agotado: actualiza agotado_hasta = null en la entidad y marca reactivado_en en agotado,
   * en la misma transacción.
   */
  async reactivar(
    id: bigint | string | number,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const agotadoId = this.parsearId(id, 'agotado');
    const ahora = new Date();

    const actualizado = await this.prisma.$transaction(async (tx: any) => {
      const reg = await tx.agotado.findUnique({
        where: { id: agotadoId },
      });

      if (!reg) {
        throw new NotFoundException({
          codigo: 'AGOTADO_NO_ENCONTRADO',
          mensaje: 'Registro de agotado no encontrado',
        });
      }

      // Restablecer agotado_hasta = null en la entidad correspondiente
      if (reg.tipo === 'PRODUCTO' && reg.producto_id) {
        await tx.producto.update({
          where: { id: reg.producto_id },
          data: { agotado_hasta: null },
        });
      } else if (reg.tipo === 'SABOR' && reg.sabor_id) {
        await tx.sabor.update({
          where: { id: reg.sabor_id },
          data: { agotado_hasta: null },
        });
      } else if (reg.tipo === 'OPCION' && reg.opcion_id) {
        await tx.opcion.update({
          where: { id: reg.opcion_id },
          data: { agotado_hasta: null },
        });
      }

      return tx.agotado.update({
        where: { id: agotadoId },
        data: {
          reactivado_en: ahora,
        },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'REACTIVAR_AGOTADO',
      resultado: 'OK',
      entidad: 'agotado',
      entidadId: actualizado.id,
      despues: { reactivado_en: ahora, agotado_hasta: null },
      partyId: usuarioActual.partyId,
      ip,
    });

    const disponibles = await this.activos();
    this.eventosGateway?.emitirAdmin('carta:disponibilidad', disponibles);

    return {
      ok: true,
      id: actualizado.id.toString(),
      reactivado_en: actualizado.reactivado_en,
    };
  }
}
