import type { Avatar3D, ConfigAvatar } from '../../../avatar/tipos';
import { OJOS, PALETA, PELOS, PIELES } from '../../../avatar/config';

/**
 * Clientes de la escena: cuántos hay en una mesa y cómo se ven los que no traen avatar.
 * Todo es estable: la misma semilla (el id del pedido) da siempre las mismas personas, aunque la pantalla se refresque.
 */
export const TOPE_PERSONAS = 40;
export const TOPE_PERSONAS_LIGERO = 18;

/** Hash estable de un texto (id del pedido + posición) a un entero sin signo. */
export function semilla(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Generador pseudoaleatorio (mulberry32): misma semilla, misma secuencia. */
export function azarDe(sem: number): () => number {
  let a = sem >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cuántos clientes se sientan en una mesa. Si se sabe cuántas personas son (reserva o lista de espera) se respeta;
 * si no, una persona por bebida del pedido (3 bebidas = cliente + 2); sin datos, dos. Siempre al menos 1, sin pasar
 * de las sillas de la mesa ni del cupo que quede en la escena.
 */
export function cantidadClientes(o: { personas?: number | null; bebidas?: number | null; sillas: number; cupo?: number }): number {
  const base = o.personas && o.personas > 0 ? o.personas : o.bebidas && o.bebidas > 0 ? o.bebidas : 2;
  return Math.max(1, Math.min(base, o.sillas, o.cupo ?? Infinity));
}

/** Avatar sencillo (sin gorros, extras ni mascota) elegido al azar pero estable: misma semilla, mismo avatar. */
export function configAleatoria(A: Pick<Avatar3D, 'REG'>, sem: number): Partial<ConfigAvatar> {
  const r = azarDe(sem);
  const elige = <T,>(l: readonly T[]): T => l[Math.floor(r() * l.length) % l.length];
  const pieza = (cat: string, evitar: string[] = []) => {
    const lista = (A.REG[cat] ?? []).filter((d) => !evitar.includes(d.id) && d.id !== 'ninguno');
    if (!lista.length) return undefined;
    const d = elige(lista);
    return { id: d.id, colores: (d.colores.includes('principal') ? { principal: elige(PALETA) } : {}) as Record<string, string> };
  };
  const c: Partial<ConfigAvatar> = {
    genero: elige(['mujer', 'hombre', 'neutro'] as const), piel: elige(PIELES), ojos: elige(OJOS), expresion: elige(['feliz', 'sonrisa'] as const), colorPelo: elige(PELOS),
  };
  for (const cat of ['cabello', 'arriba', 'abajo', 'calzado'] as const) {
    const p = pieza(cat, cat === 'cabello' ? ['calvo'] : []);
    if (p) c[cat] = p;
  }
  return c;
}
