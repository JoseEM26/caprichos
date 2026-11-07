jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));

import { PedidosAdminController } from './pedidos-admin.controller';
import { CLAVE_REQUIERE_CODIGO_SUPERVISOR } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { anulaSinAprobacion } from '../acceso/roles-usuario';

describe('anular sin código: COCINA y MOZO (condición del guard)', () => {
  const meta = Reflect.getMetadata(CLAVE_REQUIERE_CODIGO_SUPERVISOR, PedidosAdminController.prototype.cambiarEstado);
  const pide = (usuario: any, estado = 'ANULADO') => meta.condicion({ body: { estado }, usuario });

  it('la ruta sigue declarando pedidos/anular', () => {
    expect(meta.accion).toBe('pedidos/anular');
  });

  it.each([
    ['COCINA', undefined],
    ['MOZO', undefined],
    ['MOZO', ['MOZO', 'COCINA']],
    ['ALMACEN', ['ALMACEN', 'COCINA']],
  ])('%s %j anula sin código', (rol, roles) => {
    expect(pide({ rol, roles })).toBe(false);
  });

  it.each([
    ['CAJERO', undefined],
    ['ALMACEN', undefined],
    ['REPARTIDOR', undefined],
    ['CAJERO', ['CAJERO', 'MOZO']],
    ['MOZO', ['MOZO', 'CAJERO']],
    ['COCINA', ['COCINA', 'SUPERVISOR']],
  ])('%s %j sigue pidiendo código', (rol, roles) => {
    expect(pide({ rol, roles })).toBe(true);
  });

  it('otros estados no piden código', () => {
    expect(pide({ rol: 'CAJERO' }, 'LISTO')).toBe(false);
  });

  it('sin usuario no se exime', () => {
    expect(anulaSinAprobacion(undefined)).toBe(false);
  });
});
