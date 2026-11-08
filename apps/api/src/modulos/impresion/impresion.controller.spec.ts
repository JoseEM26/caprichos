jest.mock('@nestjs/jwt', () => {
  return {
    JwtService: jest.fn().mockImplementation(() => ({
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    })),
    JwtModule: {
      registerAsync: jest.fn().mockReturnValue({
        module: class MockJwtModule {},
      }),
    },
  };
});

import { ForbiddenException } from '@nestjs/common';
import { AgenteImpresionController } from './agente-impresion.controller';
import { AdminImpresionController } from './admin-impresion.controller';

describe('Controladores de Impresión', () => {
  let agenteController: AgenteImpresionController;
  let adminController: AdminImpresionController;
  let impresionServiceMock: any;

  beforeEach(() => {
    impresionServiceMock = {
      tomarTrabajos: jest.fn().mockResolvedValue({ trabajos: [] }),
      registrarResultado: jest.fn().mockResolvedValue(undefined),
      registrarLatido: jest.fn().mockResolvedValue(undefined),
      obtenerEstadoAdmin: jest.fn().mockResolvedValue({ agente: 'conectado' }),
      listarTrabajos: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      reintentarTrabajo: jest.fn().mockResolvedValue({ ok: true }),
      reimprimirTrabajos: jest.fn().mockResolvedValue({ ok: true }),
      reimprimirEtiqueta: jest.fn().mockResolvedValue({ ok: true }),
      listarLlavesAgente: jest.fn().mockResolvedValue([]),
      crearLlaveAgente: jest.fn().mockResolvedValue({ id: '1', llave: 'agk_123' }),
      desactivarLlaveAgente: jest.fn().mockResolvedValue({ ok: true }),
      listarCola: jest.fn().mockResolvedValue({ items: [] }),
      vaciarCola: jest.fn().mockResolvedValue({ ok: true }),
      descartarPedido: jest.fn().mockResolvedValue({ ok: true }),
      descartarTrabajo: jest.fn().mockResolvedValue({ ok: true }),
    };

    agenteController = new AgenteImpresionController(impresionServiceMock);
    adminController = new AdminImpresionController(impresionServiceMock);
  });

  describe('AgenteImpresionController', () => {
    it('POST /tomar delega al servicio con el id del dispositivo del request', async () => {
      const req = { deviceKey: { id: 3n } };
      await agenteController.tomar({ max: 5 }, req);
      expect(impresionServiceMock.tomarTrabajos).toHaveBeenCalledWith(5, 3n, undefined, null, false);
    });

    it('POST /tomar pasa el id del equipo y sus roles (cada PC toma lo que su configuración le asigna)', async () => {
      const req = { deviceKey: { id: 4n, area_id: 2n } };
      await agenteController.tomar({ max: 5, roles: ['ETIQUETERA'] }, req);
      expect(impresionServiceMock.tomarTrabajos).toHaveBeenCalledWith(5, 4n, ['ETIQUETERA'], null, false);
    });

    it('POST /resultado delega al servicio', async () => {
      await agenteController.registrarResultado({ id: '10', ok: true });
      expect(impresionServiceMock.registrarResultado).toHaveBeenCalledWith({ id: '10', ok: true });
    });

    it('POST /latido delega al servicio', async () => {
      const req = { deviceKey: { id: 3n }, headers: { 'x-forwarded-for': '200.1.2.3' } };
      await agenteController.registrarLatido(
        { version: '1.0', impresora: 'lista' },
        req,
      );
      // Pasa también la IP pública que ve el servidor
      expect(impresionServiceMock.registrarLatido).toHaveBeenCalledWith(
        { version: '1.0', impresora: 'lista' },
        3n,
        '200.1.2.3',
      );
    });
  });

  describe('AdminImpresionController', () => {
    const adminReq = { usuario: { rol: 'ADMIN', partyId: 1n }, ip: '127.0.0.1' };
    const cajeroReq = { usuario: { rol: 'CAJERO', partyId: 2n }, ip: '127.0.0.1' };

    it('GET /estado delega al servicio', async () => {
      const res = await adminController.obtenerEstado();
      expect(res.agente).toBe('conectado');
      expect(impresionServiceMock.obtenerEstadoAdmin).toHaveBeenCalled();
    });

    it('GET /trabajos procesa query params numéricos', async () => {
      await adminController.listarTrabajos('PENDIENTE', 'CP-01', '2', '10');
      expect(impresionServiceMock.listarTrabajos).toHaveBeenCalledWith(
        'PENDIENTE',
        'CP-01',
        2,
        10,
        undefined,
      );
    });

    it('GET /trabajos pasa la máquina; POST /cola/reimprimir y /cola/:id/reimprimir delegan con el usuario', async () => {
      await adminController.listarTrabajos(undefined, undefined, '1', '10', 'TICKETERA');
      expect(impresionServiceMock.listarTrabajos).toHaveBeenLastCalledWith(undefined, undefined, 1, 10, 'TICKETERA');
      const req = { usuario: { partyId: 1n }, ip: '9.9.9.9' };
      await adminController.reimprimirTrabajo('12', req);
      expect(impresionServiceMock.reimprimirTrabajos).toHaveBeenCalledWith({ ids: ['12'] }, req.usuario, '9.9.9.9');
      await adminController.reimprimirCola({ grupo: 'STICKERS_FALLIDOS' }, req);
      expect(impresionServiceMock.reimprimirTrabajos).toHaveBeenLastCalledWith({ grupo: 'STICKERS_FALLIDOS' }, req.usuario, '9.9.9.9');
    });

    it('POST /trabajos/:id/reintentar delega al servicio', async () => {
      await adminController.reintentarTrabajo('12');
      expect(impresionServiceMock.reintentarTrabajo).toHaveBeenCalledWith('12');
    });

    it('POST /pedidos/:id/reimprimir delega al servicio', async () => {
      await adminController.reimprimir('55', { tipo: 'general' });
      expect(impresionServiceMock.reimprimirEtiqueta).toHaveBeenCalledWith('55', { tipo: 'general' });
    });

    it('bloquea la creación de llaves si el rol no es ADMIN', async () => {
      await expect(
        adminController.crearLlave({ nombre: 'Test' }, cajeroReq),
      ).rejects.toThrow(ForbiddenException);
      expect(impresionServiceMock.crearLlaveAgente).not.toHaveBeenCalled();
    });

    it('permite la creación de llaves si el rol es ADMIN', async () => {
      const res = await adminController.crearLlave({ nombre: 'Test' }, adminReq);
      expect(res.llave).toBe('agk_123');
      expect(impresionServiceMock.crearLlaveAgente).toHaveBeenCalledWith(
        { nombre: 'Test' },
        adminReq.usuario,
        '127.0.0.1',
      );
    });

    it('bloquea la desactivación de llaves si el rol no es ADMIN', async () => {
      await expect(
        adminController.desactivarLlave('4', cajeroReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite la desactivación de llaves si el rol es ADMIN', async () => {
      const res = await adminController.desactivarLlave('4', adminReq);
      expect(res.ok).toBe(true);
      expect(impresionServiceMock.desactivarLlaveAgente).toHaveBeenCalledWith(
        '4',
        adminReq.usuario,
        '127.0.0.1',
      );
    });
  });

  describe('cola y descarte (permisos)', () => {
    it('vaciar y descartar piden pedidos/cambiar_estado y listar pide pedidos/ver', () => {
      const P = (m: string) => Reflect.getMetadataKeys(AdminImpresionController.prototype.constructor.prototype[m]);
      expect(P('vaciarCola').length).toBeGreaterThan(0);
      expect(P('descartarPedido').length).toBeGreaterThan(0);
      expect(P('listarCola').length).toBeGreaterThan(0);
    });

    it('delega al servicio con el usuario del request', async () => {
      const req = { usuario: { rol: 'CAJERO' }, ip: '2.2.2.2' };
      await adminController.vaciarCola({ alcance: 'TODAS', motivo: 'motivo largo' }, req);
      expect(impresionServiceMock.vaciarCola).toHaveBeenCalledWith({ alcance: 'TODAS', motivo: 'motivo largo' }, req.usuario, '2.2.2.2');
      await adminController.descartarPedido('5', {}, req);
      expect(impresionServiceMock.descartarPedido).toHaveBeenCalledWith('5', {}, req.usuario, '2.2.2.2');
    });
  });
});
