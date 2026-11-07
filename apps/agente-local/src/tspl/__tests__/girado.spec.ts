import { describe, it, expect } from 'vitest';
import { generarTsplTrabajo } from '../generadorTspl';
import { resolverFormato, formatoDesdeConfig } from '../formato';
import { FUENTES_TSPL } from '../tipografia';
import { LOGO_BASE64_90, LOGO_BASE64_270 } from '../logoBitmap';
import { muestraEtiquetaArea } from '../../datosMuestra';

const largo = 'ADMINISTRACION INTERNACIONAL DE EMPRESAS';
const areaLarga = {
  ...muestraEtiquetaArea,
  who: 'CLIENTE CON UN NOMBRE EXTREMADAMENTE LARGO QUE EXCEDE TODO',
  esCompacta: false,
  nota: largo + ' ' + largo,
  lineas: Array.from({ length: 6 }, (_, i) => ({ cantidad: 2, nombre: `Sandwich especial numero ${i} ${largo}`, tamano: 'Grande', opciones: ['Sin cebolla ni tomate', 'Con extra queso fundido', 'Salsa aparte'] })),
};
const casos = [
  ['ETIQUETA_AREA', muestraEtiquetaArea],
  ['ETIQUETA_AREA', areaLarga],
] as const;

type R = { X0: number; X1: number; Y0: number; Y1: number };
function cajas(t: string) {
  const textos: (R & { s: string })[] = [];
  const boxes: R[] = [];
  for (const m of t.matchAll(/^TEXT (\d+),(\d+),"(\d)",(\d+),(\d+),(\d+),"(.*)"$/gm)) {
    const [x, y, rot] = [+m[1], +m[2], +m[4]];
    const f = FUENTES_TSPL[m[3]];
    const w = m[7].length * f.ancho * +m[5];
    const h = f.alto * +m[6];
    textos.push(
      rot === 90 ? { X0: x - h, X1: x, Y0: y, Y1: y + w, s: m[7] }
        : rot === 270 ? { X0: x, X1: x + h, Y0: y - w, Y1: y, s: m[7] }
        : { X0: x, X1: x + w, Y0: y, Y1: y + h, s: m[7] }
    );
  }
  for (const m of t.matchAll(/^BOX (\d+),(\d+),(\d+),(\d+),/gm)) boxes.push({ X0: +m[1], Y0: +m[2], X1: +m[3], Y1: +m[4] });
  return { textos, boxes: boxes.slice(2) }; // los 2 primeros son el marco
}

describe('vertical-girado (etiqueta de area)', () => {
  it('es el defecto: SIZE fisico 101.6 x 63.5, giro 90 y logo rotado', () => {
    expect(resolverFormato()).toMatchObject({ orientacion: 'vertical-girado', anchoMm: 101.6, altoMm: 63.5, giro: 90 });
    expect(formatoDesdeConfig({})).toMatchObject({ orientacion: 'vertical-girado', giro: 90 });
    const t = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea);
    expect(t).toContain('SIZE 101.6 mm,63.5 mm\r\n');
    expect(t).toMatch(/TEXT \d+,\d+,"\d",90,/);
    expect(t).toContain(Buffer.from(LOGO_BASE64_90, 'base64').toString('latin1'));
  });

  it('el giro es configurable (ETIQUETA_GIRO / formato)', () => {
    expect(formatoDesdeConfig({ ETIQUETA_GIRO: '270' }).giro).toBe(270);
    expect(formatoDesdeConfig({}, { giro: 270 }).giro).toBe(270);
    const t = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, { giro: 270 });
    expect(t).toMatch(/TEXT \d+,\d+,"\d",270,/);
    expect(t).not.toMatch(/",90,/);
    expect(t).toContain(Buffer.from(LOGO_BASE64_270, 'base64').toString('latin1'));
  });

  it('la cabecera queda en el borde derecho con 90 y en el izquierdo con 270', () => {
    const x = (g: 90 | 270) => +/^REVERSE (\d+),/m.exec(generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, { giro: g }))![1];
    expect(x(90)).toBeGreaterThan(600);
    expect(x(270)).toBeLessThan(100);
  });

  for (const giro of [90, 270] as const)
    for (const [tipo, datos] of casos)
      it(`giro ${giro} ${tipo}: todo texto cae dentro del lienzo y de su recuadro`, () => {
        const t = generarTsplTrabajo(tipo, datos, false, { giro });
        const { textos, boxes } = cajas(t);
        expect(textos.length).toBeGreaterThan(5);
        for (const s of textos) {
          expect(s.X0, s.s).toBeGreaterThanOrEqual(26);
          expect(s.X1, s.s).toBeLessThanOrEqual(813 - 26);
          expect(s.Y0, s.s).toBeGreaterThanOrEqual(26);
          expect(s.Y1, s.s).toBeLessThanOrEqual(508 - 26);
          for (const b of boxes)
            if (s.X0 >= b.X0 && s.X0 <= b.X1 && s.Y0 >= b.Y0 && s.Y0 <= b.Y1) {
              expect(s.X1, s.s).toBeLessThanOrEqual(b.X1);
              expect(s.Y1, s.s).toBeLessThanOrEqual(b.Y1);
            }
        }
      });
});
