import { etiquetaMotivo } from '../cortesias/cortesia.tipos';

/** Tipo de evento del historial del pedido (la web les da un color a cada uno). */
export type TipoEventoPedido = 'cortesia' | 'edicion' | 'cobro' | 'anulacion' | 'estado' | 'otro';

export interface EventoPedido {
  id: string;
  tipo: TipoEventoPedido;
  titulo: string;
  detalle: string | null;
  en: Date;
  por: string | null;
}

const TITULOS: Record<string, [TipoEventoPedido, string]> = {
  EDITAR_PEDIDO: ['edicion', 'Pedido editado'],
  AGREGAR_EXTRA: ['edicion', 'Pedido extra agregado'],
  CORREGIR_CLIENTE: ['edicion', 'Datos del cliente corregidos'],
  REGISTRAR_PAGO: ['cobro', 'Cobro registrado'],
  REGISTRAR_PAGO_SIN_VOUCHER: ['cobro', 'Cobro registrado sin voucher'],
  EMITIR: ['cobro', 'Comprobante emitido'],
  REIMPRIMIR: ['cobro', 'Comprobante reimpreso'],
  ANULAR_ELECTRONICO: ['anulacion', 'Comprobante anulado'],
  ANULAR_COBRO: ['anulacion', 'Cobro anulado'],
};

/** Acciones que son lecturas o que el historial de estados ya cuenta: no entran a la línea de tiempo. */
const OMITIR = /^(VER_|DESCARGAR_|LISTAR_|CONSULTA_|CAMBIAR_ESTADO$|ANULAR$)/;

function humanizar(accion: string): string {
  const t = accion.toLowerCase().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface FilaAuditoria { id: bigint; accion: string; en: Date; party_id: bigint | null; motivo?: string | null }
interface FilaHistorial { id: bigint; estado_anterior: string | null; estado_nuevo: string; motivo: string | null; por_party_id: bigint | null; en: Date }
export interface FilaCortesiaPedido {
  id: bigint;
  cantidad: number;
  motivo: string;
  nota: string | null;
  creado_en: Date;
  dada_por_party_id: bigint;
  producto?: { nombre: string } | null;
  pedidoLinea?: { nombre: string } | null;
}

/** Línea de tiempo del pedido en orden cronológico: estados, cortesías, ediciones, cobros y anulaciones. Una entrada por cortesía. */
export function armarEventosPedido(
  e: { auditoria: FilaAuditoria[]; historial: FilaHistorial[]; cortesias: FilaCortesiaPedido[] },
  nombre: (partyId: bigint | null) => string | null,
): EventoPedido[] {
  const eventos: EventoPedido[] = [];
  for (const h of e.historial) {
    const anulado = h.estado_nuevo === 'ANULADO';
    eventos.push({
      id: `h${h.id}`,
      tipo: anulado ? 'anulacion' : 'estado',
      titulo: anulado ? 'Pedido anulado' : `Estado: ${h.estado_nuevo}`,
      detalle: h.motivo,
      en: h.en,
      por: nombre(h.por_party_id),
    });
  }
  for (const a of e.auditoria) {
    if (OMITIR.test(a.accion)) continue;
    const [tipo, titulo] = TITULOS[a.accion] ?? (['otro', humanizar(a.accion)] as [TipoEventoPedido, string]);
    eventos.push({ id: `a${a.id}`, tipo, titulo, detalle: a.motivo ?? null, en: a.en, por: nombre(a.party_id) });
  }
  for (const c of e.cortesias) {
    const producto = c.pedidoLinea?.nombre ?? c.producto?.nombre ?? 'Producto';
    eventos.push({
      id: `c${c.id}`,
      tipo: 'cortesia',
      titulo: `Cortesía: ${c.cantidad}× ${producto}`,
      detalle: [etiquetaMotivo(c.motivo), c.nota].filter(Boolean).join(' · '),
      en: c.creado_en,
      por: nombre(c.dada_por_party_id),
    });
  }
  return eventos.sort((x, y) => x.en.getTime() - y.en.getTime());
}

/** Lee lo necesario de la base y arma los eventos y la ficha de cortesía de cada línea (quién, cuándo y por qué). */
export async function cargarAuditoriaPedido(prisma: any, pedidoId: bigint, historial: FilaHistorial[]) {
  const [auditoria, cortesias] = await Promise.all([
    prisma.auditoria.findMany({
      where: { entidad: 'pedido', entidad_id: pedidoId, categoria: 'CAMBIO', modulo: { not: 'cortesias' } },
      orderBy: { en: 'asc' },
      select: { id: true, accion: true, en: true, party_id: true, motivo: true },
    }),
    prisma.cortesia.findMany({
      where: { OR: [{ pedido_id: pedidoId }, { pedido_referencia_id: pedidoId }] },
      orderBy: { creado_en: 'asc' },
      include: { producto: { select: { nombre: true } }, pedidoLinea: { select: { nombre: true } } },
    }),
  ]);
  const ids = new Set<bigint>();
  for (const a of auditoria) if (a.party_id) ids.add(a.party_id);
  for (const h of historial) if (h.por_party_id) ids.add(h.por_party_id);
  for (const c of cortesias) ids.add(c.dada_por_party_id);
  const personas: Array<{ party_id: bigint; nombres: string | null; apellidos: string | null }> = ids.size
    ? await prisma.person.findMany({ where: { party_id: { in: [...ids] } }, select: { party_id: true, nombres: true, apellidos: true } })
    : [];
  const nombre = (partyId: bigint | null) => {
    if (partyId === null || partyId === undefined) return null;
    const p = personas.find((x) => x.party_id === partyId);
    return p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : `Usuario ${partyId}`;
  };
  const cortesiaPorLinea = new Map<string, any>();
  for (const c of cortesias) {
    if (c.pedido_linea_id) {
      cortesiaPorLinea.set(String(c.pedido_linea_id), {
        valor_lista: c.valor_lista,
        motivo: c.motivo,
        motivo_etiqueta: etiquetaMotivo(c.motivo),
        nota: c.nota,
        dada_por: nombre(c.dada_por_party_id),
        creado_en: c.creado_en,
      });
    }
  }
  return { eventos: armarEventosPedido({ auditoria, historial, cortesias }, nombre), cortesiaPorLinea };
}
