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

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Normaliza lo escrito (trim, espacios, minúsculas); «Maní» pasa al código MANI. null si no es válido (1-30, letras/espacios/guiones). */
export function normalizarAlergeno(entrada: string): string | null {
  const t = entrada.trim().replace(/\s+/g, ' ').toLowerCase();
  if (t.length < 1 || t.length > 30 || !/^[\p{L}]+(?:[ -][\p{L}]+)*$/u.test(t)) return null;
  const fijo = ALERGENOS.find((a) => sinTildes(a.etiqueta) === sinTildes(t));
  return fijo ? fijo.valor : t;
}

/** Alérgenos que no son de los 8 fijos. */
export const esAlergenoPersonalizado = (v: string) => !ALERGENOS.some((a) => a.valor === v);

/** «maní, lácteos, lúcuma»: los fijos con su etiqueta en el orden fijo, luego los personalizados tal cual. */
export function textoAlergenos(valores: string[] | undefined | null): string {
  const lista = valores ?? [];
  const fijos = ALERGENOS.filter((a) => lista.includes(a.valor)).map((a) => a.etiqueta);
  return [...fijos, ...lista.filter(esAlergenoPersonalizado)].join(', ');
}
