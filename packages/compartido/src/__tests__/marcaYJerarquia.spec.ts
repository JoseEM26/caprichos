import { describe, it, expect } from 'vitest';
import { FUENTES_TSPL, lineasDeDatos, maquetarArea, maquetarBebida, maquetarEtiqueta, maquetarGeneral } from '../index.js';
import type { EtiquetaAreaDatos, EtiquetaBebidaDatos, EtiquetaGeneralDatos, Maqueta, Primitiva } from '../index.js';

const bebida = (e: Partial<EtiquetaBebidaDatos> = {}): EtiquetaBebidaDatos => ({
  bebidaIndex: 2, totalBebidas: 5, codigo: 'CP-101', persona: 'Maria', bebidaNombre: 'Cappuccino', tamano: '12oz',
  opciones: ['Leche de avena', 'Sin azucar'], contiene: null, who: 'Para: Juan', hora: '15:30', ...e,
});
const general = (e: Partial<EtiquetaGeneralDatos> = {}): EtiquetaGeneralDatos => ({
  codigo: 'CP-101', modalidad: 'SALON', modalidadPill: 'MESA 4', who: 'Juan Perez', canal: 'Caja', hora: '15:30', fecha: '08/11/2026',
  cantidadProductos: 2, productos: [{ cantidad: 1, nombre: 'Americano', tamano: '8oz' }], printer: 'Caja', ...e,
});
const area = (e: Partial<EtiquetaAreaDatos> = {}): EtiquetaAreaDatos => ({
  areaNombre: 'COCINA', areaIndex: 1, totalAreas: 2, codigo: 'CP-101', modalidadPill: 'MESA 4', who: 'Juan Perez', canal: 'Caja',
  hora: '15:30', fecha: '08/11/2026', lineas: [{ cantidad: 1, nombre: 'Croissant', opciones: [] }], esCompacta: true, printer: 'Cocina', ...e,
});

type Texto = Extract<Primitiva, { t: 'texto' }>;
const textos = (m: Maqueta): Texto[] => m.primitivas.filter((p): p is Texto => p.t === 'texto');
const altoTexto = (p: Texto) => FUENTES_TSPL[p.fuente].alto * p.ym;
const buscar = (m: Maqueta, f: (t: string) => boolean) => textos(m).find((p) => f(p.texto))!;
const hayMarca = (m: Maqueta) => textos(m).some((p) => p.texto === 'CAPRICHOS');
const logos = (m: Maqueta) => m.primitivas.filter((p) => p.t === 'logo').length;
/** Lo mas grande que se imprime sobre fondo blanco (la banda negra de la marca queda fuera). */
const maxCuerpo = (m: Maqueta) => Math.max(...textos(m).filter((p) => !p.invertido).map(altoTexto));

