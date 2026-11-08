import { describe, it, expect } from 'vitest';
import { FUENTES_TSPL, PAGOS_EJEMPLO, calcularPagoPedido, maquetarGeneral } from '../index.js';
import type { EtiquetaGeneralDatos, Maqueta, Primitiva } from '../index.js';

describe('calcularPagoPedido', () => {
  it('digital pagado: un medio, sin vuelto, no cobra', () => {
    expect(PAGOS_EJEMPLO.digital).toMatchObject({ estado: 'PAGADO', medios: [{ medio: 'YAPE', monto: 38.5 }], efectivo: 0, llevaVuelto: false, cobrarAlEntregar: null, esPersonal: false });
  });
  it('efectivo por cobrar con vuelto y propina', () => {
    expect(PAGOS_EJEMPLO.efectivoVuelto).toMatchObject({ estado: 'POR_COBRAR', efectivo: 38.5, recibido: 50, vuelto: 11.5, llevaVuelto: true, propina: 2, cobrarAlEntregar: null });
  });
  it('paga exacto: sin vuelto', () => {
    expect(calcularPagoPedido({ total: 20, pago_metodo: 'EFECTIVO', paga_con: 20 })).toMatchObject({ vuelto: 0, llevaVuelto: false });
  });
  it('efectivo sin decir con cuanto: vuelto desconocido', () => {
    expect(calcularPagoPedido({ total: 20, pago_metodo: 'EFECTIVO' })).toMatchObject({ vuelto: null, llevaVuelto: null });
  });
  it('dividido: un medio por linea en orden, vuelto solo sobre el efectivo, con descuento', () => {
    const p = PAGOS_EJEMPLO.dividido;
    expect(p.medios).toEqual([{ medio: 'EFECTIVO', monto: 20 }, { medio: 'YAPE', monto: 18.5 }]);
    expect(p).toMatchObject({ efectivo: 20, vuelto: 0, descuento: 4, estado: 'PAGADO' });
  });
  it('cobrado por el mozo y personal', () => {
    expect(calcularPagoPedido({ total: 10, pago_metodo: 'EFECTIVO', cobro_mozo_en: new Date(), cobro_mozo_recibido: 20 })).toMatchObject({ estado: 'COBRADO_MOZO', vuelto: 10 });
    expect(PAGOS_EJEMPLO.personal).toMatchObject({ esPersonal: true, cobrarAlEntregar: null });
  });
  it('delivery sin pagar: cobra el efectivo; sin medio, todo el total; pagado o por Yape, nada', () => {
    expect(PAGOS_EJEMPLO.deliveryContraEntrega.cobrarAlEntregar).toBe(38.5);
    expect(calcularPagoPedido({ total: 15, modalidad: 'DELIVERY' }).cobrarAlEntregar).toBe(15);
    expect(calcularPagoPedido({ total: 15, modalidad: 'DELIVERY', pago_metodo: 'YAPE' }).cobrarAlEntregar).toBeNull();
    expect(calcularPagoPedido({ total: 15, modalidad: 'DELIVERY', pago_metodo: 'EFECTIVO', pago_estado: 'PAGADO' }).cobrarAlEntregar).toBeNull();
  });
});

const base = (extra: Partial<EtiquetaGeneralDatos> = {}, n = 3): EtiquetaGeneralDatos => ({
  codigo: 'CP-1', modalidad: 'Delivery', modalidadPill: 'DELIVERY', who: 'Jose Espinoza', canal: 'Caja', hora: '21:59', fecha: '07/11/2026',
  cantidadProductos: n, total: 38.5, printer: 'x', nota: 'Sin cubiertos', direccion: 'Av. Larga 123', telefono: '987654321',
  productos: Array.from({ length: n }, (_, i) => ({ cantidad: 1, nombre: `Producto ${i + 1} con nombre largo`, tamano: null })),
  ...extra,
});

