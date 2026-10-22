import { BadRequestException, NotFoundException } from '@nestjs/common';
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
      obtenerOcrearLugarCocina: jest.fn().mockResolvedValue({ id: 11n, nombre: 'Cocina' }),
      actualizarStockInsumo: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      insumo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      lugarStock: {
        findFirst: jest.fn().mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' }),
        findUnique: jest.fn().mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' }),
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
    it('debe registrar entrada sumando al stock', async () => {
      prisma.insumo.findUnique.mockResolvedValue({ id: 1n, nombre: 'Harina', unidad_almacen: 'KG' });
      prisma.lugarStock.findFirst.mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' });
      prisma.stock.findFirst.mockResolvedValue({
        id: 5n,
        insumo_id: 1n,
        lugar_id: 10n,
        cantidad: new Prisma.Decimal('20.00'),
      });
      prisma.movimientoStock.create.mockResolvedValue({
        id: 100n,
        insumo_id: 1n,
        lugar_id: 10n,
        tipo: 'ENTRADA',
        cantidad: new Prisma.Decimal('10.00'),
        creado_en: new Date(),
        insumo: { id: 1n, nombre: 'Harina', unidad_almacen: 'KG' },
        lugar: { id: 10n, nombre: 'Almacén Principal' },
      });

      const res = await service.registrarMovimiento(
        {
          insumoId: 1,
          tipo: 'ENTRADA',
          cantidad: 10,
          origen: 'ALMACEN',
          motivo: 'Compra menor local',
        },
        mockUsuario,
      );

      expect(res).toHaveProperty('id', '100');
      expect(prisma.stock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5n },
          data: { cantidad: { increment: expect.anything() } },
        }),
      );
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
      prisma.lugarStock.findFirst.mockResolvedValue({ id: 11n, nombre: 'Cocina' });
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
  });
});
