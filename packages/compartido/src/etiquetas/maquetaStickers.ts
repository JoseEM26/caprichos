import type { EtiquetaAreaDatos, EtiquetaBebidaDatos, EtiquetaGeneralDatos, PagoEtiqueta, TipoEtiqueta } from '../tipos/etiquetas.js';
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

/** Marca de la tienda en la banda superior. Con espacio suficiente (sticker de 60 mm o mas por lado) lleva tambien el logo. */
const MARCA = 'CAPRICHOS';
const LOGO_DOTS = 64;
const conLogo = (L: Lienzo) => Math.min(L.W, L.H) >= 480;

/**
 * Banda negra superior con texto blanco: a la izquierda la marca (logo + CAPRICHOS) y a la derecha `derIdeal`.
 * La altura sale de la fuente (o del logo). Devuelve la y donde termina.
 */
function banda(L: Lienzo, y: number, fuenteIdeal: FuenteTspl, derIdeal: string): number {
  // En un sticker angosto la letra baja de nivel hasta que el texto de la derecha ocupa media banda como mucho;
  // si aun asi no cabe, se recorta.
  const orden: FuenteTspl[] = ['5', '4', '3', '2'];
  let fuente: FuenteTspl = fuenteIdeal;
  for (const c of orden.slice(orden.indexOf(fuenteIdeal))) {
    fuente = c;
    if (ancho_(derIdeal, [c, 1]) <= L.w * 0.5) break;
  }
  const logo = conLogo(L);
  const h = Math.max(alto(fuente) + 14, logo ? LOGO_DOTS + 8 : 0);
  const n: Nivel = [fuente, 1];
  const der = truncar(derIdeal, charsEn(Math.floor(L.w * 0.5), n));
  const wDer = ancho_(der, n);
  const xIzq = L.x0 + (logo ? LOGO_DOTS + 10 : 0);
  const ty = y + Math.round((h - alto(fuente)) / 2);
  if (logo) L.prim.push({ t: 'logo', x: L.x0, y: y + Math.round((h - LOGO_DOTS) / 2), lado: LOGO_DOTS, invertido: true });
  texto(L, xIzq, ty, fuente, 1, truncar(MARCA, Math.max(1, charsEn(L.x0 + L.w - xIzq - wDer - 16, n))), true);
  texto(L, L.x0 + L.w - wDer, ty, fuente, 1, der, true);
  // El REVERSE va despues del texto (asi lo invierte la impresora)
  const x = L.b + 3;
  inverso(L, x, y, L.W - 2 * x, h);
  return y + h;
}

/**
 * Parte los datos (tamano, opciones, sabores...) en lineas corridas separadas por " · ". Si no caben en
 * `maxLineas`, la ultima cierra con "+N mas" con los que quedaron fuera.
 */
