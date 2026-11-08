import type { EtiquetaAreaDatos, EtiquetaBebidaDatos, EtiquetaGeneralDatos, TipoEtiqueta } from '../tipos/etiquetas.js';
import { TAMANO_BEBIDA_DEFECTO, TAMANO_GENERAL_DEFECTO } from '../constantes/tamanosEtiqueta.js';
import {
  FUENTES_TSPL,
  MM_A_DOTS,
  ajustarLineas,
  maquetarArea,
  medirAnchoTexto,
  truncar,
  type FormatoMaqueta,
  type FuenteTspl,
  type Maqueta,
  type Primitiva,
} from './maquetaEtiquetas.js';

/**
 * Stickers de BEBIDA y GENERAL en su orientacion natural (sin girar): el lienzo mide exactamente el tamano del
 * sticker (ancho x alto mm a 203 dpi = 8 dots por mm). Nada es una constante magica: margenes, bandas, zonas y
 * tipografia se CALCULAN con el ancho y el alto. Cada texto baja de tamano por niveles hasta que cabe; si aun asi
 * no cabe, se recorta con "..." o con "+ N mas". Blanco y negro (termica), sin degradados.
 * Letra minima: fuente 2 (20 dots de alto = 2.5 mm, unos 7 pt); la fuente 1 no se usa.
 */
type Nivel = [FuenteTspl, number];

const alto = (f: string) => FUENTES_TSPL[f].alto;
const ancho = (f: string) => FUENTES_TSPL[f].ancho;
const hLinea = ([f, m]: Nivel) => alto(f) * m + (m > 1 ? 4 : 2);

interface Lienzo {
  W: number;
  H: number;
  prim: Primitiva[];
  /** Margen extra por la configuración de la PC (dots), ya sumado a b. */
  extra: number;
  /** Distancia del marco al borde. */
  b: number;
  /** Margen interior izquierdo y ancho util. */
  x0: number;
  w: number;
}

function lienzo(tam: { anchoMm: number; altoMm: number; margenMm?: number }): Lienzo {
  const W = Math.round(tam.anchoMm * MM_A_DOTS);
  const H = Math.round(tam.altoMm * MM_A_DOTS);
  const prim: Primitiva[] = [];
  // Marco unico; el margen crece un poco con el sticker (el cabezal no imprime pegado al borde)
  const bBase = Math.max(4, Math.round(Math.min(W, H) / 60));
  const b = Math.max(bBase, Math.round((tam.margenMm ?? 0) * MM_A_DOTS));
  prim.push({ t: 'caja', x1: b, y1: b, x2: W - b, y2: H - b, grosor: 3, radio: 8 });
  const x0 = b + 10;
  return { W, H, prim, b, extra: b - bBase, x0, w: W - 2 * x0 };
}

const texto = (L: Lienzo, x: number, y: number, fuente: FuenteTspl, m: number, t: string, invertido = false) => {
  const p: Primitiva = { t: 'texto', x, y, fuente, xm: m, ym: m, texto: t };
  if (invertido) p.invertido = true;
  L.prim.push(p);
};
const barra = (L: Lienzo, x: number, y: number, w: number, h: number) => L.prim.push({ t: 'barra', x, y, w, h });
const inverso = (L: Lienzo, x: number, y: number, w: number, h: number) => L.prim.push({ t: 'inverso', x, y, w, h });
const ancho_ = (t: string, [f, m]: Nivel) => medirAnchoTexto(t, f, m);
const centrar = (L: Lienzo, t: string, n: Nivel) => L.x0 + Math.max(0, Math.floor((L.w - ancho_(t, n)) / 2));
const charsEn = (w: number, [f, m]: Nivel) => Math.max(1, Math.floor(w / (ancho(f) * m)));

/**
 * Parte `t` en lineas con el nivel mas grande en que cabe entero en w x h; si ninguno cabe, usa el mas chico
 * y recorta con "..." las lineas que sobran.
 */
function encajar(t: string, w: number, h: number, niveles: Nivel[], maxLineas = 99): { n: Nivel; lineas: string[] } {
  for (const n of niveles) {
    const ls = ajustarLineas(t, charsEn(w, n));
    if (ls.length <= maxLineas && ls.length * hLinea(n) - 2 <= h) return { n, lineas: ls };
  }
  const n = niveles[niveles.length - 1];
  const cabe = Math.max(1, Math.min(maxLineas, Math.floor((h + 2) / hLinea(n))));
  return { n, lineas: ajustarLineas(t, charsEn(w, n), cabe) };
}

