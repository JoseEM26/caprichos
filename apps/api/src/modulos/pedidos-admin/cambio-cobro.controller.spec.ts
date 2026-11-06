jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { CambioCobroController } from './cambio-cobro.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MATRIZ } from '../acceso/permisos';

const permisoDe = (metodo: keyof CambioCobroController) => Reflect.getMetadata(CLAVE_PERMISO, CambioCobroController.prototype[metodo]);

describe('CambioCobroController: permisos de las rutas', () => {
  it('solicitar es del repartidor; resolver y pendientes, de quien valida pagos (Caja, Admin y Supervisor)', () => {
    expect(permisoDe('solicitar')).toEqual({ modulo: 'repartos', accion: 'solicitar_cambio_cobro' });
    expect(permisoDe('resolver')).toEqual({ modulo: 'pedidos', accion: 'validar_cambio_cobro' });
    expect(permisoDe('pendientes')).toEqual({ modulo: 'pedidos', accion: 'validar_cambio_cobro' });
    for (const rol of ['ADMIN', 'CAJERO', 'SUPERVISOR']) expect(MATRIZ[rol]).toContain('pedidos/validar_cambio_cobro');
    for (const rol of ['REPARTIDOR', 'MOZO', 'COCINA', 'CALLCENTER']) expect(MATRIZ[rol]).not.toContain('pedidos/validar_cambio_cobro');
    expect(MATRIZ.ADMIN).toContain('repartos/solicitar_cambio_cobro');
    expect(MATRIZ.CAJERO).not.toContain('repartos/solicitar_cambio_cobro');
  });

  it('pasa las capturas por campo y el usuario al servicio', async () => {
    const servicio: any = { solicitar: jest.fn().mockResolvedValue({ ok: true }) };
    const c = new CambioCobroController(servicio);
    const yape = { buffer: Buffer.from('y') };
    await c.solicitar('7', { plan: '[]' }, { captura_YAPE: [yape as any] }, { usuario: { partyId: 5n }, ip: '1.1.1.1' });
    expect(servicio.solicitar).toHaveBeenCalledWith('7', { plan: '[]' }, expect.objectContaining({ YAPE: yape, PLIN: undefined }), { partyId: 5n }, '1.1.1.1');
  });
});
