import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { finDiaLimaIso, inicioDiaLimaIso } from '../../comun/fechas-lima';
import { ORIGENES_IMPRESION, OrigenImpresion, deducirOrigen, etiquetaTipoImpresion } from './origen-impresion';

export const ESTADOS_HISTORIAL = ['IMPRESO', 'FALLIDO', 'PENDIENTE', 'IMPRIMIENDO', 'VENCIDO', 'DESCARTADO'];
export const TIPOS_HISTORIAL = ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_PAGO', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA', 'TICKET_CIERRE'];
const LIMITES = [10, 25, 50, 100];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export interface FiltrosHistorialImpresion {
  desde?: string;
  hasta?: string;
  origen?: string | string[];
  tipo?: string | string[];
  estado?: string | string[];
  equipoId?: string;
  q?: string;
  pagina?: number | string;
  limite?: number | string;
}

const lista = (v: string | string[] | undefined, validos: string[]): string[] =>
  (Array.isArray(v) ? v : (v ?? '').split(','))
    .flatMap((x) => String(x).split(','))
    .map((x) => x.trim().toUpperCase())
    .filter((x) => validos.includes(x));

/** Condición SQL (Prisma) de un origen, incluyendo las filas viejas sin la columna (origen NULL) que se deducen al leer. */
function condicionOrigen(o: OrigenImpresion): any {
  switch (o) {
    case 'REIMPRESION':
      return { OR: [{ origen: 'REIMPRESION' }, { origen: null, OR: [{ copia: true }, { tipo: 'TICKET_CIERRE' }] }] };
    case 'PRUEBA':
      return { OR: [{ origen: 'PRUEBA' }, { origen: null, copia: false, pedido_id: null, NOT: { tipo: 'TICKET_CIERRE' } }] };
    case 'AUTOMATICA':
      return { OR: [{ origen: 'AUTOMATICA' }, { origen: null, copia: false, pedido_id: { not: null } }] };
    default:
      return { origen: 'REINTENTO' };
  }
}

@Injectable()
export class HistorialImpresionService {
  constructor(private readonly prisma: PrismaService) {}

