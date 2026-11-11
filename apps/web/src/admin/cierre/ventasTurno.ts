import type { CobroTurno } from '../pedidos/pedidosApi';
import type { VentaDetalle } from './cierreApi';
import { MOD, CANAL, aHora } from '../pedidos/columnasCaja';
import { claveModalidad } from '../pedidos/InsigniaModalidad';
import { nombreMedio } from '../pedidos/planPago';
import { coincideTexto } from '../../comun/normalizarBusqueda';
import { normalizarColumnasDe } from '../../comun/tabla/ControlesTabla';

/**
 * Ventas del turno para la tabla/tarjetas del Cierre. Solo presentación: une la lista `cobrados` (la que ya
 * suma el cierre) con el detalle opcional `ventas`. Nada de aquí cambia un total del cierre.
 */
export interface VentaFila {
  id: string;
  codigo: string;
  cliente: string;
  total: number;
  /** Cuándo se registró el pedido (si el servidor no lo dice, la hora del cobro) */
  hora: string;
  horaCobro: string;
  modalidad: string;
  canal: string;
  estadoPedido: string;
  mesa: string;
  /** Quién registró la venta: mozo o cajero; si la hizo el cliente, el canal (Web, WhatsApp) */
  registro: string;
  cobro: string;
  /** Mozo que lo cobró en la mesa y lo envió a Caja */
  cobroMozo: string;
  repartidor: string;
  categorias: string[];
  medios: string[];
  pagos: Array<{ medio: string; monto: number }>;
  propina: number;
  estadoCobro: string;
  comprobante: string;
  comprobanteTipo: string;
}

const ESTADO_PEDIDO: Record<string, string> = {
  COLA: 'En cola', CONFIRMADO: 'Confirmado', PREPARANDO: 'Preparando', LISTO: 'Listo', EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado', ANULADO: 'Anulado', RECHAZADO: 'Rechazado', PENDIENTE: 'Pendiente',
};
const TIPO_COMPROBANTE: Record<string, string> = { BOLETA: 'Boleta', FACTURA: 'Factura', NOTA_VENTA: 'Nota de venta', SIMPLE: 'Ticket' };

export const unir = (cobrados: CobroTurno[], ventas?: VentaDetalle[]): VentaFila[] => {
  const det = new Map((ventas ?? []).map((v) => [v.pedidoId, v]));
  return cobrados.map((c) => {
    const d = det.get(c.pedidoId);
    const canalClave = String(d?.canal || '').toUpperCase();
    const canal = d?.canal ? (CANAL[canalClave] ?? d.canal) : '';
    const medios = c.medios.length ? c.medios.map((m) => m.toUpperCase()) : d?.pagos.map((p) => p.medio) ?? [];
    const cobradoPorMozo = d?.cobradoPorMozo ?? '';
    return {
      id: c.pedidoId,
      codigo: c.codigo,
      cliente: c.cliente?.trim() || 'Cliente',
      total: Number(c.total || 0),
      hora: d?.creadoEn ?? c.en,
      horaCobro: c.en,
      modalidad: d?.modalidad ? MOD[claveModalidad(d.modalidad)] : '',
      canal,
      estadoPedido: d?.estadoPedido ? (ESTADO_PEDIDO[d.estadoPedido.toUpperCase()] ?? d.estadoPedido) : '',
      mesa: d?.mesa?.trim() || '',
      registro: d?.registradoPor || canal,
      cobro: d?.cobradoPor ?? '',
      cobroMozo: cobradoPorMozo,
      repartidor: d?.repartidor ?? '',
      categorias: d?.categorias ?? [],
      medios,
      pagos: d?.pagos ?? [],
      propina: d?.propina ?? 0,
      estadoCobro: d?.creditoPersonal ? 'Crédito personal' : cobradoPorMozo ? 'Cobrado por mozo' : 'Cobrado',
      comprobante: d?.comprobante ? `${TIPO_COMPROBANTE[d.comprobante.tipo] ?? d.comprobante.tipo} ${d.comprobante.numero}` : '',
      comprobanteTipo: d?.comprobante ? (TIPO_COMPROBANTE[d.comprobante.tipo] ?? d.comprobante.tipo) : 'Sin comprobante',
    };
  });
};