/** Dibuja las lineas centradas o a la izquierda desde y; devuelve la y siguiente. */
function lineas(L: Lienzo, y: number, r: { n: Nivel; lineas: string[] }, centrado: boolean, invertido = false): number {
  for (const l of r.lineas) {
    texto(L, centrado ? centrar(L, l, r.n) : L.x0, y, r.n[0], r.n[1], l, invertido);
    y += hLinea(r.n);
  }
  return y;
}

/** Banda negra con texto blanco: la altura sale de la fuente. Devuelve la y donde termina. */
function banda(L: Lienzo, y: number, fuenteIdeal: FuenteTspl, izq: string, derIdeal: string): number {
  // En un sticker angosto la letra baja de nivel hasta que el texto de la derecha ocupa media banda como mucho;
  // si aun asi no cabe, se recorta.
  const orden: FuenteTspl[] = ['5', '4', '3', '2'];
  let fuente: FuenteTspl = fuenteIdeal;
  for (const c of orden.slice(orden.indexOf(fuenteIdeal))) {
    fuente = c;
    if (ancho_(derIdeal, [c, 1]) <= L.w * 0.5) break;
  }
  const h = alto(fuente) + 14;
  const n: Nivel = [fuente, 1];
  const der = truncar(derIdeal, charsEn(Math.floor(L.w * 0.5), n));
  const wDer = ancho_(der, n);
  const t = truncar(izq, Math.max(1, charsEn(L.w - wDer - 16, n)));
  texto(L, L.x0, y + 7, fuente, 1, t, true);
  texto(L, L.x0 + L.w - wDer, y + 7, fuente, 1, der, true);
  // El REVERSE va despues del texto (asi lo invierte la impresora)
  const x = L.b + 3;
  inverso(L, x, y, L.W - 2 * x, h);
  return y + h;
}

/** Pie con linea fina: texto a la izquierda y a la derecha en fuente 2 (o la dada). Devuelve la y donde empieza el pie. */
function pie(L: Lienzo, izq: string, der: string, fuente: FuenteTspl = '2'): number {
  const h = alto(fuente);
  const y = L.H - 10 - L.extra - h - 4;
  const n: Nivel = [fuente, 1];
  const wDer = ancho_(der, n);
  barra(L, L.x0 - 6, y - 6, L.w + 12, 2);
  texto(L, L.x0, y, fuente, 1, truncar(izq, Math.max(1, charsEn(L.w - wDer - 14, n))));
  texto(L, L.x0 + L.w - wDer, y, fuente, 1, der);
  return y - 6;
}

// ---- BEBIDA ----

export function maquetarBebida(d: EtiquetaBebidaDatos, tam: { anchoMm?: number; altoMm?: number; margenMm?: number } = {}): Maqueta {
  const L = lienzo({ anchoMm: tam.anchoMm ?? TAMANO_BEBIDA_DEFECTO.anchoMm, altoMm: tam.altoMm ?? TAMANO_BEBIDA_DEFECTO.altoMm, margenMm: tam.margenMm });
  // Cabecera: codigo del pedido (izq) e indice "1/3" (der)
  let y = banda(L, L.b + 4, '4', d.codigo || 'PED-000', `BEBIDA ${d.bebidaIndex}/${d.totalBebidas}`) + 6;
  // Pie: "Para: cliente" y hora
  const finCuerpo = pie(L, d.who, d.hora) - 4;
  const cuerpo = finCuerpo - y;

  // Persona, lo mas grande posible (hasta 36 % del cuerpo)
  const persona = (d.persona || 'Cliente').trim().toUpperCase().replace(/\s+/g, ' ');
  const rp = encajar(persona, L.w, Math.round(cuerpo * 0.36), [['5', 3], ['5', 2], ['4', 2], ['5', 1], ['4', 1], ['3', 1], ['2', 1]], 2);
  y = lineas(L, y, rp, true) + 2;
  barra(L, L.x0, y, L.w, 2);
  y += 6;

  // Bebida con su tamano (hasta 34 % del cuerpo)
  const nombre = `${(d.bebidaNombre || 'BEBIDA').trim().toUpperCase()}${d.tamano?.trim() ? ` - ${d.tamano.trim().toUpperCase()}` : ''}`.replace(/\s+/g, ' ');
  const rb = encajar(nombre, L.w, Math.round(cuerpo * 0.34), [['5', 2], ['4', 2], ['5', 1], ['4', 1], ['3', 1], ['2', 1]], 3);
  y = lineas(L, y, rb, true) + 2;

  // Opciones y "contiene" con lo que quede (letra 2; si sobra, recorta con ...)
  const opciones = (d.opciones || []).filter(Boolean).join(', ');
  const contiene = d.contiene && d.contiene.trim() && d.contiene.trim() !== opciones ? `CONTIENE: ${d.contiene.trim()}` : '';
  const hMin = hLinea(['2', 1]);
  if (opciones && finCuerpo - y >= alto('2')) {
    const reserva = contiene ? hMin : 0;
    const ro = encajar(opciones, L.w, Math.max(alto('2'), finCuerpo - y - reserva), [['3', 1], ['2', 1]]);
    y = lineas(L, y, ro, false);
  }
  if (contiene && finCuerpo - y >= alto('2')) {
    lineas(L, y, encajar(contiene, L.w, finCuerpo - y, [['2', 1]]), false);
  }
  return { W: L.W, H: L.H, primitivas: L.prim };
}

