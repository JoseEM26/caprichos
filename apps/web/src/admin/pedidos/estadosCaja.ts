import type { Pedido } from './pedidosApi';

/** Reglas de estado de la lista de Caja: una sola fuente para tarjetas, filtros y contadores. */

const mayus = (v: unknown) => String(v || '').toUpperCase();

export const ESTADOS_CERRADOS = ['ENTREGADO', 'ANULADO', 'RECHAZADO'];

export const esCerrado = (p: Pedido) => ESTADOS_CERRADOS.includes(mayus(p.estado));

const tieneCoordinado = (p: Pedido) => Boolean(p.pago_coordinado_en) || mayus(p.pago_estado) === 'COORDINADO';

/** Lo que Caja debe confirmar: pedido fuera del local, nuevo, sin pagar ni coordinar. */
export function esPorConfirmar(p: Pedido): boolean {
  const e = mayus(p.estado);
  return (
    (e === 'COLA' || e === 'NUEVO') &&
    mayus(p.pago_estado) !== 'PAGADO' &&
    !tieneCoordinado(p) &&
    mayus(p.modalidad) !== 'MESA'
  );
}

/** Aún sin empezar: en cola o nuevo (incluye los por confirmar). */
export const esSinEmpezar = (p: Pedido) => ['COLA', 'NUEVO'].includes(mayus(p.estado));

/** Pedido no cerrado ni de mesa, sin pago ni coordinación, que ya salió de la cola (entrega fallida u orden directa). */
export function esPagoPorCoordinar(p: Pedido): boolean {
  const e = mayus(p.estado);
  return (
    mayus(p.modalidad) !== 'MESA' &&
    mayus(p.pago_estado) !== 'PAGADO' &&
    !tieneCoordinado(p) &&
    !ESTADOS_CERRADOS.includes(e) &&
    e !== 'COLA' &&
    e !== 'PROGRAMADO' &&
    e !== 'NUEVO'
  );
}

export type FiltroCaja = 'todo' | 'prep' | 'listos' | 'domi';

export const FILTROS_CAJA: { id: FiltroCaja; n: string; punto: string | null }[] = [
  { id: 'todo', n: 'Todo', punto: null },
  { id: 'prep', n: 'En preparación', punto: '#D99E39' },
  { id: 'listos', n: 'Listos', punto: '#2F7A45' },
  { id: 'domi', n: 'A domicilio', punto: '#2C4C5D' },
];

/** Los cuatro filtros visibles. «Todo» = todo lo que haya (activos o cerrados, según el grupo Estado de Filtros). */
export function enFiltroCaja(p: Pedido, f: FiltroCaja): boolean {
  const e = mayus(p.estado);
  if (f === 'prep') return e === 'PREPARANDO' || e === 'PREP';
  if (f === 'listos') return e === 'LISTO';
  if (f === 'domi') return mayus(p.modalidad) === 'DELIVERY';
  return true;
}

/** Etapa (grupo de Filtros): por confirmar, sin empezar o pago por coordinar. */
export type EtapaCaja = 'all' | 'confirmar' | 'cola' | 'coord';

export function enEtapaCaja(p: Pedido, etapa: EtapaCaja): boolean {
  if (etapa === 'confirmar') return esPorConfirmar(p);
  if (etapa === 'cola') return esSinEmpezar(p);
  if (etapa === 'coord') return esPagoPorCoordinar(p);
  return true;
}

export type ClaveVisual = 'pendiente' | 'prep' | 'listo' | 'camino' | 'entregado' | 'anulado' | 'programado' | 'otro';

export interface EstadoVisual {
  clave: ClaveVisual;
  l: string;
  bg: string;
  fg: string;
  /** Color de la barra superior de la tarjeta */
  barra: string;
}

/** Colores por estado: pendiente naranja, preparación dorado, listo verde, camino azul petróleo. */
export function estadoVisual(p: Pedido): EstadoVisual {
  const est = mayus(p.estado);
  if (esPorConfirmar(p)) {
    return { clave: 'pendiente', l: 'Por confirmar', bg: 'var(--cp-orange, #E67929)', fg: 'var(--cp-navy, #0B2C3E)', barra: '#E67929' };
  }
  switch (est) {
    case 'COLA':
    case 'NUEVO':
      return { clave: 'pendiente', l: 'Pendiente', bg: 'var(--cp-orange, #E67929)', fg: 'var(--cp-navy, #0B2C3E)', barra: '#E67929' };
    case 'PROGRAMADO':
      return { clave: 'programado', l: 'Programado', bg: 'var(--cp-sand, #EDE1D1)', fg: 'var(--cp-navy, #0B2C3E)', barra: '#7C8EA3' };
    case 'PREPARANDO':
    case 'PREP':
      return { clave: 'prep', l: 'En preparación', bg: 'var(--cp-gold, #D99E39)', fg: 'var(--cp-navy, #0B2C3E)', barra: '#D99E39' };
    case 'LISTO':
      return { clave: 'listo', l: 'Listo', bg: 'var(--cp-green, #2F7A45)', fg: '#FFFFFF', barra: '#2F7A45' };
    case 'EN_CAMINO':
    case 'RUTA':
      return { clave: 'camino', l: 'En camino', bg: 'var(--cp-soft, #2C4C5D)', fg: '#FFFFFF', barra: '#2C4C5D' };
    case 'ENTREGADO':
      return { clave: 'entregado', l: 'Entregado', bg: 'var(--cp-line, #E3D6C6)', fg: 'var(--cp-navy, #0B2C3E)', barra: '#D9CFC2' };
    case 'ANULADO':
    case 'RECHAZADO':
      return { clave: 'anulado', l: est === 'ANULADO' ? 'Anulado' : 'Rechazado', bg: 'var(--cp-white, #FFFFFF)', fg: 'var(--cp-rust, #B2500F)', barra: '#B2500F' };
    default:
      return { clave: 'otro', l: String(p.estado || ''), bg: 'var(--cp-sand, #EDE1D1)', fg: 'var(--cp-navy, #0B2C3E)', barra: '#D9CFC2' };
  }
}

/** Compatibilidad: el detalle y otras pantallas leen el badge con esta forma. */
export function getBadge(p: Pedido) {
  const v = estadoVisual(p);
  return { l: v.l, bg: v.bg, fg: v.fg };
}

export type NivelEspera = 'verde' | 'oxido' | 'rojo' | 'neutro';

/** Pastilla de espera: verde <35 min, óxido 35–49, rojo ≥50; neutro en cerrados. */
export function nivelEspera(minutos: number | null, cerrado: boolean): NivelEspera {
  if (cerrado || minutos == null) return 'neutro';
  if (minutos >= 50) return 'rojo';
  if (minutos >= 35) return 'oxido';
  return 'verde';
}

export const ESTILO_ESPERA: Record<NivelEspera, { bg: string; fg: string }> = {
  verde: { bg: '#DFF3E3', fg: '#1F5C33' },
  oxido: { bg: '#FFF1DC', fg: '#8F3F0A' },
  rojo: { bg: '#FDE7E4', fg: '#B42318' },
  neutro: { bg: '#F3E9DB', fg: '#0B2C3E' },
};
