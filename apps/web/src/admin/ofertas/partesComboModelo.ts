/**
 * Modelo del editor de partes del combo («¿Qué lleva el combo?»).
 *
 * La fuente de verdad sigue siendo la lista plana de partes que guarda el servidor (A_ELECCION / FIJO con categorías y
 * productos, y paqueteGrupo / paqueteNombre para el complemento a elegir). Aquí solo se AGRUPA para mostrarla por
 * bloques y opciones, y se generan solos los nombres que el dueño nunca tiene que escribir.
 */
import type { ComboParteItem } from './ofertasApi';

export interface ProductoEditor {
  id: string;
  nombre: string;
  categoriaId?: string;
  categoria?: string;
  precio?: number;
  fotoUrl?: string | null;
  sabores?: Array<{ id: string; nombre: string }>;
  tamanos?: Array<{ id: string; nombre: string; precio?: number }>;
}
export interface CategoriaEditor {
  id: string;
  nombre: string;
}
export type Parte = ComboParteItem;

export type Bloque =
  | { clave: string; tipo: 'ELECCION' | 'FIJO'; idxs: [number] }
  | { clave: string; tipo: 'COMPLEMENTO'; grupo: string; idxs: number[] };

export const GRUPO_POR_DEFECTO = 'Complemento';
let contadorUid = 0;
/** Identificador solo del editor: no cambia aunque cambie el título de la opción. */
export const nuevoUid = () => `u${++contadorUid}`;
const BEBIDAS = ['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES', 'BEBIDAS'];

export const tipoDe = (p: Parte) => p.tipoParte || p.tipo || 'A_ELECCION';
export const idsProductos = (p: Parte): string[] =>
  (p.productos ?? []).map((x: any) => String(typeof x === 'object' ? x.productoId || x.id : x));

export function perteneceACategoria(prod: ProductoEditor, cat: CategoriaEditor): boolean {
  return (!!prod.categoriaId && prod.categoriaId === cat.id) || (!!prod.categoria && prod.categoria.toLowerCase() === cat.nombre.toLowerCase());
}

/** Productos que la parte ofrece: sus productos marcados (mandan) o los de sus categorías, sin los quitados. */
export function productosDeLaParte(p: Parte, productos: ProductoEditor[], categorias: CategoriaEditor[]): ProductoEditor[] {
  const marcados = idsProductos(p);
  const quitados = p.productosExcluidos ?? [];
  if (tipoDe(p) === 'FIJO') return productos.filter((x) => marcados.includes(x.id));
  if (marcados.length > 0) return productos.filter((x) => marcados.includes(x.id) && !quitados.includes(x.id));
  const cats = categorias.filter((c) => (p.categorias ?? []).includes(c.id));
  return productos.filter((x) => cats.some((c) => perteneceACategoria(x, c)) && !quitados.includes(x.id));
}

/** Combos viejos guardaban categorías por nombre: se pasan a id si se reconocen. Rellena los campos nuevos. */
export function normalizarPartes(partes: Parte[], categorias: CategoriaEditor[], productos: ProductoEditor[]): Parte[] {
  const normales = partes.map((p) => {
    const cats = (p.categorias ?? []).map((c: any) => {
      const t = String(typeof c === 'object' ? c.id ?? c.categoriaId : c);
      const porId = categorias.find((x) => x.id === t);
      return (porId ?? categorias.find((x) => x.nombre.toLowerCase() === t.toLowerCase()))?.id ?? t;
    });
    const base: Parte = {
      ...p,
      tipoParte: p.tipoParte === 'OPCIONES' || tipoDe(p) === 'UNA_DE' ? 'A_ELECCION' : p.tipoParte || (p.tipo === 'FIJO' ? 'FIJO' : 'A_ELECCION'),
      cantidad: p.cantidad || 1,
      categorias: cats,
      productos: idsProductos(p),
      alternativas: p.alternativas || [],
      saboresIds: (p.saboresIds ?? []).map(String),
      productosExcluidos: (p.productosExcluidos ?? []).map(String),
      tamanoId: p.tamanoId ?? null,
      uid: p.uid ?? nuevoUid(),
    };
    base.pieza = tipoDe(base) === 'FIJO' || (cats.length === 0 && base.productos!.length > 0) ? 'PRODUCTO' : 'CATEGORIA';
    return base;
  });
  // Un título que no es el automático lo escribió el dueño: se respeta
  const conTitulos = normales.map((p) => ({ ...p }));
  for (const g of gruposDe(normales)) {
    for (const o of opcionesDeGrupo(normales, g)) {
      const auto = tituloOpcion(o.idxs.map((i) => normales[i]), categorias, productos);
      if (o.nombre !== auto) o.idxs.forEach((i) => (conTitulos[i].nombreManual = true));
    }
  }
  return conTitulos.map((p) => (p.paqueteGrupo ? { ...p, nombre: p.paqueteNombre ?? p.nombre } : p));
}

