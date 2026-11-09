import { restanteEnCamino, ConfigEta } from '../repartos/eta-entrega';
import type { TiemposPreparacion } from '../cocina/tiempo-preparacion';

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
  | 'LLEGO'
  | 'ESPERANDO_CLIENTE'
  | 'ENTREGADO'
  | 'ANULADO';

export type EstadoAreaProgreso = 'PENDIENTE' | 'PREPARANDO' | 'LISTA';

export interface AreaProgreso {
  nombre: string;
  estado: EstadoAreaProgreso;
  lineas: number;
  /** Líneas del área: nombre, unidades y cuántas están listas y despachadas. */
  productos: ProductoProgreso[];
}

export interface ProductoProgreso {
  /** Id de la línea del pedido: lo usa cocina para despachar (no es dato de cocina de otros pedidos). */
  lineaId?: string;
  nombre: string;
  cantidad: number;
  listas: number;
  despachadas: number;
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
  /** Minutos para que esté listo lo que falta (solo mientras cocina trabaja). */
  estimadoMin?: number;
}

/** Forma mínima que necesita el cálculo (los selects de Prisma de pedidos y del seguimiento). */
export interface EntradaProgreso {
  estado: string;
  modalidad: string;
  entregado_mesa_en?: Date | null;
  repartidor_party_id?: unknown;
  despachado_en?: Date | null;
  llego_en?: Date | null;
  eta_min?: number | null;
  eta_max?: number | null;
  creado_en?: Date | null;
  pasa_cocina_en?: Date | null;
  comandas?: { area_id: bigint; estado: string; area: { nombre: string } }[];
  lineas?: {
    id?: bigint | string;
    nombre: string;
    cantidad: number;
    listas?: number;
    despachadas?: number;
    producto_id?: bigint | null;
    area_id?: bigint | null;
    producto?: { categoria?: { area_id: bigint | null } | null } | null;
  }[];
}

/**
 * Reloj y datos opcionales. `cfg` solo hace falta para el «llega en» de un pedido en camino;
 * `preparacion` (tiempos de preparación por producto) solo para el «Listo en ~N min» de cocina.
 */
export interface ContextoProgreso {
  cfg?: ConfigEta;
  ahora: Date;
  preparacion?: TiemposPreparacion;
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
    const rango = ctx?.cfg
      ? restanteEnCamino(prometido, ctx.cfg.respaldoMin, p.despachado_en ?? null, ctx.ahora, ctx.cfg.pasoMin)
      : null;
    const etiqueta = rango ? `En camino, llega en ${textoRango(rango.min, rango.max)}` : 'En camino';
    const areas = areasDePedido(p, true);
    if (p.llego_en) {
      return { etapa: 'LLEGO', etiqueta: 'Tu repartidor llegó', areas, listasDe: areas.length, totalAreas: areas.length, porcentaje: 100, enCamino: true };
    }
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

  // Listo es el aviso final de Despacho: con todas las áreas despejadas el pedido espera a Despacho
  // (sigue «en cocina», 100 %) y recién al despacharlo pasa a LISTO.
  const areas = areasDePedido(p, p.estado === 'LISTO');
  const listas = areas.filter((a) => a.estado === 'LISTA').length;
  const total = areas.length;
  const cocinaTerminada = p.estado === 'LISTO';
  if (!cocinaTerminada && total > 0 && listas === total) {
    return {
      areas,
      listasDe: total,
      totalAreas: total,
      porcentaje: 100,
      enCamino: false,
      etapa: 'EN_COCINA',
      etiqueta: 'Armando tu pedido para entregarlo',
    };
  }

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
  const estimadoMin = estimadoDelPedido(p, ctx);
  const conEstimado = estimadoMin !== undefined ? { estimadoMin } : {};
  if (total === 0 && p.estado === 'COLA') {
    return { ...vacio, areas, etapa: 'RECIBIDO', etiqueta: 'Pedido recibido', porcentaje: 0, ...conEstimado };
  }
  if (listas === 0) {
    const etiqueta = p.estado === 'PREPARANDO' ? 'En cocina, en preparación' : 'En cocina';
    return {
      areas,
      listasDe: 0,
      totalAreas: total,
      enCamino: false,
      etapa: 'EN_COCINA',
      etiqueta,
      porcentaje,
      ...conEstimado,
    };
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
    ...conEstimado,
  };
}

