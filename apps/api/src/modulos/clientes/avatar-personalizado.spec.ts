import { esAvatarPersonalizado } from './avatar-personalizado';

const porDefecto = () => ({
  nombre: 'Ana', genero: 'mujer', piel: '#F8D2B0', ojos: '#5B3A29', expresion: 'feliz', colorPelo: '#4A2C1D', disfraz: null, disfrazId: null,
  cabello: { id: 'bob_cerquillo', colores: { principal: '#4A2C1D' } }, arriba: { id: 'polo_basico', colores: {} },
  abajo: { id: 'jean', colores: {} }, calzado: { id: 'zapatilla_urbana', colores: {} },
  cabeza: { id: 'ninguno', colores: {} }, cara: { id: 'ninguno', colores: {} }, accesorio: { id: 'ninguno', colores: {} },
  mascota: { id: 'ninguno', colores: {}, nombre: '' }, usarComoFoto: true, mostrarAlEntrar: false,
});

describe('esAvatarPersonalizado', () => {
  it('nulo o vacío: no', () => {
    expect(esAvatarPersonalizado(null)).toBe(false);
    expect(esAvatarPersonalizado([])).toBe(false);
  });
  it('el de partida guardado sin cambios (con apodo y foto): no', () => {
    expect(esAvatarPersonalizado(porDefecto())).toBe(false);
  });
  it('cambiar piel, pieza, color, mascota o disfraz: sí', () => {
    expect(esAvatarPersonalizado({ ...porDefecto(), piel: '#83532F' })).toBe(true);
    expect(esAvatarPersonalizado({ ...porDefecto(), colorPelo: '#C5221F' })).toBe(true);
    expect(esAvatarPersonalizado({ ...porDefecto(), arriba: { id: 'polo_basico', colores: { principal: '#C5221F' } } })).toBe(true);
    expect(esAvatarPersonalizado({ ...porDefecto(), cabeza: { id: 'gorra', colores: {} } })).toBe(true);
    expect(esAvatarPersonalizado({ ...porDefecto(), mascota: { id: 'gato', colores: {}, nombre: 'Michi' } })).toBe(true);
    expect(esAvatarPersonalizado({ ...porDefecto(), disfrazId: 'pirata' })).toBe(true);
  });
});
