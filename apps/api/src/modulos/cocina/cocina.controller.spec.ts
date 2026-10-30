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
import { CocinaController } from './cocina.controller';
import { ComandasService } from './comandas.service';
import { AgotadosService } from './agotados.service';
import { AltaDemandaService } from './alta-demanda.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';

describe('CocinaController', () => {
  let controller: CocinaController;
  let comandasService: any;
  let agotadosService: any;
  let altaDemandaService: any;

  beforeEach(async () => {
    comandasService = {
      listarAreas: jest.fn().mockResolvedValue([]),
      listarComandas: jest.fn().mockResolvedValue([]),
      despejar: jest.fn().mockResolvedValue({ ok: true }),
      historial: jest.fn().mockResolvedValue([]),
      devolver: jest.fn().mockResolvedValue({ ok: true }),
    };

    agotadosService = {
      listar: jest.fn().mockResolvedValue([]),
      agotar: jest.fn().mockResolvedValue({ ok: true }),
      reactivar: jest.fn().mockResolvedValue({ ok: true }),
    };

    altaDemandaService = {
      obtenerEstado: jest.fn().mockResolvedValue({ activa: false }),
      configurar: jest.fn().mockResolvedValue({ ok: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CocinaController],
      providers: [
        { provide: ComandasService, useValue: comandasService },
        { provide: AgotadosService, useValue: agotadosService },
        { provide: AltaDemandaService, useValue: altaDemandaService },
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CocinaController>(CocinaController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('GET /admin/cocina/areas delega a comandasService.listarAreas', async () => {
    await controller.listarAreas();
    expect(comandasService.listarAreas).toHaveBeenCalled();
  });

  it('GET /admin/cocina/comandas delega a comandasService.listarComandas', async () => {
    await controller.listarComandas({ area: 'Barra' });
    expect(comandasService.listarComandas).toHaveBeenCalledWith('Barra');
  });

  it('POST /admin/cocina/comandas/:pedidoId/:areaId/despejar delega a comandasService.despejar', async () => {
    const req = { usuario: { partyId: 1n, rol: 'COCINA' } };
    await controller.despejarComanda('10', '1', req);
    expect(comandasService.despejar).toHaveBeenCalledWith('10', '1', req.usuario, undefined);
  });

  it('GET /admin/cocina/historial delega a comandasService.historial', async () => {
    await controller.historial({ area: 'Cocina' });
    expect(comandasService.historial).toHaveBeenCalledWith('Cocina');
  });

  it('POST /admin/cocina/comandas/:pedidoId/:areaId/devolver delega a comandasService.devolver', async () => {
    const req = { usuario: { partyId: 1n, rol: 'COCINA' } };
    await controller.devolverComanda('10', '1', req);
    expect(comandasService.devolver).toHaveBeenCalledWith('10', '1', req.usuario, undefined);
  });

  it('GET /admin/cocina/agotados delega a agotadosService.listar', async () => {
    await controller.listarAgotados();
    expect(agotadosService.listar).toHaveBeenCalled();
  });

  it('POST /admin/cocina/agotados delega a agotadosService.agotar', async () => {
    const req = { usuario: { partyId: 1n, rol: 'COCINA' } };
    const dto = { tipo: 'PRODUCTO' as const, id: 5, duracion: 'HOY' as const };
    await controller.agotar(dto, req);
    expect(agotadosService.agotar).toHaveBeenCalledWith(dto, req.usuario, undefined);
  });

  it('POST /admin/cocina/agotados/:id/reactivar delega a agotadosService.reactivar', async () => {
    const req = { usuario: { partyId: 1n, rol: 'COCINA' } };
    await controller.reactivarAgotado('5', req);
    expect(agotadosService.reactivar).toHaveBeenCalledWith('5', req.usuario, undefined);
  });

  it('GET /admin/cocina/alta-demanda delega a altaDemandaService.obtenerEstado', async () => {
    await controller.obtenerAltaDemanda();
    expect(altaDemandaService.obtenerEstado).toHaveBeenCalled();
  });

  it('PUT /admin/cocina/alta-demanda delega a altaDemandaService.configurar', async () => {
    const req = { usuario: { partyId: 1n, rol: 'COCINA' } };
    const dto = { activa: true, minutos: 30, pausa: false };
    await controller.configurarAltaDemanda(dto, req);
    expect(altaDemandaService.configurar).toHaveBeenCalledWith(dto, req.usuario, undefined);
  });
});
