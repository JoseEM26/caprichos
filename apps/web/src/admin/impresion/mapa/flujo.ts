import { MODALIDADES_SALON } from '@caprichos/compartido';
import type { EquipoMapa, EstadoRolMapa, MapaImpresionDatos, RolEquipoMapa, RuteoMapa } from '../impresionApi';

export type Modalidad = 'MESA' | 'LOCAL' | 'LLEVAR' | 'RECOGER' | 'DELIVERY' | 'COMER_LOCAL';
export interface Escenario {
  modalidad: Modalidad;
  conBebidas: boolean;
}
export type ClavePieza = 'BEBIDA' | 'RESUMEN' | 'AREA' | 'COMANDA' | 'COMANDA_AREA' | 'PAGO';

export const PIEZAS: Record<ClavePieza, { titulo: string; que: string; paraQue: string }> = {
  BEBIDA: { titulo: 'Sticker de bebida', que: 'Sale uno por cada bebida', paraQue: 'Un vaso marcado para cada bebida, para no confundirlas en la barra.' },
  RESUMEN: { titulo: 'Sticker de resumen', que: 'Sale uno con el total del pedido', paraQue: 'Muestra el monto y la modalidad para cobrar y entregar.' },
  AREA: { titulo: 'Sticker por área', que: 'Un sticker por cada área con productos, salvo Bebidas (que ya tiene uno por cada vaso)', paraQue: 'Para que cada área (salados, postres…) sepa qué le toca preparar.' },
  COMANDA: { titulo: 'Comanda de salón', que: 'Hoja con cada línea para la cocina', paraQue: 'Lo que la cocina y el mozo leen en mesa o local.' },
  COMANDA_AREA: { titulo: 'Comanda por área', que: 'Una hoja por área para su cocina', paraQue: 'Cada cocina recibe solo las líneas de su área, en su ticketera (o en la de Caja si no tiene).' },
  PAGO: { titulo: 'Ticket de pago', que: 'Lo que se entrega al cobrar', paraQue: 'El comprobante de la venta. Siempre sale en Caja.' },
};

/** Color de cada tipo de pieza: sus líneas y su borde. Las piezas apagadas usan gris (GRIS_APAGADO). */
export const COLOR_PIEZA: Record<ClavePieza, string> = {
  BEBIDA: '#2a9d8f',
  RESUMEN: '#e07a2d',
  AREA: '#3d6fb6',
  COMANDA: '#8a4fb0',
  COMANDA_AREA: '#b5537a',
  PAGO: '#0b2c3e',
};
export const GRIS_APAGADO = '#9a9a9a';

/** Texto llano de cada estado de impresora (lo que ve el dueño, no el código del agente). */
export const TEXTO_ESTADO: Record<string, string> = {
  lista: 'lista',
  sin_papel: 'sin papel',
  desconectada: 'desconectada',
  sin_permiso: 'sin permiso',
  error: 'con error',
  no_configurada: 'sin configurar',
  sin_programa: 'programa apagado',
};
export const NOMBRE_ROL: Record<string, string> = { ETIQUETERA: 'Etiquetera', TICKETERA: 'Ticketera' };

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
  COMER_LOCAL: 'Comer en el local',
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
  paraQue: string;
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

/** ¿El equipo declara esa máquina? (una etiquetera o ticketera que no tiene no cuenta como problema). */
export function tieneMaquina(e: EquipoMapa, rol: RolEquipoMapa): boolean {
  return e.maquinas.includes(rol);
}

/**
 * Qué hay en la sub-ranura de una máquina de un área: el equipo del área que la declara, un equipo del área
 * que no la tiene, o ningún equipo (sale en Caja).
 */
export type SubRanura =
  | { tipo: 'equipo'; equipo: EquipoMapa; estado: EstadoRolMapa }
  | { tipo: 'sin_maquina'; equipo: EquipoMapa }
  | { tipo: 'sin_equipo' };

export function subRanura(mapa: MapaImpresionDatos, areaId: string, rol: RolEquipoMapa): SubRanura {
  const delArea = mapa.equipos.filter((e) => e.areaId === areaId);
  const con = delArea.find((e) => tieneMaquina(e, rol));
  if (con) return { tipo: 'equipo', equipo: con, estado: estadoRol(con, rol) as EstadoRolMapa };
  if (delArea.length > 0) return { tipo: 'sin_maquina', equipo: delArea[0] };
  return { tipo: 'sin_equipo' };
}

