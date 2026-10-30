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
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { CobrosService } from './cobros.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Reflector } from '@nestjs/core';

describe('CajaController', () => {
  let controller: CajaController;
  let cajaServiceMock: any;
  let cobrosServiceMock: any;

  const mockUsuario = {
    id: 2n,
    partyId: 2n,
    rol: 'CAJERO',
  };

  beforeEach(async () => {
    cajaServiceMock = {
      abrirCaja: jest.fn().mockResolvedValue({ id: '1', estado: 'ABIERTA' }),
      obtenerCajaActual: jest.fn().mockResolvedValue({ abierta: true, efectivoEsperado: 100 }),
      crearMovimiento: jest.fn().mockResolvedValue({ id: '1', tipo: 'INGRESO', monto: 20 }),
      listarMovimientos: jest.fn().mockResolvedValue([]),
      anularMovimiento: jest.fn().mockResolvedValue({ id: '1', anulado_en: new Date() }),
    };

    cobrosServiceMock = {
      cobrar: jest.fn().mockResolvedValue({ id: '1', total: 50, pago_estado: 'PAGADO' }),
      anularCobro: jest.fn().mockResolvedValue({ id: '1', pago_estado: 'PENDIENTE' }),
      listarPorCobrar: jest.fn().mockResolvedValue([]),
      marcarCoordinado: jest.fn().mockResolvedValue({ id: '1', pago_estado: 'COORDINADO' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CajaController],
      providers: [
        { provide: CajaService, useValue: cajaServiceMock },
        { provide: CobrosService, useValue: cobrosServiceMock },
        { provide: Reflector, useValue: new Reflector() },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CajaController>(CajaController);
  });

  it('abrirCaja delega a cajaService.abrirCaja con usuario e IP', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };
    const res = await controller.abrirCaja({ apertura: 100 }, req);

    expect(cajaServiceMock.abrirCaja).toHaveBeenCalledWith(
      { apertura: 100 },
      mockUsuario,
      '127.0.0.1',
    );
    expect(res).toEqual({ id: '1', estado: 'ABIERTA' });
  });

  it('obtenerCajaActual delega a cajaService.obtenerCajaActual', async () => {
    const req = { usuario: mockUsuario };
    const res = await controller.obtenerCajaActual(req);

    expect(cajaServiceMock.obtenerCajaActual).toHaveBeenCalledWith(mockUsuario);
    expect(res.abierta).toBe(true);
  });

  it('cobrar delega a cobrosService.cobrar con usuario e IP', async () => {
    const req = { usuario: mockUsuario, ip: '192.168.1.10' };
    const dto = {
      pedidoId: '10',
      pagos: [{ medio: 'EFECTIVO', monto: 50 }],
    };

    const res = await controller.cobrar(dto, req);

    expect(cobrosServiceMock.cobrar).toHaveBeenCalledWith(dto, mockUsuario, '192.168.1.10');
    expect(res.pago_estado).toBe('PAGADO');
  });

  it('anularCobro pasa el header X-Pin-Supervisor a cobrosService', async () => {
    const req = {
      usuario: mockUsuario,
      ip: '127.0.0.1',
      headers: { 'x-pin-supervisor': '123456' },
    };
    const dto = { motivo: 'Cliente desistió de la compra' };

    await controller.anularCobro('10', dto, '123456', req);

    expect(cobrosServiceMock.anularCobro).toHaveBeenCalledWith(
      '10',
      dto,
      '123456',
      mockUsuario,
      '127.0.0.1',
    );
  });

  it('crearMovimiento delega a cajaService.crearMovimiento', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };
    const dto = { tipo: 'INGRESO' as const, monto: 20, motivo: 'Caja chica' };

    await controller.crearMovimiento(dto, req);

    expect(cajaServiceMock.crearMovimiento).toHaveBeenCalledWith(dto, mockUsuario, '127.0.0.1');
  });

  it('listarMovimientos delega a cajaService.listarMovimientos', async () => {
    await controller.listarMovimientos();
    expect(cajaServiceMock.listarMovimientos).toHaveBeenCalled();
  });

  it('anularMovimiento delega a cajaService.anularMovimiento', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };
    const dto = { motivo: 'Error en monto' };

    await controller.anularMovimiento('5', dto, req);

    expect(cajaServiceMock.anularMovimiento).toHaveBeenCalledWith(
      '5',
      dto,
      mockUsuario,
      '127.0.0.1',
    );
  });

  it('listarPorCobrar delega a cobrosService.listarPorCobrar', async () => {
    const req = { usuario: mockUsuario };
    await controller.listarPorCobrar(req);

    expect(cobrosServiceMock.listarPorCobrar).toHaveBeenCalledWith(mockUsuario);
  });

  it('marcarCoordinado delega a cobrosService.marcarCoordinado con la excepción del cuerpo', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };
    const dto = { sinVoucher: { motivo: 'Cliente sin señal', pinSupervisor: '123456' } };
    await controller.marcarCoordinado('15', dto as any, req);

    expect(cobrosServiceMock.marcarCoordinado).toHaveBeenCalledWith('15', mockUsuario, '127.0.0.1', dto);
  });
});
