import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
        findFirst: jest.fn(),
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
      producto: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      areaCocina: {
        findFirst: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Cocina' }),
        findUnique: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Cocina' }),
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

  describe('mermaMultiple (HU-CAP-095 / RN-CAP-115 / RN-CAP-117)', () => {
    it('descuenta stock atómicamente y crea movimiento MERMA con cantidad negativa', async () => {
      prisma.insumo.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Leche entera',
        unidad_almacen: 'L',
      });
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Cocina' });
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
              origen: 'Cocina',
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
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Cocina' });
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
                origen: 'Cocina',
                destino: 'Caída',
              },
            ],
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('soporta mermar productos terminados con stock (RN-CAP-115)', async () => {
      prisma.insumo.findUnique.mockResolvedValue(null);
      prisma.producto.findUnique.mockResolvedValue({
        id: 50n,
        nombre: 'Galletas de Avena',
      });
      prisma.lugarStock.findUnique.mockResolvedValue({ id: 11n, nombre: 'Cocina' });
      prisma.stock.findFirst.mockResolvedValue({
        id: 70n,
        producto_id: 50n,
        lugar_id: 11n,
        cantidad: new Prisma.Decimal('12.00'),
      });
      prisma.movimientoStock.create.mockResolvedValue({ id: 301n });

      const res = await service.mermaMultiple(
        {
          lineas: [
            {
              insumoId: 50,
              cantidad: 4,
              origen: 'Cocina',
              destino: 'Personal',
            },
          ],
        },
        mockUsuario,
      );

      expect(res.ok).toBe(true);
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'MERMA',
            producto_id: 50n,
            cantidad: new Prisma.Decimal(-4),
          }),
        }),
      );
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
