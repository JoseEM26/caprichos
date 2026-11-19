import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { StockService } from './stock.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const D = (n: number) => new Prisma.Decimal(n);

/** Prisma falso: el interruptor de almacén encendido y «consumir al preparar» apagado, salvo que la prueba diga otra cosa. */
function crearPrisma() {
  const prisma: any = {
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
    parametro: {
      findUnique: jest.fn(async ({ where }: any) => ({ valor: where?.clave === 'almacen_consumir_al_preparar' ? 'no' : 'si' })),
    },
    insumo: { findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, nombre: `Insumo ${where.id}`, factor_compra: D(1), factor_receta: D(1), minimo: D(0), lugar_consumo_id: 20n })) },
    lugarStock: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    stock: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 900n, cantidad: data.cantidad })),
      update: jest.fn(async ({ data }: any) => ({ id: 900n, cantidad: D(50) })),
    },
    movimientoStock: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    pedido: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    receta: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    recetaLinea: { findMany: jest.fn(async () => []) },
    ajusteOpcion: { findMany: jest.fn(async () => []) },
    productoTamano: { findFirst: jest.fn(async () => null) },
    producto: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), update: jest.fn() },
    sabor: { findMany: jest.fn(async () => []) },
    opcion: { findMany: jest.fn(async () => []) },
    agotado: { create: jest.fn(), updateMany: jest.fn() },
  };
  return prisma;
}

