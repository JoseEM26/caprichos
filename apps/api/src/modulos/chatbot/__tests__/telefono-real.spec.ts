import { tieneTelefonoReal, telefonoEnviable } from '../utilidades/enmascarar.util';

describe('tieneTelefonoReal / telefonoEnviable', () => {
  it('vacío, nulo y el relleno 999999999 no son teléfono real', () => {
    expect(tieneTelefonoReal(null)).toBe(false);
    expect(tieneTelefonoReal(undefined)).toBe(false);
    expect(tieneTelefonoReal('')).toBe(false);
    expect(tieneTelefonoReal('999999999')).toBe(false);
    expect(tieneTelefonoReal('51999999999')).toBe(false);
    expect(telefonoEnviable('999999999')).toBe('');
  });

  it('un celular real (con o sin 51) y un BSUID de WhatsApp sí cuentan', () => {
    expect(tieneTelefonoReal('987654321')).toBe(true);
    expect(tieneTelefonoReal('51987654321')).toBe(true);
    expect(tieneTelefonoReal('wa-user:PE.12345678')).toBe(true);
    expect(telefonoEnviable('987654321')).toBe('51987654321');
  });
});
