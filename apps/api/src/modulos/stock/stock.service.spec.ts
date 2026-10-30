import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from './stock.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Prisma } from '@prisma/client';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('StockService', () => {
  let service: StockService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      insumo: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      lugarStock: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      stock: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      movimientoStock: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
      },
      receta: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      recetaLinea: {
        findMany: jest.fn(),
      },
      ajusteOpcion: {
        findMany: jest.fn(),
      },
      productoTamano: {
        findFirst: jest.fn(),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sabor: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      opcion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      agotado: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  describe('motivo obligatorio en ajustes y mermas', () => {
    it('lanza MOTIVO_REQUERIDO si se registra AJUSTE sin motivo', async () => {
      await expect(
        service.registrarMovimientoManual(
          {
            insumoId: '1',
            lugarId: '2',
            tipo: 'AJUSTE',
            cantidad: 5,
            motivo: '', // vacío
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza MOTIVO_REQUERIDO si se registra MERMA sin motivo', async () => {
      await expect(
        service.registrarMovimientoManual(
          {
            insumoId: '1',
            lugarId: '2',
            tipo: 'MERMA',
            cantidad: 2,
            motivo: '   ', // sólo espacios
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('traslado atómico entre lugares', () => {
    it('ejecuta la salida de origen y la entrada a destino en una sola transacción', async () => {
      prisma.insumo.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Café en grano',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        minimo: new Prisma.Decimal(5),
      });

      prisma.lugarStock.findUnique
        .mockResolvedValueOnce({ id: 10n, nombre: 'Almacén central' })
        .mockResolvedValueOnce({ id: 20n, nombre: 'Barra' });

      // Stock en origen antes: 25 kg
      prisma.stock.findFirst
        .mockResolvedValueOnce({
          id: 101n,
          insumo_id: 1n,
          lugar_id: 10n,
          cantidad: new Prisma.Decimal(25),
        })
        // Stock en destino antes: 3 kg
        .mockResolvedValueOnce({
          id: 102n,
          insumo_id: 1n,
          lugar_id: 20n,
          cantidad: new Prisma.Decimal(3),
        });

      prisma.stock.update
        .mockResolvedValueOnce({
          id: 101n,
          cantidad: new Prisma.Decimal(20), // 25 - 5
        })
        .mockResolvedValueOnce({
          id: 102n,
          cantidad: new Prisma.Decimal(8), // 3 + 5
        });

      prisma.movimientoStock.create
        .mockResolvedValueOnce({ id: 501n, tipo: 'TRASLADO_SALIDA' })
        .mockResolvedValueOnce({ id: 502n, tipo: 'TRASLADO_ENTRADA' });

      const res = await service.registrarMovimientoManual(
        {
          insumoId: '1',
          lugarId: '10',
          lugarDestinoId: '20',
          tipo: 'TRASLADO',
          cantidad: 5,
          unidad: 'almacen',
          motivo: 'Reposición a Barra',
        },
        mockUsuario,
      );

      expect(res.ok).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'TRASLADO_SALIDA',
            lugar_id: 10n,
          }),
        }),
      );
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'TRASLADO_ENTRADA',
            lugar_id: 20n,
          }),
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('stock:cambio', {
        insumoId: '1',
        lugarId: '10',
        nuevoStock: 20,
      });
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('stock:cambio', {
        insumoId: '1',
        lugarId: '20',
        nuevoStock: 8,
      });
    });
  });

  describe('descontarPorPedido y disponibilidad', () => {
    it('es idempotente: si ya existen movimientos VENTA para el pedido, no vuelve a descontar', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce({
        id: 99n,
        tipo: 'VENTA',
        pedido_id: 77n,
      });

      const res = await service.descontarPorPedido('77');
      expect(res).toEqual({ ok: true, yaDescontado: true });
      expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    });

    it('un producto sin receta no descuenta nada ni produce error', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null); // no ventas previas
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 88n,
        estado: 'CONFIRMADO',
        lineas: [
          {
            id: 111n,
            producto_id: 999n, // producto sin receta
            cantidad: 2,
            tamano: null,
            opcionesElegidas: [],
          },
        ],
      });

      prisma.receta.findMany.mockResolvedValueOnce([]); // sin recetas

      const res = await service.descontarPorPedido('88');
      expect(res).toEqual({ ok: true, descontado: true });
      expect(prisma.stock.update).not.toHaveBeenCalled();
      expect(prisma.movimientoStock.create).not.toHaveBeenCalled();
    });

    it('descuenta insumos por receta y cuando llega a 0 marca agotado_hasta en Producto y emite evento en vivo', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null);
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 100n,
        estado: 'CONFIRMADO',
        party_id: 5n,
        lineas: [
          {
            id: 201n,
            producto_id: 32n, // Capuccino
            cantidad: 1,
            tamano: null,
            opcionesElegidas: [],
          },
        ],
      });

      // Receta con Café: 18g
      prisma.receta.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          producto_id: 32n,
          tamano_valor_id: null,
          lineas: [
            {
              insumo_id: 1n,
              cantidad: new Prisma.Decimal(18), // 18g
            },
          ],
        },
      ]);

      prisma.insumo.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Café en grano',
        factor_receta: new Prisma.Decimal(1000), // 18g / 1000 = 0.018 kg
        lugar_consumo_id: 20n,
      });

      // Stock existente de café: 0.018 kg (justo la cantidad a descontar) -> saldo final 0
      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 801n,
        insumo_id: 1n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(0.018),
      });

      prisma.stock.update.mockResolvedValueOnce({
        id: 801n,
        cantidad: new Prisma.Decimal(0), // Llegó a 0
      });

      prisma.recetaLinea.findMany.mockResolvedValueOnce([
        {
          receta: { producto_id: 32n },
        },
      ]);

      const res = await service.descontarPorPedido('100');
      expect(res.ok).toBe(true);

      // Verificamos que se actualizó agotado_hasta en el producto
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: 32n },
        data: { agotado_hasta: FECHA_HASTA_REACTIVAR },
      });

      // Verificamos que se creó registro en tabla agotado
      expect(prisma.agotado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            producto_id: 32n,
            tipo: 'PRODUCTO',
            alcance: 'HASTA_REACTIVAR',
          }),
        }),
      );

      // Verificamos que se emitió el evento carta:disponibilidad
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'carta:disponibilidad',
        expect.any(Object),
      );
    });
  });

  describe('revertirPorPedido', () => {
    it('revierte las ventas con movimiento ANULACION y repone el stock', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null); // no hay anulación previa

      prisma.movimientoStock.findMany.mockResolvedValueOnce([
        {
          id: 701n,
          tipo: 'VENTA',
          insumo_id: 1n,
          lugar_id: 20n,
          cantidad: new Prisma.Decimal(0.018),
        },
      ]);

      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 801n,
        insumo_id: 1n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(0),
      });

      prisma.stock.update.mockResolvedValueOnce({
        id: 801n,
        cantidad: new Prisma.Decimal(0.018),
      });

      const res = await service.revertirPorPedido('100');
      expect(res).toEqual({ ok: true, movimientosRevertidos: 1 });

      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ANULACION',
            insumo_id: 1n,
            lugar_id: 20n,
            cantidad: new Prisma.Decimal(0.018),
            movimiento_anulado_id: 701n,
          }),
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('stock:cambio', {
        insumoId: '1',
        lugarId: '20',
      });
    });

    it('es idempotente: si ya fue anulado previamente no duplica', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce({
        id: 999n,
        tipo: 'ANULACION',
      });

      const res = await service.revertirPorPedido('100');
      expect(res).toEqual({ ok: true, yaRevertido: true });
      expect(prisma.movimientoStock.findMany).not.toHaveBeenCalled();
    });

    it('revierte producto terminado por tanda con producto_id (DT-58)', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null);
      prisma.movimientoStock.findMany.mockResolvedValueOnce([
        {
          id: 702n,
          tipo: 'VENTA',
          insumo_id: null,
          producto_id: 55n,
          lugar_id: 20n,
          cantidad: new Prisma.Decimal(2),
        },
      ]);

      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 855n,
        producto_id: 55n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(3),
      });

      prisma.stock.update.mockResolvedValueOnce({
        id: 855n,
        cantidad: new Prisma.Decimal(5),
      });

      const res = await service.revertirPorPedido('101');
      expect(res).toEqual({ ok: true, movimientosRevertidos: 1 });
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ANULACION',
            producto_id: 55n,
            cantidad: new Prisma.Decimal(2),
          }),
        }),
      );
    });
  });

  describe('productos por tanda y alertas en descontarPorPedido (DT-58, RN-CAP-041)', () => {
    it('descuenta stock de producto terminado cuando tiene receta por tanda', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null); // sin cobro previo
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 200n,
        estado: 'PAGADO',
        party_id: 1n,
        lineas: [{ producto_id: 55n, cantidad: 2, tamano: null, area_id: null }],
      });
      prisma.lugarStock.findFirst.mockResolvedValueOnce({ id: 10n, nombre: 'Almacén central', tipo: 'ALMACEN' });
      prisma.lugarStock.findFirst.mockResolvedValueOnce({ id: 20n, nombre: 'Cocina', tipo: 'AREA' });
      prisma.lugarStock.findMany.mockResolvedValueOnce([]);
      prisma.receta.findMany.mockResolvedValueOnce([]); // sin receta unitaria
      prisma.receta.findFirst.mockResolvedValueOnce({ id: 9n, producto_id: 55n, es_produccion: true }); // receta tanda
      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 900n,
        producto_id: 55n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(10),
      });
      prisma.stock.update.mockResolvedValueOnce({
        id: 900n,
        cantidad: new Prisma.Decimal(8),
      });

      const res = await service.descontarPorPedido('200');
      expect(res.ok).toBe(true);
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'VENTA',
            producto_id: 55n,
            cantidad: new Prisma.Decimal(2),
          }),
        }),
      );
    });

    it('emite alerta stock:negativo cuando una venta deja saldo menor a cero', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null);
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 201n,
        estado: 'PAGADO',
        party_id: 1n,
        lineas: [{ producto_id: 30n, cantidad: 1, tamano: null, area_id: null }],
      });
      prisma.lugarStock.findFirst.mockResolvedValueOnce({ id: 10n, nombre: 'Almacén central', tipo: 'ALMACEN' });
      prisma.lugarStock.findFirst.mockResolvedValueOnce({ id: 20n, nombre: 'Cocina', tipo: 'AREA' });
      prisma.lugarStock.findMany.mockResolvedValueOnce([]);
      prisma.receta.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          tamano_valor_id: null,
          lineas: [{ insumo_id: 5n, cantidad: new Prisma.Decimal(100) }],
        },
      ]);
      prisma.insumo.findUnique.mockResolvedValueOnce({
        id: 5n,
        nombre: 'Leche entera',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        minimo: new Prisma.Decimal(2),
        lugar_consumo_id: 20n,
      });
      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 950n,
        insumo_id: 5n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(0.05),
      });
      prisma.stock.update.mockResolvedValueOnce({
        id: 950n,
        cantidad: new Prisma.Decimal(-0.05), // negativo!
      });
      prisma.recetaLinea.findMany.mockResolvedValueOnce([]);

      const res = await service.descontarPorPedido('201');
      expect(res.ok).toBe(true);
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'stock:negativo',
        expect.objectContaining({
          insumoId: '5',
          saldo: -0.05,
        }),
      );
    });
  });

  describe('verificarYReactivarAgotados (FT-STK-01 / RN-CAP-041)', () => {
    it('reactiva producto cuando todos sus insumos tienen stock positivo', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce({
        id: 30n,
        nombre: 'Cappuccino',
        agotado_hasta: new Date('2099-12-31T23:59:59.999Z'),
      });
      prisma.recetaLinea.findMany.mockResolvedValueOnce([
        { receta: { producto_id: 30n, es_produccion: false } },
      ]);
      prisma.recetaLinea.findMany.mockResolvedValueOnce([
        { insumo_id: 5n },
      ]);
      prisma.stock.findMany.mockResolvedValueOnce([
        { id: 950n, insumo_id: 5n, cantidad: new Prisma.Decimal(5) }, // stock > 0
      ]);

      const res = await service.verificarYReactivarAgotados(['5']);
      expect(res.reactivados).toContain('30');
      expect(prisma.producto.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 30n },
          data: { agotado_hasta: null },
        }),
      );
    });

    it('no apaga productos por tanda cuando se agota un insumo si no son de receta unitaria', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null);
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 301n,
        estado: 'PAGADO',
        party_id: 1n,
        lineas: [{ producto_id: 10n, cantidad: 1, tamano: null, area_id: null }],
      });
      prisma.lugarStock.findFirst.mockResolvedValueOnce({ id: 10n, nombre: 'Almacén central', tipo: 'ALMACEN' });
      prisma.lugarStock.findFirst.mockResolvedValueOnce({ id: 20n, nombre: 'Cocina', tipo: 'AREA' });
      prisma.lugarStock.findMany.mockResolvedValueOnce([]);
      prisma.receta.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          tamano_valor_id: null,
          lineas: [{ insumo_id: 88n, cantidad: new Prisma.Decimal(50) }],
        },
      ]);
      prisma.insumo.findUnique.mockResolvedValueOnce({
        id: 88n,
        nombre: 'Harina común',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        minimo: new Prisma.Decimal(1),
        lugar_consumo_id: 20n,
      });
      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 951n,
        insumo_id: 88n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(0.05),
      });
      prisma.stock.update.mockResolvedValueOnce({
        id: 951n,
        cantidad: new Prisma.Decimal(0), // Agotado
      });
      // Líneas que usan el insumo 88: una receta unitaria (id 10) y una de tanda (id 99, empanada)
      prisma.recetaLinea.findMany.mockResolvedValueOnce([
        { receta: { producto_id: 10n, es_produccion: false } },
        { receta: { producto_id: 99n, es_produccion: true } },
      ]);
      prisma.producto.update.mockClear();

      await service.descontarPorPedido('301');

      // Debe apagar producto 10n (receta unitaria), pero NO producto 99n (tanda)
      expect(prisma.producto.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({ agotado_hasta: expect.anything() }),
        }),
      );
      expect(prisma.producto.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99n },
        }),
      );
    });

    it('registra porUsuarioId en el movimiento ANULACION al revertir pedido', async () => {
      prisma.movimientoStock.findFirst.mockResolvedValueOnce(null);
      prisma.movimientoStock.findMany.mockResolvedValueOnce([
        {
          id: 703n,
          tipo: 'VENTA',
          insumo_id: 1n,
          lugar_id: 20n,
          cantidad: new Prisma.Decimal(1),
        },
      ]);
      prisma.stock.findFirst.mockResolvedValueOnce({
        id: 801n,
        insumo_id: 1n,
        lugar_id: 20n,
        cantidad: new Prisma.Decimal(5),
      });
      prisma.stock.update.mockResolvedValueOnce({
        id: 801n,
        cantidad: new Prisma.Decimal(6),
      });

      const res = await service.revertirPorPedido('100', undefined, '42');
      expect(res.ok).toBe(true);
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ANULACION',
            por: 42n,
          }),
        }),
      );
    });
  });
});
