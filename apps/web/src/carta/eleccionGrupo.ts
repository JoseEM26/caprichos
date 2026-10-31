/**
 * Regla única para elegir opciones de un grupo, compartida por la carta, el pedido de caja y el mozo.
 * - Elección única (máximo 1) y obligatoria (mínimo 1): elegir otra reemplaza; pulsar la elegida no la quita.
 * - Elección única y opcional (mínimo 0): elegir otra reemplaza; pulsar la elegida la quita.
 * - Varias (máximo mayor que 1): pulsar la elegida la quita; no se pasa del máximo.
 */
export function alternarEleccion(grupo: { minimo: number; maximo: number }, elegidas: string[], oid: string): string[] {
  const yaElegida = elegidas.includes(oid);
  if (grupo.maximo === 1) {
    if (!yaElegida) return [oid];
    return grupo.minimo === 0 ? [] : elegidas;
  }
  if (yaElegida) return elegidas.filter((x) => x !== oid);
  return elegidas.length < grupo.maximo ? [...elegidas, oid] : elegidas;
}
