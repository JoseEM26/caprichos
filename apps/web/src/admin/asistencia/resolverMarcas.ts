import type { CronoDia, CronoMarca } from './correccionesApi';

export type Otras = 'IGNORAR' | 'BREAK';

/** Hace falta el criterio del admin: varias entradas, varias salidas o una doble marca. */
export function necesitaCriterio(dia: CronoDia | null): boolean {
  if (!dia || dia.marcas.length < 2) return false;
  const cuenta = (rol: string) => dia.marcas.filter((m) => m.rol === rol).length;
  return cuenta('ENTRADA') >= 2 || cuenta('SALIDA') >= 2 || dia.marcas.some((m) => m.duplicada);
}

/** Preselección: la primera entrada y la última salida (las dobles marcas no cuentan para elegir). */
export function seleccionInicial(marcas: CronoMarca[]): { entradaId: number | null; salidaId: number | null } {
  const orden = [...marcas].sort((a, b) => a.minutos - b.minutos);
  const sinDobles = orden.filter((m) => !m.duplicada);
  const lista = sinDobles.length >= 2 ? sinDobles : orden;
  return { entradaId: lista[0]?.id ?? null, salidaId: lista[lista.length - 1]?.id ?? null };
}

/** Marcas que quedan entre la entrada y la salida elegidas: si son exactamente 2, pueden ser salida y regreso del break. */
export function entreElegidas(marcas: CronoMarca[], entradaId: number | null, salidaId: number | null): CronoMarca[] {
  const e = marcas.find((m) => m.id === entradaId);
  const s = marcas.find((m) => m.id === salidaId);
  if (!e || !s || s.minutos <= e.minutos) return [];
  return marcas
    .filter((m) => m.id !== e.id && m.id !== s.id && m.minutos > e.minutos && m.minutos < s.minutos)
    .sort((a, b) => a.minutos - b.minutos);
}

/**
 * Cómo quedaría el día con esas dos marcas, con lo que ya tiene el día (turno). No descuenta la tolerancia:
 * el sueldo exacto lo recalcula el servidor al guardar. null = elección que no sirve (sin salida posterior).
 */
export function vistaPrevia(dia: CronoDia, entradaId: number | null, salidaId: number | null): string | null {
  const e = dia.marcas.find((m) => m.id === entradaId);
  const s = dia.marcas.find((m) => m.id === salidaId);
  if (!e || !s || s.minutos <= e.minutos) return null;
  const cabeza = `Así queda: entrada ${e.hora} → salida ${s.hora} · ${((s.minutos - e.minutos) / 60).toFixed(1)} h trabajadas`;
  const t = dia.turno;
  if (!t) return `${cabeza} · sin horario (descanso trabajado)`;
  const tardanza = Math.max(0, e.minutos - t.entrada);
  const extra = Math.max(0, s.minutos - t.salida);
  const anticipada = Math.max(0, t.salida - s.minutos);
  return `${cabeza} · tardanza ${tardanza} min · extra ${extra} min${anticipada ? ` · salida anticipada ${anticipada} min` : ''}`;
}
