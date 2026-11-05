import { MODALIDADES_SALON } from '@caprichos/compartido';
import type { EquipoMapa, EstadoRolMapa, MapaImpresionDatos, RolEquipoMapa, RuteoMapa } from '../impresionApi';

export type Modalidad = 'MESA' | 'LOCAL' | 'LLEVAR' | 'RECOGER' | 'DELIVERY';
export interface Escenario {
  modalidad: Modalidad;
  conBebidas: boolean;
}
export type ClavePieza = 'BEBIDA' | 'RESUMEN' | 'AREA' | 'COMANDA' | 'PAGO';

export const PIEZAS: Record<ClavePieza, { titulo: string; que: string }> = {
  BEBIDA: { titulo: 'Sticker de bebida', que: 'Un sticker por cada vaso con bebida' },
  RESUMEN: { titulo: 'Sticker de resumen', que: 'Un sticker con el monto total del pedido' },
  AREA: { titulo: 'Sticker por área', que: 'Un sticker por cada área del pedido' },
  COMANDA: { titulo: 'Comanda de salón', que: 'Hoja con cada línea para la cocina de salón' },
  PAGO: { titulo: 'Ticket de pago', que: 'Lo que se entrega al cobrar' },
};

/** Botones de modalidad del resumen: cada uno agrupa las modalidades que representa. */
export const GRUPOS_MODALIDAD: Array<{ id: string; titulo: string; mods: Modalidad[] }> = [
  { id: 'SALON', titulo: 'Salón', mods: ['MESA', 'LOCAL'] },
  { id: 'LLEVAR', titulo: 'Para llevar', mods: ['LLEVAR', 'RECOGER'] },
  { id: 'DELIVERY', titulo: 'Delivery', mods: ['DELIVERY'] },
];

const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  MESA: 'Salón',
  LOCAL: 'Salón',
  LLEVAR: 'Para llevar',
  RECOGER: 'Para recoger',
  DELIVERY: 'Delivery',
};

export interface Salida {
  /** Columna donde cae el trabajo: id del área, o null = Caja. */
  slot: string | null;
  equipoId: string | null;
  nombreDestino: string;
  /** El equipo asignado no está listo (sin conexión, sin papel...): el trabajo espera en su cola. */
  espera: boolean;
  /** El área no tiene equipo de etiquetas: el trabajo cae en Caja. */
  cae: boolean;
  /** Caja no tiene equipo para ese tipo de impresión: no sale nada. */
  sinEquipo: boolean;
}

export interface PiezaFlujo {
  clave: ClavePieza;
  titulo: string;
  que: string;
  /** La regla de esta pieza está encendida. */
  reglaActiva: boolean;
  /** Sale con el pedido del escenario. */
  sale: boolean;
  motivo: string;
  salidas: Salida[];
}

export type NivelLuz = 'verde' | 'ambar' | 'rojo';

export function estadoRol(e: EquipoMapa, rol: RolEquipoMapa): EstadoRolMapa | 'no_configurada' {
  return e.roles.find((r) => r.rol === rol)?.estado ?? 'no_configurada';
}

/** Luz del equipo: verde lista; ámbar pide atención (sin papel, sin configurar); rojo no imprime. */
export function luzDeEquipo(e: EquipoMapa): NivelLuz {
  if (!e.conectado) return 'rojo';
  const estados = e.roles.map((r) => r.estado);
  if (estados.some((s) => s === 'desconectada' || s === 'error' || s === 'sin_permiso' || s === 'sin_programa')) return 'rojo';
  if (estados.some((s) => s === 'sin_papel' || s === 'no_configurada')) return 'ambar';
  return 'verde';
}

/** Alterna un grupo de modalidades: si todas están, las quita; si no, añade las que falten. */
export function alternarGrupo(actuales: string[], mods: Modalidad[]): string[] {
  const todas = mods.every((m) => actuales.includes(m));
  if (todas) return actuales.filter((m) => !mods.includes(m as Modalidad));
  return [...actuales, ...mods.filter((m) => !actuales.includes(m))];
}

