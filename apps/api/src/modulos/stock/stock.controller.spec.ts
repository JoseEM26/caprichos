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
import { StockController } from './stock.controller';
import { InsumosService } from './insumos.service';
import { StockService } from './stock.service';
import { RecetasService } from './recetas.service';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { AccesoGuard } from '../acceso/acceso.guard';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('StockController', () => {
  let controller: StockController;
  let insumosService: any;
  let stockService: any;
  let recetasService: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    insumosService = {
      listarLugares: jest.fn().mockResolvedValue([]),
      listar: jest.fn().mockResolvedValue([]),
      obtenerPorId: jest.fn().mockResolvedValue({ id: '1', nombre: 'Leche' }),
      crear: jest.fn().mockResolvedValue({ id: '1' }),
      actualizar: jest.fn().mockResolvedValue({ id: '1' }),
      desactivar: jest.fn().mockResolvedValue({ ok: true }),
      activar: jest.fn().mockResolvedValue({ ok: true }),
    };

    stockService = {
      obtenerExistenciasPorLugar: jest.fn().mockResolvedValue({ lugares: [], insumos: [] }),
      registrarMovimientoManual: jest.fn().mockResolvedValue({ ok: true }),
      listarMovimientos: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    recetasService = {
      listarProductosConMargen: jest.fn().mockResolvedValue({ productos: [] }),
      obtenerRecetaProducto: jest.fn().mockResolvedValue({ productoId: '1' }),
      guardarReceta: jest.fn().mockResolvedValue({ productoId: '1' }),
      quitarRecetaSabor: jest.fn().mockResolvedValue({ productoId: '1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        { provide: InsumosService, useValue: insumosService },
        { provide: StockService, useValue: stockService },
        { provide: RecetasService, useValue: recetasService },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StockController>(StockController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('receta por sabor: la lectura pasa sabor_id y quitar exige recetas/editar', async () => {
    await controller.obtenerReceta('1', '5');
    expect(recetasService.obtenerRecetaProducto).toHaveBeenCalledWith('1', '5');
    await controller.quitarRecetaSabor('1', '5', { usuario: { partyId: 1n } });
    expect(recetasService.quitarRecetaSabor).toHaveBeenCalledWith('1', '5', { partyId: 1n }, undefined);
    expect(Reflect.getMetadata(CLAVE_PERMISO, StockController.prototype.quitarRecetaSabor)).toEqual({ modulo: 'recetas', accion: 'editar' });
    expect(Reflect.getMetadata(CLAVE_PERMISO, StockController.prototype.obtenerReceta)).toEqual({ modulo: 'recetas', accion: 'ver' });
  });

  it('GET /admin/stock/lugares delega en insumosService.listarLugares', async () => {
    await controller.listarLugares();
    expect(insumosService.listarLugares).toHaveBeenCalled();
  });

  it('GET /admin/stock/insumos delega en insumosService.listar', async () => {
    await controller.listarInsumos({ q: 'café' });
    expect(insumosService.listar).toHaveBeenCalledWith({ q: 'café' });
  });

  it('POST /admin/stock/movimientos delega en stockService.registrarMovimientoManual', async () => {
    const dto = {
      insumoId: '1',
      lugarId: '2',
      tipo: 'ENTRADA' as const,
      cantidad: 10,
    };
    await controller.registrarMovimiento(dto, { usuario: mockUsuario });
    expect(stockService.registrarMovimientoManual).toHaveBeenCalledWith(
      dto,
      mockUsuario,
      undefined,
    );
  });
});
