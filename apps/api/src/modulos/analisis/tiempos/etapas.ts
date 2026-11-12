import type { CodigoEtapa } from '@caprichos/compartido';
import { minutosEntre } from '../comun/estadistica';

/**
 * Cálculo PURO (sin base de datos) de las etapas del pipeline de un pedido, a partir de marcas que ya se guardan.
 * Regla de oro: si falta una marca, la etapa queda en null («sin dato»); nunca se inventa un valor.
 */
export interface PedidoParaTiempos {
  id: bigint | string;
  codigo: string;
  estado: string;
  modalidad: string;
  pago_estado?: string | null;
  creado_en: Date;
  pago_coordinado_en: Date | null;
  pasa_cocina_en: Date | null;
  listo_en: Date | null;
  entregado_mesa_en: Date | null;
  entregado_en: Date | null;
  anulado_en: Date | null;
  tomado_en: Date | null;
  salio_en: Date | null;
  despachado_en: Date | null;
  llego_en: Date | null;
  comandas: Array<{ area_id: bigint | string; estado: string; despejada_en: Date | null; area: { nombre: string } }>;
  lineas: Array<{ despachado_en: Date | null }>;
  /** Cobro vigente (no anulado) con la hora de cierre de su caja. */
  cobros: Array<{ en: Date; caja: { cerrada_en: Date | null } | null }>;
}

export interface EtapasDePedido {
  /** Minutos por etapa; null = sin dato para este pedido (no aplica o falta la marca). */
  minutos: Partial<Record<CodigoEtapa, number | null>>;
  /** Cocina por área (minutos desde que pasó a cocina hasta que el área marcó Listo). */
  areas: Array<{ nombre: string; minutos: number | null }>;
}

const mayor = (fechas: Array<Date | null | undefined>): Date | null => {
  const v = fechas.filter((x): x is Date => !!x);
  return v.length ? new Date(Math.max(...v.map((x) => x.getTime()))) : null;
};
const menor = (fechas: Array<Date | null | undefined>): Date | null => {
  const v = fechas.filter((x): x is Date => !!x);
  return v.length ? new Date(Math.min(...v.map((x) => x.getTime()))) : null;
};
/** Tramos que pueden traslaparse (se despacha mientras se sigue listando): si el orden se invierte, dura 0. */
const noNeg = (a: Date | null, b: Date | null): number | null => {
  if (!a || !b) return null;
  return b.getTime() < a.getTime() ? 0 : minutosEntre(a, b);
};

