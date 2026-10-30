import type { EtiquetaAreaDatos, EtiquetaBebidaDatos, EtiquetaGeneralDatos, TipoEtiqueta } from '../tipos/etiquetas.js';

/**
 * Maqueta unica de los stickers (fuente de verdad del agente de impresion y de la vista previa del panel).
 * Todo en coordenadas LOGICAS: lienzo vertical (63.5 x 101.6 mm = 508 x 813 dots a 203 dpi), origen arriba a la izquierda.
 * El agente transforma estas primitivas a TSPL (giro 90/270); la web las dibuja en SVG.
 */
export type FuenteTspl = '1' | '2' | '3' | '4' | '5';

export const FUENTES_TSPL: Record<string, { ancho: number; alto: number }> = {
  '1': { ancho: 8, alto: 12 },
  '2': { ancho: 12, alto: 20 },
  '3': { ancho: 16, alto: 24 },
  '4': { ancho: 24, alto: 32 },
  '5': { ancho: 32, alto: 48 },
};

export type Primitiva =
  /** (x, y) = esquina superior izquierda de la celda del primer caracter; cada caracter ocupa ancho*xm. */
  | { t: 'texto'; x: number; y: number; fuente: FuenteTspl; xm: number; ym: number; texto: string; invertido?: boolean }
  | { t: 'caja'; x1: number; y1: number; x2: number; y2: number; grosor: number; radio: number }
  | { t: 'barra'; x: number; y: number; w: number; h: number }
  /** Invierte el rectangulo (REVERSE): negro con lo que haya dentro en blanco. */
  | { t: 'inverso'; x: number; y: number; w: number; h: number }
  | { t: 'logo'; x: number; y: number; lado: number; invertido?: boolean };

export interface Maqueta {
  W: number;
  H: number;
  primitivas: Primitiva[];
}

export interface FormatoMaqueta {
  anchoMm?: number;
  altoMm?: number;
}

export const MM_A_DOTS = 8;
export const MEDIDAS_ROLLO_MM = { largo: 101.6, corto: 63.5 };

// ---- Tipografia ----

export function medirAnchoTexto(texto: string, font: string = '2', xm: number = 1): number {
  const metricas = FUENTES_TSPL[font] || FUENTES_TSPL['2'];
  return texto.length * metricas.ancho * xm;
}

/** Trunca a un maximo de caracteres anadiendo '...' al final si excede. */
export function truncar(texto: string, maxCaracteres: number): string {
  if (!texto) return '';
  if (texto.length <= maxCaracteres) return texto;
  if (maxCaracteres <= 3) return texto.slice(0, maxCaracteres);
  return texto.slice(0, maxCaracteres - 3) + '...';
}

/** Divide en lineas respetando palabras, con corte de desborde y maximo de lineas opcional (cierra con '...'). */
export function ajustarLineas(texto: string, maxCharsPorLinea: number, maxLineas?: number): string[] {
  if (!texto) return [];
  const palabras = texto.trim().split(/\s+/);
  const lineas: string[] = [];
  let lineaActual = '';

  for (const palabra of palabras) {
    if (!lineaActual) {
      if (palabra.length > maxCharsPorLinea) {
        lineas.push(palabra.slice(0, maxCharsPorLinea));
        lineaActual = palabra.slice(maxCharsPorLinea);
      } else {
        lineaActual = palabra;
      }
    } else if (lineaActual.length + 1 + palabra.length <= maxCharsPorLinea) {
      lineaActual += ' ' + palabra;
    } else {
      lineas.push(lineaActual);
      if (palabra.length > maxCharsPorLinea) {
        lineas.push(palabra.slice(0, maxCharsPorLinea));
        lineaActual = palabra.slice(maxCharsPorLinea);
      } else {
        lineaActual = palabra;
      }
    }
  }
  if (lineaActual) lineas.push(lineaActual);

  if (maxLineas !== undefined && lineas.length > maxLineas) {
    const recortadas = lineas.slice(0, maxLineas);
    const ultima = recortadas[maxLineas - 1];
    if (ultima.length + 3 <= maxCharsPorLinea) {
      recortadas[maxLineas - 1] = ultima + '...';
    } else {
      const espacioDisponible = Math.max(3, maxCharsPorLinea - 3);
      recortadas[maxLineas - 1] = ultima.slice(0, espacioDisponible) + '...';
    }
    return recortadas;
  }
  return lineas;
}

