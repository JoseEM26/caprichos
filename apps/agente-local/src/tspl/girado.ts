import type { EtiquetaGeneralDatos, EtiquetaAreaDatos, EtiquetaBebidaDatos } from '@caprichos/compartido';
import { medirAnchoTexto, truncar, ajustarLineas, FUENTES_TSPL } from './tipografia';
import { limpiarParaTspl } from './codepage1252';
import { generarSeparadorRombos } from './rombos';
import { comandosInicio, comandoLogo, MM_A_DOTS, type FormatoEtiqueta } from './formato';

/**
 * Sticker 'vertical-girado': el rollo sigue apaisado (101.6 x 63.5 mm) pero el contenido se maqueta en
 * retrato (lienzo logico 63.5 x 101.6 mm = 508 x 813 dots, como la vista previa web) y se dibuja girado 90 grados.
 * TODA la maqueta usa coordenadas logicas; `crearPintor` es la unica funcion que las pasa a fisicas.
 *   giro 90 : logico (x,y) -> fisico (H - y, x)   (la cabecera queda en el borde derecho del rollo)
 *   giro 270: logico (x,y) -> fisico (y, W - x)   (la cabecera queda en el borde izquierdo)
 * Referencia de TEXT con rotacion: el punto es la esquina superior izquierda del texto SIN girar.
 */
export interface Pintor {
  /** Lienzo logico en dots. */
  W: number;
  H: number;
  giro: 90 | 270;
  salida: () => string;
  text(x: number, y: number, font: string, xm: number, ym: number, texto: string): void;
  box(x1: number, y1: number, x2: number, y2: number, grosor: number, radio: number): void;
  bar(x: number, y: number, w: number, h: number): void;
  reverse(x: number, y: number, w: number, h: number): void;
  logo(x: number, y: number): void;
  rombos(y: number): void;
}

export function crearPintor(W: number, H: number, giro: 90 | 270): Pintor {
  let s = '';
  // Rectangulo logico -> rectangulo fisico {X, Y, w, h}
  const rect = (x: number, y: number, w: number, h: number) =>
    giro === 90 ? { X: H - (y + h), Y: x, w: h, h: w } : { X: y, Y: W - (x + w), w: h, h: w };
  const p: Pintor = {
    W,
    H,
    giro,
    salida: () => s,
    text(x, y, font, xm, ym, texto) {
      const [X, Y] = giro === 90 ? [H - y, x] : [y, W - x];
      s += `TEXT ${Math.round(X)},${Math.round(Y)},"${font}",${giro},${xm},${ym},"${limpiarParaTspl(texto)}"\r\n`;
    },
    box(x1, y1, x2, y2, grosor, radio) {
      const r = rect(x1, y1, x2 - x1, y2 - y1);
      s += `BOX ${r.X},${r.Y},${r.X + r.w},${r.Y + r.h},${grosor},${radio}\r\n`;
    },
    bar(x, y, w, h) {
      const r = rect(x, y, w, h);
      s += `BAR ${r.X},${r.Y},${r.w},${r.h}\r\n`;
    },
    reverse(x, y, w, h) {
      const r = rect(x, y, w, h);
      s += `REVERSE ${r.X},${r.Y},${r.w},${r.h}\r\n`;
    },
    logo(x, y) {
      const r = rect(x, y, 64, 64);
      s += comandoLogo(r.X, r.Y, giro);
    },
    rombos(y) {
      generarSeparadorRombos(y, W, 38)
        .split('\r\n')
        .forEach((l) => {
          const m = /^BAR (\d+),(\d+),(\d+),(\d+)$/.exec(l);
          if (m) p.bar(+m[1], +m[2], +m[3], +m[4]);
        });
    },
  };
  return p;
}

const X0 = 38; // margen interior izquierdo
const alto = (f: string) => FUENTES_TSPL[f].alto;
const ancho = (f: string) => FUENTES_TSPL[f].ancho;
const PILL_ALTO = 28;

