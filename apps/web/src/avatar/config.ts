import type { Avatar3D, CategoriaPieza, ConfigAvatar, DefPieza, PiezaElegida } from './tipos';

export const MASCOTA_NOMBRE_MAX = 14;
export const PALETA = ['#E67929', '#B2500F', '#D99E39', '#F2C14E', '#FBF4EC', '#FFFFFF', '#E8D5BC', '#8BA7B8', '#0B2C3E', '#1C1C22', '#5A6B78', '#C5221F', '#E84A7F', '#F2B6C3', '#6B4E9B', '#3B6FB6', '#3BB4E7', '#2DBE60', '#1F6B3A', '#7A4A2A'];
export const PIELES = ['#FFE6D0', '#F8D2B0', '#EDBB92', '#DDA477', '#C68B5E', '#A86E45', '#83532F', '#5E3A22'];
export const OJOS = ['#14141A', '#5B3A29', '#8A5A2B', '#2E7D5B', '#3B6FB6', '#6E8899', '#7A4FA0', '#B5651D'];
export const PELOS = ['#14141A', '#2B1B14', '#4A2C1D', '#7A4A2A', '#B07A45', '#E0BE6E', '#F3E3B5', '#9AA3AD', '#C5221F', '#E84A7F', '#6B4E9B', '#3B6FB6', '#2DBE60'];

export type CategoriaEditor = 'cuerpo' | CategoriaPieza | 'disfraz';
export const CATS: { id: CategoriaEditor; nombre: string; icono: string }[] = [
  { id: 'cuerpo', nombre: 'Cuerpo', icono: '🙂' },
  { id: 'cabello', nombre: 'Cabello', icono: '💇' },
  { id: 'arriba', nombre: 'Arriba', icono: '👕' },
  { id: 'abajo', nombre: 'Abajo', icono: '👖' },
  { id: 'calzado', nombre: 'Calzado', icono: '👟' },
  { id: 'cabeza', nombre: 'Gorros', icono: '🎩' },
  { id: 'cara', nombre: 'Cara', icono: '🥸' },
  { id: 'accesorio', nombre: 'Extras', icono: '🎒' },
  { id: 'mascota', nombre: 'Mascota', icono: '🐾' },
  { id: 'disfraz', nombre: 'Disfraces', icono: '🎭' },
];
export const ZOOM: Partial<Record<CategoriaEditor, 'cabeza' | 'pies' | 'mascota'>> = { cabello: 'cabeza', cabeza: 'cabeza', cara: 'cabeza', calzado: 'pies', mascota: 'mascota' };
/** Sección de Disfraces con las pijamas enteras: va primera y se abre por defecto. */
export const GRUPO_DESTACADOS = 'Destacados ✨';
export const NOMBRE_COLOR: Record<string, string> = { principal: 'Color principal', secundario: 'Segundo color', acento: 'Detalles' };

const primero = (A: Avatar3D, cat: string, evitar?: string) => A.REG[cat].find((x) => x.id !== evitar)?.id ?? 'ninguno';
const preferido = (A: Avatar3D, cat: string, ids: string[]) => ids.find((i) => A.buscar(cat, i)) ?? primero(A, cat, cat === 'cabello' ? 'calvo' : undefined);
const nada = (): PiezaElegida => ({ id: 'ninguno', colores: {} });

/** Avatar de partida (el mismo de la maqueta aprobada). */
export function porDefecto(A: Avatar3D, nombre = ''): ConfigAvatar {
  return {
    nombre: nombre.slice(0, 18), genero: 'mujer', piel: PIELES[1], ojos: OJOS[1], expresion: 'feliz', colorPelo: '#4A2C1D', disfraz: null, disfrazId: null,
    cabello: { id: preferido(A, 'cabello', ['bob_cerquillo', 'cerquillo_recto', 'melena']), colores: {} },
    arriba: { id: preferido(A, 'arriba', ['polo_basico', 'polo']), colores: {} },
    abajo: { id: preferido(A, 'abajo', ['jean', 'pantalon']), colores: {} },
    calzado: { id: preferido(A, 'calzado', ['zapatilla_urbana', 'zapatillas_urbanas']), colores: {} },
    cabeza: nada(), cara: nada(), accesorio: nada(), mascota: { id: 'ninguno', colores: {}, nombre: '' },
  };
}

/** El color del cabello va aparte del peinado: se mezcla al construir. */
export const conPelo = (c: ConfigAvatar): ConfigAvatar => ({ ...c, cabello: { ...c.cabello, colores: { ...c.cabello.colores, principal: c.colorPelo } } });

/** Pone un disfraz completo sobre el avatar actual (cada prenda sigue siendo editable). */
export function aplicarDisfraz(A: Avatar3D, base: ConfigAvatar, d: DefPieza): ConfigAvatar {
  const c: ConfigAvatar = JSON.parse(JSON.stringify(base));
  const rec = c as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(d.aplica ?? {})) {
    if (k === 'piel' || k === 'ojos' || k === 'genero' || k === 'expresion') rec[k] = v;
    else if (typeof v === 'object' && k === 'cabello') {
      c.cabello = { id: v.id, colores: {} };
      if (v.colores?.principal) c.colorPelo = v.colores.principal;
    } else if (typeof v === 'object' && A.REG[k] && A.buscar(k, v.id)) rec[k] = { id: v.id, colores: { ...(v.colores ?? {}) } };
  }
  c.disfraz = d.nombre;
  c.disfrazId = d.id;
  return c;
}

/** Quita piezas que ya no existen en el catálogo (un avatar guardado antes de un cambio de piezas no debe romper). */
export function normalizar(A: Avatar3D, guardada: unknown, nombre = ''): ConfigAvatar {
  const base = porDefecto(A, nombre);
  if (!guardada || typeof guardada !== 'object') return base;
  const g = guardada as Partial<ConfigAvatar>;
  const c: ConfigAvatar = { ...base, ...g, disfraz: g.disfraz ?? null, disfrazId: g.disfrazId ?? null };
  for (const cat of ['cabello', 'arriba', 'abajo', 'calzado', 'cabeza', 'cara', 'accesorio'] as const) {
    const p = g[cat];
    c[cat] = p && A.buscar(cat, p.id) ? { id: p.id, colores: { ...(p.colores ?? {}) } } : base[cat];
  }
  // Mascota: avatares guardados antes de que existiera no la traen
  const m = g.mascota;
  c.mascota = m && A.buscar('mascota', m.id) ? { id: m.id, colores: { ...(m.colores ?? {}) }, nombre: String(m.nombre ?? '').slice(0, MASCOTA_NOMBRE_MAX) } : base.mascota;
  c.usarComoFoto = g.usarComoFoto === true;
  return c;
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