// ---- Rombos (separador): lineas a los lados y 3 rombos al centro, todo como barras ----

function barrasRombos(y: number, anchoTotal: number, margenX: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const cx = Math.floor(anchoTotal / 2);
  out.push({ x: margenX, y, w: cx - 48 - margenX, h: 2 });
  out.push({ x: cx + 48, y, w: anchoTotal - margenX - (cx + 48), h: 2 });
  const radio = 5;
  for (const centro of [cx - 24, cx, cx + 24]) {
    for (let dy = -radio; dy <= radio; dy++) {
      const semi = radio - Math.abs(dy);
      out.push({ x: centro - semi, y: y + dy, w: semi * 2 + 1, h: 1 });
    }
  }
  return out;
}

// ---- Maqueta ----

const X0 = 38; // margen interior izquierdo
const alto = (f: string) => FUENTES_TSPL[f].alto;
const ancho = (f: string) => FUENTES_TSPL[f].ancho;
const PILL_ALTO = 28;
const LOGO_LADO_DOTS = 64;

const lineas = (texto: string, w: number, font: string, max?: number) =>
  ajustarLineas(texto, Math.max(1, Math.floor(w / ancho(font))), max);

const centrar = (x0: number, w: number, texto: string, font: string, xm = 1) =>
  x0 + Math.max(0, Math.floor((w - medirAnchoTexto(texto, font, xm)) / 2));

interface Contexto {
  W: number;
  H: number;
  prim: Primitiva[];
  w: number; // ancho util
  yFin: number; // limite inferior del cuerpo (sobre el pie)
}

function texto(C: Contexto, x: number, y: number, fuente: string, m: number, t: string, invertido = false) {
  const p: Primitiva = { t: 'texto', x, y, fuente: fuente as FuenteTspl, xm: m, ym: m, texto: t };
  if (invertido) p.invertido = true;
  C.prim.push(p);
}
const caja = (C: Contexto, x1: number, y1: number, x2: number, y2: number, grosor: number, radio: number) =>
  C.prim.push({ t: 'caja', x1, y1, x2, y2, grosor, radio });
const barra = (C: Contexto, x: number, y: number, w: number, h: number) => C.prim.push({ t: 'barra', x, y, w, h });
const inverso = (C: Contexto, x: number, y: number, w: number, h: number) => C.prim.push({ t: 'inverso', x, y, w, h });
const rombos = (C: Contexto, y: number) => barrasRombos(y, C.W, 38).forEach((b) => barra(C, b.x, b.y, b.w, b.h));

function inicio(f: FormatoMaqueta, titulo: string, subtitulo: string): Contexto {
  const W = Math.round((f.altoMm ?? MEDIDAS_ROLLO_MM.corto) * MM_A_DOTS);
  const H = Math.round((f.anchoMm ?? MEDIDAS_ROLLO_MM.largo) * MM_A_DOTS);
  const C: Contexto = { W, H, prim: [], w: W - 2 * X0, yFin: H - 74 };
  caja(C, 16, 16, W - 16, H - 16, 4, 16);
  caja(C, 26, 26, W - 26, H - 26, 2, 10);
  C.prim.push({ t: 'logo', x: 36, y: 38, lado: LOGO_LADO_DOTS, invertido: true });
  texto(C, 112, 44, '4', 1, truncar(titulo.toUpperCase(), Math.floor((W - 112 - X0) / 24)), true);
  texto(C, 112, 84, '2', 1, truncar(subtitulo, Math.floor((W - 112 - X0) / 12)), true);
  inverso(C, 28, 28, W - 56, 84); // banda negra con texto y logo en blanco
  return C;
}