describe('marca en los 3 stickers', () => {
  it('bebida, general y area dicen CAPRICHOS (tambien en tamanos chicos)', () => {
    expect(hayMarca(maquetarBebida(bebida()))).toBe(true);
    expect(hayMarca(maquetarBebida(bebida(), { anchoMm: 50, altoMm: 30 }))).toBe(true);
    expect(hayMarca(maquetarGeneral(general()))).toBe(true);
    expect(hayMarca(maquetarGeneral(general(), { anchoMm: 76, altoMm: 38 }))).toBe(true);
    expect(hayMarca(maquetarArea(area()))).toBe(true);
  });

  it('con espacio lleva tambien el logo (100 x 100, area, y el vaso de 76 x 38 y 60 x 40); en 50 x 30 solo la palabra', () => {
    expect(logos(maquetarGeneral(general()))).toBe(1);
    expect(logos(maquetarBebida(bebida(), { anchoMm: 100, altoMm: 100 }))).toBe(1);
    expect(logos(maquetarArea(area()))).toBe(1);
    expect(logos(maquetarBebida(bebida()))).toBe(1);
    expect(logos(maquetarBebida(bebida(), { anchoMm: 60, altoMm: 40 }))).toBe(1);
    expect(logos(maquetarBebida(bebida(), { anchoMm: 50, altoMm: 30 }))).toBe(0);
  });

  it('vaso: logo y CAPRICHOS enteros en la banda, sin solapar nada, con nombre corto y largo', () => {
    for (const t of [{ anchoMm: 76, altoMm: 38 }, { anchoMm: 60, altoMm: 40 }, { anchoMm: 100, altoMm: 100 }, { anchoMm: 50, altoMm: 30 }]) {
      for (const persona of ['Maria', 'Alejandro Rafael Ramos Nardini']) {
        const m = maquetarBebida(bebida({ persona }), t);
        const marca = textos(m).find((p) => p.texto === 'CAPRICHOS')!;
        expect(marca, `${t.anchoMm}x${t.altoMm}`).toBeDefined();
        const caja = (p: Texto) => ({ x1: p.x, y1: p.y, x2: p.x + p.texto.length * FUENTES_TSPL[p.fuente].ancho * p.xm, y2: p.y + altoTexto(p) });
        const logo = m.primitivas.find((p) => p.t === 'logo') as Extract<Primitiva, { t: 'logo' }> | undefined;
        if (logo) {
          const l = { x1: logo.x, y1: logo.y, x2: logo.x + logo.lado, y2: logo.y + logo.lado };
          expect(marca.x).toBeGreaterThanOrEqual(l.x2);
          for (const p of textos(m)) {
            const c = caja(p);
            expect(c.x1 >= l.x2 || c.x2 <= l.x1 || c.y1 >= l.y2 || c.y2 <= l.y1, `logo vs "${p.texto}"`).toBe(true);
          }
          expect(l.y2).toBeLessThanOrEqual(m.H);
        }
        // ningun texto se sale del sticker ni se pisa con el nombre del cliente
        const nombre = textos(m).filter((p) => !p.invertido && persona.toUpperCase().includes(p.texto) && p.texto.length > 3);
        for (const p of textos(m)) {
          const c = caja(p);
          expect(c.x2).toBeLessThanOrEqual(m.W);
          expect(c.y2).toBeLessThanOrEqual(m.H);
        }
        for (const n of nombre) expect(caja(n).y1).toBeGreaterThanOrEqual(caja(marca).y2);
      }
    }
  });
});

describe('el cliente es el protagonista', () => {
  it('bebida: el nombre es lo mas grande y el producto mas chico (76 x 38 y 100 x 100)', () => {
    for (const t of [{ anchoMm: 76, altoMm: 38 }, { anchoMm: 100, altoMm: 100 }]) {
      const m = maquetarBebida(bebida(), t);
      const nombre = buscar(m, (x) => x === 'MARIA');
      expect(altoTexto(nombre)).toBeGreaterThan(altoTexto(buscar(m, (x) => x === 'CAPPUCCINO')));
      expect(altoTexto(nombre)).toBe(maxCuerpo(m));
    }
  });

  it('general: el nombre es lo mas grande; area: igual en el cuerpo', () => {
    const g = maquetarGeneral(general({ who: 'Juan' }));
    expect(altoTexto(buscar(g, (x) => x === 'JUAN'))).toBe(maxCuerpo(g));
    expect(altoTexto(buscar(g, (x) => x === 'JUAN'))).toBeGreaterThan(altoTexto(buscar(g, (x) => x.includes('Americano'))));
    const a = maquetarArea(area({ who: 'Juan' }));
    expect(altoTexto(buscar(a, (x) => x === 'JUAN'))).toBe(maxCuerpo(a));
    expect(altoTexto(buscar(a, (x) => x === 'JUAN'))).toBeGreaterThan(altoTexto(buscar(a, (x) => x.includes('Croissant'))));
  });
});

