import type { Pedido } from './pedidosApi';
import { estadoVisual } from './estadosCaja';
import { claveModalidad } from './InsigniaModalidad';
import { mediosDePedido } from './mediosFila';
import { nombreMedio } from './planPago';
import { totalDe } from './resumenDia';

const aHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }) : '';

const MOD: Record<string, string> = { DELIVERY: 'Delivery', LLEVAR: 'Para llevar', MESA: 'En mesa', COMER_LOCAL: 'Comer en el local', LOCAL: 'En el local' };
const CANAL: Record<string, string> = { CARTA: 'Web', WEB: 'Web', BOT: 'WhatsApp', WHATSAPP: 'WhatsApp', MOZO: 'Mozo', CAJA: 'Caja' };

export function textoPago(p: Pedido): string {
  const pag = String(p.pago_estado || '').toUpperCase();
  if (p.es_personal) return 'Crédito personal';
  if (pag === 'PAGADO') return 'Pagado';
  if (pag === 'COORDINADO') return 'Coordinado';
  return 'Por cobrar';
}

/** Minutos entre dos instantes ISO; null si falta alguno. */
export function minutosEntre(desde?: string | null, hasta?: string | null): number | null {
  if (!desde || !hasta) return null;
  const m = Math.round((Date.parse(hasta) - Date.parse(desde)) / 60000);
  return Number.isFinite(m) && m >= 0 ? m : null;
}

export function textoDuracion(min: number | null): string {
  if (min == null) return '';
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

export interface ColumnaCaja {
  id: string;
  titulo: string;
  /** Alineada a la derecha (cifras). */
  numerica?: boolean;
  /** Texto de la celda (los medios y el estado se pintan como chips en la tabla). */
  texto: (p: Pedido) => string;
}

const dinero = (v: unknown) => `S/ ${Number(v || 0).toFixed(2)}`;
const cobroEn = (p: Pedido) => p.cobradoEn ?? p.cobroMozo?.en ?? p.pago_coordinado_en ?? null;

export const COLUMNAS_CAJA: ColumnaCaja[] = [
  { id: 'codigo', titulo: 'Código', texto: (p) => p.codigo },
  { id: 'hora', titulo: 'Hora', texto: (p) => aHora(p.creado_en) },
  { id: 'cliente', titulo: 'Cliente', texto: (p) => p.cliente_nombre?.trim() || 'Cliente' },
  { id: 'modalidad', titulo: 'Tipo', texto: (p) => MOD[claveModalidad(p.modalidad)] },
  { id: 'mesa', titulo: 'Mesa', texto: (p) => p.mesa_nombre?.trim() || '' },
  { id: 'canal', titulo: 'Canal', texto: (p) => CANAL[String(p.canal || '').toUpperCase()] ?? (p.canal || 'Web') },
  { id: 'estado', titulo: 'Estado', texto: (p) => estadoVisual(p).l },
  { id: 'pago', titulo: 'Estado de pago', texto: textoPago },
  { id: 'medios', titulo: 'Medios de pago', texto: (p) => mediosDePedido(p).map(nombreMedio).join(' + ') },
  { id: 'total', titulo: 'Total', numerica: true, texto: (p) => dinero(totalDe(p)) },
  { id: 'propina', titulo: 'Propina', numerica: true, texto: (p) => (Number(p.propina || 0) > 0 ? dinero(p.propina) : '') },
  { id: 'atendio', titulo: 'Atendió', texto: (p) => p.atendidoPorNombre ?? p.cobroMozo?.mozo ?? '' },
  { id: 'horaAtencion', titulo: 'Hora de atención', texto: (p) => aHora(p.atendidoEn ?? p.entregado_mesa_en ?? p.despachado_en) },
  { id: 'cobro', titulo: 'Cobró', texto: (p) => p.cobradoPorNombre ?? '' },
  { id: 'horaCobro', titulo: 'Hora de cobro', texto: (p) => aHora(cobroEn(p)) },
  {
    id: 'tiempo',
    titulo: 'Tiempo total',
    numerica: true,
    texto: (p) => textoDuracion((p.tiempoTotalSeg != null ? Math.round(p.tiempoTotalSeg / 60) : null) ?? minutosEntre(p.creado_en, p.entregado_en)),
  },
];

const IDS = COLUMNAS_CAJA.map((c) => c.id);
/** Lo que se ve de entrada: lo necesario para cuadrar. */
export const COLUMNAS_POR_DEFECTO = ['codigo', 'hora', 'cliente', 'modalidad', 'mesa', 'estado', 'pago', 'medios', 'total', 'propina'];

/** Lista guardada → ids válidos, sin repetir y en su orden; si queda vacía vuelve a la de fábrica. */
export function normalizarColumnas(v: unknown): string[] {
  if (!Array.isArray(v)) return COLUMNAS_POR_DEFECTO;
  const ok = [...new Set(v.filter((x): x is string => typeof x === 'string' && IDS.includes(x)))];
  return ok.length ? ok : COLUMNAS_POR_DEFECTO;
}

/** Orden completo para el selector: primero las visibles (en su orden), luego las ocultas. */
export function ordenSelector(visibles: string[]): string[] {
  return [...visibles, ...IDS.filter((i) => !visibles.includes(i))];
}
