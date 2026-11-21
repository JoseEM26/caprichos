import type { ElementoVivo, PisoVivo } from '../salonVivoApi';

/**
 * Convierte el plano real del piso (elementos tal como se guardan) en la descripción de la escena 3D.
 * Función pura, sin three: decide qué es cada cosa (mesa, exhibidor, cocina por área, pared de ladrillo...) y dónde va.
 * Los tipos desconocidos se vuelven cajas neutras.
 */
export type ClaseItem = 'mesa' | 'caja' | 'barra' | 'cocina' | 'bano' | 'entrada' | 'pared' | 'escalera' | 'otro';
export type AreaEscena = 'BEBIDAS' | 'SALADOS' | 'POSTRES' | 'LAVADERO' | 'DESPACHO' | 'GENERAL';
export type RolPared = 'ladrillo' | 'rosada' | 'norte' | 'fachada' | 'normal';
export type EstiloMesa = 'sofa' | 'sillones' | 'sillas';

export interface ItemEscena {
  id: string;
  clase: ClaseItem;
  area?: AreaEscena;
  /** Clave para casar el área del plano con el área de cocina real (ver claveArea) */
  claveArea?: string;
  rol?: RolPared;
  etiqueta: string;
  /** Celdas del plano */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Centro en el mundo 3D (el plano queda centrado en 0,0; una celda = 1 unidad) */
  cx: number;
  cz: number;
  asientos: number;
  numero: number | null;
  estilo?: EstiloMesa;
  /** Mesa de la mitad norte (junto a la cocina) */
  arriba?: boolean;
}

export interface PuestoMesa {
  x: number;
  z: number;
  tipo: 'sofa' | 'silla' | 'sillon';
}

export interface EntradaEscena {
  cx: number;
  cz: number;
  /** Hacia dónde queda la calle (vector unitario en el plano) */
  dirX: number;
  dirZ: number;
}

export interface PlanoEscena {
  ancho: number;
  alto: number;
  items: ItemEscena[];
  entrada: EntradaEscena | null;
  /** Fila del plano (centro) por donde camina la gente entre las mesas */
  pasilloY: number;
  /** Celdas por donde no se camina */
  bloqueo: boolean[][];
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** «Salado», «SALADOS», «Salados» → «SALAD»: igual clave para el nombre del plano y el del área real. */
export function claveArea(texto: string): string {
  return sinTildes(texto).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
}

export function areaDeEtiqueta(etiqueta: string): { area: AreaEscena; clave: string } {
  const k = claveArea(etiqueta);
  if (k === 'BEBID') return { area: 'BEBIDAS', clave: k };
  if (k === 'SALAD') return { area: 'SALADOS', clave: k };
  if (k === 'POSTR') return { area: 'POSTRES', clave: k };
  if (k === 'LAVAD') return { area: 'LAVADERO', clave: k };
  if (k === 'DESPA') return { area: 'DESPACHO', clave: k };
  return { area: 'GENERAL', clave: k };
}

const claseDe = (tipo: string): ClaseItem => {
  const t = sinTildes(tipo).toUpperCase();
  if (t === 'MESA') return 'mesa';
  if (t === 'CAJA') return 'caja';
  if (t === 'BARRA') return 'barra';
  if (t === 'COCINA') return 'cocina';
  if (t === 'BANO' || t === 'BANOS') return 'bano';
  if (t === 'ENTRADA') return 'entrada';
  if (t === 'PARED') return 'pared';
  if (t === 'ESCALERA') return 'escalera';
  return 'otro';
};

const solapaX = (a: { x: number; w: number }, b: { x: number; w: number }) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);

