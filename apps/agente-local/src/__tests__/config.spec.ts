import { describe, it, expect } from 'vitest';
import { obtenerConfiguracion } from '../config';

describe('config', () => {
  it('usa valores por defecto requeridos cuando no hay variables de entorno', () => {
    const config = obtenerConfiguracion({});
    expect(config.apiUrl).toBe('http://localhost:3000');
    expect(config.agenteKey).toBe('');
    expect(config.impresoraRuta).toBe('/dev/usb/lp0');
    expect(config.intervaloConsultaMs).toBe(3000);
    expect(config.intervaloLatidoMs).toBe(20000);
    expect(config.maxTrabajosPorLote).toBe(10);
  });

  it('permite sobreescribir configuracion mediante variables de entorno', () => {
    const config = obtenerConfiguracion({
      API_URL: 'http://192.168.1.100:3000',
      AGENTE_KEY: 'mi-llave-secreta-de-dispositivo',
      IMPRESORA_RUTA: '/dev/usb/lp1',
      INTERVALO_CONSULTA_MS: '5000',
      INTERVALO_LATIDO_MS: '15000',
      MAX_TRABAJOS_LOTE: '5',
    });

    expect(config.apiUrl).toBe('http://192.168.1.100:3000');
    expect(config.agenteKey).toBe('mi-llave-secreta-de-dispositivo');
    expect(config.impresoraRuta).toBe('/dev/usb/lp1');
    expect(config.intervaloConsultaMs).toBe(5000);
    expect(config.intervaloLatidoMs).toBe(15000);
    expect(config.maxTrabajosPorLote).toBe(5);
  });

  it('normaliza URLs quitando barras diagonales al final', () => {
    const config = obtenerConfiguracion({
      API_URL: 'http://api.caprichos.pe/',
    });
    expect(config.apiUrl).toBe('http://api.caprichos.pe');
  });

  it('el formato del sticker tiene defecto apaisado y se ajusta por entorno o archivo sin recompilar', () => {
    expect(obtenerConfiguracion({}).etiqueta).toEqual({ orientacion: 'vertical-girado', giro: 90, anchoMm: 101.6, altoMm: 63.5, direccion: 1, gapMm: 3 });
    const e = obtenerConfiguracion({ ETIQUETA_ORIENTACION: 'vertical', ETIQUETA_DIRECCION: '0' }).etiqueta;
    expect(e).toMatchObject({ orientacion: 'vertical', anchoMm: 63.5, altoMm: 101.6, direccion: 0 });
    const a = obtenerConfiguracion({}, { etiqueta: { anchoMm: 100, altoMm: 50, gapMm: 2 } }).etiqueta;
    expect(a).toMatchObject({ orientacion: 'vertical-girado', anchoMm: 100, altoMm: 50, gapMm: 2 });
  });
});
