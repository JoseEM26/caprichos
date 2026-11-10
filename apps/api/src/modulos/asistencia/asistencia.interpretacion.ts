// Interpretación pura de las marcas de una jornada (única fuente de verdad: jornada, planilla, propinas y cronograma).
// La gente marca 1, 3, 4, 7 u 8 veces: el servidor las ordena por hora y las lee por ORDEN Y PARES.
// Primera = entrada, última = salida, las del medio se emparejan (salida de break, regreso de break).
// Marcas a menos de `dobleMin` minutos de la anterior se unen (cuenta la primera; la otra queda tachada).
// Una marca «fija» (corrección del admin) conserva el rol que el admin le dio. Sin acceso a BD.

import type { MarcaCalc, TipoMarca, Turno } from './asistencia.calculo';

export const DOBLE_MARCA_MIN_DEFECTO = 3;

export interface MarcaClasificada extends MarcaCalc {
  /** Rol interpretado; null si es una doble marca (tachada) o no se pudo ubicar. */
  rol: TipoMarca | null;
  /** Índice (en `marcas`) de la marca a la que se unió, si es doble marca. */
  duplicadaDe: number | null;
}

export interface Tramo {
  desde: number;
  /** null = tramo todavía abierto (la persona sigue trabajando). */
  hasta: number | null;
  tipo: 'TRABAJO' | 'BREAK';
}

export type EstadoMarcas = 'SIN_MARCAS' | 'OK' | 'EN_CURSO' | 'INCOMPLETO' | 'A_REVISAR';

export interface Interpretacion {
  /** Todas, ordenadas por hora (incluye las dobles, con rol null). */
  marcas: MarcaClasificada[];
  entrada: MarcaClasificada | null;
  salida: MarcaClasificada | null;
  breaks: Array<{ sale: number; regresa: number }>;
  /** Break real (suma de pares); sin ninguna marca de break, el programado del turno. */
  breakMin: number;
  tramos: Tramo[];
  alertas: string[];
  estado: EstadoMarcas;
  /** Marcas que faltan para cerrar bien la jornada. */
  faltan: TipoMarca[];
}

/**
 * Clasifica las marcas (no anuladas) de una jornada. `cerrada` = ya pasaron las 04:00 del día siguiente.
 * Con la jornada abierta, la última marca solo cuenta como salida si hay salida clara (cerca del fin del turno).
 */
export function interpretarMarcas(
  entrada: MarcaCalc[],
  turno: Turno | null,
  cerrada: boolean,
  dobleMin: number = DOBLE_MARCA_MIN_DEFECTO,
): Interpretacion {
  const marcas: MarcaClasificada[] = [...entrada]
    .sort((a, b) => a.minutos - b.minutos)
    .map((m) => ({ ...m, rol: null, duplicadaDe: null }));
  const res: Interpretacion = {
    marcas, entrada: null, salida: null, breaks: [], breakMin: 0, tramos: [], alertas: [], estado: 'SIN_MARCAS', faltan: [],
  };

  // 1) dobles marcas: cuenta la primera
  const idx: number[] = [];
  marcas.forEach((m, i) => {
    const prev = idx.length ? marcas[idx[idx.length - 1]] : null;
    if (prev && dobleMin > 0 && !m.separada && !m.fijo && m.minutos - prev.minutos < dobleMin) m.duplicadaDe = idx[idx.length - 1];
    else idx.push(i);
  });
  const v = idx.map((i) => marcas[i]);
  const n = v.length;
  if (n === 0) return res;

  // 2) entrada y salida
  let eK = v.findIndex((m) => m.fijo && m.tipo === 'ENTRADA');
  if (eK < 0 && !v[0].fijo) eK = 0;
  let sK = -1;
  for (let k = n - 1; k >= 0; k--) if (v[k].fijo && v[k].tipo === 'SALIDA') { sK = k; break; }
  if (sK < 0 && n >= 2 && !v[n - 1].fijo && n - 1 !== eK) {
    const clara = cerrada || !turno || v[n - 1].minutos >= turno.salida - 60;
    if (clara) sK = n - 1;
  }
  if (eK >= 0) { v[eK].rol = 'ENTRADA'; res.entrada = v[eK]; }
  if (sK >= 0) { v[sK].rol = 'SALIDA'; res.salida = v[sK]; }

  let dudosa = false;
  const dudar = (texto: string, falta?: TipoMarca) => {
    dudosa = true;
    res.alertas.push(texto);
    if (falta && !res.faltan.includes(falta)) res.faltan.push(falta);
  };

  // 3) lo del medio, en pares (salida de break → regreso de break)
  const ini = eK >= 0 ? eK + 1 : 0;
  const fin = sK >= 0 ? sK : n;
  let esperado: 'OUT' | 'IN' = 'OUT';
  let pendiente: MarcaClasificada | null = null;
  let sinRegreso = false;
  let sinSalidaBreak = false;
  for (let k = ini; k < fin; k++) {
    const m = v[k];
    m.rol = m.fijo && m.tipo ? m.tipo : esperado === 'OUT' ? 'SALIDA_ALMUERZO' : 'ENTRADA_ALMUERZO';
    if (m.rol === 'SALIDA_ALMUERZO') {
      if (pendiente) sinRegreso = true;
      pendiente = m;
      esperado = 'IN';
    } else if (m.rol === 'ENTRADA_ALMUERZO') {
      if (!pendiente) sinSalidaBreak = true;
      else res.breaks.push({ sale: pendiente.minutos, regresa: m.minutos });
      pendiente = null;
      esperado = 'OUT';
    } else {
      dudar(`Marcó ${n} veces: hay una ${m.rol === 'ENTRADA' ? 'entrada' : 'salida'} repetida`);
    }
  }
  const abierta = pendiente && sK < 0 && !cerrada; // en su break: normal
  if (pendiente && !abierta) sinRegreso = true;
  if (sinRegreso) dudar(`Marcó ${n} veces: falta el regreso del break`, 'ENTRADA_ALMUERZO');
  if (sinSalidaBreak) dudar(`Marcó ${n} veces: hay un regreso de break sin salida a break`, 'SALIDA_ALMUERZO');

  // 4) marcas fuera de lugar y faltantes
  for (let k = 0; k < Math.min(eK < 0 ? 0 : eK, n); k++) dudar(`Marcó ${n} veces: hay una marca antes de la entrada`);
  if (sK >= 0) for (let k = sK + 1; k < n; k++) dudar(`Marcó ${n} veces: hay una marca después de la salida`);
  if (eK < 0) dudar(n === 1 ? 'Solo marcó 1 vez: falta la entrada' : `Marcó ${n} veces: falta la entrada`, 'ENTRADA');
  let incompleta = false;
  if (sK < 0 && cerrada) {
    if (!dudosa && n === 1) {
      incompleta = true;
      res.alertas.push('Solo marcó 1 vez: falta la salida');
      res.faltan.push('SALIDA');
    } else dudar(`Marcó ${n} veces: falta la salida`, 'SALIDA');
  }

  // 5) tramos y break
  if (eK >= 0) {
    let cursor = v[eK].minutos;
    for (const b of res.breaks) {
      res.tramos.push({ desde: cursor, hasta: b.sale, tipo: 'TRABAJO' }, { desde: b.sale, hasta: b.regresa, tipo: 'BREAK' });
      cursor = b.regresa;
    }
    if (sK >= 0) res.tramos.push({ desde: cursor, hasta: v[sK].minutos, tipo: 'TRABAJO' });
    else if (abierta && pendiente) {
      res.tramos.push({ desde: cursor, hasta: pendiente.minutos, tipo: 'TRABAJO' }, { desde: pendiente.minutos, hasta: null, tipo: 'BREAK' });
    } else if (!dudosa) res.tramos.push({ desde: cursor, hasta: null, tipo: 'TRABAJO' });
  }
  res.breakMin = res.breaks.reduce((a, b) => a + Math.max(0, b.regresa - b.sale), 0);
  const sinMarcasDeBreak = ini >= fin;
  if (sinMarcasDeBreak && turno && turno.almuerzoIni !== undefined && turno.almuerzoFin !== undefined) {
    res.breakMin = turno.almuerzoFin - turno.almuerzoIni;
  }

  res.estado = dudosa ? 'A_REVISAR' : sK < 0 ? (incompleta ? 'INCOMPLETO' : cerrada ? 'INCOMPLETO' : 'EN_CURSO') : 'OK';
  return res;
}