function pill(C: Contexto, x: number, y: number, t: string): void {
  texto(C, x + 8, y + 4, '2', 1, t, true);
  inverso(C, x, y, medirAnchoTexto(t, '2') + 16, PILL_ALTO);
}

const pillDerecha = (C: Contexto, y: number, t: string) => pill(C, X0 + C.w - (medirAnchoTexto(t, '2') + 16), y, t);

function pie(C: Contexto, izq: string, der: string): void {
  barra(C, 26, C.H - 62, C.W - 52, 2);
  const wDer = medirAnchoTexto(der, '2');
  const libre = C.w - wDer - 12;
  if (izq.length * 12 <= libre) texto(C, X0, C.H - 50, '2', 1, izq);
  else texto(C, X0, C.H - 46, '1', 1, truncar(izq, Math.floor(libre / 8))); // fuente chica antes de truncar
  texto(C, X0 + C.w - wDer, C.H - 50, '2', 1, der);
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
  ls.forEach((l, i) => texto(C, centrar(X0, C.w, l, font, m), y + i * (alto(font) * m + 6), font, m, l));
  return y + ls.length * (alto(font) * m + 6);
}

interface Linea {
  t: string;
  f: string;
  dx: number;
}

/** Coloca bloques de lineas hasta `limite`; si no entran todos, quita los ultimos hasta que quepa "+ N mas". */
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
      texto(C, X0 + l.dx, yy, l.f, 1, l.t);
      yy += alto(l.f) + 2;
    }
    yy += GAP;
  }
  if (n < bloques.length && yy + hMas <= limite) {
    texto(C, X0 + 12, yy, '2', 1, `+ ${bloques.length - n} más`);
    yy += hMas;
  }
  return yy;
}

/** Recuadro pegado al pie del cuerpo; el alto sale del texto y nada se sale del borde. Devuelve su y superior. */
function recuadroAbajo(C: Contexto, t: string, maxLineas: number, encabezado?: string): number {
  const ls = lineas(t, C.w - 16, '2', maxLineas);
  const enc = encabezado ? 22 : 0;
  const hBox = 6 + enc + ls.length * 20 + 6;
  const top = C.yFin - hBox;
  caja(C, X0, top, X0 + C.w, top + hBox, 2, 6);
  let y = top + 6;
  if (encabezado) texto(C, X0 + 8, y, '2', 1, encabezado);
  y += enc;
  ls.forEach((l, i) => texto(C, X0 + 8, y + i * 20, '2', 1, l));
  return top;
}

const topeSobreRecuadro = (C: Contexto, top: number | null) => (top === null ? C.yFin : top - 8);

const salida = (C: Contexto): Maqueta => ({ W: C.W, H: C.H, primitivas: C.prim });

export function maquetarGeneral(d: EtiquetaGeneralDatos, f: FormatoMaqueta = {}): Maqueta {
  const C = inicio(f, 'CAPRICHOS', 'Pedido completo');
  let y = 124;
  texto(C, centrar(X0, C.w, 'PEDIDO', '2'), y, '2', 1, 'PEDIDO');
  const codigo = d.codigo || 'PED-000';
  const xm = codigo.length * 48 <= C.w ? 2 : 1;
  texto(C, centrar(X0, C.w, codigo, '4', xm), y + 26, '4', xm, codigo);
  y += 26 + 32 * xm + 12;
  rombos(C, y);
  y += 16;
  const pillTxt = (d.modalidadPill || 'SALON').toUpperCase();
  pillDerecha(C, y, pillTxt);
  texto(C, X0, y + 4, '2', 1, truncar(`${d.canal} - ${d.hora}`, Math.floor((C.w - medirAnchoTexto(pillTxt, '2') - 28) / 12)));
  y += PILL_ALTO + 14;
  y = nombreGrande(C, y, d.who, false) + 4;
  rombos(C, y);
  y += 14;
  const cant = `${d.cantidadProductos} PRODUCTO${d.cantidadProductos === 1 ? '' : 'S'}`;
  texto(C, centrar(X0, C.w, cant, '3'), y, '3', 1, cant);
  y += 34;

  const top = d.nota ? recuadroAbajo(C, `NOTA: ${d.nota}`, 3) : null;
  const bloques = (d.productos || []).map((p) =>
    lineas(`• ${p.cantidad} x ${p.nombre}${p.tamano ? ` ${p.tamano}` : ''}`, C.w, '2', 2).map((t, i) => ({ t, f: '2', dx: i ? 12 : 0 }))
  );
  llenar(C, bloques, y, topeSobreRecuadro(C, top));
  pie(C, `Sale en: ${d.printer}`, d.fecha);
  return salida(C);
}

