import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RegistroAuditoria } from './auditoria.tipos';

export interface FiltrosAuditoria {
  modulo?: string;
  accion?: string;
  partyId?: bigint | string | number;
  desde?: Date | string;
  hasta?: Date | string;
  entidad?: string;
  pagina?: number | string;
  limite?: number | string;
}

export interface ResultadoVerificacionCadena {
  valida: boolean;
  totalFilas: number;
  discrepancias: number;
  primerFalloId?: string | null;
  error?: string;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserta un registro en auditoria vía Prisma.
   * Regla de contrato: nunca lanza excepción; si falla, lo registra en el log.
   */
  async registrar(r: RegistroAuditoria, db: any = this.prisma): Promise<void> {
    try {
      // db: cliente de la transacción en curso (si se pasa, el registro se deshace con ella)
      await db.auditoria.create({
        data: {
          categoria: r.categoria,
          modulo: r.modulo,
          accion: r.accion,
          resultado: r.resultado ?? 'OK',
          entidad: r.entidad ?? null,
          entidad_id: r.entidadId !== undefined && r.entidadId !== null ? BigInt(r.entidadId) : null,
          antes: r.antes !== undefined ? (r.antes as any) : undefined,
          despues: r.despues !== undefined ? (r.despues as any) : undefined,
          motivo: r.motivo ?? null,
          party_id: r.partyId !== undefined && r.partyId !== null ? BigInt(r.partyId) : null,
          con_pin_admin: r.conPinAdmin ?? false,
          ip: r.ip ?? null,
          dispositivo: r.dispositivo ?? null,
          request_id: r.requestId ?? null,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error al registrar auditoría: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Lista los eventos de auditoría según filtros y paginación en orden cronológico descendente.
   */
  async listar(filtros: FiltrosAuditoria = {}) {
    const limite = Math.min(Math.max(1, Number(filtros.limite) || 20), 100);
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const skip = (pagina - 1) * limite;

    const where: any = {};

    if (filtros.modulo) {
      where.modulo = filtros.modulo;
    }
    if (filtros.accion) {
      where.accion = filtros.accion;
    }
    if (filtros.partyId !== undefined && filtros.partyId !== null && filtros.partyId !== '') {
      where.party_id = BigInt(filtros.partyId);
    }
    if (filtros.entidad) {
      where.entidad = filtros.entidad;
    }
    if (filtros.desde || filtros.hasta) {
      where.en = {};
      if (filtros.desde) {
        where.en.gte = new Date(filtros.desde);
      }
      if (filtros.hasta) {
        where.en.lte = new Date(filtros.hasta);
      }
    }

    const [total, registros] = await Promise.all([
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({
        where,
        orderBy: { en: 'desc' },
        skip,
        take: limite,
      }),
    ]);

    const datos = registros.map((reg) => ({
      id: reg.id.toString(),
      categoria: reg.categoria,
      modulo: reg.modulo,
      accion: reg.accion,
      resultado: reg.resultado,
      entidad: reg.entidad,
      entidadId: reg.entidad_id ? reg.entidad_id.toString() : null,
      antes: reg.antes,
      despues: reg.despues,
      motivo: reg.motivo,
      partyId: reg.party_id ? reg.party_id.toString() : null,
      conPinAdmin: reg.con_pin_admin,
      ip: reg.ip,
      dispositivo: reg.dispositivo,
      requestId: reg.request_id,
      en: reg.en,
      hashAnterior: reg.hash_anterior ? Buffer.from(reg.hash_anterior).toString('hex') : null,
      hash: reg.hash ? Buffer.from(reg.hash).toString('hex') : '',
    }));

    return {
      total,
      pagina,
      limite,
      paginas: Math.ceil(total / limite),
      datos,
    };
  }

  /**
   * Recorre la tabla y valida criptográficamente que cada hash_anterior corresponda
   * al hash de la fila previa y que el hash actual coincida con el sha256 de su contenido.
   */
  async verificarCadena(): Promise<ResultadoVerificacionCadena> {
    try {
      const resumen: any[] = await this.prisma.$queryRaw`
        WITH verificacion AS (
          SELECT
            id,
            hash_anterior,
            hash,
            LAG(hash) OVER (ORDER BY id) as esperado_anterior,
            sha256(
              coalesce(LAG(hash) OVER (ORDER BY id), ''::bytea) ||
              convert_to(concat_ws('|', categoria, modulo, accion, resultado, entidad, entidad_id,
                         antes::text, despues::text, motivo, party_id, con_pin_admin, ip, en), 'UTF8')
            ) as hash_recalculado
          FROM auditoria
        )
        SELECT
          count(*)::bigint as total,
          count(*) FILTER (WHERE hash_anterior IS DISTINCT FROM esperado_anterior OR hash != hash_recalculado)::bigint as discrepancias
        FROM verificacion;
      `;

      const totalFilas = Number(resumen[0]?.total ?? 0);
      const discrepancias = Number(resumen[0]?.discrepancias ?? 0);

      if (discrepancias === 0) {
        return {
          valida: true,
          totalFilas,
          discrepancias: 0,
        };
      }

      const primerFallo: any[] = await this.prisma.$queryRaw`
        WITH verificacion AS (
          SELECT
            id,
            hash_anterior,
            hash,
            LAG(hash) OVER (ORDER BY id) as esperado_anterior,
            sha256(
              coalesce(LAG(hash) OVER (ORDER BY id), ''::bytea) ||
              convert_to(concat_ws('|', categoria, modulo, accion, resultado, entidad, entidad_id,
                         antes::text, despues::text, motivo, party_id, con_pin_admin, ip, en), 'UTF8')
            ) as hash_recalculado
          FROM auditoria
        )
        SELECT id
        FROM verificacion
        WHERE hash_anterior IS DISTINCT FROM esperado_anterior OR hash != hash_recalculado
        ORDER BY id
        LIMIT 1;
      `;

      return {
        valida: false,
        totalFilas,
        discrepancias,
        primerFalloId: primerFallo[0]?.id ? primerFallo[0].id.toString() : null,
      };
    } catch (error: any) {
      this.logger.error(`Error al verificar la cadena de auditoría: ${error?.message}`, error?.stack);
      return {
        valida: false,
        totalFilas: 0,
        discrepancias: -1,
        error: error?.message || 'Error desconocido al verificar integridad de la cadena',
      };
    }
  }
}
