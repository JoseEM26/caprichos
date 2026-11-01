import { restanteEnCamino, ConfigEta } from '../repartos/eta-entrega';

/**
 * Fuente de verdad del progreso de un pedido: lo usan el mozo («Mis pedidos»)
 * y el cliente de la carta (seguimiento). Solo lleva etiquetas, áreas y estados:
 * nunca tiempos de cocina de otros pedidos ni costos.
 */
export type EtapaProgreso =
  | 'RECIBIDO'
  | 'EN_COCINA'
  | 'PARCIAL'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ESPERANDO_CLIENTE'
  | 'ENTREGADO'
  | 'ANULADO';

export type EstadoAreaProgreso = 'PENDIENTE' | 'PREPARANDO' | 'LISTA';

export interface AreaProgreso {
  nombre: string;
  estado: EstadoAreaProgreso;
  lineas: number;
  /** Líneas del área: nombre y cantidad (nada más del producto). */
  productos: { nombre: string; cantidad: number }[];
}

export interface ProgresoPedido {
  etapa: EtapaProgreso;
  etiqueta: string;
  areas: AreaProgreso[];
  listasDe: number;
  totalAreas: number;
  porcentaje: number;
  enCamino: boolean;
  etaMin?: number;
  etaMax?: number;
}

/** Forma mínima que necesita el cálculo (los selects de Prisma de pedidos y del seguimiento). */
export interface EntradaProgreso {
  estado: string;
  modalidad: string;
  entregado_mesa_en?: Date | null;
  repartidor_party_id?: unknown;
  despachado_en?: Date | null;
  eta_min?: number | null;
  eta_max?: number | null;
  comandas?: { area_id: bigint; estado: string; area: { nombre: string } }[];
  lineas?: {
    nombre: string;
    cantidad: number;
    area_id?: bigint | null;
    producto?: { categoria?: { area_id: bigint | null } | null } | null;
  }[];
}

/** Parámetros del tiempo y reloj: solo hacen falta para el «llega en» de un pedido en camino. */
export interface ContextoProgreso {
  cfg: ConfigEta;
  ahora: Date;
}

const unir = (nombres: string[]) =>
  nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

const textoRango = (min: number, max: number) =>
  min === max ? `unos ${min} minutos` : `unos ${min} a ${max} minutos`;

/** Área de una línea: la propia del producto, o la de su categoría (igual que la sincronía de comandas). */
const areaDeLinea = (l: NonNullable<EntradaProgreso['lineas']>[number]): bigint | null =>
  l.area_id ?? l.producto?.categoria?.area_id ?? null;