function salidaDe(x: RuteoMapa, rol: RolEquipoMapa, mapa: MapaImpresionDatos): Salida {
  const equipo = x.destinoEquipoId ? mapa.equipos.find((e) => e.deviceKeyId === x.destinoEquipoId) ?? null : null;
  return {
    slot: x.destinoAreaId,
    equipoId: x.destinoEquipoId,
    nombreDestino: x.destinoNombre,
    espera: equipo !== null && !(equipo.conectado && estadoRol(equipo, rol) === 'lista'),
    cae: x.areaId !== null && x.destinoAreaId === null,
    sinEquipo: x.destinoEquipoId === null,
  };
}

/**
 * Qué piezas salen con un pedido del escenario, a qué columna y por qué (o por qué no).
 * Las salidas vienen del ruteo que calcula el servidor; aquí solo se decide según reglas y modalidad.
 * Las bebidas y las áreas se suponen presentes en el pedido (el simulador asume que lo tiene).
 */
export function derivarFlujo(mapa: MapaImpresionDatos, esc: Escenario): PiezaFlujo[] {
  const r = mapa.reglas;
  const salidas = (tipo: RuteoMapa['tipo'], rol: RolEquipoMapa) =>
    mapa.ruteo.filter((x) => x.tipo === tipo).map((x) => salidaDe(x, rol, mapa));
  const enSalon = (MODALIDADES_SALON as readonly string[]).includes(esc.modalidad);

  const bebida: PiezaFlujo = {
    clave: 'BEBIDA',
    ...PIEZAS.BEBIDA,
    reglaActiva: r.bebidaActivo,
    sale: r.bebidaActivo && esc.conBebidas,
    motivo: !r.bebidaActivo ? 'Apagado en las reglas' : !esc.conBebidas ? 'El pedido no lleva bebidas' : 'Un vaso por cada bebida',
    salidas: salidas('ETIQUETA_BEBIDA', 'ETIQUETERA'),
  };

  const resumen: PiezaFlujo = {
    clave: 'RESUMEN',
    ...PIEZAS.RESUMEN,
    reglaActiva: r.generalModalidades.length > 0,
    sale: r.generalModalidades.includes(esc.modalidad),
    motivo: r.generalModalidades.length === 0
      ? 'Apagado: ninguna modalidad lo imprime'
      : r.generalModalidades.includes(esc.modalidad)
        ? 'Sale con el monto total'
        : `No sale en ${NOMBRE_MODALIDAD[esc.modalidad]}`,
    salidas: salidas('ETIQUETA_GENERAL', 'ETIQUETERA'),
  };

  const area: PiezaFlujo = {
    clave: 'AREA',
    ...PIEZAS.AREA,
    reglaActiva: r.areaActivo,
    sale: r.areaActivo,
    motivo: r.areaActivo ? 'Un sticker por cada área del pedido' : 'Apagado: actívalo cuando lo confirmes',
    salidas: salidas('ETIQUETA_AREA', 'ETIQUETERA'),
  };

  const comanda: PiezaFlujo = {
    clave: 'COMANDA',
    ...PIEZAS.COMANDA,
    reglaActiva: r.comandaSalonActivo,
    sale: r.comandaSalonActivo && enSalon,
    motivo: !r.comandaSalonActivo
      ? 'Apagada en las reglas'
      : !enSalon
        ? 'Solo sale en pedidos de salón (mesa o local)'
        : 'Sale en la ticketera de Caja',
    salidas: salidas('TICKET_COMANDA_SALON', 'TICKETERA'),
  };

  const pago: PiezaFlujo = {
    clave: 'PAGO',
    ...PIEZAS.PAGO,
    reglaActiva: true,
    sale: true,
    motivo: 'Siempre sale en Caja',
    salidas: salidas('TICKET_PAGO', 'TICKETERA'),
  };

  return [bebida, resumen, area, comanda, pago];
}
