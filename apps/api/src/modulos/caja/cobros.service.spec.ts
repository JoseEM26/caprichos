// El gateway importa @nestjs/jwt (ESM): en las pruebas unitarias basta con un mock
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../comprobantes/comprobantes.service', () => ({ ComprobantesService: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { CobrosService } from './cobros.service';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

describe('CobrosService', () => {
  let service: CobrosService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;
  let salonMock: any;
  let comprobantesMock: any;

  const cajeroUsuario = {
    id: 2n,
    partyId: 2n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const adminUsuario = {
    id: 1n,
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    redisClientMock = {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    redisServiceMock = {
      obtenerCliente: jest.fn().mockReturnValue(redisClientMock),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    salonMock = { liberarMesasDePedido: jest.fn().mockResolvedValue(0) };
    comprobantesMock = { emitirParaPedido: jest.fn().mockResolvedValue({ id: '1' }) };
    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    prismaMock = {
      caja: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      pedido: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      cobro: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
      },
      cobroPago: {
        deleteMany: jest.fn(),
      },
      userAccount: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prismaMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: SalonService, useValue: salonMock },
        { provide: ComprobantesService, useValue: comprobantesMock },
      ],
    }).compile();

    service = module.get<CobrosService>(CobrosService);
  });

  describe('cobrar', () => {
    const cajaAbiertaMock = {
      id: 10n,
      fecha: new Date('2026-10-21T00:00:00.000Z'),
      estado: 'ABIERTA',
    };

    const pedidoMock = {
      id: 100n,
      codigo: 'CP-0100',
      total: new Prisma.Decimal(50.0),
      estado: 'ENTREGADO',
      pago_estado: 'PENDIENTE',
      pago_metodo: null,
      es_personal: false,
      cobro: null,
    };

    it('caja cerrada no cobra -> 409 CAJA_CERRADA si no hay caja abierta hoy', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 50 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'CAJA_CERRADA' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('sin caja de hoy pero con una de otro día abierta, dice que hay que cerrarla (no «abre la caja»)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);
      prismaMock.caja.findFirst.mockResolvedValue({ id: 7n, fecha: new Date('2026-10-22T00:00:00.000Z'), estado: 'ABIERTA' });

      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'CAJA_ANTERIOR_SIN_CERRAR' } });
    });

    it('caja cerrada no cobra -> 409 CAJA_CERRADA si la caja está en estado CERRADA', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'CERRADA',
      });

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 50 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'CAJA_CERRADA' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('pedido no encontrado -> 404 PEDIDO_NO_ENCONTRADO', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue(null);

      await expect(
        service.cobrar(
          {
            pedidoId: '999',
            pagos: [{ medio: 'EFECTIVO', monto: 50 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'PEDIDO_NO_ENCONTRADO' }),
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('pedido anulado no se cobra -> 409 PEDIDO_ANULADO', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        estado: 'ANULADO',
      });

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 50 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'PEDIDO_ANULADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('doble cobro -> 409 YA_COBRADO si pedido ya figura PAGADO', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        pago_estado: 'PAGADO',
      });

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 50 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'YA_COBRADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('doble cobro -> 409 YA_COBRADO si pedido ya tiene cobro activo registrado', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        cobro: { id: 50n, anulado_en: null },
      });

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 50 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'YA_COBRADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('pago que no cuadra -> 400 PAGO_NO_CUADRA con la diferencia reportada', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock); // total = 50

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 45 }], // Faltan 5 soles
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PAGO_NO_CUADRA',
            diferencia: -5,
          }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('efectivo insuficiente -> 400 EFECTIVO_INSUFICIENTE si recibido < monto', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock); // total = 50

      await expect(
        service.cobrar(
          {
            pedidoId: '100',
            pagos: [{ medio: 'EFECTIVO', monto: 50, recibido: 40 }],
          },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'EFECTIVO_INSUFICIENTE' }),
          status: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('vuelto correcto en pago en efectivo', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock); // total = 50

      prismaMock.cobro.create.mockResolvedValue({
        id: 77n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [
          {
            id: 1n,
            medio: 'EFECTIVO',
            monto: new Prisma.Decimal(50.0),
            recibido: new Prisma.Decimal(100.0),
            vuelto: new Prisma.Decimal(50.0),
          },
        ],
      });

      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        pago_estado: 'PAGADO',
        pago_metodo: 'EFECTIVO',
      });

      const res = await service.cobrar(
        {
          pedidoId: '100',
          pagos: [{ medio: 'EFECTIVO', monto: 50, recibido: 100 }],
        },
        cajeroUsuario,
      );

      expect(res.id).toBe('77');
      expect(res.pago_metodo).toBe('EFECTIVO');
      expect(res.pago_estado).toBe('PAGADO');
      expect(res.pagos[0].vuelto).toBe(50.0);
      expect(res.pagos[0].recibido).toBe(100.0);
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:pago', {
        id: '100',
        codigo: 'CP-0100',
      });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'caja',
          accion: 'COBRAR',
          resultado: 'OK',
        }),
      );
    });

    it('pago mixto -> asigna MIXTO, calcula vuelto solo sobre el efectivo y procesa la transacción', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        total: new Prisma.Decimal(80.0),
      });

      prismaMock.cobro.create.mockResolvedValue({
        id: 88n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(80.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [
          {
            id: 10n,
            medio: 'YAPE',
            monto: new Prisma.Decimal(50.0),
            recibido: null,
            vuelto: null,
          },
          {
            id: 11n,
            medio: 'EFECTIVO',
            monto: new Prisma.Decimal(30.0),
            recibido: new Prisma.Decimal(50.0),
            vuelto: new Prisma.Decimal(20.0),
          },
        ],
      });

      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        pago_estado: 'PAGADO',
        pago_metodo: 'MIXTO',
      });

      const res = await service.cobrar(
        {
          pedidoId: '100',
          pagos: [
            { medio: 'YAPE', monto: 50 },
            { medio: 'EFECTIVO', monto: 30, recibido: 50 },
          ],
        },
        cajeroUsuario,
      );

      expect(res.id).toBe('88');
      expect(res.pago_metodo).toBe('MIXTO');
      expect(res.pagos).toHaveLength(2);
      expect(res.pagos[1].vuelto).toBe(20.0);
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pago_estado: 'PAGADO',
            pago_metodo: 'MIXTO',
          }),
        }),
      );
    });

    it('al cobrar genera la nota de venta y si eso falla el cobro igual queda registrado', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock });
      prismaMock.cobro.create.mockResolvedValue({
        id: 32n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [{ id: 41n, medio: 'YAPE', monto: new Prisma.Decimal(50.0), recibido: null, vuelto: null }],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'YAPE' });
      comprobantesMock.emitirParaPedido.mockRejectedValue(new Error('serie sin configurar'));

      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'YAPE', monto: 50 }] }, cajeroUsuario);

      expect(res.id).toBe('32');
      expect(comprobantesMock.emitirParaPedido).toHaveBeenCalledWith(100n, undefined, cajeroUsuario);
    });

    it('al cobrar libera las mesas del pedido y si falla el cobro igual queda registrado', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock });
      prismaMock.cobro.create.mockResolvedValue({
        id: 31n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [{ id: 40n, medio: 'YAPE', monto: new Prisma.Decimal(50.0), recibido: null, vuelto: null }],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'YAPE' });
      salonMock.liberarMesasDePedido.mockRejectedValue(new Error('falló al liberar'));

      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'YAPE', monto: 50 }] }, cajeroUsuario);

      expect(res.id).toBe('31');
      expect(salonMock.liberarMesasDePedido).toHaveBeenCalledWith(100n);
    });

    it('cobrar de nuevo un pedido cuyo cobro fue anulado -> reemplaza el cobro anulado (un cobro por pedido)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        cobro: { id: 7n, anulado_en: new Date('2026-10-21T20:00:00.000Z') },
      });
      prismaMock.cobro.create.mockResolvedValue({
        id: 9n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [{ id: 20n, medio: 'YAPE', monto: new Prisma.Decimal(50.0), recibido: null, vuelto: null }],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'YAPE' });

      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'YAPE', monto: 50 }] }, cajeroUsuario);

      expect(res.id).toBe('9');
      expect(prismaMock.cobroPago.deleteMany).toHaveBeenCalledWith({ where: { cobro_id: 7n } });
      expect(prismaMock.cobro.delete).toHaveBeenCalledWith({ where: { id: 7n } });
      expect(prismaMock.cobro.create).toHaveBeenCalledTimes(1);
    });

    it('soporta firma contractual cobrar(pedidoId, pagos, usuario)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      prismaMock.cobro.create.mockResolvedValue({
        id: 99n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [
          {
            id: 1n,
            medio: 'PLIN',
            monto: new Prisma.Decimal(50.0),
            recibido: null,
            vuelto: null,
          },
        ],
      });

      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        pago_estado: 'PAGADO',
        pago_metodo: 'PLIN',
      });

      const res = await service.cobrar(
        100n,
        [{ medio: 'PLIN', monto: 50 }],
        cajeroUsuario,
      );

      expect(res.pago_metodo).toBe('PLIN');
      expect(res.pago_estado).toBe('PAGADO');
    });
  });

  describe('anularCobro', () => {
    let pinSupervisorHash: string;

    beforeAll(async () => {
      pinSupervisorHash = await argon2.hash('123456');
    });

    beforeEach(() => {
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 1n,
          party_id: 1n,
          rol: 'ADMIN',
          activo: true,
          pin_hash: pinSupervisorHash,
        },
      ]);
    });

    it('anular sin pin -> 403 PIN_INVALIDO y audita PIN_FALLIDO', async () => {
      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Error en cobro del pedido' },
          undefined,
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'PIN_INVALIDO' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'caja',
          accion: 'PIN_FALLIDO',
          resultado: 'RECHAZADO',
        }),
      );
    });

    it('anular con pin incorrecto -> 403 PIN_INVALIDO', async () => {
      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Error en cobro del pedido' },
          '999999',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'PIN_INVALIDO' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );
    });

    it('3 fallos de PIN bloquean 5 min en Redis -> 403 PIN_BLOQUEADO', async () => {
      redisClientMock.get.mockResolvedValue('3');

      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Error en cobro del pedido' },
          '123456',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'PIN_BLOQUEADO' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );
    });

    it('motivo menor a 5 caracteres -> 400 MOTIVO_REQUERIDO', async () => {
      await expect(
        service.anularCobro(
          '10',
          { motivo: 'err' },
          '123456',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'MOTIVO_REQUERIDO' }),
        }),
      );
    });

    it('anular cobro inexistente -> 404 COBRO_NO_ENCONTRADO', async () => {
      prismaMock.cobro.findUnique.mockResolvedValue(null);

      await expect(
        service.anularCobro(
          '999',
          { motivo: 'Error al digitar comprobante' },
          '123456',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'COBRO_NO_ENCONTRADO' }),
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('anular cobro de caja ya cerrada -> 409 CAJA_CERRADA (RN-CAP-096)', async () => {
      prismaMock.cobro.findUnique.mockResolvedValue({
        id: 10n,
        pedido_id: 100n,
        anulado_en: null,
        caja: { estado: 'CERRADA' },
      });

      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Error al digitar comprobante' },
          '123456',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'CAJA_CERRADA' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('anular cobro ya anulado -> 409 COBRO_YA_ANULADO', async () => {
      prismaMock.cobro.findUnique.mockResolvedValue({
        id: 10n,
        pedido_id: 100n,
        anulado_en: new Date(),
        caja: { estado: 'ABIERTA' },
      });

      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Segundo intento de anulacion' },
          '123456',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'COBRO_YA_ANULADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('anula exitosamente con PIN supervisor, revierte pedido a PENDIENTE y audita', async () => {
      prismaMock.cobro.findUnique
        .mockResolvedValueOnce({ caja_id: 10n })
        .mockResolvedValueOnce({
          id: 10n,
          pedido_id: 100n,
          anulado_en: null,
          caja: { estado: 'ABIERTA' },
          pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(50), recibido: null, vuelto: null }],
        });

      prismaMock.pedido.update.mockResolvedValue({
        id: 100n,
        pago_estado: 'PENDIENTE',
      });

      const res = await service.anularCobro(
        '10',
        { motivo: 'Cliente solicitó cambio de medio de pago' },
        '123456',
        cajeroUsuario,
      );

      expect(res.id).toBe('10');
      expect(res.pago_estado).toBe('PENDIENTE');
      expect(res.motivo_anulacion).toBe('Cliente solicitó cambio de medio de pago');
      expect(redisClientMock.del).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'caja',
          accion: 'ANULAR_COBRO',
          resultado: 'OK',
          conPinAdmin: true,
          despues: expect.objectContaining({ aprobado_por: '1' }),
        }),
      );
    });
  });

  describe('listarPorCobrar', () => {
    it('lista pedidos CARTA/BOT por cobrar y enmascara DNI para cajero', async () => {
      const fechaBase = new Date(Date.now() - 10 * 60 * 1000); // 10 minutos atrás

      prismaMock.pedido.findMany.mockResolvedValue([
        {
          id: 5n,
          codigo: 'CP-C005',
          canal: 'CARTA',
          modalidad: 'LLEVAR',
          estado: 'PREPARANDO',
          pago_estado: 'PENDIENTE',
          pago_metodo: null,
          total: new Prisma.Decimal(45.0),
          cliente_nombre: 'María López',
          cliente_telefono: '987654321',
          comprobante_tipo: 'BOLETA',
          comprobante_doc: '45678912',
          comprobante_razon: null,
          creado_en: fechaBase,
        },
      ]);

      const res = await service.listarPorCobrar(cajeroUsuario);

      expect(res).toHaveLength(1);
      expect(res[0].codigo).toBe('CP-C005');
      expect(res[0].comprobante_doc).toBe('45****12'); // Enmascarado
      expect(res[0].minutosEspera).toBeGreaterThanOrEqual(9);
    });

    it('no enmascara DNI para usuario ADMIN', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        {
          id: 5n,
          codigo: 'CP-C005',
          canal: 'CARTA',
          modalidad: 'LLEVAR',
          estado: 'PREPARANDO',
          pago_estado: 'PENDIENTE',
          pago_metodo: null,
          total: new Prisma.Decimal(45.0),
          cliente_nombre: 'María López',
          cliente_telefono: '987654321',
          comprobante_tipo: 'BOLETA',
          comprobante_doc: '45678912',
          comprobante_razon: null,
          creado_en: new Date(),
        },
      ]);

      const res = await service.listarPorCobrar(adminUsuario);

      expect(res).toHaveLength(1);
      expect(res[0].comprobante_doc).toBe('45678912'); // Sin enmascarar para ADMIN
    });
  });

  describe('marcarCoordinado', () => {
    it('marca pago como COORDINADO y audita', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n,
        codigo: 'CP-W020',
        estado: 'COLA',
        pago_estado: 'PENDIENTE',
      });

      prismaMock.pedido.update.mockResolvedValue({
        id: 20n,
        codigo: 'CP-W020',
        pago_estado: 'COORDINADO',
        pago_coordinado_en: new Date(),
        pago_coordinado_por: 2n,
      });

      const res = await service.marcarCoordinado('20', cajeroUsuario);

      expect(res.id).toBe('20');
      expect(res.pago_estado).toBe('COORDINADO');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'caja',
          accion: 'MARCAR_COORDINADO',
          resultado: 'OK',
        }),
      );
    });

    it('pedido anulado no puede coordinarse -> 409 PEDIDO_ANULADO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n,
        codigo: 'CP-W020',
        estado: 'ANULADO',
        pago_estado: 'PENDIENTE',
      });

      await expect(
        service.marcarCoordinado('20', cajeroUsuario),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'PEDIDO_ANULADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('pedido ya pagado no puede coordinarse -> 409 YA_COBRADO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n,
        codigo: 'CP-W020',
        estado: 'COLA',
        pago_estado: 'PAGADO',
      });

      await expect(
        service.marcarCoordinado('20', cajeroUsuario),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'YA_COBRADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });
  });

  describe('reglas nuevas de cobro', () => {
    it('rechaza un medio de pago que no existe (MEDIO_INVALIDO)', async () => {
      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'BITCOIN', monto: 50 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'MEDIO_INVALIDO' } });
    });

    it('con la caja sin abrir pide abrirla para cobrar', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);
      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para cobrar' } });
    });

    it('la suma de pagos se compara en céntimos: 0,10 + 0,20 cuadra con 0,30', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({ id: 10n, estado: 'ABIERTA' });
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 100n, codigo: 'CP-0100', total: new Prisma.Decimal(0.3), estado: 'ENTREGADO',
        pago_estado: 'PENDIENTE', es_personal: false, cobro: null,
      });
      prismaMock.cobro.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 1n, pedido_id: 100n, caja_id: 10n, total: data.total, credito_personal: false,
          cobrado_por: 2n, en: new Date(), pagos: [] }),
      );
      prismaMock.pedido.update.mockResolvedValue({ id: 100n, pago_estado: 'PAGADO' });

      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 0.1 }, { medio: 'YAPE', monto: 0.2 }] }, cajeroUsuario),
      ).resolves.toMatchObject({ pago_estado: 'PAGADO' });
    });
  });
});
