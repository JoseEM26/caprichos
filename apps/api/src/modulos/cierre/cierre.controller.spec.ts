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
import { CierreController } from './cierre.controller';
import { CierreService } from './cierre.service';
import { ControlCuadreService } from './control-cuadre.service';
import { AnalisisCierreService } from './analisis-cierre.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('CierreController', () => {
  let controller: CierreController;
  let serviceMock: any;

  const mockUsuario = {
    partyId: 101n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const mockReq = {
    usuario: mockUsuario,
    ip: '127.0.0.1',
  };

  beforeEach(async () => {
    serviceMock = {
      arqueo: jest.fn().mockResolvedValue({ resultado: 'CUADRA', intento: 1 }),
      cerrar: jest.fn().mockResolvedValue({ cajaId: 10, resultado: 'CUADRA' }),
      obtenerEsperado: jest.fn().mockResolvedValue({ cajaId: 10, efectivoEsperado: 355.0 }),
      historial: jest.fn().mockResolvedValue({ cierres: [], total: 0 }),
      listarRepartidoresPorLiquidar: jest.fn().mockResolvedValue([]),
      liquidarRepartidor: jest.fn().mockResolvedValue({ id: 1, entregado: 50 }),
      obtenerCierrePorId: jest.fn().mockResolvedValue({ cajaId: 10, resultado: 'CUADRA' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CierreController],
      providers: [
        { provide: CierreService, useValue: serviceMock },
        { provide: ControlCuadreService, useValue: {} },
        { provide: AnalisisCierreService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secret' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CierreController>(CierreController);
  });

  it('POST /admin/cierre/arqueo delega a service.arqueo', async () => {
    const dto = {
      conteo: { '200': 1 },
      medios: { yape: 50 },
    };
    const res = await controller.arqueo(dto as any, mockReq);
    expect(res).toEqual({ resultado: 'CUADRA', intento: 1 });
    expect(serviceMock.arqueo).toHaveBeenCalledWith(
      dto,
      mockUsuario,
      '127.0.0.1',
    );
  });

  it('POST /admin/cierre/cerrar delega a service.cerrar', async () => {
    const dto = { nota: 'Cierre ok' };
    const res = await controller.cerrar(dto, mockReq);
    expect(res).toEqual({ cajaId: 10, resultado: 'CUADRA' });
    expect(serviceMock.cerrar).toHaveBeenCalledWith(
      dto,
      mockUsuario,
      '127.0.0.1',
    );
  });

  it('GET /admin/cierre/esperado delega a service.obtenerEsperado', async () => {
    const res = await controller.obtenerEsperado(mockReq);
    expect(res).toEqual({ cajaId: 10, efectivoEsperado: 355.0 });
    expect(serviceMock.obtenerEsperado).toHaveBeenCalledWith(mockUsuario);
  });

  it('GET /admin/cierre/historial delega a service.historial', async () => {
    const query = { pagina: 1, limite: 10 };
    const res = await controller.historial(query, mockReq);
    expect(res).toEqual({ cierres: [], total: 0 });
    expect(serviceMock.historial).toHaveBeenCalledWith(query, mockUsuario);
  });

  it('GET /admin/cierre/repartidores delega a service.listarRepartidoresPorLiquidar', async () => {
    const res = await controller.listarRepartidores();
    expect(res).toEqual([]);
    expect(serviceMock.listarRepartidoresPorLiquidar).toHaveBeenCalled();
  });

  it('POST /admin/cierre/liquidar delega a service.liquidarRepartidor', async () => {
    const dto = { repartidorPartyId: 55, entregado: 50 };
    const res = await controller.liquidar(dto, mockReq);
    expect(res).toEqual({ id: 1, entregado: 50 });
    expect(serviceMock.liquidarRepartidor).toHaveBeenCalledWith(
      dto,
      mockUsuario,
      '127.0.0.1',
    );
  });

  it('GET /admin/cierre/:id delega a service.obtenerCierrePorId', async () => {
    const res = await controller.obtenerPorId('10', mockReq);
    expect(res).toEqual({ cajaId: 10, resultado: 'CUADRA' });
    expect(serviceMock.obtenerCierrePorId).toHaveBeenCalledWith('10', mockUsuario);
  });
});
