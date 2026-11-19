import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AlmacenService } from './almacen.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

/** Pruebas de los hallazgos de la auditoría de almacén: anulación por documento, cierre del día, Cocina, estados y merma. */
describe('AlmacenService: hallazgos de auditoría', () => {
  const usuario: UsuarioAutenticado = { partyId: 1n, rol: 'ADMINISTRADOR', debeCambiar: false };
  const D = (n: number | string) => new Prisma.Decimal(n);

  let prisma: any;
  let tx: any;
  let auditoria: any;
  let service: AlmacenService;

  beforeEach(() => {
    tx = {
      sabor: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      cierreDia: { create: jest.fn().mockResolvedValue({ id: 900n }) },
      stock: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 1n }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      movimientoStock: { create: jest.fn().mockResolvedValue({ id: 5n }), findFirst: jest.fn().mockResolvedValue(null) },
      pedidoInterno: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      traslado: { updateMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 50n }), update: jest.fn() },
      producto: { findUnique: jest.fn().mockResolvedValue(null) },
      insumo: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prisma = {
      $transaction: jest.fn(async (cb) => cb(tx)),
      movimientoStock: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      lugarStock: {
        findUnique: jest.fn().mockResolvedValue({ id: 11n, nombre: 'Cocina' }),
        create: jest.fn().mockResolvedValue({ id: 12n, nombre: 'Cocina' }),
      },
      pedidoInterno: { findUnique: jest.fn() },
      traslado: { findUnique: jest.fn() },
      insumo: { findUnique: jest.fn() },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new AlmacenService(prisma, auditoria);
  });

  describe('A1: anularMovimiento no toca movimientos de un documento', () => {
    const movDe = (extra: Record<string, unknown>) => ({
      id: 100n,
      insumo_id: 1n,
      producto_id: null,
      sabor_id: null,
      lugar_id: 10n,
      tipo: 'ENTRADA',
      cantidad: D('10'),
      ...extra,
    });

    it('rechaza anular un movimiento de compra y manda a Compras', async () => {
      prisma.movimientoStock.findUnique.mockResolvedValue(movDe({ compra_id: 7n }));
      await expect(service.anularMovimiento(100, 'error', usuario)).rejects.toMatchObject({
        response: { codigo: 'MOVIMIENTO_DE_DOCUMENTO' },
      });
      await expect(service.anularMovimiento(100, 'error', usuario)).rejects.toMatchObject({
        response: { mensaje: expect.stringContaining('OC-7') },
      });
      expect(tx.stock.updateMany).not.toHaveBeenCalled();
      expect(tx.movimientoStock.create).not.toHaveBeenCalled();
    });

    it('rechaza anular un movimiento de producción (PRODUCCION_ALTA) y manda a Producción', async () => {
      prisma.movimientoStock.findUnique.mockResolvedValue(movDe({ tipo: 'PRODUCCION_ALTA', produccion_id: 3n, insumo_id: null, producto_id: 9n }));
      await expect(service.anularMovimiento(100, 'error', usuario)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.anularMovimiento(100, 'error', usuario)).rejects.toMatchObject({
        response: { mensaje: expect.stringContaining('anúlala desde Producción') },
      });
      expect(tx.stock.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza anular un movimiento de traslado (TRASLADO_ENTRADA con traslado_id)', async () => {
      prisma.movimientoStock.findUnique.mockResolvedValue(movDe({ tipo: 'TRASLADO_ENTRADA', traslado_id: 50n }));
      await expect(service.anularMovimiento(100, 'error', usuario)).rejects.toMatchObject({
        response: { codigo: 'MOVIMIENTO_DE_DOCUMENTO' },
      });
      expect(tx.stock.updateMany).not.toHaveBeenCalled();
    });

    it('sigue anulando una merma suelta (sin documento)', async () => {
      prisma.movimientoStock.findUnique.mockResolvedValue(movDe({ tipo: 'MERMA', cantidad: D('-3') }));
      const res = await service.anularMovimiento(100, 'se cayó', usuario);
      expect(res.ok).toBe(true);
      expect(tx.stock.updateMany).toHaveBeenCalled();
    });
  });

  describe('A2: un cierre por día y lugar', () => {
    const CIERRE = { fecha: '2026-11-19T15:00:00.000Z', filas: [{ insumoId: '1', nombre: 'Harina', sistema: 10, contado: 10, botar: 0, destino: 'Desecho' }] };

    it('el segundo envío del mismo día responde CIERRE_YA_REGISTRADO y no descuenta nada', async () => {
      tx.cierreDia.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '6.0.0' }),
      );
      await expect(service.registrarCierreDia(CIERRE as any, usuario)).rejects.toMatchObject({
        response: { codigo: 'CIERRE_YA_REGISTRADO' },
      });
      await expect(service.registrarCierreDia(CIERRE as any, usuario)).rejects.toBeInstanceOf(ConflictException);
      expect(tx.stock.updateMany).not.toHaveBeenCalled();
      expect(tx.movimientoStock.create).not.toHaveBeenCalled();
    });

    it('la marca del cierre se escribe antes que cualquier movimiento', async () => {
      tx.stock.findMany.mockResolvedValue([{ cantidad: D('10') }]);
      await service.registrarCierreDia(CIERRE as any, usuario);
      const ordenMarca = tx.cierreDia.create.mock.invocationCallOrder[0];
      const ordenMov = tx.movimientoStock.create.mock.invocationCallOrder?.[0] ?? Infinity;
      expect(ordenMarca).toBeLessThan(ordenMov);
    });
  });

  describe('A3: la diferencia sale del saldo real del servidor', () => {
    const cierre = (contado: number, botar: number, sistemaCliente: number) => ({
      fecha: '2026-11-19T15:00:00.000Z',
      filas: [{ insumoId: '1', nombre: 'Harina', sistema: sistemaCliente, contado, botar, destino: 'Desecho' }],
    });

    it('ignora el sistema que manda el cliente y usa el saldo real leído en la transacción', async () => {
      tx.stock.findMany.mockResolvedValue([{ cantidad: D('12') }]); // real: 12, el cliente dijo 8
      await service.registrarCierreDia(cierre(10, 0, 8) as any, usuario);
      expect(tx.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'DIFERENCIA_CONTEO', cantidad: D('-2') }),
      });
      expect(tx.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cantidad: { increment: D('-2') } } }),
      );
    });

    it('merma y diferencia suman: el saldo queda en lo contado menos lo botado', async () => {
      tx.stock.findMany.mockResolvedValue([{ cantidad: D('10') }]);
      await service.registrarCierreDia(cierre(8, 3, 10) as any, usuario);
      const tipos = tx.movimientoStock.create.mock.calls.map((c: any[]) => [c[0].data.tipo, c[0].data.cantidad.toString()]);
      expect(tipos).toEqual([
        ['MERMA', '-3'],
        ['DIFERENCIA_CONTEO', '-2'],
      ]);
      expect(tx.stock.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { cantidad: { increment: D('-5') } } }));
    });

    it('un sobrante (contado mayor que el sistema) queda registrado como ajuste positivo y sube el saldo', async () => {
      tx.stock.findMany.mockResolvedValue([{ cantidad: D('5') }]);
      await service.registrarCierreDia(cierre(9, 0, 5) as any, usuario);
      expect(tx.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'AJUSTE', cantidad: D('4') }),
      });
      expect(tx.stock.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { cantidad: { increment: D('4') } } }));
    });

    it('si no hay fila de stock en Cocina para un sobrante, la crea', async () => {
      tx.stock.findMany.mockResolvedValue([]);
      tx.stock.updateMany.mockResolvedValue({ count: 0 });
      await service.registrarCierreDia(cierre(4, 0, 0) as any, usuario);
      expect(tx.stock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ insumo_id: 1n, lugar_id: 11n, cantidad: D('4') }),
      });
    });

    it('rechaza botar más de lo contado', async () => {
      await expect(service.registrarCierreDia(cierre(2, 3, 5) as any, usuario)).rejects.toMatchObject({
        response: { codigo: 'BOTAR_MAYOR_QUE_CONTEO' },
      });
    });
  });

  describe('A4: Cocina y el antiguo Salados son un solo lugar', () => {
    it('si la base aún tiene «Salados» (y no «Cocina»), el cierre usa ese lugar y no crea otro', async () => {
      prisma.lugarStock.findUnique.mockImplementation(async (args: any) =>
        args.where.nombre === 'Salados' ? { id: 77n, nombre: 'Salados' } : null,
      );
      tx.cierreDia.create.mockResolvedValue({ id: 1n });
      await service.registrarCierreDia({ filas: [{ insumoId: '1', nombre: 'x', sistema: 0, contado: 0, botar: 0, destino: 'D' }] } as any, usuario);
      expect(tx.cierreDia.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lugar_id: 77n }) }));
      expect(prisma.lugarStock.create).not.toHaveBeenCalled();
    });

    it('si no existe ninguno, crea «Cocina» (nunca «Salados»)', async () => {
      prisma.lugarStock.findUnique.mockResolvedValue(null);
      await service.registrarCierreDia({ filas: [{ insumoId: '1', nombre: 'x', sistema: 0, contado: 0, botar: 0, destino: 'D' }] } as any, usuario);
      expect(prisma.lugarStock.create).toHaveBeenCalledWith({ data: { nombre: 'Cocina', tipo: 'AREA' } });
    });
  });

  describe('A5: entrega de pedido interno y recepción de traslado son atómicas', () => {
    it('entregar: si el pedido ya no está en el estado leído, no mueve stock ni crea traslados', async () => {
      prisma.pedidoInterno.findUnique.mockResolvedValue({ id: 8n, estado: 'PENDIENTE', area: { nombre: 'Cocina' }, detalle: { items: [{ insumoId: '1', cantidad: 2 }] } });
      prisma.insumo.findUnique.mockResolvedValue({ id: 1n, nombre: 'Harina' });
      tx.pedidoInterno.updateMany.mockResolvedValue({ count: 0 });
      tx.pedidoInterno.findUnique.mockResolvedValue({ estado: 'ENTREGADO' });

      await expect(service.entregarPedidoInterno(8, usuario)).rejects.toMatchObject({
        response: { codigo: 'PEDIDO_INTERNO_YA_ENTREGADO' },
      });
      expect(tx.stock.create).not.toHaveBeenCalled();
      expect(tx.stock.updateMany).not.toHaveBeenCalled();
      expect(tx.traslado.create).not.toHaveBeenCalled();
    });

    it('entregar: la transición a ENTREGADO va condicionada al estado leído y antes del stock', async () => {
      prisma.pedidoInterno.findUnique.mockResolvedValue({ id: 8n, estado: 'PENDIENTE', area: { nombre: 'Cocina' }, detalle: { items: [{ insumoId: '1', cantidad: 2 }] } });
      tx.insumo.findUnique.mockResolvedValue({ id: 1n, nombre: 'Harina' });
      tx.pedidoInterno.updateMany.mockResolvedValue({ count: 1 });
      tx.traslado.create.mockResolvedValue({ id: 50n });
      tx.stock.findFirst.mockResolvedValue({ id: 3n, cantidad: D('10') });

      await service.entregarPedidoInterno(8, usuario);
      expect(tx.pedidoInterno.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 8n, estado: 'PENDIENTE' }, data: expect.objectContaining({ estado: 'ENTREGADO' }) }),
      );
      expect(tx.pedidoInterno.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.stock.update.mock.invocationCallOrder?.[0] ?? Infinity);
      expect(tx.traslado.create).toHaveBeenCalledTimes(1);
    });

    it('confirmar recepción: una segunda recepción no suma el stock otra vez', async () => {
      prisma.traslado.findUnique.mockResolvedValue({
        id: 5n,
        estado: 'POR_RECIBIR',
        enviado: D('10'),
        insumo_id: 1n,
        destino_lugar_id: 11n,
        destinoLugar: { id: 11n, nombre: 'Cocina' },
      });
      tx.traslado.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmarRecepcionTraslado(5, 10, usuario)).rejects.toMatchObject({
        response: { codigo: 'TRASLADO_YA_RECIBIDO' },
      });
      expect(tx.stock.create).not.toHaveBeenCalled();
      expect(tx.stock.update).not.toHaveBeenCalled();
      expect(tx.movimientoStock.create).not.toHaveBeenCalled();
    });
  });

  describe('A7: mermaMultiple no adivina si el id es insumo o producto', () => {
    const lineaInsumo = { insumoId: 50, cantidad: 2, origen: 'Cocina', destino: 'Desecho' };

    it('rechaza una línea sin insumoId ni productoId, o con los dos', async () => {
      await expect(service.mermaMultiple({ lineas: [{ cantidad: 1, origen: 'Cocina', destino: 'D' }] } as any, usuario)).rejects.toMatchObject({
        response: { codigo: 'LINEA_ITEM_INVALIDA' },
      });
      await expect(
        service.mermaMultiple({ lineas: [{ ...lineaInsumo, productoId: 50 }] } as any, usuario),
      ).rejects.toMatchObject({ response: { codigo: 'LINEA_ITEM_INVALIDA' } });
    });

    it('con insumoId no busca en productos aunque exista un producto con ese id', async () => {
      tx.insumo.findUnique.mockResolvedValue(null);
      tx.producto.findUnique.mockResolvedValue({ id: 50n, nombre: 'Dona', controla_stock: false });
      await expect(service.mermaMultiple({ lineas: [lineaInsumo] } as any, usuario)).rejects.toMatchObject({
        response: { codigo: 'ITEM_NO_ENCONTRADO' },
      });
      expect(tx.producto.findUnique).not.toHaveBeenCalled();
    });
  });
});