const dinero = (v: number) => `S/ ${v.toFixed(2)}`;

export interface ColumnaVenta {
  id: string;
  titulo: string;
  numerica?: boolean;
  texto: (f: VentaFila) => string;
  /** Valor para ordenar (por defecto, el texto sin mayúsculas) */
  orden?: (f: VentaFila) => string | number;
}

export const COLUMNAS_VENTAS: ColumnaVenta[] = [
  { id: 'codigo', titulo: 'Código', texto: (f) => f.codigo },
  { id: 'hora', titulo: 'Hora de la venta', texto: (f) => aHora(f.hora), orden: (f) => f.hora },
  { id: 'registro', titulo: 'Registró', texto: (f) => f.registro },
  { id: 'modalidad', titulo: 'Tipo', texto: (f) => f.modalidad },
  { id: 'categoria', titulo: 'Categoría', texto: (f) => f.categorias.join(', ') },
  { id: 'medios', titulo: 'Medio de pago', texto: (f) => f.medios.map(nombreMedio).join(' + ') },
  { id: 'repartidor', titulo: 'Repartidor', texto: (f) => f.repartidor },
  { id: 'cliente', titulo: 'Cliente', texto: (f) => f.cliente },
  { id: 'total', titulo: 'Total', numerica: true, texto: (f) => dinero(f.total), orden: (f) => f.total },
  { id: 'propina', titulo: 'Propina', numerica: true, texto: (f) => (f.propina > 0 ? dinero(f.propina) : ''), orden: (f) => f.propina },
  { id: 'estadoCobro', titulo: 'Estado de cobro', texto: (f) => f.estadoCobro },
  { id: 'cobro', titulo: 'Cobró (Caja)', texto: (f) => f.cobro },
  { id: 'cobroMozo', titulo: 'Cobrado por mozo', texto: (f) => f.cobroMozo },
  { id: 'horaCobro', titulo: 'Hora de cobro', texto: (f) => aHora(f.horaCobro), orden: (f) => f.horaCobro },
  { id: 'comprobante', titulo: 'Comprobante', texto: (f) => f.comprobante },
  { id: 'canal', titulo: 'Canal de origen', texto: (f) => f.canal },
  { id: 'estadoPedido', titulo: 'Estado del pedido', texto: (f) => f.estadoPedido },
  { id: 'mesa', titulo: 'Mesa', texto: (f) => f.mesa },
];

export const COLUMNAS_VENTAS_POR_DEFECTO = ['codigo', 'hora', 'registro', 'modalidad', 'categoria', 'medios', 'repartidor', 'total', 'propina', 'cobro'];

export const CLAVE_VENTAS_COLUMNAS = 'cierre.ventas.columnas';
export const CLAVE_VENTAS_VISTA = 'cierre.ventas.vista';
export const CLAVE_VENTAS_FILAS = 'cierre.ventas.filas';

export const normalizarColumnasVentas = (v: unknown) => normalizarColumnasDe(v, COLUMNAS_VENTAS, COLUMNAS_VENTAS_POR_DEFECTO);

/** Filtros combinables: cada uno saca de una venta los valores que puede tener (una venta puede tener varios). */
export interface DefFiltro {
  id: string;
  titulo: string;
  valores: (f: VentaFila) => string[];
  /** Nombre que se muestra de un valor (por defecto, el mismo) */
  nombre?: (v: string) => string;
}

const uno = (v: string) => (v ? [v] : []);

