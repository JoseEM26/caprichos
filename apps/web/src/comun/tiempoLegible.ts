/**
 * Tiempo de espera en texto corto y sin emojis.
 * duracionLegible: «25 min», «1 h», «1 h 20 min», «1 día», «3 días».
 * haceLegible: «hace 25 min», «hace 1 h 20 min», «hace 3 días» desde una fecha ISO (null si no sirve).
 */
export function duracionLegible(minutos: number): string {
  const m = Math.max(0, Math.floor(minutos));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const resto = m % 60;
    return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
  }
  const dias = Math.floor(m / 1440);
  return dias === 1 ? '1 día' : `${dias} días`;
}

export function haceLegible(iso: string | null | undefined, ahora = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const minutos = Math.floor((ahora - t) / 60000);
  if (minutos < 1) return 'hace menos de 1 min';
  return `hace ${duracionLegible(minutos)}`;
}