/** Lineas que caben en `w` dots con la fuente dada (corta palabras largas y cierra con "..." si pasa de max). */
const lineas = (texto: string, w: number, font: string, max?: number) =>
  ajustarLineas(texto, Math.max(1, Math.floor(w / ancho(font))), max);

const centrar = (x0: number, w: number, texto: string, font: string, xm = 1) =>
  x0 + Math.max(0, Math.floor((w - medirAnchoTexto(texto, font, xm)) / 2));

interface Contexto {
  P: Pintor;
  w: number; // ancho util
  yFin: number; // limite inferior del cuerpo (sobre el pie)
}

function inicio(f: FormatoEtiqueta, titulo: string, subtitulo: string): { s: string; C: Contexto } {
  // Lienzo logico: ancho fisico del cabezal = alto logico
  const W = Math.round(f.altoMm * MM_A_DOTS);
  const H = Math.round(f.anchoMm * MM_A_DOTS);
  const P = crearPintor(W, H, f.giro);
  const w = W - 2 * X0;
  P.box(16, 16, W - 16, H - 16, 4, 16);
  P.box(26, 26, W - 26, H - 26, 2, 10);
  P.logo(36, 38);
  P.text(112, 44, '4', 1, 1, truncar(titulo.toUpperCase(), Math.floor((W - 112 - X0) / 24)));
  P.text(112, 84, '2', 1, 1, truncar(subtitulo, Math.floor((W - 112 - X0) / 12)));
  P.reverse(28, 28, W - 56, 84); // banda negra con texto y logo en blanco
  return { s: comandosInicio(f), C: { P, w, yFin: H - 74 } };
}

function pill(P: Pintor, x: number, y: number, texto: string): void {
  P.text(x + 8, y + 4, '2', 1, 1, texto);
  P.reverse(x, y, medirAnchoTexto(texto, '2') + 16, PILL_ALTO);
}

const pillDerecha = (C: Contexto, y: number, texto: string) =>
  pill(C.P, X0 + C.w - (medirAnchoTexto(texto, '2') + 16), y, texto);

function pie(C: Contexto, izq: string, der: string): void {
  const { P } = C;
  P.bar(26, P.H - 62, P.W - 52, 2);
  const wDer = medirAnchoTexto(der, '2');
  const libre = C.w - wDer - 12;
  if (izq.length * 12 <= libre) P.text(X0, P.H - 50, '2', 1, 1, izq);
  else P.text(X0, P.H - 46, '1', 1, 1, truncar(izq, Math.floor(libre / 8))); // fuente chica antes de truncar
  P.text(X0 + C.w - wDer, P.H - 50, '2', 1, 1, der);
}

/** Nombre de la persona lo mas grande que quepa entero (hasta 2 lineas); devuelve la y siguiente. */
function nombreGrande(C: Contexto, y: number, nombre: string, grande: boolean): number {
  const n = (nombre || 'Cliente').trim().toUpperCase().replace(/\s+/g, ' ');
  const cand: [string, number][] = grande
    ? [['4', 2], ['5', 1], ['4', 1], ['3', 1]]
    : [['5', 1], ['4', 1], ['3', 1], ['2', 1]];
  let elegido = cand[cand.length - 1];
  let ls = lineas(n, C.w, elegido[0], 2);
  for (const c of cand) {
    const l = lineas(n, C.w / c[1], c[0]);
    if (l.length <= 2 && l.join(' ') === n) {
      elegido = c;
      ls = l;
      break;
    }
  }
  const [font, m] = elegido;
  if (m > 1 && ls.length === 0) ls = [n];
  ls.forEach((l, i) => C.P.text(centrar(X0, C.w, l, font, m), y + i * (alto(font) * m + 6), font, m, m, l));
  return y + ls.length * (alto(font) * m + 6);
}

interface Linea {
  t: string;
  f: string;
  dx: number;
}

/**
 * Coloca bloques de lineas hasta `limite`; si no entran todos, quita los ultimos hasta que quepa
 * "+ N mas" y lo escribe. Devuelve la y final.
 */
