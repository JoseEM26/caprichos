import type { Pedido } from './pedidosApi';

/** Resumen del día de Caja: un solo cálculo para lo que viene del API (agrupado) y para la lista cargada. */

export interface FilaResumen {
  estado: string;
  pago_estado: string | null;
  n: number;
  total: number;
}

export interface ResumenDia {
  total: number;
  activos: number;
  entregados: number;
  anulados: number;
  rechazados: number;
  porCobrar: number;
  /** Suma de los no anulados ni rechazados (total neto: ya descontados puntos/cupones; la propina va aparte) */
  ventas: number;
  /** De esas ventas, lo de los pedidos PAGADOS */
  cobrado: number;
  /** De esas ventas, lo de los vivos no pagados (ventas = cobrado + montoPorCobrar); su cantidad es `porCobrar` */
  montoPorCobrar: number;
}

/** Total neto de UN pedido: la única cifra que usan tarjetas, tabla, resumen y modal (la propina va aparte). */
export const totalDe = (p: Pick<Pedido, 'total'>): number => Number(p.total || 0);

/** Filtro por un contador del resumen (más fino que Activos/Cerrados/Todos). */
export type ContadorDia = 'entregados' | 'anulados' | 'rechazados' | 'porcobrar';

const mayus = (v: unknown) => String(v || '').toUpperCase();
const sinValor = (e: string) => e === 'ANULADO' || e === 'RECHAZADO';
// Un PROGRAMADO (para otro día) aún no es venta ni cobro pendiente del día: como el cierre del servidor, no cuenta como activo ni por cobrar
const programado = (e: string) => e === 'PROGRAMADO';

/** Por cobrar: pedido que sigue vivo (no anulado, rechazado ni programado para otro día) y aún no está pagado. */
export const esPorCobrar = (p: Pick<Pedido, 'estado' | 'pago_estado'>) =>
  !sinValor(mayus(p.estado)) && !programado(mayus(p.estado)) && mayus(p.pago_estado) !== 'PAGADO';

const ESTADO_DE: Record<Exclude<ContadorDia, 'porcobrar'>, string> = {
  entregados: 'ENTREGADO',
  anulados: 'ANULADO',
  rechazados: 'RECHAZADO',
};

export const enContador = (p: Pedido, c: ContadorDia): boolean =>
  c === 'porcobrar' ? esPorCobrar(p) : mayus(p.estado) === ESTADO_DE[c];

export function filasDePedidos(pedidos: Pedido[]): FilaResumen[] {
  return pedidos.map((p) => ({ estado: String(p.estado), pago_estado: p.pago_estado ?? null, n: 1, total: totalDe(p) }));
}

export function resumirDia(filas: FilaResumen[]): ResumenDia {
  const r: ResumenDia = { total: 0, activos: 0, entregados: 0, anulados: 0, rechazados: 0, porCobrar: 0, ventas: 0, cobrado: 0, montoPorCobrar: 0 };
  for (const f of filas) {
    const e = mayus(f.estado);
    r.total += f.n;
    if (e === 'ENTREGADO') r.entregados += f.n;
    else if (e === 'ANULADO') r.anulados += f.n;
    else if (e === 'RECHAZADO') r.rechazados += f.n;
    else if (!programado(e)) r.activos += f.n;
    if (!sinValor(e)) {
      const pagado = mayus(f.pago_estado) === 'PAGADO';
      // Programado sin pagar: ni venta del día ni por cobrar. Pagado hoy: el dinero sí entró hoy.
      if (programado(e) && !pagado) continue;
      r.ventas += f.total;
      if (!pagado) { r.porCobrar += f.n; r.montoPorCobrar += f.total; }
      else r.cobrado += f.total;
    }
  }
  return r;
}