/** Rol con el que cuenta una marca (las dobles toman el de la marca a la que se unieron). */
export function rolEfectivo(i: Interpretacion, marca: MarcaClasificada): TipoMarca | null {
  return marca.rol ?? (marca.duplicadaDe !== null ? i.marcas[marca.duplicadaDe].rol : null);
}

// ---------------------------------------------------------------------------
// Inconsistencias (aviso al día siguiente)
// ---------------------------------------------------------------------------

export type TipoInconsistencia = 'SIN_SALIDA' | 'SIN_ENTRADA' | 'BREAK_SIN_REGRESO' | 'MARCAS_DUDOSAS' | 'SIN_MARCAS';

export interface Inconsistencia {
  tipo: TipoInconsistencia;
  texto: string;
  /** Marca que probablemente falta (sirve para prellenar la solicitud); null si no se sabe. */
  falta: TipoMarca | null;
}

const ETIQUETA_FALTA: Record<TipoMarca, string> = {
  ENTRADA: 'tu entrada',
  SALIDA_ALMUERZO: 'tu salida a break',
  ENTRADA_ALMUERZO: 'tu regreso del break',
  SALIDA: 'tu salida',
};

/** Qué inconsistencia tiene una jornada ya cerrada, a partir de su estado e interpretación; null si está bien. */
export function detectarInconsistencia(estado: string, i: Interpretacion, quien: string): Inconsistencia | null {
  if (estado === 'FALTA') return { tipo: 'SIN_MARCAS', texto: `${quien}: tenías horario pero no hay marcas. ¿Te olvidaste de marcar?`, falta: 'ENTRADA' };
  if (estado !== 'INCOMPLETO' && estado !== 'A_REVISAR') return null;
  // Marcas bien ordenadas pero a la espera del admin (p. ej. marca web): no es culpa de la persona
  if (i.estado !== 'A_REVISAR' && i.estado !== 'INCOMPLETO') return null;
  const f = i.faltan[0] ?? null;
  if (f === 'SALIDA') return { tipo: 'SIN_SALIDA', texto: `No marcaste tu salida (${quien})`, falta: f };
  if (f === 'ENTRADA') return { tipo: 'SIN_ENTRADA', texto: `No marcaste tu entrada (${quien})`, falta: f };
  if (f === 'ENTRADA_ALMUERZO' || f === 'SALIDA_ALMUERZO') {
    return { tipo: 'BREAK_SIN_REGRESO', texto: `Te falta ${ETIQUETA_FALTA[f]} (${quien})`, falta: f };
  }
  return { tipo: 'MARCAS_DUDOSAS', texto: `Tus marcas no cuadran (${quien}): ${i.alertas[0] ?? 'revisa la jornada'}`, falta: null };
}
