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
    it('debe acumular 5% de lo pagado en productos para cliente con cuenta', async () => {
      // Pedido de S/ 70 sin envío ni cupón -> 5% = 3.50 puntos
      prismaMock.movimientoPuntos.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 101n,
        codigo: 'CP-0101',
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
  });

  describe('reversarPorPedido (RQ-CLI-02-04, RQ-CLI-02-12)', () => {
    it('revierte los puntos sumados al anular un pedido', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 101n,
        codigo: 'CP-0101',
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
