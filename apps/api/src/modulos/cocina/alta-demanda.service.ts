import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AltaDemandaDto } from './dto/alta-demanda.dto';

@Injectable()
export class AltaDemandaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /**
   * Resuelve el nombre visible de un usuario para notificaciones y eventos.
   */
  private async obtenerNombreUsuario(partyId: bigint): Promise<string> {
    try {
      const persona = await this.prisma.person.findUnique({
        where: { party_id: partyId },
      });
      if (persona) {
        return `${persona.nombres}${persona.apellidos ? ' ' + persona.apellidos : ''}`.trim();
      }
    } catch {
      // Ignorar error de consulta y usar fallback
    }

    return 'Cocina';
  }

  /**
   * GET /admin/cocina/alta-demanda
   * Devuelve el estado actual de la alta demanda y la pausa en cocina,
   * incluyendo quién realizó la última activación/desactivación y cuándo.
   */
  async obtenerEstado() {
    const activo = await this.prisma.altaDemanda.findFirst({
      where: { hasta: null },
      orderBy: { desde: 'desc' },
    });

    if (!activo) {
      const ultimo = await this.prisma.altaDemanda.findFirst({
        orderBy: { id: 'desc' },
      });
      const nombreUsuario = ultimo ? await this.obtenerNombreUsuario(ultimo.por) : undefined;
      return {
        activa: false,
        minutos: 0,
        pausa: false,
        desde: ultimo?.hasta ?? ultimo?.desde,
        por: ultimo?.por?.toString(),
        activado_por: nombreUsuario,
        mensaje: nombreUsuario ? `desactivó ${nombreUsuario}` : undefined,
      };
    }

    const nombreUsuario = await this.obtenerNombreUsuario(activo.por);

    return {
      activa: true,
      minutos: activo.minutos,
      pausa: activo.pausa,
      desde: activo.desde,
      por: activo.por.toString(),
      activado_por: nombreUsuario,
      mensaje: `activó ${nombreUsuario}`,
    };
  }

  /**
   * PUT /admin/cocina/alta-demanda
   * Configura la alta demanda y/o la pausa.
   * Reglas:
   * - Minutos entre 5 y 180 (400 MINUTOS_INVALIDOS).
   * - La pausa sólo con alta demanda activa (409 PAUSA_SIN_ALTA_DEMANDA).
   * - Apagar quita los minutos y la pausa.
   * - Sincroniza la clave de parámetro 'pausa_alta_demanda'.
   * - Emite evento 'cocina:alta-demanda' con «activó <nombre>».
   */
  async configurar(
    dto: AltaDemandaDto,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const ahora = new Date();

    // Regla: la pausa sólo se permite con alta demanda activa
    if (!dto.activa && dto.pausa) {
      throw new ConflictException({
        codigo: 'PAUSA_SIN_ALTA_DEMANDA',
        mensaje: 'La pausa de pedidos solo se puede activar con alta demanda activa',
      });
    }

    // Regla: si se activa, los minutos deben estar entre 5 y 180
    if (dto.activa) {
      if (
        dto.minutos === undefined ||
        dto.minutos === null ||
        isNaN(dto.minutos) ||
        dto.minutos < 5 ||
        dto.minutos > 180
      ) {
        throw new BadRequestException({
          codigo: 'MINUTOS_INVALIDOS',
          mensaje: 'Los minutos de alta demanda deben estar entre 5 y 180',
        });
      }
    }

    const nombreUsuario = await this.obtenerNombreUsuario(usuarioActual.partyId);

    // Cerrar cualquier alta demanda activa anterior
    await this.prisma.altaDemanda.updateMany({
      where: { hasta: null },
      data: { hasta: ahora },
    });

    let registroCreadoId = 0n;

    if (dto.activa) {
      const registro = await this.prisma.altaDemanda.create({
        data: {
          minutos: dto.minutos!,
          pausa: Boolean(dto.pausa),
          desde: ahora,
          hasta: null,
          por: usuarioActual.partyId,
        },
      });
      registroCreadoId = registro.id;

      // Actualizar parámetro 'pausa_alta_demanda' para que la carta y local.service lo reconozcan
      await this.prisma.parametro.upsert({
        where: { clave: 'pausa_alta_demanda' },
        update: {
          valor: {
            activa: Boolean(dto.pausa),
            motivo: 'Por alta demanda en cocina',
          },
        },
        create: {
          clave: 'pausa_alta_demanda',
          valor: {
            activa: Boolean(dto.pausa),
            motivo: 'Por alta demanda en cocina',
          },
        },
      });
    } else {
      // Al apagar se quitan los minutos y la pausa
      await this.prisma.parametro.upsert({
        where: { clave: 'pausa_alta_demanda' },
        update: {
          valor: {
            activa: false,
          },
        },
        create: {
          clave: 'pausa_alta_demanda',
          valor: {
            activa: false,
          },
        },
      });
    }

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'ALTA_DEMANDA',
      resultado: 'OK',
      entidad: 'alta_demanda',
      entidadId: registroCreadoId,
      despues: {
        activa: dto.activa,
        minutos: dto.activa ? dto.minutos : 0,
        pausa: dto.activa ? Boolean(dto.pausa) : false,
      },
      partyId: usuarioActual.partyId,
      ip,
    });

    // Emisión de evento en vivo a todas las áreas
    const mensaje = dto.activa ? `activó ${nombreUsuario}` : `desactivó ${nombreUsuario}`;

    this.eventosGateway?.emitirAdmin('cocina:alta-demanda', {
      activa: dto.activa,
      minutos: dto.activa ? dto.minutos : 0,
      pausa: dto.activa ? Boolean(dto.pausa) : false,
      mensaje,
      activado_por: nombreUsuario,
      por: usuarioActual.partyId.toString(),
      en: ahora,
    });

    return {
      ok: true,
      activa: dto.activa,
      minutos: dto.activa ? dto.minutos : 0,
      pausa: dto.activa ? Boolean(dto.pausa) : false,
      mensaje,
    };
  }

  /**
   * Método público que suma los minutos extra de alta demanda al rango base prometido.
   * Si no hay alta demanda activa, devuelve el rango base sin modificaciones.
   * Soporta string (ej. "de 25 a 35 minutos"), objeto { min, max }, arreglo o número.
   */
  async tiempoPrometido(rangoBase: any): Promise<any> {
    const activo = await this.prisma.altaDemanda.findFirst({
      where: { hasta: null },
      orderBy: { desde: 'desc' },
    });

    if (!activo || activo.minutos <= 0) {
      return rangoBase;
    }

    const extra = activo.minutos;

    if (typeof rangoBase === 'number') {
      return rangoBase + extra;
    }

    if (Array.isArray(rangoBase)) {
      return rangoBase.map((item) => (typeof item === 'number' ? item + extra : item));
    }

    if (typeof rangoBase === 'object' && rangoBase !== null) {
      const copia: any = { ...rangoBase };
      if (typeof copia.min === 'number') copia.min += extra;
      if (typeof copia.max === 'number') copia.max += extra;
      if (typeof copia.desde === 'number') copia.desde += extra;
      if (typeof copia.hasta === 'number') copia.hasta += extra;
      return copia;
    }

    if (typeof rangoBase === 'string') {
      // Buscar rangos como "de 25 a 35 minutos", "25 a 35", "25-35"
      const regexRango = /(\d+)\s*(a|-)\s*(\d+)/i;
      const match = rangoBase.match(regexRango);
      if (match) {
        const min = parseInt(match[1], 10) + extra;
        const sep = match[2];
        const max = parseInt(match[3], 10) + extra;
        return rangoBase.replace(regexRango, `${min} ${sep} ${max}`);
      }

      const regexNumero = /\d+/;
      const matchNum = rangoBase.match(regexNumero);
      if (matchNum) {
        const val = parseInt(matchNum[0], 10) + extra;
        return rangoBase.replace(regexNumero, val.toString());
      }
    }

    return rangoBase;
  }
}