/** Luz de una sola máquina: verde lista, ámbar sin papel, roja cualquier otro problema o sin conexión. */
export function luzDeMaquina(e: EquipoMapa, rol: RolEquipoMapa): NivelLuz {
  if (!e.conectado) return 'rojo';
  const estado = estadoRol(e, rol);
  if (estado === 'lista') return 'verde';
  if (estado === 'sin_papel') return 'ambar';
  return 'rojo';
}

/** Luz del equipo: verde lista; ámbar pide atención (sin papel, sin máquinas); rojo no imprime. Solo cuentan sus máquinas. */
export function luzDeEquipo(e: EquipoMapa): NivelLuz {
  if (!e.conectado) return 'rojo';
  const estados = e.roles.filter((r) => tieneMaquina(e, r.rol)).map((r) => r.estado);
  if (estados.length === 0) return 'ambar';
  if (estados.some((s) => s === 'desconectada' || s === 'error' || s === 'sin_permiso' || s === 'sin_programa')) return 'rojo';
  if (estados.some((s) => s === 'sin_papel')) return 'ambar';
  return 'verde';
}

/** Texto de la luz de un equipo: lo que se entiende de un vistazo. */
export function textoLuz(e: EquipoMapa): string {
  if (!e.conectado) return 'Sin conexión';
  const luz = luzDeEquipo(e);
  return luz === 'verde' ? 'Lista' : luz === 'ambar' ? 'Atención' : 'Revisar';
}

/** Por qué un trabajo de esta pieza acaba en ese destino (o no sale). Para el detalle. */
export function motivoSalida(s: Salida): string {
  if (s.sinEquipo) return 'Ningún equipo tiene asignada esta área: no sale.';
  if (s.cae) return 'El área no tiene equipo propio: cae en Caja.';
  if (s.espera) return 'Su equipo no está listo: el trabajo queda en espera.';
  if (s.slot === null) return 'Caja imprime esta pieza.';
  return 'Su equipo está asignado a esa área.';
}

/**
 * Orden de las piezas para que las líneas se crucen lo menos posible: primero las que van a la
 * columna de Caja (la de arriba), luego las de cada área en el orden de la columna de destinos.
 */
export function ordenarPiezas(flujo: PiezaFlujo[], columnas: Array<string | null>): PiezaFlujo[] {
  const puesto = (p: PiezaFlujo) => {
    const idx = p.salidas.map((s) => {
      const i = columnas.indexOf(s.slot ?? null);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    });
    return idx.length ? Math.min(...idx) : Number.MAX_SAFE_INTEGER;
  };
  return [...flujo].sort((a, b) => puesto(a) - puesto(b));
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
    reglaActiva: r.bebidaActivo && r.bebidaModalidades.length > 0,
    sale: r.bebidaActivo && r.bebidaModalidades.includes(esc.modalidad) && esc.conBebidas,
    motivo: !r.bebidaActivo
      ? 'Apagado en las reglas'
      : !r.bebidaModalidades.includes(esc.modalidad)
        ? `No sale en ${NOMBRE_MODALIDAD[esc.modalidad]}`
        : !esc.conBebidas
          ? 'El pedido no lleva bebidas'
          : 'Un vaso por cada bebida',
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
    reglaActiva: r.areaActivo && r.areaModalidades.length > 0,
    sale: r.areaActivo && r.areaModalidades.includes(esc.modalidad),
    motivo: !r.areaActivo
      ? 'Apagado en las reglas'
      : r.areaModalidades.includes(esc.modalidad)
        ? 'Un sticker por cada área con productos, salvo Bebidas'
        : `No sale en ${NOMBRE_MODALIDAD[esc.modalidad]}`,
    salidas: salidas('ETIQUETA_AREA', 'ETIQUETERA'),
  };

  const comandaArea: PiezaFlujo = {
    clave: 'COMANDA_AREA',
    ...PIEZAS.COMANDA_AREA,
    reglaActiva: r.comandaAreaActivo,
    sale: r.comandaAreaActivo,
    motivo: r.comandaAreaActivo ? 'Una hoja por cada área del pedido' : 'Apagada en las reglas',
    salidas: salidas('TICKET_COMANDA_AREA', 'TICKETERA'),
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

  return [bebida, resumen, area, comanda, comandaArea, pago];
}
