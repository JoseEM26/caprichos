/** Contenido editable de la página Conócenos. Los defectos son los textos que tenía escritos el código. */
export const CONOCENOS_BLOQUES_IDS = ['donde', 'horario', 'contacto', 'redes', 'momentos'] as const;

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
  momentosCantidad: number;
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
  momentosCantidad: 8,
};

const texto = (v: unknown, def: string, max: number) =>
  (typeof v === 'string' ? v.trim().slice(0, max) : '') || def;

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
  const cant = Number(o.momentosCantidad);
  return {
    etiqueta: texto(o.etiqueta, d.etiqueta, 40),
    titulo: texto(o.titulo, d.titulo, 120),
    parrafos: parrafos.length ? parrafos : [...d.parrafos],
    bloques,
    momentosCantidad: Number.isFinite(cant) ? Math.min(24, Math.max(1, Math.round(cant))) : d.momentosCantidad,
  };
}