export function planoAEscena(piso: Pick<PisoVivo, 'cuadriculaAncho' | 'cuadriculaAlto' | 'elementos'>): PlanoEscena {
  const ancho = Math.max(1, piso.cuadriculaAncho);
  const alto = Math.max(1, piso.cuadriculaAlto);
  const els = piso.elementos.filter((e: ElementoVivo) => e.activo !== false);
  const base = els.map((e) => ({ e, clase: claseDe(e.tipo) }));
  const cocinas = base.filter((b) => b.clase === 'cocina').map((b) => b.e);
  const paredes = base.filter((b) => b.clase === 'pared').map((b) => b.e);

  const items: ItemEscena[] = base.map(({ e, clase }) => {
    const item: ItemEscena = {
      id: e.id, clase, etiqueta: (e.nombre ?? '').trim(),
      x: e.x, y: e.y, w: e.ancho, h: e.alto,
      cx: e.x + e.ancho / 2 - ancho / 2, cz: e.y + e.alto / 2 - alto / 2,
      asientos: e.asientos ?? 4, numero: e.numero,
    };
    if (clase === 'cocina') {
      const { area, clave } = areaDeEtiqueta(item.etiqueta || 'COCINA');
      item.area = area; item.claveArea = clave;
      if (!item.etiqueta) item.etiqueta = 'COCINA';
    }
    if (clase === 'pared') {
      const horizontal = e.ancho > e.alto;
      if (horizontal && cocinas.some((c) => c.y + c.alto === e.y && solapaX({ x: c.x, w: c.ancho }, { x: e.x, w: e.ancho }) > 0)) item.rol = 'ladrillo';
      else if (horizontal && e.y + e.alto >= alto && e.ancho >= ancho / 2) item.rol = 'rosada';
      else if (e.y === 0) item.rol = 'norte';
      else if (!horizontal && e.x + e.ancho >= ancho && e.alto >= 2) item.rol = 'fachada';
      else item.rol = 'normal';
    }
    return item;
  });

  // Mesas: estilo según lo que tengan al sur (pared) y su tamaño
  for (const it of items.filter((i) => i.clase === 'mesa')) {
    it.arriba = it.y + it.h / 2 < alto * 0.55;
    const paredSur = paredes.some((p) => p.y >= it.y + it.h && p.y - (it.y + it.h) <= 1 && solapaX({ x: p.x, w: p.ancho }, { x: it.x, w: it.w }) > 0 && p.ancho > p.alto);
    it.estilo = paredSur ? 'sofa' : it.asientos <= 2 ? 'sillones' : 'sillas';
  }

  const bloqueo: boolean[][] = Array.from({ length: alto }, () => Array<boolean>(ancho).fill(false));
  for (const it of items) {
    if (it.clase === 'entrada') continue;
    for (let j = it.y; j < it.y + it.h; j++) for (let i = it.x; i < it.x + it.w; i++) if (bloqueo[j]?.[i] !== undefined) bloqueo[j][i] = true;
  }

  const ent = items.find((i) => i.clase === 'entrada');
  let entrada: EntradaEscena | null = null;
  if (ent) {
    const izq = ent.x, der = ancho - (ent.x + ent.w), arr = ent.y, aba = alto - (ent.y + ent.h);
    const m = Math.min(izq, der, arr, aba);
    const [dirX, dirZ] = m === der ? [1, 0] : m === izq ? [-1, 0] : m === aba ? [0, 1] : [0, -1];
    entrada = { cx: ent.cx, cz: ent.cz, dirX, dirZ };
  }

  // Pasillo: la fila libre (en el interior) que queda en medio de la tanda de filas libres más larga
  const libre = (j: number) => { for (let i = 2; i < ancho - 2; i++) if (bloqueo[j][i]) return false; return true; };
  let mejor: [number, number] | null = null, ini = -1;
  for (let j = 0; j <= alto; j++) {
    if (j < alto && libre(j)) { if (ini < 0) ini = j; continue; }
    if (ini >= 0 && (!mejor || j - ini > mejor[1] - mejor[0] + 1)) mejor = [ini, j - 1];
    ini = -1;
  }
  const pasilloY = mejor ? Math.floor((mejor[0] + mejor[1]) / 2) + 0.5 : Math.min(alto - 1, Math.floor(alto / 2)) + 0.5;

  return { ancho, alto, items, entrada, pasilloY, bloqueo };
}

