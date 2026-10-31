import { describe, it, expect } from 'vitest';
import { parsearUbicacion } from '../parsearUbicacion';

describe('parsearUbicacion: coordenadas sueltas', () => {
  it('acepta lat,lng con coma y espacio', () => {
    expect(parsearUbicacion('-12.0123, -76.9456')).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('acepta lat lng separados solo por espacio', () => {
    expect(parsearUbicacion('-12.0123 -76.9456')).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('acepta espacios alrededor y sin decimales', () => {
    expect(parsearUbicacion('  -12,-77  ')).toEqual({ lat: -12, lng: -77 });
  });

  it('acepta los límites exactos de rango', () => {
    expect(parsearUbicacion('90, 180')).toEqual({ lat: 90, lng: 180 });
    expect(parsearUbicacion('-90, -180')).toEqual({ lat: -90, lng: -180 });
  });
});

describe('parsearUbicacion: enlaces de Google Maps', () => {
  it('lee el centro del mapa de un enlace /@lat,lng,zoom', () => {
    expect(parsearUbicacion('https://www.google.com/maps/@-12.0123,-76.9456,17z')).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('lee el lugar de un enlace /maps/place/…/@lat,lng', () => {
    expect(parsearUbicacion('https://www.google.com/maps/place/Caprichos/@-12.0196436,-76.963255,17z/data=!3m1')).toEqual({
      lat: -12.0196436,
      lng: -76.963255,
    });
  });

  it('prefiere el pin del lugar (!3d!4d) sobre el centro (@)', () => {
    expect(
      parsearUbicacion('https://www.google.com/maps/place/X/@-12.1,-77.1,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-12.0123!4d-76.9456'),
    ).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('lee ?q=lat,lng', () => {
    expect(parsearUbicacion('https://www.google.com/maps?q=-12.0123,-76.9456')).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('lee ?q= con la coma codificada y otros parámetros después', () => {
    expect(parsearUbicacion('https://maps.google.com/?q=-12.0123%2C-76.9456&hl=es')).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('lee ?ll=lat,lng', () => {
    expect(parsearUbicacion('https://maps.google.com/maps?ll=-12.0123,-76.9456&z=15')).toEqual({ lat: -12.0123, lng: -76.9456 });
  });

  it('ignora ?q= cuando trae un nombre de lugar en lugar de coordenadas', () => {
    expect(parsearUbicacion('https://www.google.com/maps?q=Av+Brasil+1234+Lima')).toBeNull();
  });

  it('no resuelve enlaces cortos (maps.app.goo.gl): devuelve null', () => {
    expect(parsearUbicacion('https://maps.app.goo.gl/AbC123xyz')).toBeNull();
  });
});

describe('parsearUbicacion: textos inválidos', () => {
  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['texto libre', 'Av. Brasil 1234'],
    ['un solo número', '-12.0123'],
    ['tres números', '-12.0123, -76.9456, 5'],
    ['latitud fuera de rango', '-91, -76.9'],
    ['longitud fuera de rango', '-12.0, 181'],
    ['latitud 90.5', '90.5, -76.9'],
    ['letras mezcladas', '-12.0x, -76.9'],
    ['enlace sin coordenadas', 'https://www.google.com/maps/search/restaurantes'],
    ['enlace con latitud fuera de rango', 'https://www.google.com/maps/@-95.0,-76.9,17z'],
  ])('devuelve null para %s', (_nombre, texto) => {
    expect(parsearUbicacion(texto)).toBeNull();
  });

  it('devuelve null para null o undefined', () => {
    expect(parsearUbicacion(null as unknown as string)).toBeNull();
    expect(parsearUbicacion(undefined as unknown as string)).toBeNull();
  });
});