describe('casos borde', () => {
  const largo = 'MARIA ELENA GUADALUPE DEL CARMEN DE LOS SANTOS PEREZ';

  it('nombre largo: a lo mas 2 lineas, sin cortar (bebida 76 x 38, general y area)', () => {
    for (const m of [maquetarBebida(bebida({ persona: largo })), maquetarGeneral(general({ who: largo })), maquetarArea(area({ who: largo }))]) {
      const ls = textos(m).filter((p) => !p.invertido && largo.includes(p.texto) && p.texto.length > 6);
      expect(ls.length).toBeLessThanOrEqual(2);
      expect(ls.map((p) => p.texto).join(' ')).toBe(largo);
    }
  });

  it('el nombre largo baja de tamano frente al corto', () => {
    const corto = altoTexto(buscar(maquetarBebida(bebida()), (x) => x === 'MARIA'));
    const lg = textos(maquetarBebida(bebida({ persona: largo }))).find((p) => largo.includes(p.texto) && p.texto.length > 6)!;
    expect(altoTexto(lg)).toBeLessThan(corto);
  });

  it('sin nombre dice CLIENTE', () => {
    expect(hayTexto(maquetarBebida(bebida({ persona: '  ' })), 'CLIENTE')).toBe(true);
    expect(hayTexto(maquetarGeneral(general({ who: '' })), 'CLIENTE')).toBe(true);
    expect(hayTexto(maquetarArea(area({ who: '' })), 'CLIENTE')).toBe(true);
  });

  it('producto con nombre enorme se recorta con ... en una sola linea', () => {
    const m = maquetarBebida(bebida({ bebidaNombre: 'FRAPPE CARAMELO SALADO CON CREMA BATIDA Y GALLETA TRITURADA DE LA CASA' }));
    const prod = textos(m).filter((p) => p.texto.startsWith('FRAPPE'));
    expect(prod).toHaveLength(1);
    expect(prod[0].texto.endsWith('...')).toBe(true);
  });

  it('muchas opciones: maximo 2 lineas y la ultima cierra con +N mas', () => {
    const m = maquetarBebida(bebida({ opciones: Array.from({ length: 12 }, (_, i) => `Extra ${i}`) }));
    const ls = textos(m).filter((p) => p.texto.includes('Extra') || p.texto.includes('12OZ'));
    expect(ls.length).toBeLessThanOrEqual(2);
    expect(ls[ls.length - 1].texto).toMatch(/\+\d+ más$/);
    expect(lineasDeDatos(['a', 'b'], 20, 2)).toEqual(['a · b']);
    expect(lineasDeDatos(['aaaaaaaa', 'bbbbbbbb', 'cccccccc'], 16, 2)).toEqual(['aaaaaaaa', 'bbbbbbbb +1 más']);
  });

  it('escala por mm: el lienzo mide W x H del sticker y el nombre crece con el tamano', () => {
    const a = maquetarBebida(bebida(), { anchoMm: 76, altoMm: 38 });
    const b = maquetarBebida(bebida(), { anchoMm: 100, altoMm: 100 });
    expect([a.W, a.H, b.W, b.H]).toEqual([608, 304, 800, 800]);
    const nom = (m: Maqueta) => altoTexto(buscar(m, (x) => x === 'MARIA'));
    expect(nom(b)).toBeGreaterThanOrEqual(nom(a));
  });

  it('maquetarEtiqueta (la entrada que usan la vista previa web y el agente) da lo mismo que cada maqueta', () => {
    expect(maquetarEtiqueta('ETIQUETA_BEBIDA', bebida())).toEqual(maquetarBebida(bebida()));
    expect(maquetarEtiqueta('ETIQUETA_GENERAL', general())).toEqual(maquetarGeneral(general()));
    expect(maquetarEtiqueta('ETIQUETA_AREA', area())).toEqual(maquetarArea(area()));
  });
});

const hayTexto = (m: Maqueta, t: string) => textos(m).some((p) => p.texto === t);
