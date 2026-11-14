import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RegistroAuditoria } from './auditoria.tipos';
import { Prisma } from '@prisma/client';
import { inicioDiaLimaIso, sumarDiasIso, hoyLimaIso } from '../../comun/fechas-lima';

/** Máximo de días que se miran al buscar dentro del JSON (pedido/producto): no hay índice para eso. */
export const MAX_DIAS_BUSQUEDA_JSON = 31;
const TOPE_IDS_JSON = 5000;
const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface FiltrosAuditoria {
  modulo?: string;
  accion?: string;
  partyId?: bigint | string | number;
  desde?: Date | string;
  hasta?: Date | string;
  entidad?: string;
  categoria?: string;
  resultado?: string;
  busqueda?: string;
  /** Texto libre solo en el motivo. */
  motivo?: string;
  /** Código (CP-W422) o id del pedido: trae el pedido y lo relacionado que lo nombra. */
  pedido?: string;
  /** Nombre o id del producto. */
  producto?: string;
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

  /** Límite de fecha: YYYY-MM-DD es día de Lima; otra cosa se interpreta como instante. */
  private limite(valor: Date | string, final: boolean): Date | undefined {
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return inicioDiaLimaIso(final ? sumarDiasIso(valor, 1) : valor);
    }
    const d = new Date(valor);
    return isNaN(d.getTime()) ? undefined : d;
  }

  /** WHERE de Prisma; `omitir` saca filtros para calcular los conteos de ese combo. */
  private armarWhere(filtros: FiltrosAuditoria, omitir: Array<'categoria' | 'resultado'> = []) {
    const where: any = {};
    if (filtros.modulo) where.modulo = filtros.modulo;
    if (filtros.accion) where.accion = filtros.accion;
    if (filtros.partyId !== undefined && filtros.partyId !== null && filtros.partyId !== '') {
      try {
        where.party_id = BigInt(filtros.partyId);
      } catch {
        where.party_id = -1n; // id inválido: no coincide con nada
      }
    }
    if (filtros.entidad) where.entidad = filtros.entidad;
    if (filtros.categoria && !omitir.includes('categoria')) {
      const c = filtros.categoria.toUpperCase();
      where.categoria = c === 'SENSIBLE' ? 'LECTURA_SENSIBLE' : c;
    }
    if (filtros.resultado && !omitir.includes('resultado')) where.resultado = filtros.resultado.toUpperCase();
    const desde = filtros.desde ? this.limite(filtros.desde, false) : undefined;
    const hasta = filtros.hasta ? this.limite(filtros.hasta, true) : undefined;
    if (desde || hasta) {
      where.en = {};
      if (desde) where.en.gte = desde;
      // hasta inclusivo: el día elegido entra completo (límite exclusivo = inicio del día siguiente)
      if (hasta) {
        if (typeof filtros.hasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(filtros.hasta)) where.en.lt = hasta;
        else where.en.lte = hasta;
      }
    }
    const m = filtros.motivo?.trim();
    if (m) where.motivo = { contains: m, mode: 'insensitive' };
    const q = filtros.busqueda?.trim();
    if (q) {
      const texto = (campo: string) => ({ [campo]: { contains: q, mode: 'insensitive' } });
      const or: any[] = [texto('accion'), texto('modulo'), texto('entidad'), texto('motivo'), texto('dispositivo')];
      if (/^\d{1,15}$/.test(q)) or.push({ entidad_id: BigInt(q) }, { party_id: BigInt(q) });
      where.OR = or;
    }
    return where;
  }

  /** Rango de la búsqueda dentro del JSON: el pedido por defecto 31 días y nunca más de 31. */
  private rangoJson(filtros: FiltrosAuditoria): { desde: Date; hasta: Date; recortado: boolean } {
    const hoy = hoyLimaIso();
    const hastaIso = typeof filtros.hasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(filtros.hasta) ? filtros.hasta : hoy;
    const hasta = this.limite(hastaIso, true)!; // exclusivo: inicio del día siguiente
    let desde = filtros.desde ? this.limite(filtros.desde, false) : undefined;
    const minimo = inicioDiaLimaIso(sumarDiasIso(hastaIso, -(MAX_DIAS_BUSQUEDA_JSON - 1)));
    let recortado = false;
    if (!desde || desde < minimo) {
      recortado = true;
      desde = minimo;
    }
    return { desde, hasta, recortado };
  }

  /** Ids de auditoría que mencionan el pedido o el producto (búsqueda en JSON, siempre con rango). */
  private async idsPorJson(filtros: FiltrosAuditoria): Promise<{ ids: bigint[]; aviso?: string } | undefined> {
    const pedido = filtros.pedido?.trim();
    const producto = filtros.producto?.trim();
    if (!pedido && !producto) return undefined;
    if (pedido && producto) {
      // los dos a la vez: intersección de ids
      const a = await this.idsPorJson({ ...filtros, producto: undefined });
      const b = await this.idsPorJson({ ...filtros, pedido: undefined });
      const set = new Set((b?.ids ?? []).map(String));
      return { ids: (a?.ids ?? []).filter((i) => set.has(i.toString())), aviso: a?.aviso };
    }
    const { desde, hasta, recortado } = this.rangoJson(filtros);
    const cond: Prisma.Sql[] = [];

    if (pedido) {
      const esId = /^\d{1,15}$/.test(pedido);
      const p = await this.prisma.pedido.findFirst({
        where: esId ? { id: BigInt(pedido) } : { codigo: pedido.toUpperCase() },
        select: { id: true, codigo: true },
      });
      const idTxt = p ? p.id.toString() : '';
      const codigo = p ? p.codigo : pedido.toUpperCase();
      const quoted = `%"${escaparLike(codigo)}"%`;
      cond.push(Prisma.sql`(entidad = 'pedido' AND entidad_id = ${p ? p.id : -1n})`);
      if (p) {
        cond.push(Prisma.sql`(despues->>'pedidoId' = ${idTxt} OR antes->>'pedidoId' = ${idTxt} OR despues->>'pedido_id' = ${idTxt} OR antes->>'pedido_id' = ${idTxt})`);
      }
      if (!esId) cond.push(Prisma.sql`(despues::text LIKE ${quoted} OR antes::text LIKE ${quoted})`);
    }

    if (producto) {
      const esId = /^\d{1,15}$/.test(producto);
      const idsProd = esId ? [BigInt(producto)] : [];
      if (!esId) {
        const hallados = await this.prisma.producto.findMany({
          where: { nombre: { contains: producto, mode: 'insensitive' } },
          select: { id: true },
          take: 20,
        });
        idsProd.push(...hallados.map((h) => h.id));
      }
      if (idsProd.length) {
        cond.push(Prisma.sql`(entidad = 'producto' AND entidad_id IN (${Prisma.join(idsProd)}))`);
        const txt = idsProd.map(String);
        cond.push(Prisma.sql`(despues->>'productoId' IN (${Prisma.join(txt)}) OR antes->>'productoId' IN (${Prisma.join(txt)}) OR despues->>'producto_id' IN (${Prisma.join(txt)}))`);
      }
      if (!esId) {
        const like = `%${escaparLike(producto)}%`;
        cond.push(Prisma.sql`(despues::text ILIKE ${like} OR antes::text ILIKE ${like})`);
      }
    }

    if (!cond.length) return { ids: [] };

    const filas = await this.prisma.$queryRaw<Array<{ id: bigint }>>(
      Prisma.sql`SELECT id FROM auditoria WHERE en >= ${desde} AND en < ${hasta} AND (${Prisma.join(cond, ' OR ')}) ORDER BY en DESC LIMIT ${TOPE_IDS_JSON}`,
    );
    return {
      ids: filas.map((f) => f.id),
      aviso: recortado
        ? `Para buscar por pedido o producto se revisan como máximo ${MAX_DIAS_BUSQUEDA_JSON} días (por defecto, los últimos ${MAX_DIAS_BUSQUEDA_JSON}). Elige otras fechas para ver otro tramo.`
        : undefined,
    };
  }

  /** Valores que existen, para los selectores de módulo y acción. */
  async opciones() {
    const [modulos, acciones] = await Promise.all([
      this.prisma.auditoria.groupBy({ by: ['modulo'], _count: { _all: true }, orderBy: { modulo: 'asc' } }),
      this.prisma.auditoria.groupBy({ by: ['accion'], _count: { _all: true }, orderBy: { accion: 'asc' } }),
    ]);
    return { modulos: modulos.map((m) => m.modulo), acciones: acciones.map((a) => a.accion) };
  }

  /** Buscador de personas por nombre (para filtrar quién hizo la acción). */
  async personas(q: string) {
    const t = q.trim();
    if (t.length < 2) return [];
    const filas = await this.prisma.person.findMany({
      where: { OR: [{ nombres: { contains: t, mode: 'insensitive' } }, { apellidos: { contains: t, mode: 'insensitive' } }] },
      select: { party_id: true, nombres: true, apellidos: true },
      orderBy: { nombres: 'asc' },
      take: 10,
    });
    return filas.map((f) => ({ id: f.party_id.toString(), nombre: `${f.nombres} ${f.apellidos ?? ''}`.trim() }));
  }

  /**
   * Lista los eventos de auditoría según filtros y paginación en orden cronológico descendente.
   */
  async listar(filtros: FiltrosAuditoria = {}) {
    const limite = Math.min(Math.max(1, Number(filtros.limite) || 20), 100);
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const skip = (pagina - 1) * limite;

    const json = await this.idsPorJson(filtros);
    const conIds = (w: any) => (json ? { ...w, id: { in: json.ids } } : w);
    const base = conIds(this.armarWhere(filtros));
    const catWhere = conIds(this.armarWhere(filtros, ['categoria']));
    const resWhere = conIds(this.armarWhere(filtros, ['resultado']));

    const [total, registros, porCategoria, porResultado] = await Promise.all([
      this.prisma.auditoria.count({ where: base }),
      this.prisma.auditoria.findMany({
        where: base,
        orderBy: { en: 'desc' },
        skip,
        take: limite,
      }),
      this.prisma.auditoria.groupBy({ by: ['categoria'], where: catWhere, _count: { _all: true } }),
      this.prisma.auditoria.groupBy({ by: ['resultado'], where: resWhere, _count: { _all: true } }),
    ]);

    // Conteos reales para los combos: cada uno respeta los demás filtros pero no el suyo.
    const conteos = {
      categoria: Object.fromEntries(porCategoria.map((g) => [g.categoria, g._count._all])),
      resultado: Object.fromEntries(porResultado.map((g) => [g.resultado, g._count._all])),
    };

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
      conteos,
      aviso: json?.aviso,
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
