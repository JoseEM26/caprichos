import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarDatosLocalDto } from './actualizar-datos-local.dto';

const base = { nombre: 'Caprichos', direccion: 'Dir', telefono: '1' };
const errores = async (extra: Record<string, unknown>) =>
  (await validate(plainToInstance(ActualizarDatosLocalDto, { ...base, ...extra }))).map((e) => e.property);

describe('ActualizarDatosLocalDto', () => {
  it('acepta RUC de 11 dígitos, vacío, y coordenadas válidas', async () => {
    expect(await errores({ ruc: '20601234567', lat: -12.0147, lng: -76.966, razon_social: 'X SAC', lema: 'Café' })).toEqual([]);
    expect(await errores({ ruc: '' })).toEqual([]);
  });
  it('rechaza RUC mal formado, coordenadas fuera de rango y lema largo', async () => {
    expect(await errores({ ruc: '1234567890' })).toContain('ruc');
    expect(await errores({ ruc: '30601234567' })).toContain('ruc');
    expect(await errores({ lat: 95 })).toContain('lat');
    expect(await errores({ lng: -200 })).toContain('lng');
    expect(await errores({ lema: 'x'.repeat(81) })).toContain('lema');
  });
});
