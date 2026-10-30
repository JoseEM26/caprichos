import { maquetarEtiqueta } from '@caprichos/compartido';
import type { EtiquetaGeneralDatos, EtiquetaAreaDatos, EtiquetaBebidaDatos, Primitiva } from '@caprichos/compartido';
import { limpiarParaTspl } from './codepage1252';
import { comandosInicio, comandoLogo, type FormatoEtiqueta } from './formato';

/**
 * Sticker 'vertical-girado': el rollo sigue apaisado (101.6 x 63.5 mm) pero el contenido se maqueta en
 * retrato (lienzo logico 63.5 x 101.6 mm = 508 x 813 dots, como la vista previa web) y se dibuja girado 90 grados.
 * La maqueta (primitivas en coordenadas logicas) vive en @caprichos/compartido; aqui solo se pasa a TSPL.
 *   giro 90 : logico (x,y) -> fisico (H - y, x)   (la cabecera queda en el borde derecho del rollo)
 *   giro 270: logico (x,y) -> fisico (y, W - x)   (la cabecera queda en el borde izquierdo)
 * Referencia de TEXT con rotacion: el punto es la esquina superior izquierda del texto SIN girar.
 */
export function primitivasATspl(prim: Primitiva[], W: number, H: number, giro: 90 | 270): string {
  // Rectangulo logico -> rectangulo fisico {X, Y, w, h}
  const rect = (x: number, y: number, w: number, h: number) =>
    giro === 90 ? { X: H - (y + h), Y: x, w: h, h: w } : { X: y, Y: W - (x + w), w: h, h: w };
  let s = '';
  for (const p of prim) {
    if (p.t === 'texto') {
      const [X, Y] = giro === 90 ? [H - p.y, p.x] : [p.y, W - p.x];
      s += `TEXT ${Math.round(X)},${Math.round(Y)},"${p.fuente}",${giro},${p.xm},${p.ym},"${limpiarParaTspl(p.texto)}"\r\n`;
    } else if (p.t === 'caja') {
      const r = rect(p.x1, p.y1, p.x2 - p.x1, p.y2 - p.y1);
      s += `BOX ${r.X},${r.Y},${r.X + r.w},${r.Y + r.h},${p.grosor},${p.radio}\r\n`;
    } else if (p.t === 'barra') {
      const r = rect(p.x, p.y, p.w, p.h);
      s += `BAR ${r.X},${r.Y},${r.w},${r.h}\r\n`;
    } else if (p.t === 'inverso') {
      const r = rect(p.x, p.y, p.w, p.h);
      s += `REVERSE ${r.X},${r.Y},${r.w},${r.h}\r\n`;
    } else {
      const r = rect(p.x, p.y, p.lado, p.lado);
      s += comandoLogo(r.X, r.Y, giro);
    }
  }
  return s;
}

function generar(
  tipo: 'ETIQUETA_GENERAL' | 'ETIQUETA_AREA' | 'ETIQUETA_BEBIDA',
  d: EtiquetaGeneralDatos | EtiquetaAreaDatos | EtiquetaBebidaDatos,
  copias: number,
  f: FormatoEtiqueta
): string {
  const m = maquetarEtiqueta(tipo, d, { anchoMm: f.anchoMm, altoMm: f.altoMm });
  return comandosInicio(f) + primitivasATspl(m.primitivas, m.W, m.H, f.giro) + `PRINT 1,${copias}\r\n`;
}

export const generarGeneralG = (d: EtiquetaGeneralDatos, copias: number, f: FormatoEtiqueta) => generar('ETIQUETA_GENERAL', d, copias, f);
export const generarAreaG = (d: EtiquetaAreaDatos, copias: number, f: FormatoEtiqueta) => generar('ETIQUETA_AREA', d, copias, f);
export const generarBebidaG = (d: EtiquetaBebidaDatos, copias: number, f: FormatoEtiqueta) => generar('ETIQUETA_BEBIDA', d, copias, f);