export const FILTROS_VENTAS: DefFiltro[] = [
  { id: 'registro', titulo: 'Usuario que registró', valores: (f) => uno(f.registro) },
  { id: 'cobro', titulo: 'Quién cobró', valores: (f) => [...uno(f.cobro), ...uno(f.cobroMozo)] },
  { id: 'modalidad', titulo: 'Tipo', valores: (f) => uno(f.modalidad) },
  { id: 'categoria', titulo: 'Categoría', valores: (f) => f.categorias },
  { id: 'medio', titulo: 'Medio de pago', valores: (f) => f.medios, nombre: nombreMedio },
  { id: 'repartidor', titulo: 'Repartidor', valores: (f) => uno(f.repartidor) },
  { id: 'estadoCobro', titulo: 'Estado de cobro', valores: (f) => uno(f.estadoCobro) },
  { id: 'comprobante', titulo: 'Comprobante', valores: (f) => [f.comprobanteTipo] },
  { id: 'canal', titulo: 'Canal de origen', valores: (f) => uno(f.canal) },
];

export type FiltrosElegidos = Record<string, string[]>;

export const hayFiltros = (e: FiltrosElegidos, busqueda: string) => busqueda.trim() !== '' || Object.values(e).some((v) => v.length > 0);

/** Opciones de un filtro: lo que de verdad aparece en las ventas, ordenado. */
export function opcionesDe(def: DefFiltro, filas: VentaFila[]): Array<{ id: string; n: string }> {
  const ids = [...new Set(filas.flatMap(def.valores))].sort((a, b) => a.localeCompare(b, 'es'));
  return ids.map((id) => ({ id, n: def.nombre ? def.nombre(id) : id }));
}

/** Filtros (todos a la vez; dentro de cada uno basta una coincidencia) y búsqueda por código o cliente. */
export function filtrarVentas(filas: VentaFila[], elegidos: FiltrosElegidos, busqueda: string): VentaFila[] {
  return filas.filter((f) => {
    if (!coincideTexto(busqueda, f.codigo, f.cliente)) return false;
    return FILTROS_VENTAS.every((def) => {
      const e = elegidos[def.id] ?? [];
      return e.length === 0 || def.valores(f).some((v) => e.includes(v));
    });
  });
}

export interface Orden { col: string; asc: boolean }

export function ordenarVentas(filas: VentaFila[], orden: Orden | null): VentaFila[] {
  if (!orden) return filas;
  const c = COLUMNAS_VENTAS.find((x) => x.id === orden.col);
  if (!c) return filas;
  const clave = (f: VentaFila) => (c.orden ? c.orden(f) : c.texto(f).toLowerCase());
  return [...filas].sort((a, b) => {
    const x = clave(a);
    const y = clave(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
    return orden.asc ? r : -r;
  });
}

export interface TotalesVentas {
  n: number;
  total: number;
  propina: number;
  porMedio: Record<string, number>;
}

/** Totales de lo que se ve: ventas (suma del total de cada cobro), propinas y monto por medio (con pagos divididos, cada parte). */
export function totalesVentas(filas: VentaFila[]): TotalesVentas {
  const t: TotalesVentas = { n: filas.length, total: 0, propina: 0, porMedio: {} };
  const cent = (v: number) => Math.round(v * 100);
  let total = 0;
  let propina = 0;
  const medios: Record<string, number> = {};
  for (const f of filas) {
    total += cent(f.total);
    propina += cent(f.propina);
    const partes = f.pagos.length ? f.pagos : f.medios.length === 1 ? [{ medio: f.medios[0], monto: f.total }] : [];
    for (const p of partes) medios[p.medio] = (medios[p.medio] ?? 0) + cent(p.monto);
  }
  t.total = total / 100;
  t.propina = propina / 100;
  for (const [m, v] of Object.entries(medios)) t.porMedio[m] = v / 100;
  return t;
}

const celdaCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** CSV de lo filtrado con las columnas elegidas (Excel lo abre bien: lleva BOM y comillas). */
export function ventasACsv(filas: VentaFila[], columnas: string[]): string {
  const cols = columnas.map((id) => COLUMNAS_VENTAS.find((c) => c.id === id)!).filter(Boolean);
  const lineas = [cols.map((c) => celdaCsv(c.titulo)).join(','), ...filas.map((f) => cols.map((c) => celdaCsv(c.texto(f))).join(','))];
  return `\uFEFF${lineas.join('\r\n')}`;
}
