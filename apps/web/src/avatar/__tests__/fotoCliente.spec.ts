import { describe, expect, it } from 'vitest';
import { fotoDelCliente } from '../fotoCliente';

const foto = '/archivos/foto.jpg';
const avatar = '/archivos/avatar.png';

describe('fotoDelCliente (regla única de la foto)', () => {
  it('eligió usar el avatar: el retrato, aunque tenga foto', () => {
    expect(fotoDelCliente({ fotoUrl: foto, avatarUrl: avatar, avatarComoFoto: true })).toEqual({ url: avatar, esAvatar: true });
  });
  it('no eligió pero no tiene foto: el retrato por defecto', () => {
    expect(fotoDelCliente({ fotoUrl: null, avatarUrl: avatar, avatarComoFoto: false })).toEqual({ url: avatar, esAvatar: true });
    expect(fotoDelCliente({ fotoUrl: null, avatarUrl: avatar })).toEqual({ url: avatar, esAvatar: true });
  });
  it('tiene foto y no eligió el avatar: su foto', () => {
    expect(fotoDelCliente({ fotoUrl: foto, avatarUrl: avatar, avatarComoFoto: false })).toEqual({ url: foto, esAvatar: false });
  });
  it('sin avatar usa su foto (o nada), aunque la opción esté marcada', () => {
    expect(fotoDelCliente({ fotoUrl: foto, avatarUrl: null, avatarComoFoto: true })).toEqual({ url: foto, esAvatar: false });
    expect(fotoDelCliente({ fotoUrl: null, avatarUrl: null, avatarComoFoto: true })).toBeNull();
    expect(fotoDelCliente(null)).toBeNull();
  });
});