export function progresoDelPedido(p: EntradaProgreso, ctx?: ContextoProgreso): ProgresoPedido {
  const vacio = { areas: [] as AreaProgreso[], listasDe: 0, totalAreas: 0, enCamino: false };

  if (p.estado === 'ANULADO') {
    return { ...vacio, etapa: 'ANULADO', etiqueta: 'Anulado', porcentaje: 0 };
  }

  const mesa = p.modalidad === 'MESA';
  const entregadoEnMesa = mesa && !!p.entregado_mesa_en;
  if (p.estado === 'ENTREGADO' || entregadoEnMesa) {
    const areas = (p.comandas ?? []).map((c) => areaProgreso(p, c.area_id, c.area.nombre, 'LISTA'));
    return {
      etapa: 'ENTREGADO',
      etiqueta: entregadoEnMesa && p.estado !== 'ENTREGADO' ? 'Entregado en mesa' : 'Entregado',
      areas,
      listasDe: areas.length,
      totalAreas: areas.length,
      porcentaje: 100,
      enCamino: false,
    };
  }

  if (p.estado === 'EN_CAMINO') {
    const prometido = p.eta_min != null && p.eta_max != null ? { min: p.eta_min, max: p.eta_max } : null;
    const rango = ctx
      ? restanteEnCamino(prometido, ctx.cfg.respaldoMin, p.despachado_en ?? null, ctx.ahora, ctx.cfg.pasoMin)
      : null;
    const etiqueta = rango ? `En camino, llega en ${textoRango(rango.min, rango.max)}` : 'En camino';
    const areas = areasDePedido(p, true);
    return {
      etapa: 'EN_CAMINO',
      etiqueta,
      areas,
      listasDe: areas.length,
      totalAreas: areas.length,
      porcentaje: 100,
      enCamino: true,
      ...(rango ? { etaMin: rango.min, etaMax: rango.max } : {}),
    };
  }

  // Cocina ya terminó: el pedido pasó a LISTO a mano, o todas sus áreas despejaron
  const areas = areasDePedido(p, p.estado === 'LISTO');
  const listas = areas.filter((a) => a.estado === 'LISTA').length;
  const total = areas.length;
  const cocinaTerminada = p.estado === 'LISTO' || (total > 0 && listas === total);

  if (cocinaTerminada) {
    const base = { areas, listasDe: total, totalAreas: total, porcentaje: 100, enCamino: false };
    if (mesa) return { ...base, etapa: 'LISTO', etiqueta: 'Listo para entregar en mesa' };
    if (p.modalidad === 'DELIVERY') {
      const conRepartidor = p.repartidor_party_id != null;
      return {
        ...base,
        etapa: 'LISTO',
        etiqueta: conRepartidor ? 'Listo, esperando salida del repartidor' : 'Listo, esperando repartidor',
      };
    }
    // Recojo en local o para llevar: listo, esperando que el cliente llegue
    return { ...base, etapa: 'ESPERANDO_CLIENTE', etiqueta: 'Listo, esperando al cliente' };
  }

  // Todavía en cocina (o recibido, si no hay comandas)
  const porcentaje = total > 0 ? Math.round((listas * 100) / total) : 0;
  if (total === 0 && p.estado === 'COLA') {
    return { ...vacio, areas, etapa: 'RECIBIDO', etiqueta: 'Pedido recibido', porcentaje: 0 };
  }
  if (listas === 0) {
    const etiqueta = p.estado === 'PREPARANDO' ? 'En cocina, en preparación' : 'En cocina';
    return { areas, listasDe: 0, totalAreas: total, enCamino: false, etapa: 'EN_COCINA', etiqueta, porcentaje };
  }
  const listasNombres = areas.filter((a) => a.estado === 'LISTA').map((a) => a.nombre);
  const faltan = areas.filter((a) => a.estado !== 'LISTA').map((a) => a.nombre);
  return {
    areas,
    listasDe: listas,
    totalAreas: total,
    enCamino: false,
    etapa: 'PARCIAL',
    etiqueta: `Cocina: listas ${unir(listasNombres)}, faltan ${unir(faltan)}`,
    porcentaje,
  };
}

/** Líneas del pedido que van a esa área (nombre y cantidad). */
function productosDeArea(p: EntradaProgreso, areaId: bigint): AreaProgreso['productos'] {
  return (p.lineas ?? [])
    .filter((l) => areaDeLinea(l) === areaId)
    .map((l) => ({ nombre: l.nombre, cantidad: l.cantidad }));
}

function areaProgreso(p: EntradaProgreso, areaId: bigint, nombre: string, estado: EstadoAreaProgreso): AreaProgreso {
  const productos = productosDeArea(p, areaId);
  return { nombre, estado, lineas: productos.length, productos };
}

/** Áreas del pedido con su estado. Si la cocina ya terminó, todas quedan lista. */
function areasDePedido(p: EntradaProgreso, todasListas: boolean): ProgresoPedido['areas'] {
  return (p.comandas ?? []).map((c) => {
    const estado: EstadoAreaProgreso =
      todasListas || c.estado === 'DESPEJADA'
        ? 'LISTA'
        : p.estado === 'PREPARANDO'
          ? 'PREPARANDO'
          : 'PENDIENTE';
    return areaProgreso(p, c.area_id, c.area.nombre, estado);
  });
}
