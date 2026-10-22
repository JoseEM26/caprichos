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
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ReclamosPublicoController } from './reclamos.publico.controller';
import { ReclamosAdminController } from './reclamos.admin.controller';
import { ReclamosService } from './reclamos.service';
import { AccesoGuard } from '../acceso/acceso.guard';

describe('ReclamosControllers', () => {
  let publicoController: ReclamosPublicoController;
  let adminController: ReclamosAdminController;
  let reclamosServiceMock: any;

  beforeEach(async () => {
    reclamosServiceMock = {
      crear: jest.fn(),
      obtenerConstanciaPublica: jest.fn(),
      obtenerCartaLegal: jest.fn(),
      listarAdmin: jest.fn(),
      obtenerPorIdAdmin: jest.fn(),
      marcarEnRevision: jest.fn(),
      responder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReclamosPublicoController, ReclamosAdminController],
      providers: [
        { provide: ReclamosService, useValue: reclamosServiceMock },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    publicoController = module.get<ReclamosPublicoController>(ReclamosPublicoController);
    adminController = module.get<ReclamosAdminController>(ReclamosAdminController);
  });

  describe('ReclamosPublicoController', () => {
    it('POST /reclamos invoca reclamosService.crear con dto e ip', async () => {
      const dto: any = { tipo: 'RECLAMO', detalle: 'Detalle de prueba' };
      const req = { ip: '192.168.1.100' };
      reclamosServiceMock.crear.mockResolvedValue({ numero: 'LR-2026-000001' });

      const res = await publicoController.crear(dto, req);

      expect(reclamosServiceMock.crear).toHaveBeenCalledWith(dto, '192.168.1.100');
      expect(res).toEqual({ numero: 'LR-2026-000001' });
    });

    it('GET /reclamos/constancia/:numero invoca reclamosService.obtenerConstanciaPublica', async () => {
      reclamosServiceMock.obtenerConstanciaPublica.mockResolvedValue({ numero: 'LR-2026-000001' });

      const res = await publicoController.obtenerConstancia('LR-2026-000001', '45678912');

      expect(reclamosServiceMock.obtenerConstanciaPublica).toHaveBeenCalledWith(
        'LR-2026-000001',
        '45678912',
      );
      expect(res).toEqual({ numero: 'LR-2026-000001' });
    });

    it('GET /carta/legal invoca reclamosService.obtenerCartaLegal', async () => {
      const datosLegal = {
        terminos: 'Términos...',
        privacidad: 'Privacidad...',
        reclamoPlazoDiasHabiles: 15,
      };
      reclamosServiceMock.obtenerCartaLegal.mockResolvedValue(datosLegal);

      const res = await publicoController.obtenerCartaLegal();

      expect(reclamosServiceMock.obtenerCartaLegal).toHaveBeenCalled();
      expect(res).toEqual(datosLegal);
    });
  });

  describe('ReclamosAdminController', () => {
    it('GET /admin/reclamos invoca reclamosService.listarAdmin', async () => {
      const filtros = { estado: 'RECIBIDO' };
      const req = { usuario: { partyId: 1n, rol: 'ADMIN' } };
      reclamosServiceMock.listarAdmin.mockResolvedValue({ total: 1, items: [] });

      const res = await adminController.listar(filtros, req);

      expect(reclamosServiceMock.listarAdmin).toHaveBeenCalledWith(filtros, req.usuario);
      expect(res).toEqual({ total: 1, items: [] });
    });

    it('GET /admin/reclamos/:id invoca reclamosService.obtenerPorIdAdmin con ip para auditoría', async () => {
      const req = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '10.0.0.5' };
      reclamosServiceMock.obtenerPorIdAdmin.mockResolvedValue({ id: '1', numero: 'LR-2026-000001' });

      const res = await adminController.obtenerPorId('1', req);

      expect(reclamosServiceMock.obtenerPorIdAdmin).toHaveBeenCalledWith('1', req.usuario, '10.0.0.5');
      expect(res).toEqual({ id: '1', numero: 'LR-2026-000001' });
    });

    it('POST /admin/reclamos/:id/en-revision invoca marcarEnRevision', async () => {
      const req = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '10.0.0.5' };
      reclamosServiceMock.marcarEnRevision.mockResolvedValue({ id: '1', estado: 'EN_REVISION' });

      const res = await adminController.marcarEnRevision('1', req);

      expect(reclamosServiceMock.marcarEnRevision).toHaveBeenCalledWith('1', req.usuario, '10.0.0.5');
      expect(res).toEqual({ id: '1', estado: 'EN_REVISION' });
    });

    it('POST /admin/reclamos/:id/responder invoca responder', async () => {
      const dto = { respuesta: 'Respuesta formal oficial del establecimiento...' };
      const req = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '10.0.0.5' };
      reclamosServiceMock.responder.mockResolvedValue({ id: '1', estado: 'RESPONDIDO' });

      const res = await adminController.responder('1', dto, req);

      expect(reclamosServiceMock.responder).toHaveBeenCalledWith('1', dto, req.usuario, '10.0.0.5');
      expect(res).toEqual({ id: '1', estado: 'RESPONDIDO' });
    });
  });
});