/** Lugares de la mesa (coordenadas locales, la mesa en 0,0): sofá contra la pared, sillones azules o sillas alrededor. */
export function puestosDeMesa(m: ItemEscena): PuestoMesa[] {
  const n = Math.max(1, m.asientos);
  if (m.estilo === 'sillones') {
    const base: PuestoMesa[] = [{ x: -0.9, z: 0, tipo: 'sillon' }, { x: 0.9, z: 0, tipo: 'sillon' }, { x: 0, z: -0.82, tipo: 'silla' }, { x: 0, z: 0.82, tipo: 'silla' }, { x: 0, z: 0.82, tipo: 'silla' }];
    return base.slice(0, Math.max(2, Math.min(n, 4)));
  }
  const base: PuestoMesa[] = m.estilo === 'sofa'
    ? [{ x: -0.3, z: 0.88, tipo: 'sofa' }, { x: 0.3, z: 0.88, tipo: 'sofa' }, { x: -0.88, z: 0, tipo: 'silla' }, { x: 0.88, z: 0, tipo: 'silla' }, { x: 0, z: -0.82, tipo: 'silla' }]
    : [{ x: -0.3, z: 0.88, tipo: 'silla' }, { x: 0.3, z: 0.88, tipo: 'silla' }, { x: -0.88, z: 0, tipo: 'silla' }, { x: 0.88, z: 0, tipo: 'silla' }, { x: 0, z: -0.82, tipo: 'silla' }];
  return base.slice(0, Math.min(n, 5));
}

/** Cuántos cocineros caben en el área (1 si es corta). */
export const cocinerosDeArea = (it: ItemEscena): number => (it.area === 'LAVADERO' || it.area === 'DESPACHO' ? 0 : it.w >= 5 ? 2 : 1);

/**
 * Ruta caminando por las celdas libres (8 vecinos, sin cortar esquinas). Coordenadas en celdas del plano.
 * Si el destino está tapado (mesa, mostrador...) termina en la celda libre más cercana y de ahí va recto.
 */
export function buscarRuta(
  plano: Pick<PlanoEscena, 'ancho' | 'alto' | 'bloqueo'>,
  desde: [number, number],
  hasta: [number, number],
): Array<[number, number]> {
  const { ancho, alto, bloqueo } = plano;
  const dentro = (i: number, j: number) => i >= 0 && j >= 0 && i < ancho && j < alto;
  const libre = (i: number, j: number) => dentro(i, j) && !bloqueo[j][i];
  const cel = (p: [number, number]): [number, number] => [Math.min(ancho - 1, Math.max(0, Math.floor(p[0]))), Math.min(alto - 1, Math.max(0, Math.floor(p[1])))];
  // Si el camino recto está libre no hace falta buscar
  const largo = Math.hypot(hasta[0] - desde[0], hasta[1] - desde[1]);
  let recto = true;
  for (let t = 0; t <= largo && recto; t += 0.25) {
    const f = largo ? t / largo : 0;
    const [ci, cj] = cel([desde[0] + (hasta[0] - desde[0]) * f, desde[1] + (hasta[1] - desde[1]) * f]);
    if (bloqueo[cj][ci]) recto = false;
  }
  if (recto && !bloqueo[cel(hasta)[1]][cel(hasta)[0]]) return [[hasta[0], hasta[1]]];
  const [si, sj] = cel(desde);
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const k = (i: number, j: number) => j * ancho + i;
  const cola: Array<[number, number]> = [[si, sj]];
  dist.set(k(si, sj), 0);
  for (let q = 0; q < cola.length; q++) {
    const [i, j] = cola[q];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (!libre(ni, nj) || dist.has(k(ni, nj))) continue;
      if (di && dj && (!libre(i + di, j) || !libre(i, j + dj))) continue;
      dist.set(k(ni, nj), dist.get(k(i, j))! + 1);
      prev.set(k(ni, nj), k(i, j));
      cola.push([ni, nj]);
    }
  }
  let mejorCelda = k(si, sj), mejorD = Infinity;
  for (const [id] of dist) {
    const i = id % ancho, j = Math.floor(id / ancho);
    const d = Math.hypot(i + 0.5 - hasta[0], j + 0.5 - hasta[1]);
    if (d < mejorD - 1e-9) { mejorD = d; mejorCelda = id; }
  }
  const camino: Array<[number, number]> = [];
  for (let c: number | undefined = mejorCelda; c !== undefined; c = prev.get(c)) camino.unshift([(c % ancho) + 0.5, Math.floor(c / ancho) + 0.5]);
  camino.shift(); // la celda de salida
  camino.push([hasta[0], hasta[1]]);
  // se quitan los puntos que quedan en línea recta
  return camino.filter((p, n) => {
    if (n === 0 || n === camino.length - 1) return true;
    const a = camino[n - 1], b = camino[n + 1];
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-6;
  });
}
