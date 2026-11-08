import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlmacenService } from './almacen.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { StockService } from '../stock/stock.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Prisma } from '@prisma/client';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('AlmacenService', () => {
  let service: AlmacenService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;
  let stockService: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMINISTRADOR',
    debeCambiar: false,
  };

  beforeEach(async () => {
    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    stockService = {
      obtenerOcrearLugarAlmacen: jest.fn().mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' }),
      obtenerOcrearLugarCocina: jest.fn().mockResolvedValue({ id: 11n, nombre: 'Salados' }),
      actualizarStockInsumo: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      // Productos por sabor: un producto sin sabores activos (la merma va por el saldo del producto, como antes)
      sabor: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      insumo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      lugarStock: {
        findFirst: jest.fn().mockImplementation(async (args: any) => {
          if (args?.where?.nombre?.contains && /salados/i.test(args.where.nombre.contains)) {
            return { id: 11n, nombre: 'Salados' };
          }
          return { id: 10n, nombre: 'Almacén Principal' };
        }),
        findUnique: jest.fn().mockImplementation(async (args: any) => {
          if (args?.where?.nombre && /salados/i.test(args.where.nombre)) {
            return { id: 11n, nombre: 'Salados' };
          }
          if (args?.where?.id === 11n) {
            return { id: 11n, nombre: 'Salados' };
          }
          return { id: 10n, nombre: 'Almacén central' };
        }),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      stock: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      movimientoStock: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      receta: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      pedidoInterno: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      cierreDia: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      produccion: {
        create: jest.fn().mockResolvedValue({ id: 99n, documento: 'PROD-0001' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      producto: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      areaCocina: {
        findFirst: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Salados' }),
        findUnique: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Salados' }),
      },
      traslado: {
        create: jest.fn().mockResolvedValue({ id: 50n }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlmacenService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
        { provide: StockService, useValue: stockService },
      ],
    }).compile();

    service = module.get<AlmacenService>(AlmacenService);
  });

  describe('registrarMovimiento', () => {
    it('debe rechazar ENTRADA manual con 409 ConflictException indicando que los ingresos van por Compras', async () => {
      await expect(
        service.registrarMovimiento(
          {
            insumoId: 1,
            tipo: 'ENTRADA',
            cantidad: 10,
            origen: 'ALMACEN',
            motivo: 'Compra menor local',
          } as any,
          mockUsuario,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'INGRESO_SOLO_COMPRAS',
          mensaje: 'Los ingresos se registran en Compras',
        },
      });
    });

    it('debe rechazar salida si el stock es insuficiente', async () => {
      prisma.insumo.findUnique.mockResolvedValue({ id: 1n, nombre: 'Harina', unidad_almacen: 'KG' });
      prisma.lugarStock.findFirst.mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' });
      prisma.stock.findFirst.mockResolvedValue({
        id: 5n,
        insumo_id: 1n,
        lugar_id: 10n,
        cantidad: new Prisma.Decimal('5.00'),
      });

      await expect(
        service.registrarMovimiento(
          {
            insumoId: 1,
            tipo: 'SALIDA',
            cantidad: 20,
            origen: 'ALMACEN',
            motivo: 'Uso en taller',
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    describe('mermas grandes (>= 10): sin código, solo por permiso y auditoría', () => {
      it('acepta la merma de 15 sin ningún código y descuenta el stock', async () => {
        prisma.insumo.findUnique.mockResolvedValue({ id: 1n, nombre: 'Harina', unidad_almacen: 'KG' });
        prisma.lugarStock.findUnique.mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' });
        prisma.lugarStock.findFirst.mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' });
        prisma.stock.findFirst.mockResolvedValue({
          id: 5n,
          insumo_id: 1n,
          lugar_id: 10n,
          cantidad: new Prisma.Decimal('50.00'),
        });
        prisma.movimientoStock.create.mockResolvedValue({
          id: 101n,
          insumo_id: 1n,
          lugar_id: 10n,
          tipo: 'MERMA',
          cantidad: new Prisma.Decimal('-15.00'),
          creado_en: new Date(),
          insumo: { id: 1n, nombre: 'Harina', unidad_almacen: 'KG' },
          lugar: { id: 10n, nombre: 'Almacén Principal' },
        });

        const res = await service.registrarMovimiento(
          { insumoId: 1, tipo: 'MERMA', cantidad: 15, origen: 'ALMACEN', motivo: 'Vencido' } as any,
          mockUsuario,
        );

        expect(res.ok).toBe(true);
        expect(prisma.movimientoStock.create).toHaveBeenCalled();
      });
    });

    it('debe registrar merma en reparto como informativa sin descontar stock (RN-CAP-126)', async () => {
      prisma.insumo.findUnique.mockResolvedValue({ id: 1n, nombre: 'Empanada', unidad_almacen: 'UNIDAD' });
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 30n, nombre: 'Reparto' });
      prisma.stock.update.mockClear();
      prisma.movimientoStock.create.mockResolvedValue({
        id: 105n,
        tipo: 'MERMA',
        cantidad: new Prisma.Decimal(0),
      });

      const res = await service.registrarMovimiento(
        {
          insumoId: 1,
          tipo: 'MERMA',
          cantidad: 2,
          origen: 'Reparto',
          motivo: 'reparto - caído de moto',
        },
        mockUsuario,
      );

      expect(res.ok).toBe(true);
      expect(prisma.stock.update).not.toHaveBeenCalled();
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'MERMA',
            cantidad: new Prisma.Decimal(0),
          }),
        }),
      );
    });
  });

  describe('anularMovimiento', () => {
    it('debe crear un movimiento inverso y actualizar el stock', async () => {
      prisma.movimientoStock.findUnique.mockResolvedValue({
        id: 100n,
        insumo_id: 1n,
        lugar_id: 10n,
        tipo: 'ENTRADA',
        cantidad: new Prisma.Decimal('10.00'),
        insumo: { id: 1n, nombre: 'Harina', unidad_almacen: 'KG' },
        lugar: { id: 10n, nombre: 'Almacén Principal' },
      });
      prisma.stock.findFirst.mockResolvedValue({
        id: 5n,
        insumo_id: 1n,
        lugar_id: 10n,
        cantidad: new Prisma.Decimal('15.00'),
      });
      prisma.movimientoStock.create.mockResolvedValue({
        id: 101n,
        tipo: 'SALIDA',
        cantidad: new Prisma.Decimal('10.00'),
      });

      const res = await service.anularMovimiento(
        100,
        'Error en digitación de entrada',
        mockUsuario,
      );

      expect(res.ok).toBe(true);
      expect(prisma.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { cantidad: { increment: expect.anything() } },
        }),
      );
    });

    it('debe revertir stock de producto cuando el movimiento original tiene producto_id', async () => {
      prisma.movimientoStock.findUnique.mockResolvedValue({
        id: 102n,
        insumo_id: null,
        producto_id: 50n,
        lugar_id: 11n,
        tipo: 'MERMA',
        cantidad: new Prisma.Decimal('-3.00'),
      });
      prisma.movimientoStock.findFirst.mockResolvedValue(null);
      prisma.movimientoStock.create.mockResolvedValue({
        id: 103n,
        tipo: 'ANULACION',
      });

      const res = await service.anularMovimiento(
        102,
        'Merma de producto mal registrada',
        mockUsuario,
      );

      expect(res.ok).toBe(true);
      expect(prisma.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { producto_id: 50n, lugar_id: 11n },
          data: { cantidad: { increment: new Prisma.Decimal('3.00') } },
        }),
      );
    });
  });

  describe('registrarProduccion', () => {
    it('debe descontar insumos de la receta e ingresar la masa/producción lista', async () => {
      prisma.receta.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Masa de Churros Tradicional',
        rinde: new Prisma.Decimal('50'),
        es_produccion: true,
        insumo_resultado_id: 99n,
        insumo_resultado: { id: 99n, nombre: 'Masa de Churros lista', unidad_almacen: 'UNIDAD' },
        producto: { id: 1n, nombre: 'Churros Tradicionales' },
        lineas: [
          {
            insumo_id: 1n,
            cantidad: new Prisma.Decimal('2'),
            insumo: { id: 1n, nombre: 'Harina', unidad_almacen: 'KG' },
          },
        ],
      });
      prisma.lugarStock.findFirst.mockImplementation(async (args: any) => {
        if (args?.where?.nombre?.contains === 'Salados') {
          return { id: 11n, nombre: 'Salados' };
        }
        return { id: 10n, nombre: 'Almacén central' };
      });
      prisma.stock.findFirst.mockResolvedValue({
        id: 20n,
        insumo_id: 1n,
        lugar_id: 11n,
        cantidad: new Prisma.Decimal('10'),
      });
      prisma.movimientoStock.create.mockResolvedValue({ id: 150n });

      const res = await service.registrarProduccion(
        {
          recetaId: 1,
          tandas: 2,
        },
        mockUsuario,
      );

      expect(res.unidades).toBe(100);
      expect(res).toHaveProperty('id');
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'PRODUCCION_CONSUMO',
          }),
        }),
      );
    });

    it('permite registrar producción por unidades con cálculo decimal exacto descontando de Cocina', async () => {
      prisma.receta.findUnique.mockResolvedValue({
        id: 1n,
        rinde: new Prisma.Decimal('10'),
        es_produccion: true,
        producto_id: 5n,
        producto: { id: 5n, nombre: 'Alfajores' },
        lineas: [
          {
            insumo_id: 1n,
            cantidad: new Prisma.Decimal('0.5'), // 0.5 kg por cada 10 alfajores
            insumo: { id: 1n, nombre: 'Maicena', unidad_almacen: 'KG' },
          },
        ],
      });
      prisma.lugarStock.findFirst.mockImplementation(async (args: any) => {
        if (args?.where?.nombre?.contains === 'Salados') {
          return { id: 11n, nombre: 'Salados' };
        }
        return { id: 10n, nombre: 'Almacén central' };
      });
      prisma.stock.findFirst.mockResolvedValue({
        id: 20n,
        insumo_id: 1n,
        lugar_id: 11n,
        cantidad: new Prisma.Decimal('5.0'),
      });
      prisma.produccion.create.mockResolvedValue({ id: 101n });
      prisma.movimientoStock.create.mockResolvedValue({ id: 201n });

      // Preparó 15 unidades: factor = 15 / 10 = 1.5; gasto = 1.5 * 0.5 = 0.75 kg
      const res = await service.registrarProduccion(
        {
          recetaId: 1,
          unidadesObtenidas: 15,
        },
        mockUsuario,
      );

      expect(res.unidades).toBe(15);
      expect(prisma.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { insumo_id: 1n, lugar_id: 11n },
          data: { cantidad: { decrement: new Prisma.Decimal(0.75) } },
        }),
      );
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'PRODUCCION_CONSUMO',
            cantidad: new Prisma.Decimal(-0.75),
            lugar_id: 11n,
          }),
        }),
      );
    });

    it('rechaza registrar producción si no hay suficiente stock en Cocina', async () => {
      prisma.receta.findUnique.mockResolvedValue({
        id: 1n,
        rinde: new Prisma.Decimal('10'),
        es_produccion: true,
        producto_id: 5n,
        producto: { id: 5n, nombre: 'Alfajores' },
        lineas: [
          {
            insumo_id: 1n,
            cantidad: new Prisma.Decimal('1.0'),
            insumo: { id: 1n, nombre: 'Harina', unidad_almacen: 'KG' },
          },
        ],
      });
      prisma.lugarStock.findFirst.mockImplementation(async (args: any) => {
        if (args?.where?.nombre?.contains === 'Salados') {
          return { id: 11n, nombre: 'Salados' };
        }
        return { id: 10n, nombre: 'Almacén central' };
      });
      // Solo hay 0.2 kg en Cocina
      prisma.stock.findFirst.mockResolvedValue({
        id: 20n,
        insumo_id: 1n,
        lugar_id: 11n,
        cantidad: new Prisma.Decimal('0.2'),
      });

      await expect(
        service.registrarProduccion(
          {
            recetaId: 1,
            unidadesObtenidas: 20, // Requiere 2.0 kg
          },
          mockUsuario,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'STOCK_MATERIA_PRIMA_INSUFICIENTE',
        },
      });
    });

    it('anularProduccion revierte exactamente las unidades y los insumos en Cocina', async () => {
      prisma.produccion.findUnique.mockResolvedValue({
        id: 101n,
        anulado_en: null,
        unidades: new Prisma.Decimal('15'),
        tandas: new Prisma.Decimal('1.5'),
        receta: {
          id: 1n,
          rinde: new Prisma.Decimal('10'),
          producto_id: 5n,
          producto: { id: 5n, nombre: 'Alfajores' },
          lineas: [
            {
              insumo_id: 1n,
              cantidad: new Prisma.Decimal('0.5'),
              insumo: { id: 1n, nombre: 'Maicena', unidad_almacen: 'KG' },
            },
          ],
        },
      });
      prisma.produccion.update.mockResolvedValue({ id: 101n, anulado_en: new Date() });
      prisma.movimientoStock.create.mockResolvedValue({ id: 301n });

      const res = await service.anularProduccion(
        101,
        'Error de lote',
        mockUsuario,
        undefined,
      );

      expect(res.ok).toBe(true);
      // Revertir producto en Cocina
      expect(prisma.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { producto_id: 5n, lugar_id: 11n },
          data: { cantidad: { decrement: new Prisma.Decimal(15) } },
        }),
      );
      // Devolver insumos en Cocina (1.5 * 0.5 = 0.75)
      expect(prisma.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { insumo_id: 1n, lugar_id: 11n },
          data: { cantidad: { increment: new Prisma.Decimal(0.75) } },
        }),
      );
    });
  });

  describe('apertura por sabor (GET y POST /admin/almacen/apertura)', () => {
    const dona = {
      id: 50n,
      nombre: 'Dona',
      controla_stock: true,
      categoria: { area_id: 3n, area: { nombre: 'Salados' } },
      sabores: [
        { id: 11n, nombre: 'Fresa', activo: true },
        { id: 12n, nombre: 'Oreo', activo: true },
      ],
    };

    beforeEach(() => {
      prisma.producto.findMany = jest.fn().mockResolvedValue([dona]);
      prisma.lugarStock.findFirst.mockImplementation(async (args: any) =>
        args?.where?.nombre?.contains === 'Salados' ? { id: 11n, nombre: 'Salados' } : { id: 10n, nombre: 'Almacén central' },
      );
      prisma.stock.findFirst.mockResolvedValue(null);
      prisma.stock.findMany = jest.fn().mockResolvedValue([]);
      prisma.movimientoStock.create.mockResolvedValue({ id: 160n });
      prisma.movimientoStock.findMany = jest.fn().mockResolvedValue([]); // «Produje hoy» del día (arrastre)
      prisma.stockSabor = {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ sabor_id: 11n, cantidad: new Prisma.Decimal('4') }]),
      };
      prisma.conteoApertura = {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ sabor_id: 11n, cantidad: new Prisma.Decimal('10'), producto_id: 50n }]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      };
      prisma.sabor = { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue({ agotado_hasta: null }), update: jest.fn() };
      prisma.agotado = { create: jest.fn(), updateMany: jest.fn() };
    });

    it('GET: un producto por sabor trae sabores con saldo y apertura, y el saldo del producto es la suma', async () => {
      const res: any = await service.obtenerApertura();
      const p = res.productos[0];
      expect(p.sabores).toEqual([
        { saborId: '11', nombre: 'Fresa', saldo: 4, aperturaHoy: true, aperturaCantidad: 10, producidoHoy: 0, quedaronAyer: 4 },
        { saborId: '12', nombre: 'Oreo', saldo: 0, aperturaHoy: false, aperturaCantidad: null, producidoHoy: 0, quedaronAyer: 0 },
      ]);
      expect(p).toMatchObject({ saldo: 4, aperturaHoy: true });
    });

    it('GET: un producto oculto no entra a la apertura (la consulta excluye oculto y los anfitriones de combo)', async () => {
      await service.obtenerApertura();
      expect(prisma.producto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { controla_stock: true, oculto: false, ofertasAlcance: { none: { tipo: 'COMBO' } } } }),
      );
    });

    it('POST: producto por sabor sin saborId: 400 SABOR_REQUERIDO; con saborId fija el saldo de ese sabor', async () => {
      await expect(
        service.registrarApertura({ items: [{ productoId: '50', cantidad: 6 }] } as any, mockUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'SABOR_REQUERIDO' } });

      await service.registrarApertura({ items: [{ productoId: '50', saborId: '11', cantidad: 6 }] } as any, mockUsuario);
      expect(prisma.stockSabor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sabor_id: 11n } }),
      );
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'AJUSTE', sabor_id: 11n, nota: 'Apertura del día' }) }),
      );
    });

    it('POST: un sabor ajeno al producto o un producto sin sabores con saborId responde 400', async () => {
      await expect(
        service.registrarApertura({ items: [{ productoId: '50', saborId: '99', cantidad: 1 }] } as any, mockUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'SABORES_INVALIDOS' } });
      prisma.producto.findMany = jest.fn().mockResolvedValue([{ ...dona, sabores: [] }]);
      await expect(
        service.registrarApertura({ items: [{ productoId: '50', saborId: '11', cantidad: 1 }] } as any, mockUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'PRODUCTO_SIN_SABORES' } });
    });
  });

  describe('stock por sabor (donas): producción, apertura y merma', () => {
    const recetaDona = (sabores: any[]) => ({
      id: 1n,
      rinde: new Prisma.Decimal('12'),
      es_produccion: true,
      producto_id: 50n,
      producto: { id: 50n, nombre: 'Dona', controla_stock: true, sabores },
      lineas: [],
    });
    const conSabores = [{ id: 11n, nombre: 'Fresa', activo: true }, { id: 12n, nombre: 'Oreo', activo: true }];

    beforeEach(() => {
      prisma.lugarStock.findFirst.mockImplementation(async (args: any) =>
        args?.where?.nombre?.contains === 'Salados' ? { id: 11n, nombre: 'Salados' } : { id: 10n, nombre: 'Almacén central' },
      );
      prisma.movimientoStock.create.mockResolvedValue({ id: 150n });
      prisma.stockSabor = {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ cantidad: new Prisma.Decimal('12') }),
      };
      prisma.sabor = { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ agotado_hasta: null }), update: jest.fn() };
      prisma.agotado = { create: jest.fn(), updateMany: jest.fn() };
    });

    it('producción de un producto por sabor exige el sabor y lo suma a ese sabor', async () => {
      prisma.receta.findUnique.mockResolvedValue(recetaDona(conSabores));
      await expect(service.registrarProduccion({ recetaId: 1, unidadesObtenidas: 12 }, mockUsuario)).rejects.toMatchObject({
        response: { codigo: 'SABOR_REQUERIDO' },
      });

      await service.registrarProduccion({ recetaId: 1, unidadesObtenidas: 12, saborId: 11 }, mockUsuario);
      expect(prisma.stockSabor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sabor_id: 11n }, update: { cantidad: { increment: new Prisma.Decimal(12) } } }),
      );
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'PRODUCCION_ALTA', sabor_id: 11n, producto_id: 50n }) }),
      );
    });

    it('producción de un sabor que no es del producto: 400 SABORES_INVALIDOS', async () => {
      prisma.receta.findUnique.mockResolvedValue(recetaDona(conSabores));
      await expect(service.registrarProduccion({ recetaId: 1, unidadesObtenidas: 12, saborId: 99 }, mockUsuario)).rejects.toMatchObject({
        response: { codigo: 'SABORES_INVALIDOS' },
      });
    });

    it('merma de un producto por sabor exige el sabor y descuenta de ese sabor', async () => {
      prisma.insumo.findUnique.mockResolvedValue(null);
      prisma.producto.findUnique.mockResolvedValue({ id: 50n, nombre: 'Dona', controla_stock: true });
      prisma.sabor.findMany.mockResolvedValue([{ id: 11n, nombre: 'Fresa', activo: true }]);
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Salados' });
      prisma.stock.findFirst.mockResolvedValue(null);
      prisma.stockSabor.update = jest.fn().mockResolvedValue({});
      await expect(
        service.mermaMultiple({ lineas: [{ insumoId: 50, cantidad: 2, origen: 'Salados', destino: 'Desecho' }] } as any, mockUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'SABOR_REQUERIDO' } });

      // La merma de productos ya no sale de aquí: se registra en Apertura del día
      await expect(
        service.mermaMultiple(
          { lineas: [{ insumoId: 50, cantidad: 2, origen: 'Salados', destino: 'Desecho', saborId: 11 }] } as any,
          mockUsuario,
        ),
      ).rejects.toMatchObject({ response: { codigo: 'MERMA_PRODUCTO_EN_APERTURA', enlace: '/admin/apertura' } });
      expect(prisma.stockSabor.update).not.toHaveBeenCalled();
      expect(prisma.movimientoStock.create).not.toHaveBeenCalled();
    });
  });

  describe('mermaMultiple (HU-CAP-095 / RN-CAP-115 / RN-CAP-117)', () => {
    it('descuenta stock atómicamente y crea movimiento MERMA con cantidad negativa', async () => {
      prisma.insumo.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Leche entera',
        unidad_almacen: 'L',
      });
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Salados' });
      prisma.stock.findFirst.mockResolvedValue({
        id: 25n,
        insumo_id: 1n,
        lugar_id: 11n,
        cantidad: new Prisma.Decimal('10.00'),
      });
      prisma.movimientoStock.create.mockResolvedValue({ id: 300n });

      const res = await service.mermaMultiple(
        {
          lineas: [
            {
              insumoId: 1,
              cantidad: 3,
              origen: 'Salados',
              destino: 'Desecho',
            },
          ],
        },
        mockUsuario,
        '127.0.0.1',
      );

      expect(res.ok).toBe(true);
      expect(res.lineasMermadas).toBe(1);
      expect(prisma.stock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 25n },
          data: { cantidad: { decrement: new Prisma.Decimal(3) } },
        }),
      );
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'MERMA',
            insumo_id: 1n,
            lugar_id: 11n,
            cantidad: new Prisma.Decimal(-3),
          }),
        }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'almacen',
          accion: 'REGISTRAR_MERMA_MULTIPLE',
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('stock:cambio', {});
    });

    it('rechaza merma cuando la cantidad excede el stock disponible (stock nunca negativo)', async () => {
      prisma.insumo.findUnique.mockResolvedValue({
        id: 2n,
        nombre: 'Donas artesanales',
        unidad_almacen: 'UNIDAD',
      });
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Salados' });
      prisma.stock.findFirst.mockResolvedValue({
        id: 26n,
        insumo_id: 2n,
        lugar_id: 11n,
        cantidad: new Prisma.Decimal('5.00'),
      });

      await expect(
        service.mermaMultiple(
          {
            lineas: [
              {
                insumoId: 2,
                cantidad: 8,
                origen: 'Salados',
                destino: 'Caída',
              },
            ],
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('un producto terminado ya no se mera aquí: 409 «se registra en Apertura del día»', async () => {
      prisma.insumo.findUnique.mockResolvedValue(null);
      prisma.producto.findUnique.mockResolvedValue({ id: 50n, nombre: 'Galletas de Avena' });
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Salados' });
      await expect(
        service.mermaMultiple({ lineas: [{ insumoId: 50, cantidad: 4, origen: 'Salados', destino: 'Personal' }] }, mockUsuario),
      ).rejects.toMatchObject({
        response: { codigo: 'MERMA_PRODUCTO_EN_APERTURA', mensaje: expect.stringContaining('Apertura del día') },
      });
      expect(prisma.movimientoStock.create).not.toHaveBeenCalled();
    });
  });

  describe('pedidos internos (HU-CAP-094)', () => {
    it('crearPedidoInterno registra el pedido con área, items y auditoría', async () => {
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 2n, nombre: 'Barra' });
      prisma.areaCocina.findUnique.mockResolvedValue({ id: 2n, nombre: 'Barra' });
      prisma.pedidoInterno.create.mockResolvedValue({
        id: 15n,
        area_id: 2n,
        estado: 'PENDIENTE',
        detalle: { items: [{ insumo: 'Leche', cantidad: 6 }] },
      });

      const res = await service.crearPedidoInterno(
        {
          area: 'Barra',
          items: [{ insumo: 'Leche', cantidad: 6, unidad: 'L' }],
          nota: 'Para el turno tarde',
        },
        mockUsuario,
        '127.0.0.1',
      );

      expect(res.ok).toBe(true);
      expect(res.id).toBe('15');
      expect(res.estado).toBe('PENDIENTE');
      expect(prisma.pedidoInterno.create).toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'almacen',
          accion: 'CREAR_PEDIDO_INTERNO',
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('almacen:pedido_interno', {
        id: '15',
        area: 'Barra',
        estado: 'PENDIENTE',
      });
    });

    it('entregarPedidoInterno descuenta de almacén central, genera traslado por recibir y actualiza pedido a ENTREGADO', async () => {
      prisma.pedidoInterno.findUnique.mockResolvedValue({
        id: 20n,
        estado: 'PENDIENTE',
        area: { id: 2n, nombre: 'Barra' },
        detalle: {
          items: [{ insumo: 'Café Grano', cantidad: 2 }],
        },
      });
      prisma.lugarStock.findUnique
        .mockResolvedValueOnce({ id: 10n, nombre: 'Almacén central' })
        .mockResolvedValueOnce({ id: 20n, nombre: 'Barra' });
      prisma.insumo.findFirst.mockResolvedValue({
        id: 5n,
        nombre: 'Café Grano',
        unidad_almacen: 'KG',
      });
      prisma.stock.findFirst.mockResolvedValue({
        id: 40n,
        insumo_id: 5n,
        lugar_id: 10n,
        cantidad: new Prisma.Decimal('30.00'),
      });
      prisma.movimientoStock.create.mockResolvedValue({ id: 500n });
      prisma.traslado.create.mockResolvedValue({ id: 80n });
      prisma.pedidoInterno.update.mockResolvedValue({ id: 20n, estado: 'ENTREGADO' });

      const res = await service.entregarPedidoInterno(20, mockUsuario, '127.0.0.1');

      expect(res.ok).toBe(true);
      expect(res.estado).toBe('ENTREGADO');
      expect(res.traslados).toBe(1);
      expect(prisma.stock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 40n },
          data: { cantidad: { decrement: new Prisma.Decimal(2) } },
        }),
      );
      expect(prisma.traslado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            insumo_id: 5n,
            destino_lugar_id: 20n,
            enviado: new Prisma.Decimal(2),
            estado: 'POR_RECIBIR',
            pedido_interno_id: 20n,
          }),
        }),
      );
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'TRASLADO_SALIDA',
            insumo_id: 5n,
            lugar_id: 10n,
            cantidad: new Prisma.Decimal(-2),
          }),
        }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ENTREGAR_PEDIDO_INTERNO',
        }),
      );
    });

    it('rechaza entregar un pedido interno que ya fue entregado', async () => {
      prisma.pedidoInterno.findUnique.mockResolvedValue({
        id: 21n,
        estado: 'ENTREGADO',
      });

      await expect(service.entregarPedidoInterno(21, mockUsuario)).rejects.toThrow(ConflictException);
    });
  });
});
