jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../../acceso/acceso.guard', () => ({
  AccesoGuard: class {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { VouchersController } from '../vouchers.controller';
import { VouchersService } from '../vouchers.service';
import { CLAVE_PERMISO } from '../../acceso/permiso.decorator';

describe('VouchersController', () => {
  let controller: VouchersController;
  let serviceMock: any;
  let reflector: Reflector;

  beforeEach(async () => {
    serviceMock = {
      subirYProcesar: jest.fn().mockResolvedValue({ id: '1', legible: true }),
      listar: jest.fn().mockResolvedValue({ vouchers: [], faltanRevisar: 0, total: 0 }),
      marcarRevisado: jest.fn().mockResolvedValue({ ok: true, id: '1' }),
      obtenerConsumoMesVoucher: jest.fn().mockResolvedValue({ periodo: '2026-10', costoUsdEstimado: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VouchersController],
      providers: [
        { provide: VouchersService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<VouchersController>(VouchersController);
    reflector = new Reflector();
  });

  describe('Metadatos de Permisos', () => {
    it('POST /admin/vouchers exige permiso vouchers/subir', () => {
      const permiso = reflector.get(CLAVE_PERMISO, controller.subirVoucher);
      expect(permiso).toEqual({ modulo: 'vouchers', accion: 'subir' });
    });

    it('GET /admin/vouchers exige permiso vouchers/ver', () => {
      const permiso = reflector.get(CLAVE_PERMISO, controller.listarVouchers);
      expect(permiso).toEqual({ modulo: 'vouchers', accion: 'ver' });
    });

    it('POST /admin/vouchers/:id/revisado exige permiso vouchers/ver', () => {
      const permiso = reflector.get(CLAVE_PERMISO, controller.marcarRevisado);
      expect(permiso).toEqual({ modulo: 'vouchers', accion: 'ver' });
    });
  });

  describe('Invocación de métodos del servicio', () => {
    it('subirVoucher llama a subirYProcesar con archivo, medio y usuario', async () => {
      const fakeFile = { buffer: Buffer.from('test') } as any;
      const req = { usuario: { partyId: 10n, rol: 'MOZO' }, ip: '127.0.0.1' };

      const res = await controller.subirVoucher(
        { archivo: [fakeFile] },
        '55',
        'YAPE',
        req,
      );

      expect(res).toEqual({ id: '1', legible: true });
      expect(serviceMock.subirYProcesar).toHaveBeenCalledWith(
        fakeFile,
        { pedidoId: '55', medio: 'YAPE' },
        req.usuario,
        '127.0.0.1',
      );
    });

    it('listarVouchers pasa los filtros de búsqueda al servicio', async () => {
      await controller.listarVouchers('55', undefined, '2026-10-27', 'pendientes');
      expect(serviceMock.listar).toHaveBeenCalledWith({
        pedidoId: '55',
        conversacionId: undefined,
        fecha: '2026-10-27',
        estado: 'pendientes',
      });
    });

    it('marcarRevisado delega en el servicio con el ID y usuario', async () => {
      const req = { usuario: { partyId: 20n, rol: 'CAJERO' }, ip: '127.0.0.1' };
      const res = await controller.marcarRevisado('42', req);
      expect(res).toEqual({ ok: true, id: '1' });
      expect(serviceMock.marcarRevisado).toHaveBeenCalledWith('42', req.usuario, '127.0.0.1');
    });
  });
});
