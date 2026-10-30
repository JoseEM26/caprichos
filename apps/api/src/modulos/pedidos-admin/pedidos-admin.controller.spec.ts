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

import { Test, TestingModule } from '@nestjs/testing';
import { PedidosAdminController } from './pedidos-admin.controller';
import { PedidosEstadoService } from './pedidos-estado.service';
import { UbicarPedidoService } from './ubicar-pedido.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('PedidosAdminController', () => {
  let controller: PedidosAdminController;
  let service: any;

  beforeEach(async () => {
    service = {
      listar: jest.fn(),
      listarCocina: jest.fn(),
      obtenerPorId: jest.fn(),
      cambiarEstado: jest.fn(),
      registrarPago: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PedidosAdminController],
      providers: [
        { provide: PedidosEstadoService, useValue: service },
        { provide: UbicarPedidoService, useValue: { ubicar: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secreto' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PedidosAdminController>(PedidosAdminController);
  });

  it('GET /admin/pedidos debe llamar a service.listar', async () => {
    service.listar.mockResolvedValue({ total: 1, items: [] });
    const reqMock: any = { usuario: { partyId: 1n, rol: 'ADMIN' } };

    const res = await controller.listar({ estado: 'COLA' }, reqMock);

    expect(service.listar).toHaveBeenCalledWith({ estado: 'COLA' }, reqMock.usuario);
    expect(res.total).toBe(1);
  });

  it('GET /admin/pedidos/cocina debe llamar a service.listarCocina', async () => {
    service.listarCocina.mockResolvedValue([{ id: 1n, codigo: 'CP-W001' }]);
    const reqMock: any = { usuario: { partyId: 3n, rol: 'COCINA' } };

    const res = await controller.listarCocina({ historial: 'false' }, reqMock);

    expect(service.listarCocina).toHaveBeenCalledWith('false', reqMock.usuario);
    expect(res).toHaveLength(1);
  });

  it('GET /admin/pedidos/:id debe llamar a service.obtenerPorId', async () => {
    service.obtenerPorId.mockResolvedValue({ id: 10n, codigo: 'CP-W001' });
    const reqMock: any = { usuario: { partyId: 2n, rol: 'CAJERO' }, ip: '127.0.0.1' };

    const res = await controller.obtenerPorId('10', reqMock);

    expect(service.obtenerPorId).toHaveBeenCalledWith('10', reqMock.usuario, '127.0.0.1');
    expect(res.codigo).toBe('CP-W001');
  });

  it('POST /admin/pedidos/:id/estado debe llamar a service.cambiarEstado con PIN', async () => {
    service.cambiarEstado.mockResolvedValue({ id: 10n, estado: 'ANULADO' });
    const reqMock: any = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '127.0.0.1' };

    const res = await controller.cambiarEstado(
      '10',
      { estado: 'ANULADO', motivo: 'Cliente desistió' },
      '654321',
      reqMock,
    );

    expect(service.cambiarEstado).toHaveBeenCalledWith(
      '10',
      { estado: 'ANULADO', motivo: 'Cliente desistió' },
      reqMock.usuario,
      '654321',
      '127.0.0.1',
    );
    expect(res.estado).toBe('ANULADO');
  });

  it('POST /admin/pedidos/:id/pago debe llamar a service.registrarPago', async () => {
    service.registrarPago.mockResolvedValue({ id: 10n, pago_estado: 'COORDINADO' });
    const reqMock: any = { usuario: { partyId: 2n, rol: 'CAJERO' }, ip: '127.0.0.1' };

    const res = await controller.registrarPago(
      '10',
      { metodo: 'YAPE', estado: 'COORDINADO' },
      reqMock,
    );

    expect(service.registrarPago).toHaveBeenCalledWith(
      '10',
      { metodo: 'YAPE', estado: 'COORDINADO' },
      reqMock.usuario,
      '127.0.0.1',
    );
    expect(res.pago_estado).toBe('COORDINADO');
  });
});
