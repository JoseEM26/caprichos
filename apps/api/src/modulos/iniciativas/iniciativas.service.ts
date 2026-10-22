import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearIniciativaDto } from './dto/crear-iniciativa.dto';
import { CrearComentarioDto } from './dto/crear-comentario.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { FiltrarIniciativasDto } from './dto/filtrar-iniciativas.dto';

const ETIQUETAS_TIPO: Record<string, string> = {
  QUEJA: 'Queja',
  MEJORA: 'Mejora',
  IDEA: 'Idea',
};

const ETIQUETAS_ESTADO: Record<string, string> = {
  NUEVA: 'Nueva',
  EN_REVISION: 'En revisión',
  HECHA: 'Hecha',
  NO_POR_AHORA: 'No por ahora',
};

const ETIQUETAS_AREA: Record<string, string> = {
  CARTA_WEB: 'Carta web',
  PEDIDOS_CAJA: 'Pedidos y caja',
  COCINA: 'Cocina',
  REPARTO: 'Reparto',
  ALMACEN_COMPRAS: 'Almacén y compras',
  OTRO: 'Otro',
};

@Injectable()
export class IniciativasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly archivosService?: ArchivosService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador no es válido',
      });
    }
  }

  private formatearFechaHora(fecha: Date): string {
    const d = new Date(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const horas = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} ${horas}:${mins}`;
  }

  /**
   * Obtiene el ID numérico de UserAccount a partir del partyId de la sesión.
   */
  async obtenerUserAccountId(partyId: bigint): Promise<bigint> {
    const cuenta = await this.prisma.userAccount.findUnique({
      where: { party_id: partyId },
      select: { id: true },
    });

    if (!cuenta) {
      throw new ForbiddenException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'No se encontró la cuenta de usuario asociada',
      });
    }

    return cuenta.id;
  }

  /**
   * Genera el siguiente código secuencial IN-0001, IN-0002...
   */
  async generarCodigo(): Promise<string> {
    const ultima = await this.prisma.iniciativa.findFirst({
      orderBy: { id: 'desc' },
      select: { codigo: true, id: true },
    });

    if (!ultima) {
      return 'IN-0001';
    }

    const numDesdeCodigo = parseInt(ultima.codigo.replace(/\D/g, ''), 10);
    const siguiente = !isNaN(numDesdeCodigo) && numDesdeCodigo > 0
      ? numDesdeCodigo + 1
      : Number(ultima.id) + 1;

    return `IN-${String(siguiente).padStart(4, '0')}`;
  }

  /**
   * Lista iniciativas del equipo con contadores en tiempo real y filtros.
   */
  async listar(filtros: FiltrarIniciativasDto, usuarioActual?: UsuarioAutenticado) {
    // 1. Obtener todas las iniciativas para conteos exactos
    const [
      total,
      nuevas,
      enRevision,
      hechas,
      noPorAhora,
      quejas,
      mejoras,
      ideas,
    ] = await Promise.all([
      this.prisma.iniciativa.count(),
      this.prisma.iniciativa.count({ where: { estado: 'NUEVA' } }),
      this.prisma.iniciativa.count({ where: { estado: 'EN_REVISION' } }),
      this.prisma.iniciativa.count({ where: { estado: 'HECHA' } }),
      this.prisma.iniciativa.count({ where: { estado: 'NO_POR_AHORA' } }),
      this.prisma.iniciativa.count({ where: { tipo: 'QUEJA' } }),
      this.prisma.iniciativa.count({ where: { tipo: 'MEJORA' } }),
      this.prisma.iniciativa.count({ where: { tipo: 'IDEA' } }),
    ]);

    // 2. Construir cláusula where
    const where: any = {};

    if (filtros.tipo && filtros.tipo !== 'TODOS') {
      where.tipo = filtros.tipo;
    }

    if (filtros.estado && filtros.estado !== 'TODOS') {
      where.estado = filtros.estado;
    }

    const soloMias = filtros.soloMias === true || filtros.soloMias === 'true' || filtros.soloMias === '1';
    if (soloMias && usuarioActual?.partyId) {
      where.autor = { party_id: usuarioActual.partyId };
    }

    if (filtros.busqueda && filtros.busqueda.trim()) {
      const q = filtros.busqueda.trim();
      where.OR = [
        { titulo: { contains: q, mode: 'insensitive' } },
        { detalle: { contains: q, mode: 'insensitive' } },
        { codigo: { contains: q, mode: 'insensitive' } },
        {
          autor: {
            party: {
              persona: {
                OR: [
                  { nombres: { contains: q, mode: 'insensitive' } },
                  { apellidos: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const iniciativas = await this.prisma.iniciativa.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      include: {
        autor: {
          include: {
            party: {
              include: { persona: true },
            },
          },
        },
        comentarios: {
          orderBy: { creado_en: 'asc' },
          include: {
            autor: {
              include: {
                party: {
                  include: { persona: true },
                },
              },
            },
          },
        },
      },
    });

    const elementos = iniciativas.map((item) => {
      const autorPersona = item.autor?.party?.persona;
      const autorNombre = autorPersona
        ? `${autorPersona.nombres || ''} ${autorPersona.apellidos || ''}`.trim()
        : 'Colaborador';
      const autorRol = item.autor?.rol || 'Personal';

      const comentarios = item.comentarios.map((c) => {
        const cPersona = c.autor?.party?.persona;
        const cNombre = cPersona
          ? `${cPersona.nombres || ''} ${cPersona.apellidos || ''}`.trim()
          : 'Colaborador';
        const cRol = c.autor?.rol || 'Personal';

        return {
          id: c.id.toString(),
          iniciativaId: c.iniciativa_id.toString(),
          texto: c.texto,
          creadoEn: c.creado_en.toISOString(),
          fechaTexto: this.formatearFechaHora(c.creado_en),
          autor: {
            id: c.creado_por.toString(),
            nombre: cNombre,
            rol: cRol,
          },
        };
      });

      const fotoUrl = item.archivo_id
        ? `/admin/archivos/${item.archivo_id.toString()}`
        : null;

      return {
        id: item.id.toString(),
        codigo: item.codigo,
        tipo: item.tipo,
        tipoTexto: ETIQUETAS_TIPO[item.tipo] || item.tipo,
        area: item.area,
        areaTexto: ETIQUETAS_AREA[item.area] || item.area,
        titulo: item.titulo,
        detalle: item.detalle,
        archivoId: item.archivo_id ? item.archivo_id.toString() : null,
        fotoUrl,
        estado: item.estado,
        estadoTexto: ETIQUETAS_ESTADO[item.estado] || item.estado,
        creadoEn: item.creado_en.toISOString(),
        fechaTexto: this.formatearFechaHora(item.creado_en),
        autor: {
          id: item.creado_por.toString(),
          nombre: autorNombre,
          rol: autorRol,
        },
        comentarios,
        totalComentarios: comentarios.length,
      };
    });

    return {
      conteos: {
        total,
        nuevas,
        enRevision,
        hechas,
        noPorAhora,
        quejas,
        mejoras,
        ideas,
      },
      elementos,
    };
  }

  /**
   * Sube una nueva iniciativa con confirmación y auditoría obligatoria (DT-53, RQ-INI-01-01).
   */
  async crear(dto: CrearIniciativaDto, usuarioActual: UsuarioAutenticado, ip?: string) {
    if (!usuarioActual?.partyId) {
      throw new ForbiddenException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Debes iniciar sesión para subir una iniciativa',
      });
    }

    const codigo = await this.generarCodigo();
    const usuarioId = await this.obtenerUserAccountId(usuarioActual.partyId);
    const archivoId = dto.archivoId ? BigInt(dto.archivoId) : null;

    const iniciativa = await this.prisma.iniciativa.create({
      data: {
        codigo,
        tipo: dto.tipo,
        area: dto.area,
        titulo: dto.titulo.trim(),
        detalle: dto.detalle.trim(),
        archivo_id: archivoId,
        estado: 'NUEVA',
        creado_por: usuarioId,
      },
      include: {
        autor: {
          include: {
            party: {
              include: { persona: true },
            },
          },
        },
      },
    });

    // Auditoría de acción en la misma transacción lógica
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'iniciativas',
      accion: 'INICIATIVA_NUEVA',
      resultado: 'OK',
      entidad: 'iniciativa',
      entidadId: iniciativa.id,
      partyId: usuarioActual.partyId,
      antes: null,
      despues: {
        codigo: iniciativa.codigo,
        tipo: iniciativa.tipo,
        area: iniciativa.area,
        titulo: iniciativa.titulo,
        estado: iniciativa.estado,
      },
      ip,
    });

    return {
      id: iniciativa.id.toString(),
      codigo: iniciativa.codigo,
      tipo: iniciativa.tipo,
      area: iniciativa.area,
      titulo: iniciativa.titulo,
      detalle: iniciativa.detalle,
      archivoId: iniciativa.archivo_id ? iniciativa.archivo_id.toString() : null,
      estado: iniciativa.estado,
      creadoEn: iniciativa.creado_en.toISOString(),
    };
  }

  /**
   * Agrega un comentario a una iniciativa (RQ-INI-01-07).
   */
  async comentar(
    id: bigint | string | number,
    dto: CrearComentarioDto,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const iniciativaId = this.parsearId(id);

    const iniciativa = await this.prisma.iniciativa.findUnique({
      where: { id: iniciativaId },
    });

    if (!iniciativa) {
      throw new NotFoundException({
        codigo: 'INICIATIVA_NO_ENCONTRADA',
        mensaje: 'La iniciativa no existe',
      });
    }

    const usuarioId = await this.obtenerUserAccountId(usuarioActual.partyId);
    const comentario = await this.prisma.iniciativaComentario.create({
      data: {
        iniciativa_id: iniciativaId,
        texto: dto.texto.trim(),
        creado_por: usuarioId,
      },
      include: {
        autor: {
          include: {
            party: {
              include: { persona: true },
            },
          },
        },
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'iniciativas',
      accion: 'INICIATIVA_COMENTARIO',
      resultado: 'OK',
      entidad: 'iniciativa_comentario',
      entidadId: comentario.id,
      partyId: usuarioActual.partyId,
      despues: {
        iniciativaId: iniciativaId.toString(),
        texto: comentario.texto,
      },
      ip,
    });

    const cPersona = comentario.autor?.party?.persona;
    const autorNombre = cPersona
      ? `${cPersona.nombres || ''} ${cPersona.apellidos || ''}`.trim()
      : 'Colaborador';

    return {
      id: comentario.id.toString(),
      iniciativaId: comentario.iniciativa_id.toString(),
      texto: comentario.texto,
      creadoEn: comentario.creado_en.toISOString(),
      fechaTexto: this.formatearFechaHora(comentario.creado_en),
      autor: {
        id: comentario.creado_por.toString(),
        nombre: autorNombre,
        rol: comentario.autor?.rol || 'Personal',
      },
    };
  }

  /**
   * Cambia el estado de una iniciativa (Solo administrador, RQ-INI-01-08).
   */
  async cambiarEstado(
    id: bigint | string | number,
    dto: CambiarEstadoDto,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    if (usuarioActual.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SIN_PERMISO',
        mensaje: 'Solo el administrador puede cambiar el estado de una iniciativa',
      });
    }

    const iniciativaId = this.parsearId(id);

    const iniciativa = await this.prisma.iniciativa.findUnique({
      where: { id: iniciativaId },
    });

    if (!iniciativa) {
      throw new NotFoundException({
        codigo: 'INICIATIVA_NO_ENCONTRADA',
        mensaje: 'La iniciativa no existe',
      });
    }

    const estadoAnterior = iniciativa.estado;
    const ahora = new Date();
    const usuarioId = await this.obtenerUserAccountId(usuarioActual.partyId);

    const actualizada = await this.prisma.iniciativa.update({
      where: { id: iniciativaId },
      data: {
        estado: dto.estado,
        estado_cambiado_en: ahora,
        estado_cambiado_por: usuarioId,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'iniciativas',
      accion: 'INICIATIVA_ESTADO',
      resultado: 'OK',
      entidad: 'iniciativa',
      entidadId: iniciativaId,
      partyId: usuarioActual.partyId,
      antes: { estado: estadoAnterior },
      despues: { estado: dto.estado },
      ip,
    });

    return {
      id: actualizada.id.toString(),
      codigo: actualizada.codigo,
      estado: actualizada.estado,
      estadoTexto: ETIQUETAS_ESTADO[actualizada.estado] || actualizada.estado,
      estadoCambiadoEn: ahora.toISOString(),
    };
  }

  /**
   * Cuenta iniciativas nuevas para la insignia del menú lateral (RQ-INI-01-09).
   */
  async obtenerConteoNuevas(): Promise<{ nuevas: number }> {
    const nuevas = await this.prisma.iniciativa.count({
      where: { estado: 'NUEVA' },
    });
    return { nuevas };
  }
}