  private idOpcional(v: unknown, campo: string): bigint | null {
    if (v === undefined || v === null || v === '') return null;
    try {
      return BigInt(String(v));
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: `${campo} no válido` });
    }
  }

  /** Filtros comunes (sin origen ni estado, que el resumen cuenta por separado). */
  private whereBase(f: FiltrosHistorialImpresion): any {
    const and: any[] = [];
    if (f.desde && FECHA.test(f.desde)) and.push({ creado_en: { gte: inicioDiaLimaIso(f.desde) } });
    if (f.hasta && FECHA.test(f.hasta)) and.push({ creado_en: { lte: finDiaLimaIso(f.hasta) } });
    const tipos = lista(f.tipo, TIPOS_HISTORIAL);
    if (tipos.length) and.push({ tipo: { in: tipos } });
    const equipo = this.idOpcional(f.equipoId, 'La computadora');
    if (equipo !== null) and.push({ OR: [{ destino_equipo_id: equipo }, { device_key_id: equipo }] });
    const q = (f.q ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (q) {
      const sinGuion = q.replace(/[-\s]/g, '');
      and.push({
        pedido: {
          OR: [{ codigo: { contains: q, mode: 'insensitive' } }, ...(sinGuion && sinGuion !== q ? [{ codigo: { contains: sinGuion, mode: 'insensitive' } }] : [])],
        },
      });
    }
    return { AND: and };
  }

  async listar(f: FiltrosHistorialImpresion) {
    const limiteIn = Number(f.limite);
    const limite = LIMITES.includes(limiteIn) ? limiteIn : 25;
    const pagina = Math.max(1, Math.floor(Number(f.pagina)) || 1);
    const origenes = lista(f.origen, ORIGENES_IMPRESION) as OrigenImpresion[];
    const estados = lista(f.estado, ESTADOS_HISTORIAL);

    const base = this.whereBase(f);
    const conOrigen = origenes.length ? { OR: origenes.map(condicionOrigen) } : {};
    const conEstado = estados.length ? { estado: { in: estados } } : {};
    const where = { AND: [base, conOrigen, conEstado] };

    const [total, filas, porOrigen, porEstado] = await Promise.all([
      this.prisma.printJob.count({ where }),
      this.prisma.printJob.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: { pedido: { select: { codigo: true } } },
      }),
      // El resumen por origen respeta los demás filtros pero no el de origen (y viceversa), como los combos del admin
      Promise.all(ORIGENES_IMPRESION.map((o) => this.prisma.printJob.count({ where: { AND: [base, conEstado, condicionOrigen(o)] } }))),
      Promise.all(ESTADOS_HISTORIAL.map((e) => this.prisma.printJob.count({ where: { AND: [base, conOrigen, { estado: e }] } }))),
    ]);

    return {
      total,
      pagina,
      limite,
      paginas: Math.max(1, Math.ceil(total / limite)),
      datos: await this.armar(filas),
      resumen: {
        origen: Object.fromEntries(ORIGENES_IMPRESION.map((o, i) => [o, porOrigen[i]])),
        estado: Object.fromEntries(ESTADOS_HISTORIAL.map((e, i) => [e, porEstado[i]])),
      },
    };
  }

  /** Todas las impresiones de un pedido (con su origen), de la más nueva a la más vieja. */
  async deUnPedido(pedidoId: string) {
    const id = this.idOpcional(pedidoId, 'El pedido');
    if (id === null) throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Pedido no válido' });
    const filas = await this.prisma.printJob.findMany({
      where: { pedido_id: id },
      orderBy: { id: 'desc' },
      take: 200,
      include: { pedido: { select: { codigo: true } } },
    });
    return { datos: await this.armar(filas) };
  }

  /** Da forma a las filas: origen (guardado o deducido), quién, computadora y etiqueta legible. Solo campos de impresión. */
  private async armar(filas: any[]) {
    if (!filas.length) return [];
    const origenDe = new Map<string, OrigenImpresion>(filas.map((t) => [t.id.toString(), deducirOrigen(t)]));

    // Quién: lo guardado; en filas viejas (sin columna) se busca en la auditoría de impresión de esos minutos
    const viejas = filas.filter((t) => t.origen === null && t.solicitado_por_party_id === null && origenDe.get(t.id.toString()) !== 'AUTOMATICA');
    const deAuditoria = new Map<string, bigint>();
    if (viejas.length) {
      const ms = viejas.map((t) => t.creado_en.getTime());
      const reg = await this.prisma.auditoria
        .findMany({
          where: {
            modulo: 'impresion',
            party_id: { not: null },
            en: { gte: new Date(Math.min(...ms) - 120_000), lte: new Date(Math.max(...ms) + 120_000) },
            accion: { in: ['IMPRESION_PRUEBA', 'IMPRESION_PRUEBA_TAMANO', 'REIMPRIMIR_TRABAJOS', 'REIMPRIMIR_PEDIDO', 'REIMPRIMIR_TICKET_PEDIDO', 'REIMPRIMIR_TICKET_CIERRE'] },
          },
          select: { accion: true, entidad_id: true, despues: true, party_id: true },
        })
        .catch(() => []);
      for (const r of reg) {
        const d: any = r.despues ?? {};
        const ids = [r.entidad_id?.toString(), d.trabajoId, ...(Array.isArray(d.trabajoIds) ? d.trabajoIds : []), ...(Array.isArray(d.copias) ? d.copias : [])]
          .filter((x) => x !== undefined && x !== null)
          .map(String);
        for (const j of ids) if (r.party_id) deAuditoria.set(j, r.party_id);
      }
    }

    const partyIds = [...new Set(filas.map((t) => t.solicitado_por_party_id ?? deAuditoria.get(t.id.toString())).filter((x): x is bigint => x !== undefined && x !== null))];
    const equipoIds = [...new Set(filas.map((t) => t.destino_equipo_id ?? t.device_key_id).filter((x): x is bigint => x !== undefined && x !== null))];
    const [personas, cuentas, equipos] = await Promise.all([
      partyIds.length ? this.prisma.person.findMany({ where: { party_id: { in: partyIds } }, select: { party_id: true, nombres: true, apellidos: true } }) : [],
      partyIds.length ? this.prisma.userAccount.findMany({ where: { party_id: { in: partyIds } }, select: { party_id: true, rol: true } }) : [],
      equipoIds.length ? this.prisma.deviceKey.findMany({ where: { id: { in: equipoIds } }, select: { id: true, nombre: true } }) : [],
    ]);
    const nombre = new Map<string, string>(personas.map((p: any) => [p.party_id.toString(), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
    const rol = new Map<string, string>(cuentas.map((c: any) => [c.party_id.toString(), c.rol]));
    const equipo = new Map<string, string>(equipos.map((e: any) => [e.id.toString(), e.nombre]));

    return filas.map((t) => {
      const party = t.solicitado_por_party_id ?? deAuditoria.get(t.id.toString()) ?? null;
      const eq = t.destino_equipo_id ?? t.device_key_id ?? null;
      return {
        id: t.id.toString(),
        pedidoId: t.pedido_id?.toString() ?? null,
        pedidoCodigo: t.pedido?.codigo ?? null,
        tipo: t.tipo,
        etiqueta: etiquetaTipoImpresion(t.tipo),
        origen: origenDe.get(t.id.toString()) as OrigenImpresion,
        solicitadoPor: party !== null ? { partyId: party.toString(), nombre: nombre.get(party.toString()) ?? 'Usuario', rol: rol.get(party.toString()) ?? null } : null,
        creadoEn: t.creado_en.toISOString(),
        impresoEn: t.impreso_en ? t.impreso_en.toISOString() : null,
        estado: t.estado,
        intentos: t.intentos,
        error: t.error ?? null,
        equipo: eq !== null ? { id: eq.toString(), nombre: equipo.get(eq.toString()) ?? 'Computadora sin identificar' } : null,
        impresora: t.impresora ?? null,
        copia: Boolean(t.copia),
        motivo: t.motivo_origen ?? null,
      };
    });
  }
}
