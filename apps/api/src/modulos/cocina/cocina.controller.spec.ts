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
import { AjustesPersonalesCocinaService } from './ajustes-personales.service';
import { MisAjustesCocinaDto } from './dto/mis-ajustes-cocina.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { ForbiddenException } from '@nestjs/common';

describe('CocinaController', () => {
  let controller: CocinaController;
  let comandasService: any;
  let agotadosService: any;
  let altaDemandaService: any;
  let ajustesPersonales: any;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = { userAccount: { findUnique: jest.fn().mockResolvedValue({ areasCocina: [] }) } };
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

    ajustesPersonales = {
      obtener: jest.fn().mockResolvedValue({ confirmarDespejar: true, confirmarDespejarGeneral: true, personalizado: false }),
      guardar: jest.fn().mockResolvedValue({ confirmarDespejar: false, confirmarDespejarGeneral: true, personalizado: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CocinaController],
      providers: [
        { provide: ComandasService, useValue: comandasService },
        { provide: AgotadosService, useValue: agotadosService },
        { provide: AltaDemandaService, useValue: altaDemandaService },
        { provide: AjustesPersonalesCocinaService, useValue: ajustesPersonales },
        { provide: PrismaService, useValue: prismaMock },
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
    await controller.listarAreas({ usuario: { rol: 'COCINA', roles: ['COCINA'] } });
    expect(comandasService.listarAreas).toHaveBeenCalled();
  });

  it('GET /admin/cocina/comandas delega a comandasService.listarComandas', async () => {
    await controller.listarComandas({ area: 'Barra' }, { usuario: { rol: 'COCINA', roles: ['COCINA'] } });
    expect(comandasService.listarComandas).toHaveBeenCalledWith('Barra');
  });

  it('POST /admin/cocina/comandas/:pedidoId/:areaId/despejar delega a comandasService.despejar', async () => {
    const req = { usuario: { partyId: 1n, rol: 'COCINA' } };
    await controller.despejarComanda('10', '1', req);
    expect(comandasService.despejar).toHaveBeenCalledWith('10', '1', req.usuario, undefined);
  });

  it('GET /admin/cocina/historial delega a comandasService.historial', async () => {
    await controller.historial({ area: 'Cocina' }, { usuario: { rol: 'COCINA', roles: ['COCINA'] } });
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

  describe('áreas por usuario (rol COCINA)', () => {
    const cocinaTodas = { usuario: { partyId: 1n, rol: 'COCINA', roles: ['COCINA'] } };
    const cocinaBebidas = { usuario: { partyId: 2n, rol: 'COCINA', roles: ['COCINA'] } };
    const areasApi = [{ id: '1', nombre: 'Bebidas' }, { id: '2', nombre: 'Salados' }];

    beforeEach(() => {
      comandasService.listarAreas.mockResolvedValue(areasApi);
      prismaMock.userAccount = {
        findUnique: jest.fn(async ({ where }: any) => ({
          id: 1n,
          areasCocina: where.party_id === 2n ? [{ area_id: 1n }] : [],
        })),
      };
    });

    it('COCINA sin áreas marcadas sigue viendo todas las áreas', async () => {
      expect(await controller.listarAreas(cocinaTodas)).toEqual(areasApi);
    });

    it('COCINA con Bebidas marcada solo ve Bebidas', async () => {
      expect(await controller.listarAreas(cocinaBebidas)).toEqual([{ id: '1', nombre: 'Bebidas' }]);
    });

    it('sin área pedida, recibe solo las comandas de sus áreas', async () => {
      await controller.listarComandas({} as any, cocinaBebidas);
      expect(comandasService.listarComandas).toHaveBeenCalledWith('1');
      expect(comandasService.listarComandas).not.toHaveBeenCalledWith('2');
    });

    it('no puede pedir ni despejar ni devolver otra área', async () => {
      await expect(controller.listarComandas({ area: '2' } as any, cocinaBebidas)).rejects.toThrow(ForbiddenException);
      await expect(controller.despejarComanda('10', '2', cocinaBebidas)).rejects.toThrow(ForbiddenException);
      await expect(controller.devolverComanda('10', '2', cocinaBebidas)).rejects.toThrow(ForbiddenException);
      expect(comandasService.despejar).not.toHaveBeenCalled();
      expect(comandasService.devolver).not.toHaveBeenCalled();
    });

    it('sí despeja su área', async () => {
      await controller.despejarComanda('10', '1', cocinaBebidas);
      expect(comandasService.despejar).toHaveBeenCalledWith('10', '1', cocinaBebidas.usuario, undefined);
    });

    it('un ADMIN no tiene restricción de área aunque tenga áreas guardadas', async () => {
      expect(await controller.listarAreas({ usuario: { partyId: 9n, rol: 'ADMIN' } })).toEqual(areasApi);
      expect(prismaMock.userAccount.findUnique).not.toHaveBeenCalled();
    });
  });
  describe('ajustes personales de cocina', () => {
    const cocinero = { usuario: { partyId: 7n, rol: 'COCINA', roles: ['COCINA'] } };

    it('GET ajustes devuelve el efectivo para el party del token', async () => {
      await expect(controller.obtenerAjustes(cocinero)).resolves.toMatchObject({ confirmarDespejar: true });
      expect(ajustesPersonales.obtener).toHaveBeenCalledWith(7n);
    });

    it('PUT mis-ajustes usa el usuario del token y pasa el valor del cuerpo', async () => {
      await controller.guardarMisAjustes({ confirmarDespejar: false }, cocinero);
      expect(ajustesPersonales.guardar).toHaveBeenCalledWith(cocinero.usuario, false, undefined);
    });

    it('PUT mis-ajustes acepta null (quitar la preferencia)', async () => {
      await controller.guardarMisAjustes({ confirmarDespejar: null }, cocinero);
      expect(ajustesPersonales.guardar).toHaveBeenCalledWith(cocinero.usuario, null, undefined);
    });

    it('el cuerpo valida tipos: solo true, false o null', async () => {
      const valida = async (body: unknown) =>
        (await validate(plainToInstance(MisAjustesCocinaDto, body))).length === 0;
      expect(await valida({ confirmarDespejar: true })).toBe(true);
      expect(await valida({ confirmarDespejar: false })).toBe(true);
      expect(await valida({ confirmarDespejar: null })).toBe(true);
      expect(await valida({ confirmarDespejar: 'no' })).toBe(false);
      expect(await valida({ confirmarDespejar: 1 })).toBe(false);
      expect(await valida({})).toBe(false);
    });
  });
});
