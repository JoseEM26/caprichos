/**
 * Opciones distintas por bebida: las unidades con la MISMA configuración (mismas opciones) se juntan
 * en una sola línea; las diferentes quedan en líneas aparte. Conserva el orden de aparición.
 */
export function agruparUnidadesIguales<T extends { opciones: { id: string }[] }>(unidades: T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const u of unidades) {
    const clave = u.opciones
      .map((o) => o.id)
      .sort()
      .join('|');
    grupos.set(clave, [...(grupos.get(clave) ?? []), u]);
  }
  return [...grupos.values()];
}
