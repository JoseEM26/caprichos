/**
 * Pasos del armado de un combo (carta y mozo comparten esta regla). Es pura: recibe lo ya elegido y dice
 * qué pasos hay, cuáles están hechos y qué falta en cada uno. La UI (AsistenteCombo) solo la pinta.
 */

/** Un paso del asistente: una decisión. El resumen final lo agrega AsistenteCombo, no esta lista. */
export interface PasoAsistente {
  id: string;
  /** Texto corto del indicador de progreso («Bebida 1»). */
  etiqueta: string;
  /** Título del paso. */
  titulo: string;
  hecho: boolean;
  /** Qué falta, en palabras; aparece junto a «Siguiente» deshabilitado. */
  falta?: string;
  /** Una selección única basta: al completarse avanza solo al paso siguiente. */
  avanzaSolo?: boolean;
  /** Paso que no bloquea «Siguiente» (nota para cocina, extras). */
  opcional?: boolean;
}

/** Lo que la ventana ya sabe de sus propios estados (carta o mozo), en datos planos. */
export interface EntradaPasos {
  tamano: { hay: boolean; elegido: boolean };
  /** Nombres de los grupos de paquetes («Complemento»); vacío si no hay. */
  grupoPaquete: string;
  paqueteElegido: boolean;
  alternativas: { parteId: string; faltante: string; elegida: boolean }[];
  /** Partes de bebidas: un paso por unidad («Bebida 1», «Bebida 2»…). */
  bebidas: { parteId: string; slots: { indice: number; hecho: boolean }[] }[];
  /** Piezas del complemento: faltan > 0 = faltan lugares; < 0 = sobran. */
  piezas: { parteId: string; faltan: number }[];
  /** Secciones de opciones del combo (nombre de la sección y si ya está completa). */
  secciones: { clave: string; completa: boolean; unica: boolean; falta: string }[];
  /** Nombres de los vasos (0 total = no aplica). */
  nombres: { total: number; faltan: number; primera: string };
  /** Hay extras (partes opcionales, p. ej. papas). */
  opcionales: boolean;
}

/** Secciones en orden de aparición: «Bebida 1 · Sabor» → «Bebida 1». */
export const secciones0 = (nombres: string[]): string[] => Array.from(new Set(nombres.filter((n) => n.includes(' · ')).map((n) => n.split(' · ')[0])));

/** Un grupo suelto (sin « · ») se titula con su nombre; nunca con un id numérico. */
export const tituloPaso = (nombre: string): string => (/^\s*\d*\s*$/.test(nombre) ? 'Complemento' : nombre.trim());

/** Clave de sección de un grupo: lo que va antes de « · », o el título del grupo suelto. */
export const claveSeccion = (nombre: string): string => (nombre.includes(' · ') ? nombre.split(' · ')[0] : tituloPaso(nombre));

/** Secciones de un conjunto de grupos (cada grupo va a su sección por el nombre); `completa` dice si ya cumple. */
export function agruparSecciones<G extends { nombre: string; maximo: number }>(grupos: G[], completa: (g: G) => boolean): EntradaPasos['secciones'] {
  const claves: string[] = [];
  const mapa: Record<string, G[]> = {};
  for (const g of grupos) {
    const k = claveSeccion(g.nombre);
    if (!mapa[k]) {
      mapa[k] = [];
      claves.push(k);
    }
    mapa[k].push(g);
  }
  return claves.map((k) => ({ clave: k, completa: mapa[k].every(completa), unica: mapa[k].length === 1 && mapa[k][0].maximo === 1, falta: `Elige en ${k}` }));
}

/** Texto de lo que falta en el complemento: lugares que faltan o sobran. */
function faltaComplemento(e: EntradaPasos): string {
  const faltan = e.piezas.reduce((a, p) => a + Math.max(0, p.faltan), 0);
  const sobran = e.piezas.reduce((a, p) => a + Math.max(0, -p.faltan), 0);
  if (!e.paqueteElegido) return `Elige tu ${e.grupoPaquete ? e.grupoPaquete.toLowerCase() : 'complemento'}`;
  return sobran > 0 ? `Quita ${sobran} opción(es)` : `Elige ${faltan} lugar(es) más`;
}

/** Pasos de la ventana de un combo, en el orden en que se eligen. */
export function pasosCombo(e: EntradaPasos): PasoAsistente[] {
  const pasos: PasoAsistente[] = [];
  if (e.tamano.hay) {
    pasos.push({ id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: e.tamano.elegido, falta: 'Elige tu tamaño', avanzaSolo: true });
  }
  for (const a of e.alternativas) {
    pasos.push({ id: `alt-${a.parteId}`, etiqueta: 'Alternativa', titulo: `Sin stock de ${a.faltante}`, hecho: a.elegida, falta: `Elige una alternativa de ${a.faltante}`, avanzaSolo: true });
  }
  for (const b of e.bebidas) {
    for (const s of b.slots) {
      const n = s.indice + 1;
      pasos.push({ id: `beb-${b.parteId}-${s.indice}`, etiqueta: `Bebida ${n}`, titulo: `Bebida ${n}`, hecho: s.hecho, falta: `Elige tu bebida ${n}`, avanzaSolo: true });
    }
  }
  if (e.grupoPaquete || e.piezas.length > 0) {
    pasos.push({
      id: 'comp',
      etiqueta: 'Complemento',
      titulo: 'Complemento',
      hecho: (!e.grupoPaquete || e.paqueteElegido) && e.piezas.every((p) => p.faltan === 0),
      falta: faltaComplemento(e),
    });
  }
  for (const s of e.secciones) {
    pasos.push({ id: `sec-${s.clave}`, etiqueta: s.clave, titulo: s.clave, hecho: s.completa, falta: s.falta, avanzaSolo: s.unica });
  }
  if (e.nombres.total > 0) {
    pasos.push({ id: 'nombres', etiqueta: 'Nombres', titulo: 'Nombres para el vaso', hecho: e.nombres.faltan === 0, falta: e.nombres.primera });
  }
  if (e.opcionales) pasos.push({ id: 'opc', etiqueta: 'Extras', titulo: 'Extras del combo', hecho: true, opcional: true });
  pasos.push({ id: 'nota', etiqueta: 'Nota', titulo: 'Nota para cocina', hecho: true, opcional: true });
  return pasos;
}

/** Desde cuántas decisiones el armado pasa a ser asistente por pasos (notas y extras no cuentan). */
export const UMBRAL_ASISTENTE = 3;

export const decisionesDe = (pasos: PasoAsistente[]): number => pasos.filter((p) => !p.opcional).length;
