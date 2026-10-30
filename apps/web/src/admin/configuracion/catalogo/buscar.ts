import type { EntradaConfig } from './tipos';

/** Minúsculas, sin tildes, solo letras/números. Conserva la longitud (1 unidad por unidad) para poder resaltar. */
export function normaliza(s: string): string {
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const b = s[i].normalize('NFD')[0].toLowerCase();
    r += /[a-z0-9]/.test(b) ? b : ' ';
  }
  return r;
}

const palabrasDe = (s: string) => normaliza(s).split(/\s+/).filter(Boolean);

/** Distancia de edición <= 1 (inserción, borrado, sustitución o transposición). */
export function cercana(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // sustitución
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // transposición
  }
  const [c, l] = a.length < b.length ? [a, b] : [b, a];
  return c.slice(i) === l.slice(i + 1);
}

/** Fuerza 0..1 con que un término coincide con un texto. */
function fuerza(t: string, texto: string, palabras: string[]): number {
  if (!texto) return 0;
  if (palabras.includes(t)) return 1;
  if (palabras.some((p) => p.startsWith(t))) return 0.8;
  if (t.length >= 3 && texto.includes(t)) return 0.5;
  if (t.length >= 5 && palabras.some((p) => p.length >= 4 && cercana(t, p))) return 0.6;
  return 0;
}

interface Pre { titulo: string; tituloP: string[]; clave: string; claveP: string[]; desc: string; descP: string[]; sec: string; secP: string[] }
const cache = new WeakMap<EntradaConfig, Pre>();
function pre(e: EntradaConfig, nombreTab: string): Pre {
  let p = cache.get(e);
  if (!p) {
    const titulo = normaliza(e.titulo);
    const clave = normaliza([...e.palabras, e.clave || ''].join(' '));
    const desc = normaliza(e.descripcion);
    const sec = normaliza(`${e.seccion} ${nombreTab}`);
    p = { titulo, tituloP: palabrasDe(titulo), clave, claveP: palabrasDe(clave), desc, descP: palabrasDe(desc), sec, secP: palabrasDe(sec) };
    cache.set(e, p);
  }
  return p;
}

export interface ResultadoBusqueda { entrada: EntradaConfig; puntaje: number; }

export interface OpcionesBusqueda {
  /** Filtra lo que el usuario no puede ver. */
  visible?: (e: EntradaConfig) => boolean;
  /** Nombre legible de una pestaña (entra en la búsqueda por sección). */
  nombreTab?: (tab: string) => string;
}

/**
 * Puntaje: título 10 > palabras clave 6 > descripción 3 > sección 2.
 * Todas las palabras escritas (AND); si nadie las cumple todas, cae a cualquiera (OR) con la mitad de puntaje.
 */
export function buscar(catalogo: EntradaConfig[], consulta: string, op: OpcionesBusqueda = {}): ResultadoBusqueda[] {
  const terminos = palabrasDe(consulta);
  if (!terminos.length) return [];
  const base = op.visible ? catalogo.filter(op.visible) : catalogo;
  const filas = base.map((entrada) => {
    const p = pre(entrada, op.nombreTab ? op.nombreTab(entrada.tab) : '');
    const porTermino = terminos.map((t) =>
      Math.max(10 * fuerza(t, p.titulo, p.tituloP), 6 * fuerza(t, p.clave, p.claveP), 3 * fuerza(t, p.desc, p.descP), 2 * fuerza(t, p.sec, p.secP)),
    );
    return { entrada, porTermino };
  });
  const suma = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let res = filas.filter((f) => f.porTermino.every((x) => x > 0)).map((f) => ({ entrada: f.entrada, puntaje: suma(f.porTermino) }));
  if (!res.length) {
    res = filas.filter((f) => f.porTermino.some((x) => x > 0)).map((f) => ({ entrada: f.entrada, puntaje: suma(f.porTermino) / 2 }));
  }
  return res.sort((a, b) => b.puntaje - a.puntaje || a.entrada.titulo.localeCompare(b.entrada.titulo, 'es'));
}

/** Rangos [ini, fin) del texto original que coinciden (por prefijo/palabra) con la consulta, para <mark>. */
export function rangosResaltado(texto: string, consulta: string): Array<[number, number]> {
  const n = normaliza(texto);
  const rangos: Array<[number, number]> = [];
  for (const t of palabrasDe(consulta)) {
    const re = new RegExp(`(^|\\s)(${t})`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(n))) {
      const ini = m.index + m[1].length;
      rangos.push([ini, ini + t.length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  rangos.sort((a, b) => a[0] - b[0]);
  const unidos: Array<[number, number]> = [];
  for (const r of rangos) {
    const u = unidos[unidos.length - 1];
    if (u && r[0] <= u[1]) u[1] = Math.max(u[1], r[1]);
    else unidos.push([...r]);
  }
  return unidos;
}