describe('StockService: insumos al cobrar, cortesías y regularización', () => {
  let service: StockService;
  let prisma: any;
  let auditoria: any;

  beforeEach(async () => {
    prisma = crearPrisma();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = module.get(StockService);
  });

  describe('descontarPorPedido con recetas por sabor', () => {
    it('la línea con sabor descuenta la receta de ese sabor y no la general (ni doble)', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 100n,
        estado: 'CONFIRMADO',
        party_id: 5n,
        lineas: [{ id: 201n, producto_id: 32n, cantidad: 1, tamano: null, opcionesElegidas: [], sabores: [{ sabor_id: 7n, cantidad: 1 }] }],
      });
      // Receta general: 10 g del insumo 1. Receta propia del sabor 7: 5 g del insumo 2.
      prisma.receta.findMany.mockResolvedValueOnce([
        { id: 1n, producto_id: 32n, tamano_valor_id: null, sabor_id: null, lineas: [{ insumo_id: 1n, cantidad: D(10), insumo: { id: 1n } }] },
        { id: 2n, producto_id: 32n, tamano_valor_id: null, sabor_id: 7n, lineas: [{ insumo_id: 2n, cantidad: D(5), insumo: { id: 2n } }] },
      ]);

      await service.descontarPorPedido('100');

      const insumosDescontados = prisma.movimientoStock.create.mock.calls.map((c: any) => c[0].data.insumo_id);
      expect(insumosDescontados).toEqual([2n]);
      expect(prisma.stock.create.mock.calls[0][0].data.cantidad.toString()).toBe('-5');
    });

    it('un sabor sin receta propia descuenta la general', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce({
        id: 101n,
        estado: 'CONFIRMADO',
        party_id: 5n,
        lineas: [{ id: 202n, producto_id: 32n, cantidad: 2, tamano: null, opcionesElegidas: [], sabores: [{ sabor_id: 8n, cantidad: 2 }] }],
      });
      prisma.receta.findMany.mockResolvedValueOnce([
        { id: 1n, producto_id: 32n, tamano_valor_id: null, sabor_id: null, lineas: [{ insumo_id: 1n, cantidad: D(10), insumo: { id: 1n } }] },
      ]);

      await service.descontarPorPedido('101');

      expect(prisma.movimientoStock.create.mock.calls.map((c: any) => [c[0].data.insumo_id, c[0].data.cantidad.toString()])).toEqual([[1n, '20']]);
    });
  });

  describe('descontarPorPedidoSeguro (reintento acotado y auditoría)', () => {
    it('reintenta un fallo transitorio y, si luego sale, no audita nada', async () => {
      const spy = jest.spyOn(service, 'descontarPorPedido')
        .mockRejectedValueOnce(new Error('deadlock'))
        .mockResolvedValueOnce({ ok: true, descontado: true } as any);

      const r = await service.descontarPorPedidoSeguro('77', 5n);

      expect(r).toEqual({ ok: true, descontado: true });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });

    it('tras tres fallos no lanza: deja el registro en auditoría y devuelve ok false', async () => {
      jest.spyOn(service, 'descontarPorPedido').mockRejectedValue(new Error('bd caida'));

      const r = await service.descontarPorPedidoSeguro('77', 5n);

      expect(r.ok).toBe(false);
      expect(service.descontarPorPedido).toHaveBeenCalledTimes(StockService.INTENTOS_DESCUENTO);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'stock', accion: 'DESCUENTO_INSUMOS_FALLO', resultado: 'RECHAZADO', entidadId: 77n, partyId: 5n, motivo: 'bd caida' }),
      );
    });
  });

  describe('regularizarInsumosPagados', () => {
    it('con el control apagado no busca nada', async () => {
      prisma.parametro.findUnique.mockResolvedValueOnce({ valor: 'no' });
      const r = await service.regularizarInsumosPagados();
      expect(r).toEqual({ procesados: 0, fallidos: 0, motivo: 'Control de almacén apagado' });
      expect(prisma.pedido.findMany).not.toHaveBeenCalled();
    });

    it('descuenta los pagados sin VENTA de insumos (idempotente en la consulta) y cuenta los que fallan', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([{ id: 3n }, { id: 4n }]);
      const spy = jest.spyOn(service, 'descontarPorPedidoSeguro')
        .mockResolvedValueOnce({ ok: true } as any)
        .mockResolvedValueOnce({ ok: false } as any);

      const r = await service.regularizarInsumosPagados({ dias: 7 });

      expect(r).toEqual({ procesados: 2, fallidos: 1 });
      expect(spy.mock.calls.map((c) => c[0])).toEqual([3n, 4n]);
      const where = prisma.pedido.findMany.mock.calls[0][0].where;
      expect(where.pago_estado).toBe('PAGADO');
      expect(where.movimientosStock.none).toMatchObject({ tipo: 'VENTA', insumo_id: { not: null } });
    });
  });

  describe('insumos de una cortesía separada', () => {
    it('con el control apagado no consume ni consulta recetas', async () => {
      prisma.parametro.findUnique.mockResolvedValueOnce({ valor: 'no' });
      const r = await service.descontarInsumosCortesia(prisma, { cortesiaId: 77n, productoId: 10n, cantidad: 2, por: 5n });
      expect(r).toEqual({ insumos: 0, insumosAgotados: [] });
      expect(prisma.receta.findMany).not.toHaveBeenCalled();
      expect(prisma.stock.create).not.toHaveBeenCalled();
    });

    it('con el control encendido consume la receta del producto y liga el movimiento a la cortesía', async () => {
      prisma.receta.findMany.mockResolvedValueOnce([
        { id: 1n, producto_id: 10n, tamano_valor_id: null, sabor_id: null, lineas: [{ insumo_id: 1n, cantidad: D(10), insumo: { id: 1n, nombre: 'Harina', factor_compra: D(1), factor_receta: D(1), lugar_consumo_id: 20n } }] },
      ]);

      const r = await service.descontarInsumosCortesia(prisma, { cortesiaId: 77n, productoId: 10n, cantidad: 2, por: 5n });

      expect(r.insumos).toBe(1);
      expect(prisma.stock.create.mock.calls[0][0].data).toMatchObject({ insumo_id: 1n, lugar_id: 20n });
      expect(prisma.stock.create.mock.calls[0][0].data.cantidad.toString()).toBe('-20');
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'CORTESIA', insumo_id: 1n, cortesia_id: 77n, por: 5n }),
      });
    });

    it('anular devuelve los insumos consumidos (movimiento ANULACION ligado) y reporta qué repuso', async () => {
      prisma.movimientoStock.findMany.mockResolvedValueOnce([{ id: 500n, insumo_id: 1n, lugar_id: 20n, cantidad: D(20) }]);
      prisma.stock.findFirst.mockResolvedValueOnce({ id: 9n, cantidad: D(-5) });

      const repuestos = await service.revertirInsumosCortesia(prisma, 77n, 5n);

      expect(repuestos).toEqual([1n]);
      expect(prisma.stock.update).toHaveBeenCalledWith({ where: { id: 9n }, data: { cantidad: { increment: D(20) } } });
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'ANULACION', insumo_id: 1n, cortesia_id: 77n, movimiento_anulado_id: 500n }),
      });
    });
  });
});
