/** Contenido editable de la página Conócenos. Los defectos son los textos que tenía escritos el código. */
export const CONOCENOS_BLOQUES_IDS = ['donde', 'horario', 'contacto', 'redes', 'momentos'] as const;

/** Tope de fotos por galería (Conócenos y Momentos de Novedades). */
export const GALERIA_MAX = 60;

/** Foto propia de una galería: se oculta con `activo: false`, nunca se borra. */
export interface FotoGaleria {
  id: string;
  url: string;
  activo: boolean;
  /** Solo las que vinieron de «Fotos del local»: el lugar que ocupaban (Fachada, Terraza…). */
  origen?: string;
}

export interface BloqueConocenos {
  id: (typeof CONOCENOS_BLOQUES_IDS)[number];
  titulo: string;
  visible: boolean;
}

export interface ContenidoConocenos {
  etiqueta: string;
  titulo: string;
  parrafos: string[];
  bloques: BloqueConocenos[];
  /** Fotos de Conócenos: las 3 primeras son «Nuestro lugar» y el resto, Momentos Caprichos. */
  galeria: FotoGaleria[];
}

export const CONOCENOS_DEFAULT: ContenidoConocenos = {
  etiqueta: 'CONÓCENOS',
  titulo: 'Cafetería artesanal en San Juan de Lurigancho',
  parrafos: [
    'Creamos momentos para compartir con experiencias gastronómicas artesanales: ingredientes premium, procesos hechos a mano y sin químicos.',
  ],
  bloques: [
    { id: 'donde', titulo: 'Dónde estamos', visible: true },
    { id: 'horario', titulo: 'Horario', visible: true },
    { id: 'contacto', titulo: 'Contáctanos', visible: true },
    { id: 'redes', titulo: 'Síguenos', visible: true },
    { id: 'momentos', titulo: 'Momentos Caprichos', visible: true },
  ],
  galeria: [],
};

const texto = (v: unknown, def: string, max: number) =>
  (typeof v === 'string' ? v.trim().slice(0, max) : '') || def;

/** Solo direcciones de archivos del servidor o https: nunca una imagen incrustada (data URL). */
const urlPermitida = (u: string) => (u.startsWith('/') && !u.startsWith('//')) || u.startsWith('https://');

/** Limpia una galería: sin duplicar ids, sin URL no válida y con tope. Respeta el orden. */
export function normalizarGaleria(v: unknown): FotoGaleria[] {
  if (!Array.isArray(v)) return [];
  const lista: FotoGaleria[] = [];
  const ids = new Set<string>();
  for (const f of v as any[]) {
    const url = typeof f?.url === 'string' ? f.url.trim().slice(0, 500) : '';
    if (!url || !urlPermitida(url)) continue;
    let id = typeof f.id === 'string' ? f.id.trim().slice(0, 60) : '';
    if (!id) id = `foto-${lista.length + 1}`;
    while (ids.has(id)) id = `${id}-x`;
    ids.add(id);
    const origen = typeof f.origen === 'string' && f.origen.trim() ? f.origen.trim().slice(0, 40) : undefined;
    lista.push({ id, url, activo: f.activo !== false, ...(origen ? { origen } : {}) });
    if (lista.length >= GALERIA_MAX) break;
  }
  return lista;
}

/** Completa lo que falte con los defectos; el orden guardado se respeta y los bloques que falten van al final. */
export function normalizarConocenos(v: any): ContenidoConocenos {
  const d = CONOCENOS_DEFAULT;
  const o = v && typeof v === 'object' ? v : {};
  const parrafos = (Array.isArray(o.parrafos) ? o.parrafos : [])
    .map((p: unknown) => (typeof p === 'string' ? p.trim().slice(0, 1000) : ''))
    .filter(Boolean)
    .slice(0, 6);
  const guardados: any[] = Array.isArray(o.bloques) ? o.bloques : [];
  const bloques: BloqueConocenos[] = [];
  for (const g of guardados) {
    const base = d.bloques.find((b) => b.id === g?.id);
    if (base && !bloques.some((b) => b.id === base.id)) {
      bloques.push({ id: base.id, titulo: texto(g.titulo, base.titulo, 80), visible: g.visible !== false });
    }
  }
  for (const base of d.bloques) if (!bloques.some((b) => b.id === base.id)) bloques.push({ ...base });
  return {
    etiqueta: texto(o.etiqueta, d.etiqueta, 40),
    titulo: texto(o.titulo, d.titulo, 120),
    parrafos: parrafos.length ? parrafos : [...d.parrafos],
    bloques,
    galeria: normalizarGaleria(o.galeria),
  };
}
