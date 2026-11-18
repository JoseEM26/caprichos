import { describe, it, expect } from 'vitest';
import { medioActivo, mediosActivos, normalizarMediosPagoCanal, mediosPagoPorDefecto, MEDIOS_PRESENTACION, ordenarMediosPresentacion, presentacionDeMedio, normalizarPresentacionMedios, sanearInsignia, errorPresentacionMedios } from '../mediosPago.js';

describe('Pago en línea (PAGO_EN_LINEA) solo vive en CARTA', () => {
  const todoTrue = { PAGO_EN_LINEA: true, EFECTIVO: true };

  it('normalizar fuerza PAGO_EN_LINEA=false en CAJA, MOZO y BOT aunque venga true', () => {
    const n = normalizarMediosPagoCanal({ CARTA: todoTrue, CAJA: todoTrue, MOZO: todoTrue, BOT: todoTrue });
    expect(n.CARTA.PAGO_EN_LINEA).toBe(true);
    expect(n.CAJA.PAGO_EN_LINEA).toBe(false);
    expect(n.MOZO.PAGO_EN_LINEA).toBe(false);
    expect(n.BOT.PAGO_EN_LINEA).toBe(false);
    expect(n.CAJA.EFECTIVO).toBe(true);
  });

  it('no cambia el valor de fábrica de CARTA (apagado) cuando no viene el parámetro', () => {
    expect(normalizarMediosPagoCanal(undefined).CARTA.PAGO_EN_LINEA).toBe(false);
    expect(mediosPagoPorDefecto().CARTA.PAGO_EN_LINEA).toBe(false);
  });

  it('medioActivo de PAGO_EN_LINEA solo mira CARTA', () => {
    const config = { CARTA: { PAGO_EN_LINEA: true }, CAJA: { PAGO_EN_LINEA: true }, MOZO: { PAGO_EN_LINEA: true }, BOT: { PAGO_EN_LINEA: true } };
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'CARTA')).toBe(true);
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'CAJA')).toBe(false);
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'MOZO')).toBe(false);
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'WHATSAPP')).toBe(false);
    expect(medioActivo(config, 'PAGO_EN_LINEA', null)).toBe(false);
  });

  it('mediosActivos no lista PAGO_EN_LINEA fuera de CARTA', () => {
    const config = { CAJA: { PAGO_EN_LINEA: true }, CARTA: { PAGO_EN_LINEA: true } };
    expect(mediosActivos(config, 'CAJA')).not.toContain('PAGO_EN_LINEA');
    expect(mediosActivos(config, 'CARTA')).toContain('PAGO_EN_LINEA');
  });
});

describe('presentación de los medios de pago', () => {
  const ids = ['CULQI', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'EFECTIVO', 'TARJETA'];

  it('por defecto: Yape, Plin, Efectivo, Tarjeta, Transferencia y Culqi al final; todo normal y sin insignia', () => {
    expect(ordenarMediosPresentacion(ids, undefined)).toEqual(['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CULQI']);
    for (const m of MEDIOS_PRESENTACION) expect(presentacionDeMedio(null, m)).toMatchObject({ tamano: 'normal', insignia: null });
  });

  it('respeta el orden configurado; empates y medios desconocidos van según el orden de fábrica / al final', () => {
    const p = { CULQI: { orden: 0, tamano: 'normal', insignia: null }, YAPE: { orden: 5, tamano: 'grande', insignia: 'Nuevo' } };
    expect(ordenarMediosPresentacion(['YAPE', 'PLIN', 'CULQI', 'XXX'], p)).toEqual(['CULQI', 'PLIN', 'YAPE', 'XXX']);
    expect(presentacionDeMedio(p, 'yape')).toEqual({ orden: 5, tamano: 'grande', insignia: 'Nuevo' });
  });

  it('normalizar: lo inválido vuelve al valor de fábrica y la insignia se sanea', () => {
    const n = normalizarPresentacionMedios({ YAPE: { orden: 'x', tamano: 'enorme', insignia: '  Muy   recomendado de verdad ' }, BITCOIN: { orden: 1 } });
    expect(n.YAPE.orden).toBe(1);
    expect(n.YAPE.tamano).toBe('normal');
    expect(n.YAPE.insignia).toBe('Muy recomendad');
    expect(sanearInsignia('<b>Hi</b>')).toBe('bHi/b');
    expect(sanearInsignia('   ')).toBeNull();
    expect((n as any).BITCOIN).toBeUndefined();
  });

  it('errorPresentacionMedios: acepta lo bueno y rechaza medio desconocido, orden, tamaño e insignia', () => {
    expect(errorPresentacionMedios({ YAPE: { orden: 1, tamano: 'grande', insignia: null } })).toBeNull();
    expect(errorPresentacionMedios({})).toBeNull();
    expect(errorPresentacionMedios([])).not.toBeNull();
    expect(errorPresentacionMedios({ BITCOIN: { orden: 1, tamano: 'normal', insignia: null } })).toMatch(/desconocido/);
    expect(errorPresentacionMedios({ YAPE: { orden: 1.2, tamano: 'normal', insignia: null } })).not.toBeNull();
    expect(errorPresentacionMedios({ YAPE: { orden: 1, tamano: 'x', insignia: null } })).not.toBeNull();
    expect(errorPresentacionMedios({ YAPE: { orden: 1, tamano: 'normal', insignia: '<i>' } })).not.toBeNull();
  });
});
