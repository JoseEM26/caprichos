jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comprobantes/comprobantes.service', () => ({ ComprobantesService: class {} }));

import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CobrosService } from '../cobros.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { SalonService } from '../../salon/salon.service';
import { ComprobantesService } from '../../comprobantes/comprobantes.service';

describe('CobrosService.rechazarCobroMozo', () => {
  let service: CobrosService;
  let tx: any;
  let prismaMock: any;
  let auditoriaMock: any;
  const cajero = { partyId: 20n, rol: 'CAJERO', debeCambiar: false };
  const motivo = 'El cliente no pagó todavía';

  beforeEach(async () => {
    tx = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue({
          cobro_mozo_en: new Date('2026-11-01T12:00:00Z'),
          cobro_mozo_medio: 'EFECTIVO',
          cobro_mozo_recibido: 50,
          pago_estado: 'PENDIENTE',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      comprobante: {
        findFirst: jest.fn().mockResolvedValue({ id: 7n, numero_texto: 'NV01-000001', tipo: 'NOTA_VENTA' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prismaMock = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    auditoriaMock = { registrar: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: { obtenerCliente: jest.fn() } },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: SalonService, useValue: { liberarMesasDePedido: jest.fn() } },
        { provide: ComprobantesService, useValue: { emitirParaPedido: jest.fn() } },
      ],
    }).compile();
    service = module.get<CobrosService>(CobrosService);
  });

  it('anula la nota de venta con motivo y limpia cobro_mozo_*, sin tocar pago_estado', async () => {
    const res = await service.rechazarCobroMozo('100', { motivo }, cajero, '10.0.0.1');

    expect(tx.comprobante.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: expect.objectContaining({ anulado_en: expect.any(Date), anulado_motivo: motivo }),
    });
    expect(tx.pedido.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { cobro_mozo_en: null, cobro_mozo_medio: null, cobro_mozo_party_id: null, cobro_mozo_recibido: null },
    });
    for (const [args] of tx.pedido.update.mock.calls) expect(args.data).not.toHaveProperty('pago_estado');
    expect(auditoriaMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'RECHAZAR_COBRO_MOZO', motivo, entidadId: 100n }),
    );
    expect(res).toEqual({ id: '100', cobro_mozo: null, nota_anulada: 'NV01-000001' });
  });

  it('sin nota emitida (boleta o factura pedida) solo quita la marca', async () => {
    tx.comprobante.findFirst.mockResolvedValue(null);
    const res = await service.rechazarCobroMozo('100', { motivo }, cajero);
    expect(tx.comprobante.update).not.toHaveBeenCalled();
    expect(res.nota_anulada).toBeNull();
  });

  it('motivo corto: 400 y no toca nada', async () => {
    await expect(service.rechazarCobroMozo('100', { motivo: 'no' }, cajero)).rejects.toThrow(HttpException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('pedido ya cobrado o sin envío del mozo: 409 COBRO_MOZO_NO_VIGENTE', async () => {
    tx.pedido.findUnique.mockResolvedValue({ cobro_mozo_en: null, pago_estado: 'PENDIENTE' });
    await expect(service.rechazarCobroMozo('100', { motivo }, cajero)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.comprobante.update).not.toHaveBeenCalled();
  });
});