/**
 * Minutos para que esté lo que falta: el mayor, entre los productos no listos, de (su tiempo promedio
 * - lo que ya lleva en cocina), mínimo 1. Sin nada pendiente no hay estimado.
 */
function estimadoDelPedido(p: EntradaProgreso, ctx?: ContextoProgreso): number | undefined {
  if (!ctx?.preparacion) return undefined;
  const despejadas = new Set((p.comandas ?? []).filter((c) => c.estado === 'DESPEJADA').map((c) => String(c.area_id)));
  const pendientes = (p.lineas ?? []).filter((l) => {
    const area = areaDeLinea(l);
    if (area === null || despejadas.has(String(area))) return false;
    return (l.listas ?? 0) < l.cantidad;
  });
  if (pendientes.length === 0) return undefined;

  const inicio = p.pasa_cocina_en ?? p.creado_en ?? ctx.ahora;
  const transcurrido = Math.max(0, Math.floor((ctx.ahora.getTime() - new Date(inicio).getTime()) / 60000));
  const { porProducto, defectoMin } = ctx.preparacion;
  const restante = Math.max(
    ...pendientes.map((l) => (porProducto.get(String(l.producto_id ?? '')) ?? defectoMin) - transcurrido),
  );
  return Math.max(1, restante);
}

/**
 * Líneas del pedido que van a esa área. Si el área ya está lista (despejada o cocina terminó), sus
 * unidades cuentan como listas aunque el pedido viejo no traiga el conteo.
 */
function productosDeArea(p: EntradaProgreso, areaId: bigint, areaLista: boolean): ProductoProgreso[] {
  return (p.lineas ?? [])
    .filter((l) => areaDeLinea(l) === areaId)
    .map((l) => ({
      ...(l.id !== undefined ? { lineaId: String(l.id) } : {}),
      nombre: l.nombre,
      cantidad: l.cantidad,
      listas: areaLista ? l.cantidad : (l.listas ?? 0),
      despachadas: l.despachadas ?? 0,
    }));
}

function areaProgreso(p: EntradaProgreso, areaId: bigint, nombre: string, estado: EstadoAreaProgreso): AreaProgreso {
  const productos = productosDeArea(p, areaId, estado === 'LISTA');
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

/**
 * Avance por unidades de las líneas (cantidad vs listas), total y por área de cocina. Se suma al `ProgresoPedido`
 * en «Mis pedidos»; su `porcentajeUnidades` es independiente del `porcentaje` por etapa.
 */
export function unidadesDeProgreso(p: EntradaProgreso) {
  const nombres = new Map((p.comandas ?? []).map((c) => [String(c.area_id), c.area.nombre]));
  const porArea = new Map<string, { area: string; total: number; listas: number }>();
  let total = 0;
  let listas = 0;
  for (const l of p.lineas ?? []) {
    const lista = Math.min(l.listas ?? 0, l.cantidad);
    const id = areaDeLinea(l);
    const area = (id != null && nombres.get(String(id))) || 'Otros';
    const a = porArea.get(area) ?? { area, total: 0, listas: 0 };
    a.total += l.cantidad;
    a.listas += lista;
    porArea.set(area, a);
    total += l.cantidad;
    listas += lista;
  }
  return {
    total,
    listas,
    porcentajeUnidades: total > 0 ? Math.round((listas / total) * 100) : 0,
    porArea: [...porArea.values()],
  };
}
