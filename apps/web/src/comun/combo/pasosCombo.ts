/**
 * Pasos del armado de un combo (carta y mozo comparten esta regla). Es pura: recibe lo ya elegido y dice
 * qué pasos hay, cuáles están hechos y qué falta en cada uno. La UI (AsistenteCombo) solo la pinta.
 */

/** Una bebida dentro de un paso de bebidas (sub-paso «Bebida 2 de 4»). */
export interface SlotAsistente {
  id: string;
  etiqueta: string;
  hecho: boolean;
  /** Qué falta en esa bebida; aparece junto a «Siguiente» deshabilitado. */
  falta: string;
  parteId: string;
  indice: number;
}

/** Un paso del asistente: una decisión (o un grupo de bebidas). El resumen final lo agrega AsistenteCombo. */
export interface PasoAsistente {
  id: string;
  /** Texto corto del indicador de progreso («Bebidas», «Cremas»). */
  etiqueta: string;
  /** Título del paso. */
  titulo: string;
  hecho: boolean;
  /** Qué falta, en palabras; aparece junto a «Siguiente» deshabilitado. */
  falta?: string;
  /** Una selección única basta: al completarse avanza solo al paso siguiente (o a la siguiente bebida). */
  avanzaSolo?: boolean;
  /** Paso que no bloquea «Siguiente» (detalles sin nombres obligatorios). */
  opcional?: boolean;
  /** Bebidas del paso: una por sub-paso. Un paso con 1 o 2 bebidas tiene un slot; 3 o más, un paso con varios. */
  slots?: SlotAsistente[];
  /** Bloques que se muestran en este paso además del suyo: «opc» (extras), «nombres», «nota». */
  incluye?: string[];
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

/** Desde 3 bebidas, todas van en un solo paso «Bebidas» con sub-progreso (con 1 o 2, un paso por bebida). */
export const UMBRAL_BEBIDAS_EN_UN_PASO = 3;

/** Pasos de la ventana de un combo, en el orden en que se eligen. */
export function pasosCombo(e: EntradaPasos): PasoAsistente[] {
  const pasos: PasoAsistente[] = [];
  if (e.tamano.hay) {
    pasos.push({ id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: e.tamano.elegido, falta: 'Elige tu tamaño', avanzaSolo: true });
  }
  for (const a of e.alternativas) {
    pasos.push({ id: `alt-${a.parteId}`, etiqueta: 'Alternativa', titulo: `Sin stock de ${a.faltante}`, hecho: a.elegida, falta: `Elige una alternativa de ${a.faltante}`, avanzaSolo: true });
  }
  const slots: SlotAsistente[] = e.bebidas.flatMap((b) =>
    b.slots.map((s) => ({ id: `beb-${b.parteId}-${s.indice}`, etiqueta: `Bebida ${s.indice + 1}`, hecho: s.hecho, falta: `Elige tu bebida ${s.indice + 1}`, parteId: b.parteId, indice: s.indice })),
  );
  if (slots.length >= UMBRAL_BEBIDAS_EN_UN_PASO) {
    pasos.push({ id: 'bebidas', etiqueta: 'Bebidas', titulo: 'Bebidas', hecho: slots.every((s) => s.hecho), falta: slots.find((s) => !s.hecho)?.falta ?? 'Elige tus bebidas', avanzaSolo: true, slots });
  } else {
    for (const s of slots) pasos.push({ id: s.id, etiqueta: s.etiqueta, titulo: s.etiqueta, hecho: s.hecho, falta: s.falta, avanzaSolo: true, slots: [s] });
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
  // Extras (partes opcionales, p. ej. papas): van en el complemento o, si no hay, en la última sección (cremas);
  // si no hay ninguna de las dos, en Detalles. Nunca son un paso propio.
  const hospedaje = pasos.find((p) => p.id === 'comp') ?? [...pasos].reverse().find((p) => p.id.startsWith('sec-'));
  if (e.opcionales && hospedaje) hospedaje.incluye = ['opc'];
  // Un solo paso final «Detalles»: nombres de los vasos (obligatorios) y, en su caso, extras y nota (opcionales)
  pasos.push({
    id: 'detalles',
    etiqueta: 'Detalles',
    titulo: 'Detalles',
    hecho: e.nombres.faltan === 0,
    falta: e.nombres.primera || 'Revisa los detalles',
    opcional: e.nombres.total === 0,
    incluye: ['nombres', 'nota', ...(e.opcionales && !hospedaje ? ['opc'] : [])],
  });
  return pasos;
}

/** Desde cuántas decisiones el armado pasa a ser asistente por pasos (notas y extras no cuentan). */
export const UMBRAL_ASISTENTE = 3;

export const decisionesDe = (pasos: PasoAsistente[]): number => pasos.filter((p) => !p.opcional).length;