// ---- GENERAL ----

/** Niveles de la lista de productos, de mas legible a mas apretado: fuente, columnas. */
const NIVELES_LISTA: Array<{ n: Nivel; cols: number }> = [
  { n: ['4', 1], cols: 1 },
  { n: ['3', 1], cols: 1 },
  { n: ['3', 1], cols: 2 },
  { n: ['2', 1], cols: 1 },
  { n: ['2', 1], cols: 2 },
];

function textoProducto(cantidad: number, nombre: string, tamano: string | null | undefined, chars: number): string {
  const pre = `${cantidad} x `;
  const post = tamano ? ` ${tamano}` : '';
  const espacio = chars - pre.length - post.length;
  // Si el tamano no deja espacio razonable al nombre, se corta todo junto
  if (espacio < 6) return truncar(`${pre}${nombre}${post}`, chars);
  return `${pre}${truncar(nombre, espacio)}${post}`;
}

export function maquetarGeneral(d: EtiquetaGeneralDatos, tam: { anchoMm?: number; altoMm?: number; margenMm?: number } = {}): Maqueta {
  const L = lienzo({ anchoMm: tam.anchoMm ?? TAMANO_GENERAL_DEFECTO.anchoMm, altoMm: tam.altoMm ?? TAMANO_GENERAL_DEFECTO.altoMm, margenMm: tam.margenMm });
  // Cabecera: codigo gigante y hora
  let y = banda(L, L.b + 4, '5', d.codigo || 'PED-000', d.hora) + 8;

  // Modalidad en pill negra (izq) y canal - fecha (der)
  const pillTxt = (d.modalidadPill || 'LOCAL').toUpperCase();
  const nPill: Nivel = ['4', 1];
  const pillTxtCortado = truncar(pillTxt, Math.max(4, charsEn(Math.round(L.w * 0.6) - 16, nPill)));
  const wPill = ancho_(pillTxtCortado, nPill) + 16;
  const hPill = alto('4') + 8;
  texto(L, L.x0 + 8, y + 4, '4', 1, pillTxtCortado, true);
  inverso(L, L.x0, y, wPill, hPill);
  const canal = `GENERAL | ${d.canal} - ${d.fecha}`;
  const nCanal: Nivel = ['3', 1];
  const libreCanal = L.w - wPill - 14;
  if (libreCanal >= 8 * ancho('3')) {
    const t = truncar(canal, charsEn(libreCanal, nCanal));
    texto(L, L.x0 + L.w - ancho_(t, nCanal), y + Math.round((hPill - alto('3')) / 2), '3', 1, t);
  }
  y += hPill + 8;

  // Pie: unidades (izq) y total (der)
  const unidades = `${d.cantidadProductos} UNID.`;
  const total = d.total != null ? `S/ ${Number(d.total).toFixed(2)}` : '';
  let finCuerpo = pie(L, unidades, total, '4') - 4;

  // Nota, si hay, justo sobre el pie (hasta 2 lineas)
  if (d.nota && d.nota.trim()) {
    const rn = encajar(`NOTA: ${d.nota.trim()}`, L.w - 12, 2 * hLinea(['2', 1]), [['2', 1]], 2);
    const hBox = rn.lineas.length * hLinea(['2', 1]) + 8;
    const top = finCuerpo - hBox;
    L.prim.push({ t: 'caja', x1: L.x0, y1: top, x2: L.x0 + L.w, y2: finCuerpo, grosor: 2, radio: 4 });
    rn.lineas.forEach((l, i) => texto(L, L.x0 + 6, top + 4 + i * hLinea(['2', 1]), '2', 1, l));
    finCuerpo = top - 6;
  }

  // Cliente (hasta 14 % del alto), lo mas grande que quepa
  const cuerpoTotal = finCuerpo - y;
  const cliente = (d.who || 'Cliente').trim().toUpperCase().replace(/\s+/g, ' ');
  const rc = encajar(cliente, L.w, Math.round(cuerpoTotal * 0.2), [['5', 2], ['5', 1], ['4', 1], ['3', 1], ['2', 1]], 2);
  y = lineas(L, y, rc, true) + 2;

  // Delivery: direccion (hasta 2 lineas) y celular
  // Lo opcional solo se dibuja si queda sitio (en un sticker bajo, como 50 x 30, no se sale del borde)
  const dir = d.direccion?.trim();
  if (dir && finCuerpo - y >= hLinea(['2', 1])) {
    const rd = encajar(`DIR: ${dir}`, L.w, Math.min(2 * hLinea(['3', 1]), finCuerpo - y), [['3', 1], ['2', 1]], 2);
    y = lineas(L, y, rd, false);
  }
  const tel = d.telefono?.trim();
  if (tel && finCuerpo - y >= hLinea(['3', 1])) {
    y = lineas(L, y, encajar(`TEL: ${tel}`, L.w, hLinea(['3', 1]), [['3', 1], ['2', 1]], 1), false);
  }
  barra(L, L.x0, y + 2, L.w, 2);
  y += 8;

  // Lista de productos: el primer nivel (letra mas grande, 1 o 2 columnas) donde caben todos; si ninguno, el mas
  // apretado con "+ N mas productos" en la ultima celda.
  const prods = d.productos || [];
  const alturaLista = finCuerpo - y;
  const GAP_COL = 14;
  const plan = (nv: { n: Nivel; cols: number }) => {
    const filas = Math.max(0, Math.floor((alturaLista + 2) / hLinea(nv.n)));
    return { filas, capacidad: filas * nv.cols, chars: charsEn((L.w - (nv.cols - 1) * GAP_COL) / nv.cols, nv.n) };
  };
  const elegido = NIVELES_LISTA.find((nv) => prods.length <= plan(nv).capacidad) ?? NIVELES_LISTA[NIVELES_LISTA.length - 1];
  const { filas, capacidad, chars } = plan(elegido);
  const celdas: string[] = prods.map((p) => textoProducto(p.cantidad, p.nombre, p.tamano, chars));
  let visibles = celdas;
  if (celdas.length > capacidad) {
    const mostrados = Math.max(0, capacidad - 1);
    const resto = prods.slice(mostrados);
    const unid = resto.reduce((a, p) => a + (Number(p.cantidad) || 1), 0);
    visibles = [...celdas.slice(0, mostrados), truncar(`+ ${resto.length} MAS (${unid} UNID.)`, chars)];
  }
  const anchoCol = (L.w - (elegido.cols - 1) * GAP_COL) / elegido.cols;
  visibles.forEach((t, i) => {
    if (filas === 0) return;
    const col = Math.floor(i / filas);
    const fila = i % filas;
    texto(L, Math.round(L.x0 + col * (anchoCol + GAP_COL)), y + fila * hLinea(elegido.n), elegido.n[0], 1, t);
  });
  return { W: L.W, H: L.H, primitivas: L.prim };
}

/**
 * Maqueta segun el tipo. Bebida y general: `f` es el tamano del sticker (ancho x alto en mm) y el lienzo sale
 * sin girar. Area: `f` es el rollo como lo ve la etiquetera y el lienzo sale vertical (se gira al imprimir).
 */
export function maquetarEtiqueta(
  tipo: TipoEtiqueta,
  datos: EtiquetaGeneralDatos | EtiquetaAreaDatos | EtiquetaBebidaDatos,
  f: FormatoMaqueta = {},
): Maqueta {
  if (tipo === 'ETIQUETA_GENERAL') return maquetarGeneral(datos as EtiquetaGeneralDatos, f);
  if (tipo === 'ETIQUETA_AREA') return maquetarArea(datos as EtiquetaAreaDatos, f);
  return maquetarBebida(datos as EtiquetaBebidaDatos, f);
}
