import { TEXTOS_REPARTO } from '../textos-reparto';

const resumen = { lineas: ['1 x COMBO CAJITA CAPRIKIDS'], total: 27, medioPago: 'Yape', envioPorConfirmar: true };

describe('aviso «Recibimos tu pedido» con resumen', () => {
  it('delivery sin ubicación (Yape): productos, total, medio con captura, envío por confirmar, pedido de ubicación y enlace', () => {
    const t = TEXTOS_REPARTO.recibidoDigital('JoseEM', 'CP-W031', 'Yape', 'https://x/?seguimiento=CP-W031', resumen).textoLibre;
    expect(t).toContain('1 x COMBO CAJITA CAPRIKIDS');
    expect(t).toContain('S/ 27.00');
    expect(t).toContain('Pago por Yape');
    expect(t).toContain('captura');
    expect(t).toContain('Envío por confirmar');
    expect(t).toContain('toca el clip 📎 → Ubicación → Enviar tu ubicación actual');
    expect(t).toContain('https://x/?seguimiento=CP-W031');
  });

  it('la plantilla de Meta no cambia (misma clave y variables)', () => {
    const p = TEXTOS_REPARTO.recibidoDigital('A', 'CP-1', 'Yape', null, resumen);
    expect(p.plantillaClave).toBe('CARTA_RECIBIDO_DIGITAL');
    expect(p.variablesPlantilla).toEqual(['A', 'CP-1', 'Yape']);
  });

  it('con envío ya calculado no pide ubicación', () => {
    const t = TEXTOS_REPARTO.recibidoDigital('A', 'CP-1', 'Yape', null, { ...resumen, envioPorConfirmar: false, envio: 5 }).textoLibre;
    expect(t).toContain('Envío: S/ 5.00');
    expect(t).not.toContain('clip');
  });

  it('sin resumen mantiene el texto de siempre', () => {
    expect(TEXTOS_REPARTO.recibidoDigital('A', 'CP-1', 'Yape', null).textoLibre).toContain('Tu pedido ya está en marcha');
  });
});

describe('aviso «Recibimos tu pedido» en efectivo: monto y vuelto', () => {
  const base = { lineas: ['1 x Dona'], total: 31.75, medioPago: 'efectivo', envioPorConfirmar: false, envio: 4 };
  it('con vuelto: cuánto paga y cuánto se le devuelve', () => {
    const t = TEXTOS_REPARTO.recibidoEfectivo('A', 'CP-1', null, false, { ...base, efectivo: { aPagar: 31.75, pagaCon: 50 } }).textoLibre;
    expect(t).toContain('Efectivo a pagar al recibir: S/ 31.75');
    expect(t).toContain('Pagas con S/ 50.00 · te llevamos vuelto de S/ 18.25');
  });
  it('paga exacto o sin dato: sin vuelto', () => {
    const t = TEXTOS_REPARTO.recibidoEfectivo('A', 'CP-1', null, false, { ...base, efectivo: { aPagar: 31.75, pagaCon: null } }).textoLibre;
    expect(t).toContain('Sin vuelto (pago exacto)');
  });
  it('sin efectivo no agrega el bloque', () => {
    const t = TEXTOS_REPARTO.recibidoEfectivo('A', 'CP-1', null, false, base).textoLibre;
    expect(t).not.toContain('Efectivo a pagar');
  });
});
