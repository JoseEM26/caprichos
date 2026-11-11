import type { Pedido } from './pedidosApi';
import { claveModalidad } from './InsigniaModalidad';
import { estadoVisual } from './estadosCaja';
import { totalDe } from './resumenDia';

/** Pestañas de la vista Lista: por tipo de servicio. «todos» suma las tres. */
export type PestanaLista = 'todos' | 'mostrador' | 'domicilio' | 'mesas';
export const PESTANAS_LISTA: { id: PestanaLista; n: string }[] = [
  { id: 'todos', n: 'Todos' },
  { id: 'mostrador', n: 'Mostrador' },
  { id: 'domicilio', n: 'A domicilio' },
  { id: 'mesas', n: 'Mesas' },
];

/** Para llevar y en el local → Mostrador; delivery → A domicilio; mesa y comer en el local → Mesas. */
export function pestanaDe(p: Pedido): Exclude<PestanaLista, 'todos'> {
  const c = claveModalidad(p.modalidad);
  if (c === 'DELIVERY') return 'domicilio';
  if (c === 'MESA' || c === 'COMER_LOCAL') return 'mesas';
  return 'mostrador';
}

export const enPestana = (p: Pedido, t: PestanaLista) => t === 'todos' || pestanaDe(p) === t;

export function contarPestanas(pedidos: Pedido[]): Record<PestanaLista, number> {
  const r: Record<PestanaLista, number> = { todos: pedidos.length, mostrador: 0, domicilio: 0, mesas: 0 };
  for (const p of pedidos) r[pestanaDe(p)]++;
  return r;
}

export type CampoOrdenLista = 'fecha' | 'estado' | 'total' | 'cliente';
export interface OrdenLista { campo: CampoOrdenLista; dir: 'asc' | 'desc' }
export const ORDEN_LISTA_POR_DEFECTO: OrdenLista = { campo: 'fecha', dir: 'desc' };
export const CAMPOS_ORDEN_LISTA: { id: CampoOrdenLista; n: string }[] = [
  { id: 'fecha', n: 'Fecha' },
  { id: 'estado', n: 'Estado' },
  { id: 'total', n: 'Total' },
  { id: 'cliente', n: 'Cliente' },
];

/** Valor guardado → orden válido; cualquier otra cosa vuelve a «Fecha, más reciente primero». */
export function normalizarOrdenLista(v: unknown): OrdenLista {
  const o = v as Partial<OrdenLista> | null;
  const campo = CAMPOS_ORDEN_LISTA.find((c) => c.id === o?.campo)?.id;
  if (!campo || (o?.dir !== 'asc' && o?.dir !== 'desc')) return ORDEN_LISTA_POR_DEFECTO;
  return { campo, dir: o.dir };
}

// Estado por etapa de la atención (lo urgente primero en ascendente); los cerrados al final.
const RANGO_ESTADO: Record<string, number> = { pendiente: 0, prep: 1, listo: 2, camino: 3, entregado: 4, anulado: 5, otro: 6 };
const fechaMs = (p: Pedido) => (p.creado_en ? new Date(p.creado_en).getTime() : 0);
const clienteDe = (p: Pedido) => (p.cliente_nombre?.trim() || '').toLocaleLowerCase('es');

/** Ordena sin tocar el original; empata por fecha y luego por código para que el orden sea estable. */
export function ordenarLista(lista: Pedido[], { campo, dir }: OrdenLista): Pedido[] {
  const signo = dir === 'asc' ? 1 : -1;
  const clave = (p: Pedido): number | string =>
    campo === 'fecha' ? fechaMs(p) : campo === 'total' ? totalDe(p) : campo === 'cliente' ? clienteDe(p) : (RANGO_ESTADO[estadoVisual(p).clave] ?? 9);
  return [...lista].sort((a, b) => {
    const x = clave(a);
    const y = clave(b);
    const c = typeof x === 'string' ? x.localeCompare(String(y), 'es') : (x as number) - (y as number);
    return signo * c || fechaMs(b) - fechaMs(a) || String(a.codigo || '').localeCompare(String(b.codigo || ''));
  });
}
