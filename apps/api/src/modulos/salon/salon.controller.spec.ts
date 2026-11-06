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
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('SalonController', () => {
  let controller: SalonController;
  let salonService: any;

  beforeEach(async () => {
    salonService = {
      obtenerMesas: jest.fn(),
      abrirPedido: jest.fn(),
      liberarMesaManual: jest.fn(),
      marcarEntregadoMesa: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalonController],
      providers: [
        { provide: SalonService, useValue: salonService },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secreto' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SalonController>(SalonController);
  });

  it('GET /admin/salon/mesas debe llamar a salonService.obtenerMesas', async () => {
    salonService.obtenerMesas.mockResolvedValue({ pisos: [] });
    const res = await controller.obtenerMesas();
    expect(salonService.obtenerMesas).toHaveBeenCalled();
    expect(res).toEqual({ pisos: [] });
  });

  it('POST /admin/salon/pedidos debe llamar a salonService.abrirPedido con idempotencia y usuario', async () => {
    salonService.abrirPedido.mockResolvedValue({ id: '1', codigo: 'CP-W001' });
    const dto: any = { mesas: [1], lineas: [] };
    const reqMock: any = { usuario: { partyId: 10n, rol: 'MOZO' } };

    const res = await controller.abrirPedido(dto, 'idem-1', undefined, reqMock);

    expect(salonService.abrirPedido).toHaveBeenCalledWith(dto, reqMock.usuario, 'idem-1', undefined);
    expect(res.codigo).toBe('CP-W001');
  });

  it('POST /admin/salon/mesas/:id/liberar debe llamar a salonService.liberarMesaManual', async () => {
    salonService.liberarMesaManual.mockResolvedValue({ ok: true });
    const dto: any = { motivo: 'Cliente se retiró' };
    const reqMock: any = { usuario: { partyId: 10n }, ip: '127.0.0.1' };

    const res = await controller.liberarMesa('5', dto, reqMock);

    expect(salonService.liberarMesaManual).toHaveBeenCalledWith('5', dto, reqMock.usuario, '127.0.0.1');
    expect(res.ok).toBe(true);
  });

  it('POST /admin/salon/pedidos/:id/entregado-mesa debe llamar a salonService.marcarEntregadoMesa', async () => {
    salonService.marcarEntregadoMesa.mockResolvedValue({ ok: true });
    const reqMock: any = { usuario: { partyId: 10n }, ip: '127.0.0.1' };

    const res = await controller.marcarEntregadoMesa('99', reqMock);

    expect(salonService.marcarEntregadoMesa).toHaveBeenCalledWith('99', reqMock.usuario, '127.0.0.1');
    expect(res.ok).toBe(true);
  });
});
