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
  /** Suma de los no anulados ni rechazados */
  ventas: number;
}

/** Filtro por un contador del resumen (más fino que Activos/Cerrados/Todos). */
export type ContadorDia = 'entregados' | 'anulados' | 'rechazados' | 'porcobrar';

const mayus = (v: unknown) => String(v || '').toUpperCase();
const sinValor = (e: string) => e === 'ANULADO' || e === 'RECHAZADO';

/** Por cobrar: pedido que sigue vivo (no anulado ni rechazado) y aún no está pagado. */
export const esPorCobrar = (p: Pick<Pedido, 'estado' | 'pago_estado'>) =>
  !sinValor(mayus(p.estado)) && mayus(p.pago_estado) !== 'PAGADO';

const ESTADO_DE: Record<Exclude<ContadorDia, 'porcobrar'>, string> = {
  entregados: 'ENTREGADO',
  anulados: 'ANULADO',
  rechazados: 'RECHAZADO',
};

export const enContador = (p: Pedido, c: ContadorDia): boolean =>
  c === 'porcobrar' ? esPorCobrar(p) : mayus(p.estado) === ESTADO_DE[c];

export function filasDePedidos(pedidos: Pedido[]): FilaResumen[] {
  return pedidos.map((p) => ({ estado: String(p.estado), pago_estado: p.pago_estado ?? null, n: 1, total: Number(p.total || 0) }));
}

export function resumirDia(filas: FilaResumen[]): ResumenDia {
  const r: ResumenDia = { total: 0, activos: 0, entregados: 0, anulados: 0, rechazados: 0, porCobrar: 0, ventas: 0 };
  for (const f of filas) {
    const e = mayus(f.estado);
    r.total += f.n;
    if (e === 'ENTREGADO') r.entregados += f.n;
    else if (e === 'ANULADO') r.anulados += f.n;
    else if (e === 'RECHAZADO') r.rechazados += f.n;
    else r.activos += f.n;
    if (!sinValor(e)) {
      r.ventas += f.total;
      if (mayus(f.pago_estado) !== 'PAGADO') r.porCobrar += f.n;
    }
  }
  return r;
}