function llenar(C: Contexto, bloques: Linea[][], y: number, limite: number): number {
  const GAP = 4;
  const hMas = alto('2') + 2;
  const hBloque = (b: Linea[]) => b.reduce((a, l) => a + alto(l.f) + 2, 0) + GAP;
  let n = 0;
  let acum = 0;
  while (n < bloques.length && y + acum + hBloque(bloques[n]) <= limite) acum += hBloque(bloques[n++]);
  if (n < bloques.length) while (n > 0 && y + acum + hMas > limite) acum -= hBloque(bloques[--n]);
  let yy = y;
  for (const b of bloques.slice(0, n)) {
    for (const l of b) {
      C.P.text(X0 + l.dx, yy, l.f, 1, 1, l.t);
      yy += alto(l.f) + 2;
    }
    yy += GAP;
  }
  if (n < bloques.length && yy + hMas <= limite) {
    C.P.text(X0 + 12, yy, '2', 1, 1, `+ ${bloques.length - n} más`);
    yy += hMas;
  }
  return yy;
}

/** Recuadro pegado al pie del cuerpo; el alto sale del texto y nada se sale del borde. Devuelve su y superior. */
function recuadroAbajo(C: Contexto, texto: string, maxLineas: number, encabezado?: string): number {
  const ls = lineas(texto, C.w - 16, '2', maxLineas);
  const enc = encabezado ? 22 : 0;
  const hBox = 6 + enc + ls.length * 20 + 6;
  const top = C.yFin - hBox;
  C.P.box(X0, top, X0 + C.w, top + hBox, 2, 6);
  let y = top + 6;
  if (encabezado) C.P.text(X0 + 8, y, '2', 1, 1, encabezado);
  y += enc;
  ls.forEach((l, i) => C.P.text(X0 + 8, y + i * 20, '2', 1, 1, l));
  return top;
}

const topeSobreRecuadro = (C: Contexto, top: number | null) => (top === null ? C.yFin : top - 8);

function cerrar(s: string, C: Contexto, copias: number): string {
  return s + C.P.salida() + `PRINT 1,${copias}\r\n`;
}

export function generarGeneralG(d: EtiquetaGeneralDatos, copias: number, f: FormatoEtiqueta): string {
  const { s, C } = inicio(f, 'CAPRICHOS', 'Pedido completo');
  const { P } = C;
  let y = 124;
  P.text(centrar(X0, C.w, 'PEDIDO', '2'), y, '2', 1, 1, 'PEDIDO');
  const codigo = d.codigo || 'PED-000';
  const xm = codigo.length * 48 <= C.w ? 2 : 1;
  P.text(centrar(X0, C.w, codigo, '4', xm), y + 26, '4', xm, xm, codigo);
  y += 26 + 32 * xm + 12;
  P.rombos(y);
  y += 16;
  const pillTxt = (d.modalidadPill || 'SALON').toUpperCase();
  pillDerecha(C, y, pillTxt);
  P.text(X0, y + 4, '2', 1, 1, truncar(`${d.canal} - ${d.hora}`, Math.floor((C.w - medirAnchoTexto(pillTxt, '2') - 28) / 12)));
  y += PILL_ALTO + 14;
  y = nombreGrande(C, y, d.who, false) + 4;
  P.rombos(y);
  y += 14;
  const cant = `${d.cantidadProductos} PRODUCTO${d.cantidadProductos === 1 ? '' : 'S'}`;
  P.text(centrar(X0, C.w, cant, '3'), y, '3', 1, 1, cant);
  y += 34;

  const top = d.nota ? recuadroAbajo(C, `NOTA: ${d.nota}`, 3) : null;
  const bloques = (d.productos || []).map((p) =>
    lineas(`• ${p.cantidad} x ${p.nombre}${p.tamano ? ` ${p.tamano}` : ''}`, C.w, '2', 2).map((t, i) => ({ t, f: '2', dx: i ? 12 : 0 }))
  );
  llenar(C, bloques, y, topeSobreRecuadro(C, top));
  pie(C, `Sale en: ${d.printer}`, d.fecha);
  return cerrar(s, C, copias);
}

