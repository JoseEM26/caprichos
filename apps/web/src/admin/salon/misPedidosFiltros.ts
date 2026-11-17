/** Filtros de «Mis pedidos»: chips de periodo, opciones de los filtros avanzados y reglas de la URL. Todas las fechas son YYYY-MM-DD de Lima. */
import { errorRangoPersonalizado, fechaCorta, hoyLima, sumarDias } from '../pedidos/filtroDias';
import type { FiltrosMisPedidos, RespuestaMisPedidos } from './tipos';

/** Ventana máxima de «Mis pedidos» (la API la aplica igual). */
export const MAX_DIAS_MIS_PEDIDOS = 92;

export type ChipRango = 'hoy' | 'ayer' | 'semana' | 'mes' | 'mesPasado' | 'rango';
export const CHIPS_RANGO: Array<{ valor: ChipRango; etiqueta: string }> = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: 'semana', etiqueta: '7 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'mesPasado', etiqueta: 'Mes pasado' },
  { valor: 'rango', etiqueta: 'Rango' },
];

export interface OpcionValor {
  valor: string;
  etiqueta: string;
}

export const ESTADOS_FILTRO: OpcionValor[] = [
  { valor: 'EN_CURSO', etiqueta: 'En curso' },
  { valor: 'COLA', etiqueta: 'En cola' },
  { valor: 'PREPARANDO', etiqueta: 'Preparando' },
  { valor: 'LISTO', etiqueta: 'Listo' },
  { valor: 'ENTREGADO', etiqueta: 'Entregados' },
  { valor: 'ANULADO', etiqueta: 'Anulados' },
];

const TODOS: OpcionValor = { valor: 'todos', etiqueta: 'Todos' };
export const MODALIDADES_FILTRO: OpcionValor[] = [
  TODOS,
  { valor: 'MESA', etiqueta: 'Mesa' },
  { valor: 'LOCAL', etiqueta: 'Local' },
  { valor: 'COMER_LOCAL', etiqueta: 'Comer en el local' },
  { valor: 'LLEVAR', etiqueta: 'Para llevar' },
  { valor: 'RECOGER', etiqueta: 'Recoger' },
  { valor: 'DELIVERY', etiqueta: 'Delivery' },
];
export const PAGOS_FILTRO: OpcionValor[] = [
  TODOS,
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'COORDINADO', etiqueta: 'Coordinado' },
  { valor: 'PAGADO', etiqueta: 'Pagado' },
  { valor: 'DEVUELTO', etiqueta: 'Devuelto' },
];
export const METODOS_FILTRO: OpcionValor[] = [
  TODOS,
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'YAPE', etiqueta: 'Yape' },
  { valor: 'PLIN', etiqueta: 'Plin' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'MIXTO', etiqueta: 'Mixto' },
  { valor: 'CREDITO_PERSONAL', etiqueta: 'Crédito personal' },
];

/** Filtros avanzados. `estados` vacío = todos; `faltaVoucher` solo filtra en la web. */
export interface FiltrosAvanzados {
  estados: string[];
  faltaVoucher: boolean;
  modalidad: string;
  pago: string;
  metodo: string;
  montoMin: string;
  montoMax: string;
}

export const SIN_AVANZADOS: FiltrosAvanzados = {
  estados: [],
  faltaVoucher: false,
  modalidad: 'todos',
  pago: 'todos',
  metodo: 'todos',
  montoMin: '',
  montoMax: '',
};

/** Cuántos filtros avanzados están activos (para el contador del botón). */
export function contarAvanzados(f: FiltrosAvanzados): number {
  return (
    (f.estados.length > 0 ? 1 : 0) +
    (f.faltaVoucher ? 1 : 0) +
    (f.modalidad !== 'todos' ? 1 : 0) +
    (f.pago !== 'todos' ? 1 : 0) +
    (f.metodo !== 'todos' ? 1 : 0) +
    (f.montoMin !== '' ? 1 : 0) +
    (f.montoMax !== '' ? 1 : 0)
  );
}

/** Error de los montos (mínimo mayor que máximo, o mal escritos), o null. */
export function errorMontos(min: string, max: string): string | null {
  const a = min === '' ? null : Number(min);
  const b = max === '' ? null : Number(max);
  if ((a != null && (!Number.isFinite(a) || a < 0)) || (b != null && (!Number.isFinite(b) || b < 0))) {
    return 'Los montos deben ser cantidades en soles, sin signo.';
  }
  if (a != null && b != null && a > b) return 'El monto mínimo no puede ser mayor que el máximo.';
  return null;
}

/** Valor de la URL si existe en las opciones; si no, «todos». */
export function valorDeOpcion(valor: string | null, opciones: OpcionValor[]): string {
  return opciones.some((o) => o.valor === valor) ? (valor as string) : 'todos';
}

/** Chip de la URL; desconocido o viejo (30dias, todas) = hoy. */
export function chipDeUrl(valor: string | null): ChipRango {
  return CHIPS_RANGO.some((c) => c.valor === valor) ? (valor as ChipRango) : 'hoy';
}

/** Primer día del mes de una fecha YYYY-MM-DD. */
const primerDiaDelMes = (fecha: string) => `${fecha.slice(0, 8)}01`;

/**
 * Parámetros de la API para el chip. Null si el rango personalizado aún no es válido
 * (en ese caso no se pide nada y la pantalla dice por qué).
 */
export function parametrosDeChip(
  chip: ChipRango,
  desde: string,
  hasta: string,
  hoy: string = hoyLima(),
): Pick<FiltrosMisPedidos, 'rango' | 'desde' | 'hasta'> | null {
  switch (chip) {
    case 'hoy':
      return { rango: 'hoy' };
    case 'ayer':
      return { rango: 'ayer' };
    case 'semana':
      return { rango: '7dias' };
    case 'mes':
      return { desde: primerDiaDelMes(hoy), hasta: hoy };
    case 'mesPasado': {
      const fin = sumarDias(primerDiaDelMes(hoy), -1);
      return { desde: primerDiaDelMes(fin), hasta: fin };
    }
    case 'rango':
      return errorRangoPersonalizado(desde, hasta, hoy, MAX_DIAS_MIS_PEDIDOS) ? null : { desde, hasta };
  }
}

/** Error del rango personalizado, o null si el chip no es «Rango» o si es válido. */
export function errorDeRango(chip: ChipRango, desde: string, hasta: string, hoy: string = hoyLima()): string | null {
  return chip === 'rango' ? errorRangoPersonalizado(desde, hasta, hoy, MAX_DIAS_MIS_PEDIDOS) : null;
}

/** Fecha YYYY-MM-DD como «3 nov»; mismo mes: «3 al 9 nov». */
export function textoPeriodo(rango: NonNullable<RespuestaMisPedidos['rango']>): string {
  if (!rango.desde) return `hasta el ${fechaCorta(rango.hasta)}`;
  if (rango.desde === rango.hasta) return `del ${fechaCorta(rango.desde)}`;
  if (rango.desde.slice(0, 7) === rango.hasta.slice(0, 7)) {
    return `del ${Number(rango.desde.slice(8))} al ${fechaCorta(rango.hasta)}`;
  }
  return `del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}`;
}
