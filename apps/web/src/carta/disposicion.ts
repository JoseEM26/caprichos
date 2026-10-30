// Ajustes de tamaño y posición de la carta pública (espejo de apps/api/.../disposicion-carta.ts).
// Los valores por defecto reproducen el diseño anterior: una carta sin disposición se ve igual.

export type IdSeccionCarta = 'mes' | 'franja' | 'momentos' | 'novedades' | 'categorias';
export type IdItemFranja = 'estado' | 'delivery' | 'entrega' | 'medios';
export type TamanoBanner = 'compacto' | 'normal' | 'grande';
export type TamanoTarjeta = 'chico' | 'normal' | 'grande';

export interface DisposicionCarta {
  secciones: { id: IdSeccionCarta; visible: boolean }[];
  banner: { tamanoPc: TamanoBanner; tamanoCelular: TamanoBanner; ajusteFoto: 'cubrir' | 'contener'; focoFoto: 'arriba' | 'centro' | 'abajo' };
  franja: { items: { id: IdItemFranja; visible: boolean }[] };
  momentos: { tamano: TamanoTarjeta };
  novedades: { tamano: TamanoTarjeta };
  carta: { columnasPc: 'auto' | '2' | '3' | '4' };
}

export const DISPOSICION_DEFECTO: DisposicionCarta = {
  secciones: [
    { id: 'mes', visible: true },
    { id: 'franja', visible: true },
    { id: 'momentos', visible: true },
    { id: 'novedades', visible: true },
    { id: 'categorias', visible: true },
  ],
  banner: { tamanoPc: 'normal', tamanoCelular: 'normal', ajusteFoto: 'cubrir', focoFoto: 'centro' },
  franja: {
    items: [
      { id: 'estado', visible: true },
      { id: 'delivery', visible: true },
      { id: 'entrega', visible: true },
      { id: 'medios', visible: true },
    ],
  },
  momentos: { tamano: 'normal' },
  novedades: { tamano: 'normal' },
  carta: { columnasPc: 'auto' },
};

export const ETIQUETA_SECCION: Record<IdSeccionCarta, string> = {
  mes: 'Caprichos del mes (banner)',
  franja: 'Franja de datos (abierto, delivery, entrega, pagos)',
  momentos: 'Momentos Caprichos',
  novedades: 'Novedades',
  categorias: 'Carta (categorías y productos)',
};

export const ETIQUETA_ITEM_FRANJA: Record<IdItemFranja, string> = {
  estado: 'Abierto / cerrado',
  delivery: 'Delivery gratis desde',
  entrega: 'Entrega en unos minutos',
  medios: 'Medios de pago',
};

const SECCIONES_VALIDAS = Object.keys(ETIQUETA_SECCION) as IdSeccionCarta[];
const ITEMS_VALIDOS = Object.keys(ETIQUETA_ITEM_FRANJA) as IdItemFranja[];

/** Completa la disposición recibida del servidor; lo que no cuadra cae al valor por defecto. */
export function resolverDisposicion(raw: unknown): DisposicionCarta {
  const d = DISPOSICION_DEFECTO;
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<DisposicionCarta>;

  const secciones = Array.isArray(r.secciones) ? r.secciones : [];
  const ordenValido =
    secciones.length === SECCIONES_VALIDAS.length &&
    SECCIONES_VALIDAS.every((id) => secciones.some((s) => s?.id === id));
  const items = Array.isArray(r.franja?.items) ? r.franja!.items : [];
  const franjaValida = items.length === ITEMS_VALIDOS.length && ITEMS_VALIDOS.every((id) => items.some((s) => s?.id === id));

  const enum_ = <T extends string>(v: unknown, lista: readonly T[], def: T): T =>
    (lista as readonly string[]).includes(v as string) ? (v as T) : def;

  return {
    secciones: ordenValido ? secciones.map((s) => ({ id: s.id, visible: s.visible !== false })) : d.secciones,
    banner: {
      tamanoPc: enum_(r.banner?.tamanoPc, ['compacto', 'normal', 'grande'], d.banner.tamanoPc),
      tamanoCelular: enum_(r.banner?.tamanoCelular, ['compacto', 'normal', 'grande'], d.banner.tamanoCelular),
      ajusteFoto: enum_(r.banner?.ajusteFoto, ['cubrir', 'contener'], d.banner.ajusteFoto),
      focoFoto: enum_(r.banner?.focoFoto, ['arriba', 'centro', 'abajo'], d.banner.focoFoto),
    },
    franja: { items: franjaValida ? items.map((s) => ({ id: s.id, visible: s.visible !== false })) : d.franja.items },
    momentos: { tamano: enum_(r.momentos?.tamano, ['chico', 'normal', 'grande'], d.momentos.tamano) },
    novedades: { tamano: enum_(r.novedades?.tamano, ['chico', 'normal', 'grande'], d.novedades.tamano) },
    carta: { columnasPc: enum_(r.carta?.columnasPc, ['auto', '2', '3', '4'], d.carta.columnasPc) },
  };
}

/** Medidas del banner «Caprichos del mes» según tamaño, en celular o PC. */
export function medidasBanner(tamano: TamanoBanner, movil: boolean) {
  if (movil) {
    return {
      padding: { compacto: '12px 14px', normal: '18px 16px', grande: '24px 20px' }[tamano],
      titulo: { compacto: 20, normal: 24, grande: 30 }[tamano],
      tituloLinea: { compacto: '24px', normal: '28px', grande: '34px' }[tamano],
      foto: { compacto: 80, normal: 104, grande: 124 }[tamano],
    };
  }
  return {
    padding: { compacto: '24px 28px', normal: '36px 40px', grande: '52px 56px' }[tamano],
    titulo: { compacto: 34, normal: 44, grande: 54 }[tamano],
    tituloLinea: { compacto: '40px', normal: '50px', grande: '60px' }[tamano],
    foto: { compacto: 170, normal: 230, grande: 280 }[tamano],
  };
}

/** Ancho de cada momento (círculo + margen) según tamaño. Normal = diseño anterior. */
export function medidasMomento(tamano: TamanoTarjeta, movil: boolean) {
  const circulo = movil
    ? ({ chico: 50, normal: 60, grande: 74 } as const)[tamano]
    : ({ chico: 64, normal: 84, grande: 104 } as const)[tamano];
  return { circulo, ancho: circulo + (movil ? 8 : 12) };
}

/** Ancho de cada tarjeta de novedad en el carrusel. Normal = diseño anterior. */
export function anchoNovedad(tamano: TamanoTarjeta, movil: boolean): string {
  if (movil) return ({ chico: '58%', normal: '66%', grande: '80%' } as const)[tamano];
  return ({ chico: '240px', normal: '300px', grande: '380px' } as const)[tamano];
}

/** Columnas de la cuadrícula de productos. En celular y en vista LISTA siempre una columna. */
export function gridColumnas(movil: boolean, organizacion: string, columnasPc: string): string {
  if (movil || organizacion === 'LISTA') return '1fr';
  if (columnasPc !== 'auto') return `repeat(${columnasPc}, minmax(0, 1fr))`;
  return organizacion === 'TARJETAS' ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fill, minmax(230px, 1fr))';
}
