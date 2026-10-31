import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PuntosService } from './puntos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('PuntosService', () => {
  let service: PuntosService;
  let prismaMock: any;
  let auditoriaMock: any;

  beforeEach(async () => {
    prismaMock = {
      customerDetail: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      movimientoPuntos: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pedidoLinea: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      partyRole: {
        findFirst: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuntosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
      ],
    }).compile();

    service = module.get<PuntosService>(PuntosService);
  });

  describe('acumularPorPedido (DT-55, RN-CAP-072)', () => {
    it('pedido de MOZO con cliente identificado por DNI: suma al cliente, no al mozo', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 110n,
        codigo: 'CP-W110',
        canal: 'MOZO',
        party_id: 55n,
        cliente_party_id: 200n,
        total: '70.00',
        envio: '0.00',
        cupon_id: null,
        cupon_emitido_id: null,
        puntos_canjeados: '0',
      });
      prismaMock.partyRole.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.party_id === 200n ? { id: 50n, party_id: 200n, customer_detail: { party_role_id: 50n, puntos: '0' } } : null),
      );
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'puntos_porcentaje', valor: 5 });
      prismaMock.pedidoLinea.findMany.mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 2, precio_unit: '35.00', subtotal: '70.00', producto: { no_suma_beneficios: false } },
      ]);

      const res = await service.acumularPorPedido(110n);

      expect(res.sumados).toBe(true);
      expect(prismaMock.partyRole.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ party_id: 200n }) }));
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ party_id: 200n, tipo: 'SUMA' }) }),
      );
    });

    it('party de puntos (sin cuenta, solo celular) suma puntos del pedido de carta', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 120n,
        canal: 'CARTA',
        party_id: null,
        cliente_party_id: 300n,
        total: '70.00',
        envio: '0.00',
        cupon_id: null,
        cupon_emitido_id: null,
        puntos_canjeados: '0',
      });
      prismaMock.partyRole.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.party_id === 300n ? { id: 60n, party_id: 300n, customer_detail: { party_role_id: 60n, puntos: '0' } } : null),
      );
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'puntos_porcentaje', valor: 5 });
      prismaMock.pedidoLinea.findMany.mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 2, precio_unit: '35.00', subtotal: '70.00', producto: { no_suma_beneficios: false } },
      ]);

      const res = await service.acumularPorPedido(120n);

      expect(res.sumados).toBe(true);
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ party_id: 300n, tipo: 'SUMA' }) }),
      );
    });

    it('pedido de MOZO sin DNI (invitado) no suma puntos aunque party_id sea el mozo', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 111n,
        canal: 'MOZO',
        party_id: 55n,
        cliente_party_id: null,
        total: '70.00',
        envio: '0.00',
        cupon_id: null,
        cupon_emitido_id: null,
      });

      const res = await service.acumularPorPedido(111n);

      expect(res.sumados).toBe(false);
      expect(prismaMock.partyRole.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    it('debe acumular 5% de lo pagado en productos para cliente con cuenta', async () => {
      // Pedido de S/ 70 sin envío ni cupón -> 5% = 3.50 puntos
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 101n,
        codigo: 'CP-0101',
        canal: 'CARTA',
        party_id: 200n,
        total: '70.00',
        envio: '0.00',
        cupon_id: null,
        cupon_emitido_id: null,
      });
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '1.50' },
      });
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'puntos_porcentaje', valor: 5 });
      prismaMock.pedidoLinea.findMany.mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 2, precio_unit: '35.00', subtotal: '70.00', producto: { no_suma_beneficios: false } },
      ]);

      const res = await service.acumularPorPedido(101n);

      expect(res.sumados).toBe(true);
      expect(res.puntos).toBe(3.5);
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            party_id: 200n,
            pedido_id: 101n,
            tipo: 'SUMA',
            puntos: 3.5,
          }),
        }),
      );
      expect(prismaMock.customerDetail.update).toHaveBeenCalled();
    });

    it('no suma puntos por productos marcados, de promoción ni con descuento; descuenta lo canjeado', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 102n,
        codigo: 'CP-0102',
        canal: 'CARTA',
        party_id: 200n,
        total: '90.00',
        envio: '0.00',
        puntos_canjeados: '10.00',
        cupon_id: null,
        cupon_emitido_id: null,
        descuento_detalle: [{ lineasAfectadas: [{ productoId: '8' }] }],
      });
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '0.00' },
      });
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'puntos_porcentaje', valor: 5 });
      prismaMock.pedidoLinea.findMany.mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 1, precio_unit: '60.00', subtotal: '60.00', producto: { no_suma_beneficios: false } },
        { id: 2n, producto_id: 8n, oferta_id: null, linea_combo_id: null, cantidad: 1, precio_unit: '20.00', subtotal: '20.00', producto: { no_suma_beneficios: false } },
        { id: 3n, producto_id: 9n, oferta_id: null, linea_combo_id: null, cantidad: 1, precio_unit: '20.00', subtotal: '20.00', producto: { no_suma_beneficios: true } },
        { id: 4n, producto_id: 6n, oferta_id: 3n, linea_combo_id: null, cantidad: 1, precio_unit: '15.00', subtotal: '15.00', producto: { no_suma_beneficios: false } },
      ]);

      const res = await service.acumularPorPedido(102n);

      // elegible: 60 (los otros tres quedan fuera) - 10 canjeados = 50 -> 5 % = 2.50
      expect(res.puntos).toBe(2.5);
    });

    it('es IDEMPOTENTE: no acumula de nuevo si ya existe movimiento SUMA', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue({
        id: 1n,
        tipo: 'SUMA',
        puntos: '3.50',
      });

      const res = await service.acumularPorPedido(101n);

      expect(res.sumados).toBe(false);
      expect(res.puntos).toBe(3.5);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    it('no acumula si el pedido fue de un invitado sin cuenta (party_id = null)', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 102n,
        party_id: null,
        total: '50.00',
      });

      const res = await service.acumularPorPedido(102n);
      expect(res.sumados).toBe(false);
      expect(res.puntos).toBe(0);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    it('no acumula si el pedido usó cupón (DT-56)', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 103n,
        party_id: 200n,
        total: '60.00',
        cupon_id: 99n,
      });

      const res = await service.acumularPorPedido(103n);
      expect(res.sumados).toBe(false);
      expect(res.puntos).toBe(0);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    it('no acumula si el pedido tiene party pero no rol CLIENTE activo', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 104n,
        codigo: 'CP-0104',
        canal: 'CARTA',
        party_id: 300n,
        total: '70.00',
        envio: '0.00',
        cupon_id: null,
        cupon_emitido_id: null,
      });
      prismaMock.partyRole.findFirst.mockResolvedValue(null);
      prismaMock.pedidoLinea.findMany.mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 2, precio_unit: '35.00', subtotal: '70.00', producto: { no_suma_beneficios: false } },
      ]);

      const res = await service.acumularPorPedido(104n);
      expect(res.sumados).toBe(false);
      expect(res.puntos).toBe(0);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    it('no acumula si el pedido usó cupón emitido (cupon_emitido_id)', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 105n,
        party_id: 200n,
        total: '60.00',
        cupon_id: null,
        cupon_emitido_id: 77n,
      });

      const res = await service.acumularPorPedido(105n);
      expect(res.sumados).toBe(false);
      expect(res.puntos).toBe(0);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });
  });

  describe('reversarPorPedido (RQ-CLI-02-04, RQ-CLI-02-12)', () => {
    it('revierte los puntos sumados al anular un pedido', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 101n,
        codigo: 'CP-0101',
        canal: 'CARTA',
        party_id: 200n,
      });
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '5.00' },
      });
      // Hubo SUMA de 3.50 y no hay REVERSA
      prismaMock.movimientoPuntos.findFirst
        .mockResolvedValueOnce({ id: 1n, tipo: 'SUMA', puntos: '3.50' }) // movSuma
        .mockResolvedValueOnce(null) // movReversa
        .mockResolvedValueOnce(null); // movCanje

      const res = await service.reversarPorPedido(101n);

      expect(res.puntosReversados).toBe(3.5);
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'REVERSA',
            puntos: 3.5,
          }),
        }),
      );
      expect(prismaMock.customerDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { puntos: 1.5 },
        }),
      );
    });

    it('devuelve los puntos canjeados al anular el pedido', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 101n,
        codigo: 'CP-0101',
        canal: 'CARTA',
        party_id: 200n,
      });
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '1.00' },
      });
      // No hubo SUMA, pero sí hubo CANJE de 2.00
      prismaMock.movimientoPuntos.findFirst
        .mockResolvedValueOnce(null) // movSuma
        .mockResolvedValueOnce(null) // movReversa
        .mockResolvedValueOnce({ id: 2n, tipo: 'CANJE', puntos: '2.00' }) // movCanje
        .mockResolvedValueOnce(null); // movDevolucion

      const res = await service.reversarPorPedido(101n);

      expect(res.puntosDevueltos).toBe(2);
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'DEVOLUCION_CANJE',
            puntos: 2,
          }),
        }),
      );
    });
  });

  describe('canjear (RQ-CLI-02-11, RQ-CLI-02-12)', () => {
    it('permite canje cuando el saldo es suficiente', async () => {
      prismaMock.customerDetail.findFirst.mockResolvedValue({ puntos: '10.00' });
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '10.00' },
      });
      prismaMock.customerDetail.update.mockResolvedValue({ puntos: '7.50' });

      const res = await service.canjear(200n, 2.5);

      expect(res.puntosCanjeados).toBe(2.5);
      expect(res.saldoRestante).toBe(7.5);
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'CANJE',
            puntos: 2.5,
          }),
        }),
      );
    });

    it('canje con pedido: el tope es el monto elegible (sin descuento ni promoción), no el total', async () => {
      prismaMock.customerDetail.findFirst.mockResolvedValue({ puntos: '100.00' });
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '100.00' },
      });
      prismaMock.customerDetail.update.mockResolvedValue({ puntos: '40.00' });
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n,
        total: '100.00',
        envio: '0.00',
        descuento_detalle: [{ lineasAfectadas: [{ productoId: '8' }] }],
      });
      prismaMock.pedidoLinea.findMany.mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 1, precio_unit: '60.00', subtotal: '60.00', producto: { no_suma_beneficios: false } },
        { id: 2n, producto_id: 8n, oferta_id: null, linea_combo_id: null, cantidad: 1, precio_unit: '40.00', subtotal: '40.00', producto: { no_suma_beneficios: false } },
      ]);

      const err = await service.canjear(200n, 65, 300n).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'TOPE_CANJE_EXCEDIDO' });

      const res = await service.canjear(200n, 60, 300n);
      expect(res.puntosCanjeados).toBe(60);
    });

    it('rechaza el canje si se piden más puntos que el saldo', async () => {
      prismaMock.customerDetail.findFirst.mockResolvedValue({ puntos: '3.50' });

      await expect(service.canjear(200n, 5)).rejects.toThrow(BadRequestException);
    });

    it('rechaza canjes negativos o cero', async () => {
      await expect(service.canjear(200n, 0)).rejects.toThrow(BadRequestException);
      await expect(service.canjear(200n, -2)).rejects.toThrow(BadRequestException);
    });
  });

  describe('ajustarManual', () => {
    it('debe ajustar puntos manualmente con motivo y registrar auditoría', async () => {
      prismaMock.partyRole.findFirst.mockResolvedValue({
        id: 50n,
        party_id: 200n,
        customer_detail: { party_role_id: 50n, puntos: '10.00' },
      });
      prismaMock.customerDetail.upsert.mockResolvedValue({ puntos: '15.00' });

      const res = await service.ajustarManual(
        200n,
        { puntos: 5, tipo: 'SUMA', motivo: 'Cortesía por fidelidad' },
        1n,
        '127.0.0.1',
      );

      expect(res.nuevoSaldo).toBe(15);
      expect(res.motivo).toBe('Cortesía por fidelidad');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          accion: 'PUNTOS_AJUSTE_MANUAL',
        }),
      );
    });

    it('exige motivo obligatorio', async () => {
      await expect(
        service.ajustarManual(200n, { puntos: 5, motivo: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
