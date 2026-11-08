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
