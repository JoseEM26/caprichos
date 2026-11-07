import type { EtiquetaAreaDatos } from '@caprichos/compartido';
import { medirAnchoTexto, truncar, ajustarLineas, generarComandoTexto as T, FUENTES_TSPL } from './tipografia';
import { generarSeparadorRombos } from './rombos';
import { comandosInicio, comandoLogo, MM_A_DOTS, type FormatoEtiqueta } from './formato';

/**
 * Sticker apaisado (101.6 x 63.5 mm = 812 x 508 dots). Misma identidad que el vertical (marco doble,
 * cabecera negra con logo, rombos, pills, pie) repartida en dos columnas: datos a la izquierda y
 * productos / opciones a la derecha. Todo se calcula con el ancho y alto del formato.
 */
interface Lienzo {
  W: number;
  H: number;
  /** Columna izquierda [xi, xi + wi] y derecha [xd, xd + wd]. */
  xi: number;
  wi: number;
  xd: number;
  wd: number;
  /** y donde empieza el cuerpo y y donde termina (sobre el pie). */
  yCuerpo: number;
  yFin: number;
}

function lienzo(f: FormatoEtiqueta): Lienzo {
  const W = Math.round(f.anchoMm * MM_A_DOTS);
  const H = Math.round(f.altoMm * MM_A_DOTS);
  const m = 38;
  const wi = Math.round((W - 2 * m) * 0.47);
  return { W, H, xi: m, wi, xd: m + wi + 26, wd: W - 2 * m - wi - 26, yCuerpo: 116, yFin: H - 66 };
}

const centrar = (x0: number, w: number, texto: string, font: string, xm = 1) =>
  x0 + Math.max(0, Math.floor((w - medirAnchoTexto(texto, font, xm)) / 2));

function marcoYCabecera(L: Lienzo, titulo: string, subtitulo: string): string {
  return (
    `BOX 16,16,${L.W - 16},${L.H - 16},4,16\r\n` +
    `BOX 26,26,${L.W - 26},${L.H - 26},2,10\r\n` +
    comandoLogo(34, 34) +
    T(112, 40, '4', 1, 1, truncar(titulo.toUpperCase(), 24)) +
    T(112, 76, '2', 1, 1, truncar(subtitulo, 40)) +
    // Invierte la banda: fondo negro, texto blanco y logo como disco blanco
    `REVERSE 28,28,${L.W - 56},76\r\n`
  );
}

function pill(x: number, y: number, texto: string): string {
  const tw = medirAnchoTexto(texto, '2', 1);
  return (
    T(x + 8, y + 4, '2', 1, 1, texto) +
    `REVERSE ${Math.round(x)},${Math.round(y)},${tw + 16},${FUENTES_TSPL['2'].alto + 8}\r\n`
  );
}

const pillDerecha = (x0: number, w: number, y: number, texto: string) =>
  pill(x0 + w - (medirAnchoTexto(texto, '2', 1) + 16), y, texto);

function pie(L: Lienzo, izq: string, der: string): string {
  const fuenteIzq = izq.length > 38 ? '1' : '2';
  const textoIzq = truncar(izq, fuenteIzq === '1' ? 56 : 38);
  const xDer = L.W - 38 - medirAnchoTexto(der, '2', 1);
  return (
    `BAR 26,${L.H - 62},${L.W - 52},2\r\n` +
    T(38, fuenteIzq === '1' ? L.H - 48 : L.H - 52, fuenteIzq, 1, 1, textoIzq) +
    T(xDer, L.H - 52, '2', 1, 1, der)
  );
}

const rombos = (y: number, a: number, b: number) => generarSeparadorRombos(y, a + b, a);

function nombreEnColumna(x0: number, w: number, y: number, nombre: string): string {
  const n = (nombre || 'Cliente').trim().toUpperCase();
  const [font, max] = n.length * 24 <= w ? ['4', 99] : n.length * 16 <= w ? ['3', 99] : ['2', Math.floor(w / 12)];
  const t = truncar(n, Number(max));
  return T(centrar(x0, w, t, font), y, font, 1, 1, t);
}

function recuadro(x: number, y: number, w: number, lineas: string[], encabezado?: string): string {
  const paso = 20;
  const alto = lineas.length * paso + 12 + (encabezado ? 20 : 0);
  let s = `BOX ${x},${y},${x + w},${y + alto},2,6\r\n`;
  let yy = y + 6;
  if (encabezado) {
    s += T(x + 8, yy, '2', 1, 1, encabezado);
    yy += 20;
  }
  lineas.forEach((l, i) => (s += T(x + 8, yy + i * paso, '2', 1, 1, l)));
  return s;
}

const divisor = (L: Lienzo, y0: number) => `BAR ${L.xd - 14},${y0},2,${L.yFin - y0}\r\n`;

export function generarAreaH(d: EtiquetaAreaDatos, copias: number, f: FormatoEtiqueta): string {
  const L = lienzo(f);
  let s = comandosInicio(f) + marcoYCabecera(L, d.areaNombre || 'COCINA', `Area ${d.areaIndex || 1} de ${d.totalAreas || 1}`);
  s += T(L.xi, L.yCuerpo + 4, '4', 1, 1, d.codigo || 'PED-000');
  s += pillDerecha(L.xi, L.wi, L.yCuerpo + 6, (d.modalidadPill || 'SALON').toUpperCase());
  s += rombos(L.yCuerpo + 58, L.xi, L.xi + L.wi);
  s += nombreEnColumna(L.xi, L.wi, L.yCuerpo + 80, d.who);
  const ch = `${d.canal} - ${d.hora}`;
  s += T(centrar(L.xi, L.wi, ch, '2'), L.yCuerpo + 122, '2', 1, 1, ch);
  s += rombos(L.yCuerpo + 158, L.xi, L.xi + L.wi);
  if (d.nota) {
    s += recuadro(L.xi, L.yCuerpo + 178, L.wi, ajustarLineas(`NOTA: ${d.nota}`, Math.floor((L.wi - 16) / 12), 3));
  }

  s += divisor(L, L.yCuerpo);
  let y = L.yCuerpo;
  const dentro = (alto: number) => y + alto <= L.yFin;
  for (const l of d.lineas || []) {
    for (const ln of ajustarLineas(`${l.cantidad} x ${l.nombre}`, Math.floor(L.wd / 16), 2)) {
      if (dentro(24)) s += T(L.xd, y, '3', 1, 1, ln);
      y += 24;
    }
    const opts = d.esCompacta
      ? [[l.tamano, ...(l.opciones || [])].filter(Boolean).join(', ')].filter(Boolean)
      : [l.tamano, ...(l.opciones || []).map((o) => `• ${o}`)].filter(Boolean) as string[];
    for (const o of opts) {
      for (const lo of ajustarLineas(o, Math.floor((L.wd - 8) / 12), 2)) {
        if (dentro(20)) s += T(L.xd + 6, y, '2', 1, 1, lo);
        y += 20;
      }
    }
    y += 6;
  }
  return s + pie(L, `Sale en: ${d.printer}`, d.fecha) + `PRINT 1,${copias}\r\n`;
}
