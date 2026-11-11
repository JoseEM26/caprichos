import { unzipSync, strFromU8 } from 'fflate';
import { generarPlantilla, HOJAS, LISTAS, MARCA_EJEMPLO, ORDEN_HOJAS } from '../plantilla-almacen';

const libro = unzipSync(generarPlantilla());
const xml = (n: string) => strFromU8(libro[n]);
const hoja = (i: number) => xml(`xl/worksheets/sheet${i + 1}.xml`);
const textos = (x: string) => [...x.matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((m) => m[1]);
const fila = (x: string, r: number) => textos(x.match(new RegExp(`<row r="${r}"[^>]*>.*?</row>`))?.[0] ?? '');

describe('Plantilla de Excel de almacén', () => {
  it('trae las hojas esperadas en orden y LEEME primero', () => {
    const nombres = [...xml('xl/workbook.xml').matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    expect(nombres).toEqual([
      'LEEME', 'PROVEEDORES', 'INSUMOS', 'EQUIVALENCIAS', 'STOCK_INICIAL', 'RECETAS', 'PRODUCCION_TANDA', 'PRODUCTOS_CARTA', 'LISTAS',
    ]);
    expect(nombres).toEqual(ORDEN_HOJAS);
  });

  it('LEEME explica colores, pasos y glosario', () => {
    const t = textos(hoja(0)).join(' ');
    for (const w of ['CELESTE', 'GRIS', 'AMARILLA', '5 PASOS', 'Merma', 'Tanda', 'Rendimiento', 'Insumo', 'Receta']) expect(t).toContain(w);
  });

  it('cada hoja de datos tiene los encabezados exactos en la fila 2 y ayuda en la 3', () => {
    HOJAS.forEach((h, k) => {
      const x = hoja(k + 1);
      expect(fila(x, 2)).toEqual(['¿Ejemplo?', ...h.columnas.map((c) => c.h)]);
      expect(x).toContain('<pane');
      expect(x).toContain('state="frozen"');
      expect(x).toContain('orientation="landscape"');
      expect(x).not.toMatch(/password|hashValue/i); // protección suave, sin contraseña
    });
  });

  it('las columnas con lista tienen su desplegable y las numéricas validan >= 0', () => {
    HOJAS.forEach((h, k) => {
      const x = hoja(k + 1);
      const conLista = h.columnas.filter((c) => c.lista).length;
      expect((x.match(/type="list"/g) ?? []).length).toBe(conLista);
      const nums = h.columnas.filter((c) => c.tipo === 'num' || c.tipo === 'entero').length;
      expect((x.match(/operator="greaterThanOrEqual"/g) ?? []).length).toBe(nums);
    });
    expect(HOJAS.flatMap((h) => h.columnas).filter((c) => c.lista).length).toBeGreaterThan(10);
    const listas = textos(hoja(8));
    for (const k of Object.keys(LISTAS)) for (const v of LISTAS[k].valores) expect(listas).toContain(v);
    expect(hoja(2)).toContain('PROVEEDORES!$B$4'); // proveedor habitual sale de la hoja de proveedores
    expect(hoja(5)).toContain('INSUMOS!$C$4');
  });

  it('las filas de ejemplo están marcadas y no hay datos reales', () => {
    HOJAS.forEach((h, k) => {
      const x = hoja(k + 1);
      expect(h.ejemplos.length).toBeGreaterThan(0);
      h.ejemplos.forEach((_, i) => expect(fila(x, 4 + i)[0]).toBe(MARCA_EJEMPLO));
      expect(fila(x, 4 + h.ejemplos.length)).toEqual([]); // y nada más: sin productos ni datos reales
    });
    const todo = Object.keys(libro).map(xml).join('\n');
    expect(todo).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i); // correos
    expect(todo).not.toMatch(/\b9\d{8}\b/); // celulares peruanos
    expect(todo).not.toMatch(/\b(10|20)\d{9}\b/); // RUC reales (los de ejemplo son 00000000000)
  });

  it('se puede releer y es reproducible', () => {
    expect(Object.keys(libro)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml']));
    expect(Buffer.from(generarPlantilla()).equals(Buffer.from(generarPlantilla()))).toBe(true);
  });
});
