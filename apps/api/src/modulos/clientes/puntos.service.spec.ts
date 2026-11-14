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
        create: jest.fn(),
      },
      party: {
        findUnique: jest.fn().mockResolvedValue({ id: 200n }),
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

    it('pedido con el descuento del equipo (PERSONAL) no suma puntos', async () => {
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 130n, canal: 'CARTA', party_id: null, cliente_party_id: 300n, total: '52.50', envio: '0.00',
        cupon_id: null, cupon_emitido_id: null, puntos_canjeados: '0',
        descuento_detalle: [{ tipo: 'PERSONAL', montoDescontado: 17.5 }],
      });
      const res = await service.acumularPorPedido(130n);
      expect(res).toMatchObject({ sumados: false, puntos: 0, motivoNo: 'PERSONAL' });
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
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
      prismaMock.movimientoPuntos.findFirst
        .mockResolvedValueOnce({ id: 1n, tipo: 'SUMA', ciclo: 1, puntos: '3.50' }) // última SUMA
        .mockResolvedValueOnce(null); // sin REVERSA: el cobro sigue vigente

      const res = await service.acumularPorPedido(101n);

      expect(res.sumados).toBe(false);
      expect(res.puntos).toBe(3.5);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    describe('re-cobro suma de nuevo (cobro vigente = ciclo)', () => {
      const pedidoCobrado = (extra: any = {}) => ({
        id: 130n, codigo: 'CP-0130', canal: 'CAJA', party_id: 55n, cliente_party_id: 200n, total: '70.00', envio: '0.00',
        cupon_id: null, cupon_emitido_id: null, puntos_canjeados: '0', pago_estado: 'PAGADO', estado: 'ENTREGADO', ...extra,
      });
      const preparar = (pedido: any) => {
        prismaMock.pedido.findUnique.mockResolvedValue(pedido);
        prismaMock.partyRole.findFirst.mockResolvedValue({ id: 50n, party_id: 200n, customer_detail: { party_role_id: 50n, puntos: '0' } });
        prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'puntos_porcentaje', valor: 5 });
        prismaMock.pedidoLinea.findMany.mockResolvedValue([
          { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, cantidad: 2, precio_unit: '35.00', subtotal: '70.00', producto: { no_suma_beneficios: false } },
        ]);
      };

      it('cobro, anular cobro y cobrar de nuevo: la SUMA reversada abre el ciclo 2', async () => {
        preparar(pedidoCobrado());
        prismaMock.movimientoPuntos.findFirst
          .mockResolvedValueOnce({ id: 1n, tipo: 'SUMA', ciclo: 1, puntos: '3.50' })
          .mockResolvedValueOnce({ id: 2n, tipo: 'REVERSA', ciclo: 1, puntos: '3.50' });
        const res = await service.acumularPorPedido(130n);
        expect(res.sumados).toBe(true);
        expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ tipo: 'SUMA', ciclo: 2, puntos: 3.5 }) }),
        );
      });

      it('cobro doble por reintento: con el ciclo 2 vigente no suma otra vez', async () => {
        preparar(pedidoCobrado());
        prismaMock.movimientoPuntos.findFirst
          .mockResolvedValueOnce({ id: 3n, tipo: 'SUMA', ciclo: 2, puntos: '3.50' })
          .mockResolvedValueOnce(null);
        const res = await service.acumularPorPedido(130n);
        expect(res).toMatchObject({ sumados: false, motivoNo: 'YA_SUMADO' });
        expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
      });

      it('carrera: el único (pedido, tipo, ciclo) rechaza el segundo SUMA y se trata como YA_SUMADO', async () => {
        preparar(pedidoCobrado());
        prismaMock.movimientoPuntos.findFirst
          .mockResolvedValueOnce({ id: 1n, tipo: 'SUMA', ciclo: 1, puntos: '3.50' })
          .mockResolvedValueOnce({ id: 2n, tipo: 'REVERSA', ciclo: 1, puntos: '3.50' });
        prismaMock.movimientoPuntos.create.mockRejectedValueOnce({ code: 'P2002' });
        const res = await service.acumularPorPedido(130n);
        expect(res).toMatchObject({ sumados: false, motivoNo: 'YA_SUMADO' });
      });

      it('pedido anulado (o ya no pagado) con SUMA reversada: no vuelve a sumar', async () => {
        for (const extra of [{ estado: 'ANULADO' }, { pago_estado: 'PENDIENTE' }]) {
          prismaMock.movimientoPuntos.create.mockClear();
          preparar(pedidoCobrado(extra));
          prismaMock.movimientoPuntos.findFirst
            .mockResolvedValueOnce({ id: 1n, tipo: 'SUMA', ciclo: 1, puntos: '3.50' })
            .mockResolvedValueOnce({ id: 2n, tipo: 'REVERSA', ciclo: 1, puntos: '3.50' });
          const res = await service.acumularPorPedido(130n);
          expect(res.sumados).toBe(false);
          expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
        }
      });

      it('reversar tras el ciclo 2 crea la REVERSA del ciclo 2 (anulación del pedido completo o reprogramación)', async () => {
        prismaMock.pedido.findUnique.mockResolvedValue(pedidoCobrado());
        prismaMock.partyRole.findFirst.mockResolvedValue({ id: 50n, party_id: 200n, customer_detail: { party_role_id: 50n, puntos: '3.50' } });
        prismaMock.movimientoPuntos.findFirst
          .mockResolvedValueOnce({ id: 3n, tipo: 'SUMA', ciclo: 2, puntos: '3.50' })
          .mockResolvedValueOnce(null) // sin REVERSA del ciclo 2
          .mockResolvedValueOnce(null); // sin canje
        const res = await service.reversarPorPedido(130n);
        expect(res.puntosReversados).toBe(3.5);
        expect(prismaMock.movimientoPuntos.findFirst).toHaveBeenNthCalledWith(2, { where: { pedido_id: 130n, tipo: 'REVERSA', ciclo: 2 } });
        expect(prismaMock.movimientoPuntos.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ tipo: 'REVERSA', ciclo: 2 }) }),
        );
      });
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
    it('anular solo el COBRO (conservarCanje) no devuelve los puntos canjeados: el pedido sigue con su descuento', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ id: 101n, codigo: 'CP-0101', canal: 'CARTA', party_id: 200n });
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 50n, party_id: 200n, customer_detail: { party_role_id: 50n, puntos: '5.00' } });
      prismaMock.movimientoPuntos.findFirst
        .mockResolvedValueOnce(null) // movSuma
        .mockResolvedValueOnce(null) // movReversa
        .mockResolvedValueOnce({ id: 2n, tipo: 'CANJE', puntos: '10.00' }) // movCanje
        .mockResolvedValueOnce(null); // movDevolucion

      const res = await service.reversarPorPedido(101n, { conservarCanje: true });

      expect(res.puntosDevueltos).toBe(0);
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

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

    it('con la transacción del pedido (tx) todo ocurre dentro de ella: no abre otra transacción', async () => {
      prismaMock.customerDetail.findFirst.mockResolvedValue({ puntos: '10.00' });
      const tx: any = {
        pedido: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        partyRole: { findFirst: jest.fn().mockResolvedValue({ id: 50n, party_id: 200n, customer_detail: { party_role_id: 50n, puntos: '10.00' } }) },
        movimientoPuntos: { create: jest.fn() },
        customerDetail: { update: jest.fn().mockResolvedValue({ puntos: '7.50' }) },
      };
      prismaMock.$transaction.mockClear();

      const res = await service.canjear(200n, 2.5, 300n, tx);

      expect(res.saldoRestante).toBe(7.5);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(tx.movimientoPuntos.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: 'CANJE', pedido_id: 300n }) }));
      expect(tx.pedido.update).toHaveBeenCalledWith({ where: { id: 300n }, data: { puntos_canjeados: 2.5 } });
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

    it('dos canjes simultáneos: si el saldo ya no alcanza al descontar, PUNTOS_INSUFICIENTES (nunca saldo negativo)', async () => {
      prismaMock.customerDetail.findFirst.mockResolvedValue({ puntos: '10.00' });
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 50n, party_id: 200n, customer_detail: { party_role_id: 50n, puntos: '10.00' } });
      prismaMock.customerDetail.update.mockRejectedValue(Object.assign(new Error('no record'), { code: 'P2025' }));

      const err = await service.canjear(200n, 8).catch((e) => e);

      expect(err.getResponse()).toMatchObject({ codigo: 'PUNTOS_INSUFICIENTES' });
      // el descuento se pide condicionado al saldo
      expect(prismaMock.customerDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { party_role_id: 50n, puntos: { gte: 8 } } }),
      );
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
    it('suma con motivo de 4+ letras, deja antes/después en la auditoría', async () => {
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 50n, party_id: 200n, hasta: null });
      prismaMock.customerDetail.upsert.mockResolvedValue({ puntos: '10.00' });
      prismaMock.customerDetail.update.mockResolvedValue({ puntos: '15.00' });

      const res = await service.ajustarManual(200n, { puntos: 5, tipo: 'SUMA', motivo: 'Cortesía por fidelidad' }, 1n, '127.0.0.1');

      expect(res.nuevoSaldo).toBe(15);
      expect(prismaMock.movimientoPuntos.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PUNTOS_AJUSTE_MANUAL',
          antes: { saldo: 10 },
          despues: expect.objectContaining({ nuevoSaldo: 15 }),
        }),
      );
    });

    it('cliente sin rol CLIENTE (o desactivado) se ajusta creando el rol y el detalle', async () => {
      prismaMock.partyRole.findFirst.mockResolvedValue(null);
      prismaMock.partyRole.create.mockResolvedValue({ id: 77n, party_id: 200n });
      prismaMock.customerDetail.upsert.mockResolvedValue({ puntos: '0' });
      prismaMock.customerDetail.update.mockResolvedValue({ puntos: '8.00' });

      const res = await service.ajustarManual(200n, { puntos: 8, motivo: 'Premio manual' }, 1n);

      expect(prismaMock.partyRole.create).toHaveBeenCalledWith({ data: { party_id: 200n, rol: 'CLIENTE' } });
      expect(prismaMock.partyRole.findFirst.mock.calls[0][0].where).toEqual({ party_id: 200n, rol: 'CLIENTE' });
      expect(res.nuevoSaldo).toBe(8);
    });

    it('restar más que el saldo: PUNTOS_INSUFICIENTES y no registra movimiento', async () => {
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 50n, party_id: 200n });
      prismaMock.customerDetail.upsert.mockResolvedValue({ puntos: '3' });
      await expect(service.ajustarManual(200n, { puntos: 5, tipo: 'REVERSA', motivo: 'Corrección' })).rejects.toMatchObject({
        response: { codigo: 'PUNTOS_INSUFICIENTES' },
      });
      expect(prismaMock.movimientoPuntos.create).not.toHaveBeenCalled();
    });

    it('motivo de 3 letras o vacío: MOTIVO_REQUERIDO (mínimo 4)', async () => {
      for (const motivo of ['', 'abc']) {
        await expect(service.ajustarManual(200n, { puntos: 5, motivo })).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
      }
    });
  });
});