export function generarAreaG(d: EtiquetaAreaDatos, copias: number, f: FormatoEtiqueta): string {
  const { s, C } = inicio(f, d.areaNombre || 'COCINA', `Area ${d.areaIndex || 1} de ${d.totalAreas || 1}`);
  const { P } = C;
  let y = 124;
  const pillTxt = (d.modalidadPill || 'SALON').toUpperCase();
  pillDerecha(C, y, pillTxt);
  P.text(X0, y - 2, '4', 1, 1, truncar(d.codigo || 'PED-000', Math.floor((C.w - medirAnchoTexto(pillTxt, '2') - 28) / 24)));
  y += PILL_ALTO + 14;
  P.rombos(y);
  y += 14;
  y = nombreGrande(C, y, d.who, false) + 2;
  const ch = truncar(`${d.canal} - ${d.hora}`, Math.floor(C.w / 12));
  P.text(centrar(X0, C.w, ch, '2'), y, '2', 1, 1, ch);
  y += 30;
  P.rombos(y);
  y += 14;

  const top = d.nota ? recuadroAbajo(C, `NOTA: ${d.nota}`, 3) : null;
  const bloques = (d.lineas || []).map((l) => {
    const b: Linea[] = lineas(`${l.cantidad} x ${l.nombre}`, C.w, '3', 2).map((t, i) => ({ t, f: '3', dx: i ? 16 : 0 }));
    const opts = d.esCompacta
      ? [[l.tamano, ...(l.opciones || [])].filter(Boolean).join(', ')].filter(Boolean)
      : ([l.tamano, ...(l.opciones || []).map((o) => `• ${o}`)].filter(Boolean) as string[]);
    for (const o of opts) lineas(o, C.w - 8, '2', 2).forEach((t) => b.push({ t, f: '2', dx: 8 }));
    return b;
  });
  llenar(C, bloques, y, topeSobreRecuadro(C, top));
  pie(C, `Sale en: ${d.printer}`, d.fecha);
  return cerrar(s, C, copias);
}

export function generarBebidaG(d: EtiquetaBebidaDatos, copias: number, f: FormatoEtiqueta): string {
  const { s, C } = inicio(f, 'CAPRICHOS', 'Cafeteria artesanal');
  const { P } = C;
  let y = 124;
  P.text(X0, y + 4, '2', 1, 1, `BEBIDA ${d.bebidaIndex} de ${d.totalBebidas}`);
  pillDerecha(C, y, truncar(d.codigo || 'PED-000', 14));
  y += PILL_ALTO + 12;
  y = nombreGrande(C, y, d.persona, true) + 4;
  P.rombos(y);
  y += 16;

  // Bebida: fuente 4 si entra entera en 2 lineas, si no fuente 3 hasta 3 lineas
  const nb = (d.bebidaNombre || 'BEBIDA').trim().toUpperCase().replace(/\s+/g, ' ');
  const l4 = lineas(nb, C.w, '4');
  const [fb, lb] = l4.length <= 2 && l4.join(' ') === nb ? ['4', l4] : ['3', lineas(nb, C.w, '3', 3)];
  lb.forEach((l, i) => P.text(centrar(X0, C.w, l, fb), y + i * (alto(fb) + 6), fb, 1, 1, l));
  y += lb.length * (alto(fb) + 6);
  if (d.tamano?.trim()) {
    const t = truncar(d.tamano.trim(), Math.floor((C.w - 16) / 12));
    pill(P, centrar(X0, C.w, t, '2') - 8, y + 2, t);
    y += PILL_ALTO + 10;
  }
  y += 4;

  const top = d.contiene ? recuadroAbajo(C, d.contiene, 5, 'CONTIENE:') : null;
  const bloques = (d.opciones || []).map((o) =>
    lineas(`• ${o}`, C.w - 8, '2', 2).map((t, i) => ({ t, f: '2', dx: i ? 20 : 8 }))
  );
  llenar(C, bloques, y, topeSobreRecuadro(C, top));
  pie(C, d.who, d.hora);
  return cerrar(s, C, copias);
}