export const gruposDe = (partes: Parte[]): string[] => [...new Set(partes.map((p) => (p.paqueteGrupo ?? '').trim()).filter(Boolean))];

/** Opciones de un complemento en el orden en que aparecen, con los índices de sus piezas. */
export function opcionesDeGrupo(partes: Parte[], grupo: string): { nombre: string; idxs: number[] }[] {
  const mapa = new Map<string, number[]>();
  partes.forEach((p, i) => {
    if ((p.paqueteGrupo ?? '').trim() !== grupo) return;
    const n = (p.paqueteNombre ?? '').trim();
    mapa.set(n, [...(mapa.get(n) ?? []), i]);
  });
  return [...mapa].map(([nombre, idxs]) => ({ nombre, idxs }));
}

/** Bloques (tarjetas) en el orden de la lista: cada parte suelta es uno; todas las piezas de un complemento, otro. */
export function bloquesDe(partes: Parte[]): Bloque[] {
  const bloques: Bloque[] = [];
  const vistos = new Set<string>();
  partes.forEach((p, i) => {
    const grupo = (p.paqueteGrupo ?? '').trim();
    if (grupo) {
      if (vistos.has(grupo)) return;
      vistos.add(grupo);
      bloques.push({ clave: `g:${grupo}`, tipo: 'COMPLEMENTO', grupo, idxs: partes.flatMap((x, j) => ((x.paqueteGrupo ?? '').trim() === grupo ? [j] : [])) });
    } else {
      bloques.push({ clave: `p:${i}`, tipo: tipoDe(p) === 'FIJO' ? 'FIJO' : 'ELECCION', idxs: [i] });
    }
  });
  return bloques;
}

/** Vuelve a armar la lista plana con los bloques en el orden dado. */
export const aplanar = (partes: Parte[], bloques: Bloque[]): Parte[] => bloques.flatMap((b) => b.idxs.map((i) => partes[i]));

// ---------- Textos automáticos ----------

const singular = (t: string) => (t.length > 4 && /nes$/i.test(t) ? t.slice(0, -2) : t.length > 3 && /s$/i.test(t) ? t.slice(0, -1) : t);

/** «2 donas», «1 carrot cake»: la pieza en palabras simples. Vacío si aún no se eligió nada. */
export function tituloPieza(p: Parte, categorias: CategoriaEditor[], productos: ProductoEditor[]): string {
  const cant = p.cantidad || 1;
  const marcados = idsProductos(p).map((id) => productos.find((x) => x.id === id)?.nombre).filter((n): n is string => !!n);
  const cats = (p.categorias ?? []).map((id) => categorias.find((c) => c.id === id)?.nombre).filter((n): n is string => !!n);
  let etiqueta = '';
  if (marcados.length === 1) etiqueta = marcados[0].toLowerCase();
  else if (cats.length > 0) {
    const nombres = cats.map((n) => (cant === 1 ? singular(n) : n).toLowerCase()).join(' o ');
    etiqueta = marcados.length > 1 ? `${nombres} (a elección entre ${marcados.length})` : nombres;
  } else if (marcados.length > 1) etiqueta = marcados.length <= 3 ? marcados.map((n) => n.toLowerCase()).join(' o ') : `a elección entre ${marcados.length} productos`;
  return etiqueta ? `${cant} ${etiqueta}` : '';
}

export function tituloOpcion(piezas: Parte[], categorias: CategoriaEditor[], productos: ProductoEditor[]): string {
  const t = piezas.map((p) => tituloPieza(p, categorias, productos)).filter(Boolean);
  return t.length ? t.join(' + ') : 'Combinación sin completar';
}

/**
 * Pone a cada opción su título automático (las que el dueño renombró a mano se respetan) sin repetir títulos dentro de
 * un complemento: dos opciones con el mismo nombre se fundirían en una sola.
 */