const textos = (m: Maqueta) => (m.primitivas as Primitiva[]).flatMap((p) => (p.t === 'texto' ? [p.texto] : []));
const cajasTexto = (m: Maqueta) =>
  (m.primitivas as Primitiva[]).flatMap((p) => (p.t === 'texto' && !p.invertido ? [{ t: p.texto, x1: p.x, y1: p.y, x2: p.x + p.texto.length * FUENTES_TSPL[p.fuente].ancho * p.xm, y2: p.y + FUENTES_TSPL[p.fuente].alto * p.ym }] : []));

function verificar(m: Maqueta) {
  const c = cajasTexto(m);
  for (const a of c) {
    expect(a.x1, a.t).toBeGreaterThanOrEqual(8);
    expect(a.x2, a.t).toBeLessThanOrEqual(m.W - 8);
    expect(a.y2, a.t).toBeLessThanOrEqual(m.H - 8);
  }
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    expect(c[i].x1 < c[j].x2 && c[j].x1 < c[i].x2 && c[i].y1 < c[j].y2 && c[j].y1 < c[i].y2, `${c[i].t} / ${c[j].t}`).toBe(false);
  }
}

const TAMANOS = [{ anchoMm: 100, altoMm: 100 }, { anchoMm: 76, altoMm: 38 }, { anchoMm: 50, altoMm: 30 }, { anchoMm: 60, altoMm: 80 }, { anchoMm: 80, altoMm: 50 }];

describe('bloque PAGO del sticker general', () => {
  for (const [k, pago] of Object.entries(PAGOS_EJEMPLO)) {
    for (const tam of TAMANOS) {
      it(`${k} en ${tam.anchoMm}x${tam.altoMm}: nada se solapa y el estado se lee`, () => {
        for (const n of [2, 12]) {
          const m = maquetarGeneral(base({ pago, total: pago.total }, n), tam);
          verificar(m);
          expect(textos(m).join('|')).toMatch(/PAGADO|COBRAR|PERSONAL/);
        }
      });
    }
  }

  it('100x100: titulo PAGO, un medio por linea, vuelto y TOTAL', () => {
    const t = textos(maquetarGeneral(base({ pago: PAGOS_EJEMPLO.dividido }), { anchoMm: 100, altoMm: 100 }));
    expect(t).toEqual(expect.arrayContaining(['PAGO', 'EFECTIVO', 'YAPE', 'Sin vuelto (paga exacto)', 'TOTAL', 'S/ 38.50']));
    const d = textos(maquetarGeneral(base({ pago: PAGOS_EJEMPLO.efectivoVuelto }), { anchoMm: 100, altoMm: 100 }));
    expect(d).toContain('Paga con S/ 50.00 · Vuelto S/ 11.50');
  });

  it('prioridad: con muchos productos se recortan ellos (+ N MAS), nunca el pago ni el nombre', () => {
    for (const tam of [{ anchoMm: 100, altoMm: 100 }, { anchoMm: 76, altoMm: 38 }]) {
      const t = textos(maquetarGeneral(base({ pago: PAGOS_EJEMPLO.deliveryContraEntrega }, 30), tam));
      expect(t.some((x) => x.startsWith('COBRAR'))).toBe(true);
      expect(t.some((x) => x.includes('JOSE') || x.includes('ESPINOZA') || x.includes('JOS'))).toBe(true);
    }
    expect(textos(maquetarGeneral(base({ pago: PAGOS_EJEMPLO.deliveryContraEntrega }, 30), { anchoMm: 100, altoMm: 100 })).some((x) => x.startsWith('+ '))).toBe(true);
  });

  it('retrocompatible: sin pago el sticker conserva el total en el pie', () => {
    const t = textos(maquetarGeneral(base(), { anchoMm: 100, altoMm: 100 }));
    expect(t).toContain('S/ 38.50');
    expect(t).not.toContain('PAGO');
  });
});