export function maquetarArea(d: EtiquetaAreaDatos, f: FormatoMaqueta = {}): Maqueta {
  const C = inicio(f, d.areaNombre || 'COCINA', `Area ${d.areaIndex || 1} de ${d.totalAreas || 1}`);
  let y = 124;
  const pillTxt = (d.modalidadPill || 'SALON').toUpperCase();
  pillDerecha(C, y, pillTxt);
  texto(C, X0, y - 2, '4', 1, truncar(d.codigo || 'PED-000', Math.floor((C.w - medirAnchoTexto(pillTxt, '2') - 28) / 24)));
  y += PILL_ALTO + 14;
  rombos(C, y);
  y += 14;
  y = nombreGrande(C, y, d.who, false) + 2;
  const ch = truncar(`${d.canal} - ${d.hora}`, Math.floor(C.w / 12));
  texto(C, centrar(X0, C.w, ch, '2'), y, '2', 1, ch);
  y += 30;
  rombos(C, y);
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
  return salida(C);
}

export function maquetarBebida(d: EtiquetaBebidaDatos, f: FormatoMaqueta = {}): Maqueta {
  const C = inicio(f, 'CAPRICHOS', 'Cafeteria artesanal');
  let y = 124;
  texto(C, X0, y + 4, '2', 1, `BEBIDA ${d.bebidaIndex} de ${d.totalBebidas}`);
  pillDerecha(C, y, truncar(d.codigo || 'PED-000', 14));
  y += PILL_ALTO + 12;
  y = nombreGrande(C, y, d.persona, true) + 4;
  rombos(C, y);
  y += 16;

  // Bebida: fuente 4 si entra entera en 2 lineas, si no fuente 3 hasta 3 lineas
  const nb = (d.bebidaNombre || 'BEBIDA').trim().toUpperCase().replace(/\s+/g, ' ');
  const l4 = lineas(nb, C.w, '4');
  const [fb, lb] = l4.length <= 2 && l4.join(' ') === nb ? ['4', l4] : ['3', lineas(nb, C.w, '3', 3)];
  lb.forEach((l, i) => texto(C, centrar(X0, C.w, l, fb), y + i * (alto(fb) + 6), fb, 1, l));
  y += lb.length * (alto(fb) + 6);
  if (d.tamano?.trim()) {
    const t = truncar(d.tamano.trim(), Math.floor((C.w - 16) / 12));
    pill(C, centrar(X0, C.w, t, '2') - 8, y + 2, t);
    y += PILL_ALTO + 10;
  }
  y += 4;

  const top = d.contiene ? recuadroAbajo(C, d.contiene, 5, 'CONTIENE:') : null;
  const bloques = (d.opciones || []).map((o) =>
    lineas(`• ${o}`, C.w - 8, '2', 2).map((t, i) => ({ t, f: '2', dx: i ? 20 : 8 }))
  );
  llenar(C, bloques, y, topeSobreRecuadro(C, top));
  pie(C, d.who, d.hora);
  return salida(C);
}

export function maquetarEtiqueta(
  tipo: TipoEtiqueta,
  datos: EtiquetaGeneralDatos | EtiquetaAreaDatos | EtiquetaBebidaDatos,
  f: FormatoMaqueta = {}
): Maqueta {
  if (tipo === 'ETIQUETA_GENERAL') return maquetarGeneral(datos as EtiquetaGeneralDatos, f);
  if (tipo === 'ETIQUETA_AREA') return maquetarArea(datos as EtiquetaAreaDatos, f);
  return maquetarBebida(datos as EtiquetaBebidaDatos, f);
}