export function calcularEtapas(p: PedidoParaTiempos): EtapasDePedido {
  const m: EtapasDePedido['minutos'] = {};
  if (p.estado === 'ANULADO' || p.anulado_en) return { minutos: m, areas: [] };

  // 2. Aprobación: solo cuenta si el pago coordinado se aprobó ANTES de pasar a cocina (después es cobro, no espera)
  const aprobadoAntes = !!p.pago_coordinado_en && (!p.pasa_cocina_en || p.pago_coordinado_en <= p.pasa_cocina_en);
  m.aprobacion = aprobadoAntes ? minutosEntre(p.creado_en, p.pago_coordinado_en) : null;
  // 3. A cocina
  m.a_cocina = minutosEntre(aprobadoAntes ? p.pago_coordinado_en : p.creado_en, p.pasa_cocina_en);

  // 4. Cocina por área y general (hasta que TODAS las áreas marcaron Listo)
  const areas = p.comandas
    .map((c) => ({
      nombre: c.area.nombre,
      fin: c.estado === 'DESPEJADA' ? c.despejada_en : null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const porArea = areas.map((a) => ({ nombre: a.nombre, minutos: minutosEntre(p.pasa_cocina_en, a.fin) }));
  const todasListas = areas.length > 0 && areas.every((a) => a.fin);
  const ultimaListo = todasListas ? mayor(areas.map((a) => a.fin)) : null;
  m.cocina = todasListas ? minutosEntre(p.pasa_cocina_en, ultimaListo) : null;

  // 5 y 6. Despacho: primera entrega de una línea (pedido_linea.despachado_en) y pedido Listo
  const primeraEntrega = menor(p.lineas.map((l) => l.despachado_en));
  if (ultimaListo) {
    if (primeraEntrega) {
      m.espera_despacho = noNeg(ultimaListo, primeraEntrega);
      m.armado = noNeg(primeraEntrega, p.listo_en);
    } else {
      // Sin hora por línea (Listo puesto a mano): solo se sabe de «todo listo» a «Listo»
      m.espera_despacho = noNeg(ultimaListo, p.listo_en);
      m.armado = null;
    }
  }

  // 7. Por modalidad
  const entrega = p.entregado_en;
  if (p.modalidad === 'MESA' || p.modalidad === 'COMER_LOCAL') {
    m.entrega_mesa = minutosEntre(p.listo_en, p.entregado_mesa_en);
  } else if (p.modalidad === 'RECOGER') {
    m.recojo = minutosEntre(p.listo_en, entrega);
  } else if (p.modalidad === 'DELIVERY') {
    const salida = p.salio_en ?? p.despachado_en;
    m.reparto_espera = minutosEntre(p.listo_en, p.tomado_en);
    m.reparto_salida = minutosEntre(p.tomado_en, salida);
    m.reparto_ruta = minutosEntre(salida, p.llego_en);
    m.reparto_entrega = minutosEntre(p.llego_en, entrega);
  }

  // 8 y 9. Cobro y cierre
  const cobro = p.cobros[0] ?? null;
  const entregaCobro = p.modalidad === 'MESA' || p.modalidad === 'COMER_LOCAL' ? (p.entregado_mesa_en ?? entrega) : entrega;
  m.cobro = cobro ? noNeg(entregaCobro, cobro.en) : null;
  m.cierre = cobro ? minutosEntre(cobro.en, cobro.caja?.cerrada_en ?? null) : null;

  return { minutos: m, areas: porArea };
}

/** Etapa en la que está parado un pedido AHORA y desde cuándo. Null si no está en ninguna medible. */
export interface EtapaActual {
  codigo: CodigoEtapa;
  desde: Date;
  /** Áreas de cocina que aún no terminan (solo en cocina). */
  areasPendientes?: string[];
}

export function etapaActual(p: PedidoParaTiempos): EtapaActual | null {
  const { estado, modalidad } = p;
  if (estado === 'ANULADO' || estado === 'RECHAZADO') return null;

  if (estado === 'COLA' || estado === 'NUEVO') {
    if (!p.pago_coordinado_en && (p.pago_estado ?? 'PENDIENTE') !== 'PAGADO') return { codigo: 'aprobacion', desde: p.creado_en };
    return { codigo: 'a_cocina', desde: p.pago_coordinado_en ?? p.creado_en };
  }

  if (estado === 'PREPARANDO') {
    const pendientes = p.comandas.filter((c) => c.estado !== 'DESPEJADA');
    if (pendientes.length > 0 || p.comandas.length === 0) {
      return { codigo: 'cocina', desde: p.pasa_cocina_en ?? p.creado_en, areasPendientes: pendientes.map((c) => c.area.nombre).sort() };
    }
    const ultimaListo = mayor(p.comandas.map((c) => c.despejada_en)) ?? p.pasa_cocina_en ?? p.creado_en;
    const primera = menor(p.lineas.map((l) => l.despachado_en));
    return primera ? { codigo: 'armado', desde: primera } : { codigo: 'espera_despacho', desde: ultimaListo };
  }

  if (estado === 'LISTO') {
    const listo = p.listo_en ?? p.creado_en;
    if (modalidad === 'MESA' || modalidad === 'COMER_LOCAL') return p.entregado_mesa_en ? null : { codigo: 'entrega_mesa', desde: listo };
    if (modalidad === 'RECOGER') return { codigo: 'recojo', desde: listo };
    if (modalidad === 'DELIVERY') {
      if (!p.tomado_en) return { codigo: 'reparto_espera', desde: listo };
      return { codigo: 'reparto_salida', desde: p.tomado_en };
    }
    return null;
  }

  if (estado === 'EN_CAMINO') {
    if (p.llego_en) return { codigo: 'reparto_entrega', desde: p.llego_en };
    return { codigo: 'reparto_ruta', desde: p.salio_en ?? p.despachado_en ?? p.creado_en };
  }

  if (estado === 'ENTREGADO' && (p.pago_estado ?? 'PENDIENTE') !== 'PAGADO' && p.cobros.length === 0 && p.entregado_en) {
    return { codigo: 'cobro', desde: p.entregado_en };
  }
  return null;
}
