import { anulaConAlcanceLimitado } from '../acceso/roles-usuario';

describe('anulación de alcance limitado: COCINA y MOZO', () => {
  it.each([
    ['COCINA', undefined],
    ['MOZO', undefined],
    ['MOZO', ['MOZO', 'COCINA']],
    ['ALMACEN', ['ALMACEN', 'COCINA']],
  ])('%s %j anula solo lo suyo (alcance limitado)', (rol, roles) => {
    expect(anulaConAlcanceLimitado({ rol, roles })).toBe(true);
  });

  it.each([
    ['CAJERO', undefined],
    ['ALMACEN', undefined],
    ['REPARTIDOR', undefined],
    ['CAJERO', ['CAJERO', 'MOZO']],
    ['MOZO', ['MOZO', 'CAJERO']],
    ['COCINA', ['COCINA', 'SUPERVISOR']],
  ])('%s %j no tiene alcance limitado', (rol, roles) => {
    expect(anulaConAlcanceLimitado({ rol, roles })).toBe(false);
  });

  it('sin usuario no aplica', () => {
    expect(anulaConAlcanceLimitado(undefined)).toBe(false);
  });
});
