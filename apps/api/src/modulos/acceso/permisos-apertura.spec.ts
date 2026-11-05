import { MATRIZ, PERMISOS } from './permisos';

describe('permiso almacen/apertura (conteo de apertura)', () => {
  it('existe en el catálogo de permisos', () => {
    expect(PERMISOS).toContainEqual({ modulo: 'almacen', accion: 'apertura' });
  });

  it('lo tienen ADMIN, COCINA y CAJERO; ALMACEN también; MOZO y REPARTIDOR no', () => {
    expect(MATRIZ.ADMIN).toContain('almacen/apertura');
    expect(MATRIZ.COCINA).toContain('almacen/apertura');
    expect(MATRIZ.CAJERO).toContain('almacen/apertura');
    expect(MATRIZ.ALMACEN).toContain('almacen/apertura');
    expect(MATRIZ.MOZO).not.toContain('almacen/apertura');
    expect(MATRIZ.REPARTIDOR).not.toContain('almacen/apertura');
  });
});
