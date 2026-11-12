/** Alérgenos que un producto puede declarar (los mismos valores que valida la API). */
export const ALERGENOS: Array<{ valor: string; etiqueta: string }> = [
  { valor: 'MANI', etiqueta: 'maní' },
  { valor: 'NUECES', etiqueta: 'nueces' },
  { valor: 'LACTEOS', etiqueta: 'lácteos' },
  { valor: 'GLUTEN', etiqueta: 'gluten' },
  { valor: 'HUEVO', etiqueta: 'huevo' },
  { valor: 'SOYA', etiqueta: 'soya' },
  { valor: 'MARISCOS', etiqueta: 'mariscos' },
  { valor: 'SESAMO', etiqueta: 'sésamo' },
];

/** «maní, lácteos» con las etiquetas en el orden fijo de la lista. */
export function textoAlergenos(valores: string[] | undefined | null): string {
  const set = new Set(valores ?? []);
  return ALERGENOS.filter((a) => set.has(a.valor)).map((a) => a.etiqueta).join(', ');
}
