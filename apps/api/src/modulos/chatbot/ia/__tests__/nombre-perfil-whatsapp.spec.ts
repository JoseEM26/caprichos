import { extraerPrimerNombre } from '../ia-privacidad.util';

describe('extraerPrimerNombre: perfiles de WhatsApp', () => {
  it('toma el nombre entre paréntesis y normaliza letras decorativas', () => {
    expect(extraerPrimerNombre('Usuario de WhatsApp (𝓐𝓵𝓮💫)')).toBe('Ale');
  });
  it('sin nombre de perfil, Cliente (nunca «Usuario»)', () => {
    expect(extraerPrimerNombre('Usuario de WhatsApp')).toBe('Cliente');
  });
  it('nombre normal igual que antes', () => {
    expect(extraerPrimerNombre('Lucía Pérez')).toBe('Lucía');
  });
});