export function lineasDeDatos(items: string[], chars: number, maxLineas: number): string[] {
  const SEP = ' · ';
  const lineas: string[] = [];
  const cuantos: number[] = [];
  let cur = '';
  let k = 0;
  for (const raw of items) {
    const it = truncar(raw, chars);
    if (cur && cur.length + SEP.length + it.length <= chars) {
      cur += SEP + it;
      k++;
    } else {
      if (cur) { lineas.push(cur); cuantos.push(k); }
      cur = it;
      k = 1;
    }
  }
  if (cur) { lineas.push(cur); cuantos.push(k); }
  if (lineas.length <= maxLineas) return lineas;
  const salida = lineas.slice(0, maxLineas);
  let ultimo = salida[maxLineas - 1].split(SEP);
  let fuera = cuantos.slice(maxLineas).reduce((a, b) => a + b, 0);
  const cola = (n: number) => ` +${n} más`;
  while (ultimo.length > 1 && (ultimo.join(SEP) + cola(fuera)).length > chars) {
    ultimo.pop();
    fuera++;
  }
  if (ultimo.length === 1) ultimo = [truncar(ultimo[0], Math.max(1, chars - cola(fuera).length))];
  salida[maxLineas - 1] = ultimo.join(SEP) + cola(fuera);
  return salida;
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

/** Niveles del nombre del cliente (protagonista): de mas grande a mas chico. */
const NIVELES_NOMBRE: Nivel[] = [['5', 3], ['5', 2], ['4', 2], ['5', 1], ['4', 1], ['3', 1], ['2', 1]];
const alturaNivel = ([f, m]: Nivel) => alto(f) * m;

const nombreCliente = (t: string | null | undefined) => (t || '').trim().toUpperCase().replace(/\s+/g, ' ') || 'CLIENTE';

export function maquetarBebida(d: EtiquetaBebidaDatos, tam: { anchoMm?: number; altoMm?: number; margenMm?: number } = {}): Maqueta {
  const L = lienzo({ anchoMm: tam.anchoMm ?? TAMANO_BEBIDA_DEFECTO.anchoMm, altoMm: tam.altoMm ?? TAMANO_BEBIDA_DEFECTO.altoMm, margenMm: tam.margenMm });
  // Cabecera: marca (logo + CAPRICHOS) e indice "BEBIDA 1/3" (der)
  let y = banda(L, L.b + 4, L.H >= 560 ? '4' : '3', `BEBIDA ${d.bebidaIndex}/${d.totalBebidas}`) + 6;
  // Pie: codigo del pedido y cliente (izq), hora (der)
  const finCuerpo = pie(L, [d.codigo, d.who].filter(Boolean).join(' '), d.hora) - 4;
  const cuerpo = finCuerpo - y;

  // Cliente: el protagonista, lo mas grande posible (hasta 52 % del cuerpo)
  const rp = encajar(nombreCliente(d.persona), L.w, Math.round(cuerpo * 0.52), NIVELES_NOMBRE, 2);
  y = lineas(L, y, rp, true) + 2;
  barra(L, L.x0, y, L.w, 2);
  y += 6;

  // Producto: una linea, nunca mas grande que el nombre
  const tope = alturaNivel(rp.n);
  const nivProd = ([['3', 1], ['2', 1]] as Nivel[]).filter((n) => alturaNivel(n) < tope);
  const producto = (d.bebidaNombre || 'BEBIDA').trim().toUpperCase().replace(/\s+/g, ' ');
  const rb = encajar(producto, L.w, Math.round(cuerpo * 0.2), nivProd.length ? nivProd : [['2', 1]], 1);
  y = lineas(L, y, rb, true) + 2;

  // Tamano, opciones y "contiene": lineas corridas con " · " (max 2, con "+N mas"), letra pequena
  const opciones = (d.opciones || []).filter(Boolean);
  const contiene = d.contiene && d.contiene.trim() && d.contiene.trim() !== opciones.join(', ') ? `CONTIENE: ${d.contiene.trim()}` : '';
  const datos = [d.tamano?.trim() ? d.tamano.trim().toUpperCase() : '', ...opciones, contiene].filter(Boolean);
  const libre = finCuerpo - y;
  if (datos.length && libre >= alto('2')) {
    const n: Nivel = libre >= 2 * hLinea(['3', 1]) && alturaNivel(['3', 1]) < tope ? ['3', 1] : ['2', 1];
    const max = Math.max(1, Math.min(2, Math.floor((libre + 2) / hLinea(n))));
    lineas(L, y, { n, lineas: lineasDeDatos(datos, charsEn(L.w, n), max) }, true);
  }
  return { W: L.W, H: L.H, primitivas: L.prim };
}

// ---- GENERAL ----

/** Niveles de la lista de productos, de mas legible a mas apretado: fuente, columnas. */
const NIVELES_LISTA: Array<{ n: Nivel; cols: number }> = [
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

// ---- BLOQUE DE PAGO (sticker de despacho) ----

const solesS = (n: number) => `S/ ${Number(n).toFixed(2)}`;
const NOMBRE_MEDIO: Record<string, string> = { CREDITO_PERSONAL: 'CRÉDITO DEL PERSONAL' };
const medioTxt = (m: string) => NOMBRE_MEDIO[m] ?? m.replace(/_/g, ' ').toUpperCase();

/** Textos del pago, ya decididos (los mismos nombres que la pantalla de Despacho). */
function textosPago(pg: PagoEtiqueta) {
  const personal = pg.esPersonal;
  const base = personal ? ['CONSUMO DEL PERSONAL · a su crédito', 'CONSUMO PERSONAL', 'PERSONAL'] : pg.estado === 'PAGADO' ? ['YA PAGADO'] : pg.estado === 'COBRADO_MOZO' ? ['YA PAGADO · cobró el mozo', 'YA PAGADO'] : pg.cobrarAlEntregar != null ? [`COBRAR AL ENTREGAR: ${solesS(pg.cobrarAlEntregar)}`, `COBRAR ${solesS(pg.cobrarAlEntregar)}`] : ['POR COBRAR'];
  // Version mas corta: lleva el total pegado (solo si el banner no lo trae ya)
  const corto = pg.cobrarAlEntregar != null && !personal ? [base[base.length - 1]] : [`${base[base.length - 1]} ${solesS(pg.total)}`];
  const medios = personal ? [{ medio: 'CREDITO_PERSONAL', monto: pg.total }] : pg.medios;
  let vuelto = '';
  if (!personal && pg.efectivo > 0) {
    vuelto = pg.recibido == null ? 'Paga con: no indicó cuánto' : pg.llevaVuelto ? `Paga con ${solesS(pg.recibido)} · Vuelto ${solesS(pg.vuelto ?? 0)}` : 'Sin vuelto (paga exacto)';
  }
  const extras = [pg.descuento > 0 ? `Desc. -${solesS(pg.descuento)}` : '', pg.propina > 0 ? `Propina ${solesS(pg.propina)}` : ''].filter(Boolean).join(' · ');
  return { base, corto, medios, vuelto, extras };
}

/** Banner invertido: el primer texto (el mas completo) y su fuente (4 y luego 3) que cabe en `w`; si ninguno, el ultimo recortado. */
function elegirBanner(cands: string[], w: number): { t: string; f: FuenteTspl } {
  for (const t of cands) for (const f of ['4', '3'] as FuenteTspl[]) if (ancho_(t, [f, 1]) <= w) return { t, f };
  return { t: truncar(cands[cands.length - 1], charsEn(w, ['3', 1])), f: '3' };
}

const GAP = 4;
/**
 * Dibuja el recuadro PAGO con su borde inferior en `fin`; devuelve la y donde empieza el recuadro (0 si no cabe ni el
 * nivel minimo). Niveles de mas a menos detalle: completo (titulo, medios, vuelto, total) -> sin titulo y con los medios
 * en una linea -> solo el banner con el total. Se elige el primero que cabe en `maxAlto`.
 */
function bloquePago(L: Lienzo, pg: PagoEtiqueta, fin: number, maxAlto: number): number {
  const T = textosPago(pg);
  const wIn = L.w - 12;
  const x = L.x0 + 6;
  const hTxt = (f: string) => alto(f) + 2;
  type Fila = { alto: number; dibujar: (y: number) => void };
  const banner = (cands: string[]): Fila => {
    const b = elegirBanner(cands, wIn - 12);
    const h = alto(b.f) + 10;
    return {
      alto: h,
      dibujar: (y) => {
        texto(L, x + Math.floor((wIn - ancho_(b.t, [b.f, 1])) / 2), y + 5, b.f, 1, b.t, true);
        inverso(L, x, y, wIn, h);
      },
    };
  };
  const par = (izq: string, der: string, f: FuenteTspl, fDer: FuenteTspl = f): Fila => ({
    alto: hTxt(fDer),
    dibujar: (y) => {
      const wD = ancho_(der, [fDer, 1]);
      texto(L, x, y + alto(fDer) - alto(f), f, 1, truncar(izq, Math.max(1, charsEn(wIn - wD - 12, [f, 1]))));
      texto(L, x + wIn - wD, y, fDer, 1, der);
    },
  });
  const linea = (t: string, f: FuenteTspl = '3'): Fila => ({ alto: hTxt(f), dibujar: (y) => texto(L, x, y, f, 1, truncar(t, charsEn(wIn, [f, 1]))) });
  const total = (): Fila => ({
    alto: hTxt('4') + 4,
    dibujar: (y) => {
      barra(L, x, y, wIn, 2);
      const m = solesS(pg.total);
      texto(L, x, y + 6 + alto('4') - alto('3'), '3', 1, 'TOTAL');
      texto(L, x + wIn - ancho_(m, ['4', 1]), y + 6, '4', 1, m);
    },
  });
  const titulo = (): Fila => ({
    alto: hTxt('3'),
    dibujar: (y) => {
      texto(L, x, y, '3', 1, 'PAGO');
      if (T.extras) {
        const e = truncar(T.extras, charsEn(wIn - 5 * ancho('3') - 16, ['2', 1]));
        texto(L, x + wIn - ancho_(e, ['2', 1]), y + 2, '2', 1, e);
      }
    },
  });
  const unMedio = T.medios.map((m) => medioTxt(m.medio)).join(' + ') + (T.medios.length > 1 ? '' : '');
  const niveles: Fila[][] = [
    [titulo(), banner(T.base), ...T.medios.map((m) => par(medioTxt(m.medio), solesS(m.monto), '3')), ...(T.vuelto ? [linea(T.vuelto)] : []), total()],
    [banner(T.base), ...(T.medios.length ? [linea(T.medios.length > 1 ? T.medios.map((m) => `${medioTxt(m.medio)} ${m.monto.toFixed(2)}`).join(' + ') : `${unMedio} ${solesS(T.medios[0].monto)}`)] : []), ...(T.vuelto ? [linea(T.vuelto, '2')] : []), total()],
    ...(T.vuelto ? [[banner(T.corto), linea(T.vuelto, '2')]] : []),
    [banner(T.corto)],
  ];
  const altoDe = (fs: Fila[]) => fs.reduce((a, r) => a + r.alto, 0) + GAP * (fs.length - 1) + 8;
  const elegido = niveles.find((fs) => altoDe(fs) <= maxAlto) ?? niveles[niveles.length - 1];
  const h = altoDe(elegido);
  if (h > fin - L.b) return 0;
  const top = fin - h;
  L.prim.push({ t: 'caja', x1: L.x0, y1: top, x2: L.x0 + L.w, y2: fin, grosor: 2, radio: 4 });
  let y = top + 4;
  for (const r of elegido) {
    r.dibujar(y);
    y += r.alto + GAP;
  }
  return top;
}

export function maquetarGeneral(d: EtiquetaGeneralDatos, tam: { anchoMm?: number; altoMm?: number; margenMm?: number } = {}): Maqueta {
  const L = lienzo({ anchoMm: tam.anchoMm ?? TAMANO_GENERAL_DEFECTO.anchoMm, altoMm: tam.altoMm ?? TAMANO_GENERAL_DEFECTO.altoMm, margenMm: tam.margenMm });
  // Cabecera: marca (logo + CAPRICHOS) y codigo del pedido
  let y = banda(L, L.b + 4, L.H >= 560 ? '4' : '3', d.codigo || 'PED-000') + 8;

  // Pie: unidades (izq) y total (der)
  const unidades = `${d.cantidadProductos} UNID.`;
  // Con bloque de pago el total ya sale ahi (en grande): el pie no lo repite
  const total = d.total != null && !d.pago ? `S/ ${Number(d.total).toFixed(2)}` : '';
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

  // Recuadro PAGO (prioridad sobre la lista de productos): hasta 55 % del cuerpo; el nombre y el pago nunca se recortan antes
  if (d.pago) {
    const top = bloquePago(L, d.pago, finCuerpo, Math.floor((finCuerpo - y) * 0.55));
    if (top > 0) finCuerpo = top - 6;
  }

  // Cliente: el protagonista (hasta 34 % del cuerpo), lo mas grande que quepa en 2 lineas
  const cuerpoTotal = finCuerpo - y;
  const rc = encajar(nombreCliente(d.who), L.w, Math.round(cuerpoTotal * 0.34), NIVELES_NOMBRE, 2);
  y = lineas(L, y, rc, true) + 4;

  // Modalidad (MESA 4, LLEVAR...) en pill negra, segundo protagonista; canal, fecha y hora a la derecha
  const pillTxt = (d.modalidadPill || 'LOCAL').toUpperCase();
  const nPill: Nivel = [L.H >= 700 ? '5' : L.H >= 400 ? '4' : '3', 1];
  const pillTxtCortado = truncar(pillTxt, Math.max(4, charsEn(Math.round(L.w * 0.6) - 16, nPill)));
  const wPill = ancho_(pillTxtCortado, nPill) + 16;
  const hPill = alto(nPill[0]) + 8;
  texto(L, L.x0 + 8, y + 4, nPill[0], 1, pillTxtCortado, true);
  inverso(L, L.x0, y, wPill, hPill);
  const canal = `${d.canal} - ${d.fecha} ${d.hora}`;
  const nCanal: Nivel = ['3', 1];
  const libreCanal = L.w - wPill - 14;
  if (libreCanal >= 8 * ancho('3')) {
    const t = truncar(canal, charsEn(libreCanal, nCanal));
    texto(L, L.x0 + L.w - ancho_(t, nCanal), y + Math.round((hPill - alto('3')) / 2), '3', 1, t);
  }
  y += hPill + 8;

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
  const plus = d.plus?.trim();
  if (plus && finCuerpo - y >= hLinea(['3', 1])) {
    y = lineas(L, y, encajar(`PLUS: ${plus}`, L.w, hLinea(['3', 1]), [['3', 1], ['2', 1]], 1), false);
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