export function retitular(partes: Parte[], categorias: CategoriaEditor[], productos: ProductoEditor[]): Parte[] {
  const out = partes.map((p) => ({ ...p }));
  for (const g of gruposDe(partes)) {
    const opciones = opcionesDeGrupo(partes, g);
    const usados = new Set(opciones.filter((o) => partes[o.idxs[0]].nombreManual).map((o) => o.nombre));
    for (const o of opciones) {
      if (partes[o.idxs[0]].nombreManual) continue;
      const base = tituloOpcion(o.idxs.map((i) => partes[i]), categorias, productos);
      let titulo = base;
      for (let n = 2; usados.has(titulo); n++) titulo = `${base} (${n})`;
      usados.add(titulo);
      o.idxs.forEach((i) => ((out[i].paqueteNombre = titulo), (out[i].nombre = titulo)));
    }
  }
  return out;
}

/** «a, b o c» */
export const listaO = (n: string[]) => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} o ${n[n.length - 1]}`);

/** Nombres de lo que puede elegir el cliente en una parte: los productos marcados (mandan) o las categorías. */
export function nombresQueElige(p: Parte, categorias: CategoriaEditor[], productos: ProductoEditor[]): string[] {
  if (idsProductos(p).length > 0) return idsProductos(p).map((id) => productos.find((x) => x.id === id)?.nombre).filter((n): n is string => !!n);
  return (p.categorias ?? []).map((id) => categorias.find((c) => c.id === id)?.nombre).filter((n): n is string => !!n);
}

/** Título de la tarjeta «El cliente elige entre varias cosas»: el que escribió el dueño o «Elige 2: Donas o Galleta». */
export function nombreDeBloque(p: Parte, categorias: CategoriaEditor[], productos: ProductoEditor[] = []): string {
  if (p.nombreManual && p.nombre?.trim()) return p.nombre.trim();
  const nombres = nombresQueElige(p, categorias, productos);
  const cant = p.cantidad || 1;
  return nombres.length ? `Elige ${cant}: ${listaO(nombres)}` : `Elige ${cant} (falta elegir qué)`;
}

// ---------- Piezas nuevas ----------

export const piezaVacia = (grupo: string, nombre: string, pieza: 'CATEGORIA' | 'PRODUCTO', cantidad = 1): Parte => ({
  tipoParte: 'A_ELECCION', cantidad, categorias: [], productos: [], alternativas: [], saboresIds: [], productosExcluidos: [],
  tamanoId: null, paqueteGrupo: grupo, paqueteNombre: nombre, nombre, pieza, uid: nuevoUid(),
});

export const nuevaEleccion = (cantidad = 2): Parte => ({
  nombre: 'Elige 2', tipoParte: 'A_ELECCION', cantidad, categorias: [], productos: [], alternativas: [], saboresIds: [], productosExcluidos: [],
  tamanoId: null, pieza: 'CATEGORIA', uid: nuevoUid(),
});

export const nuevoFijo = (): Parte => ({
  nombre: 'Siempre incluido', tipoParte: 'FIJO', cantidad: 1, categorias: [], productos: [], alternativas: [], saboresIds: [], productosExcluidos: [],
  tamanoId: null, pieza: 'PRODUCTO', uid: nuevoUid(),
});

/** Plantillas rápidas de una opción de complemento. */
export type PlantillaOpcion = 'MISMA_CATEGORIA' | 'DOS_CATEGORIAS' | 'PRODUCTO_FIJO';
export function piezasDePlantilla(plantilla: PlantillaOpcion, grupo: string, nombre: string): Parte[] {
  if (plantilla === 'MISMA_CATEGORIA') return [piezaVacia(grupo, nombre, 'CATEGORIA', 2)];
  if (plantilla === 'DOS_CATEGORIAS') return [piezaVacia(grupo, nombre, 'CATEGORIA'), piezaVacia(grupo, nombre, 'CATEGORIA')];
  return [piezaVacia(grupo, nombre, 'PRODUCTO')];
}

/** Nombre de una combinación nueva que no choca con ninguno del complemento (se reemplaza solo por el título automático). */
export const nombreTemporal = (partes: Parte[], grupo: string): string => {
  const usados = new Set(opcionesDeGrupo(partes, grupo).map((o) => o.nombre));
  let n = 1;
  while (usados.has(`Combinación sin completar ${n}`)) n++;
  return `Combinación sin completar ${n}`;
};

// ---------- Cambios de producto y sabores ----------

/**
 * Lo que puede elegir el cliente, de un solo selector: categorías completas O productos sueltos (si hay productos solo
 * valen esos, así que no se mezclan). Con `fijoSiUnico`, un único producto sin sabores pasa a ser «siempre incluido».
 */
export function conSeleccion(p: Parte, cats: string[], prods: string[], productos: ProductoEditor[], fijoSiUnico = false): Parte {
  const unico = fijoSiUnico && cats.length === 0 && prods.length === 1 ? productos.find((x) => x.id === prods[0]) : undefined;
  const fijo = !!unico && (unico.sabores ?? []).length === 0;
  return {
    ...p, categorias: cats, productos: prods, saboresIds: [], tamanoId: null, tipoParte: fijo ? 'FIJO' : 'A_ELECCION',
    productosExcluidos: prods.length > 0 ? [] : p.productosExcluidos ?? [], pieza: cats.length === 0 && prods.length > 0 ? 'PRODUCTO' : 'CATEGORIA',
  };
}

/** ¿La pieza está sin completar? (sin categoría ni producto) */
export const piezaVaciaDeDatos = (p: Parte): boolean =>
  tipoDe(p) === 'FIJO' ? idsProductos(p).length === 0 : (p.categorias ?? []).length === 0 && idsProductos(p).length === 0;

/** Un producto de una pieza: fijo si no tiene sabores (sale tal cual); si tiene sabores, se elige por unidad. */
export function conProductoUnico(p: Parte, prod: ProductoEditor | undefined): Parte {
  if (!prod) return { ...p, productos: [], tipoParte: 'A_ELECCION', tamanoId: null, saboresIds: [] };
  const conSabores = (prod.sabores ?? []).length > 0;
  return { ...p, productos: [prod.id], categorias: [], tipoParte: conSabores ? 'A_ELECCION' : 'FIJO', tamanoId: null, saboresIds: [], productosExcluidos: [], alternativas: (p.alternativas ?? []).filter((a) => String(a.id) !== prod.id) };
}

/** Sabores que se pueden permitir en la parte: los de sus productos (con el producto, si hay más de uno con sabores). */
export function saboresDeLaParte(p: Parte, productos: ProductoEditor[], categorias: CategoriaEditor[]) {
  const con = productosDeLaParte(p, productos, categorias).filter((x) => (x.sabores ?? []).length > 0);
  return con.flatMap((x) => x.sabores!.map((s) => ({ id: String(s.id), nombre: s.nombre, producto: con.length > 1 ? x.nombre : '' })));
}

// ---------- Validación y resumen ----------

const sinNombreAmable = (n: string) => `«${n}»`;

/** Lo que le falta a una tarjeta (en palabras simples) o null si está completa. `n` es su número, como lo ve el dueño. */
export function faltaEnBloque(partes: Parte[], b: Bloque, n: number): string | null {
  if (b.tipo === 'COMPLEMENTO') {
    const opciones = opcionesDeGrupo(partes, b.grupo);
    for (const o of opciones) {
      if (o.idxs.some((i) => piezaVaciaDeDatos(partes[i]))) return `Te falta elegir qué lleva la combinación ${sinNombreAmable(o.nombre)} en la tarjeta ${n}.`;
    }
    if (opciones.length < 2) return `A la tarjeta ${n} le falta al menos una combinación más, para que el cliente pueda elegir.`;
    return null;
  }
  if (!piezaVaciaDeDatos(partes[b.idxs[0]])) return null;
  return b.tipo === 'FIJO' ? `Te falta elegir el producto de la tarjeta ${n}.` : `Te falta elegir qué puede escoger el cliente en la tarjeta ${n}.`;
}

/** Primer problema del editor en palabras simples, o null si todo está bien. */
export function errorDePartes(partes: Parte[], _categorias?: CategoriaEditor[]): string | null {
  if (partes.length === 0) return 'Agrega qué lleva el combo: toca «+ Agregar».';
  const bloques = bloquesDe(partes);
  for (let k = 0; k < bloques.length; k++) {
    const m = faltaEnBloque(partes, bloques[k], k + 1);
    if (m) return m;
  }
  return null;
}

export interface LineaResumen {
  clave: string;
  icono: 'bebida' | 'complemento' | 'fijo';
  titulo: string;
  opciones: { texto: string; avisos: string[] }[];
  avisos: string[];
}

function textoSabores(p: Parte, productos: ProductoEditor[], categorias: CategoriaEditor[]): string {
  const todos = saboresDeLaParte({ ...p, saboresIds: [] }, productos, categorias);
  if (todos.length === 0) return '';
  const elegidos = (p.saboresIds ?? []).length > 0 ? todos.filter((s) => p.saboresIds!.includes(s.id)).map((s) => s.nombre) : [];
  return elegidos.length > 0 ? `solo ${elegidos.join(', ')}` : 'cualquier sabor';
}

/** Lo que verá el cliente, en lenguaje claro, con avisos de lo que quedó incompleto o sin stock hoy. */
export function resumenParaCliente(partes: Parte[], categorias: CategoriaEditor[], productos: ProductoEditor[]): LineaResumen[] {
  const aviso = (p: Parte) => [...(piezaVaciaDeDatos(p) ? ['Falta completar'] : []), ...(p.disponible === false ? ['Hoy no hay stock'] : [])];
  return bloquesDe(partes).map((b): LineaResumen => {
    if (b.tipo === 'COMPLEMENTO') {
      return {
        clave: b.clave, icono: 'complemento', titulo: 'Elige una combinación', avisos: [],
        opciones: opcionesDeGrupo(partes, b.grupo).map((o) => {
          const piezas = o.idxs.map((i) => partes[i]);
          const sab = piezas.map((p) => textoSabores(p, productos, categorias)).filter(Boolean);
          const distintos = [...new Set(sab)];
          const sufijo = distintos.length ? ` (${distintos.join('; ')})` : '';
          return { texto: `${o.nombre}${sufijo}`, avisos: [...new Set(piezas.flatMap(aviso))] };
        }),
      };
    }
    const p = partes[b.idxs[0]];
    const cant = p.cantidad || 1;
    if (b.tipo === 'FIJO') {
      const prod = productos.find((x) => x.id === idsProductos(p)[0]);
      const tam = prod?.tamanos?.find((t) => t.id === p.tamanoId)?.nombre;
      return { clave: b.clave, icono: 'fijo', titulo: `Incluye ${cant} ${(prod?.nombre ?? 'producto sin elegir').toLowerCase()}${tam ? ` (${tam})` : ''}`, opciones: [], avisos: aviso(p) };
    }
    const nombres = idsProductos(p).length > 0
      ? productosDeLaParte(p, productos, categorias).map((x) => x.nombre)
      : (p.categorias ?? []).map((id) => categorias.find((c) => c.id === id)?.nombre).filter((n): n is string => !!n);
    const sab = textoSabores(p, productos, categorias);
    const quitados = (p.productosExcluidos ?? []).length;
    const soloBebidas = idsProductos(p).length === 0 && nombres.length > 0 && nombres.every((n) => BEBIDAS.includes(n.toUpperCase()));
    const que = soloBebidas
      ? `${cant} ${cant === 1 ? 'bebida' : 'bebidas'} (${nombres.join(', ')})`
      : nombres.length
        ? `${cant}: ${listaO(nombres.map((n) => n.toLowerCase()))}${cant > 1 && nombres.length > 1 ? ' (cualquier combinación)' : ''}`
        : `${cant}`;
    return {
      clave: b.clave, icono: 'bebida', opciones: [],
      titulo: `Elige ${que}${quitados ? `, sin ${quitados} producto${quitados === 1 ? '' : 's'}` : ''}${sab ? ` · ${sab}` : ''}`,
      avisos: aviso(p),
    };
  });
}

/** Partes tal como las guarda el servidor: sin campos del editor y con el nombre siempre puesto. */
export function partesParaGuardar(partes: Parte[], categorias: CategoriaEditor[], productos: ProductoEditor[]) {
  return partes.map((p, idx) => {
    const tipo = tipoDe(p) === 'FIJO' ? 'FIJO' : 'A_ELECCION';
    const nombre = (p.paqueteGrupo ? p.paqueteNombre : p.nombreManual ? p.nombre : '') || tituloPieza(p, categorias, productos) || p.nombre || 'Parte';
    return {
      nombre: nombre.trim(),
      tipo: tipo as 'FIJO' | 'A_ELECCION',
      tipoParte: tipo,
      cantidad: p.cantidad || 1,
      categorias: (p.categorias ?? []).map(String),
      productos: idsProductos(p),
      alternativas: (p.alternativas ?? []).map((a) => ({ productoId: String(a.id), cantidad: a.cantidad || 1 })),
      tamanoId: p.tamanoId || null,
      paqueteGrupo: (p.paqueteGrupo ?? '').trim() || null,
      paqueteNombre: (p.paqueteNombre ?? '').trim() || null,
      saboresIds: (p.saboresIds ?? []).map(String),
      productosExcluidos: (p.productosExcluidos ?? []).map(String),
      orden: idx + 1,
    };
  });
}
