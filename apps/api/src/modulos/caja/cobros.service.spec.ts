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
import { SupervisorCodigoService } from '../supervisor-codigo/supervisor-codigo.service';
import { ImpresionService } from '../impresion/impresion.service';

describe('CobrosService', () => {
  let service: CobrosService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;
  let salonMock: any;
  let comprobantesMock: any;
  let impresionMock: any;
  let supervisorCodigoMock: any;

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
    impresionMock = { encolarTicketPedido: jest.fn().mockResolvedValue(undefined) };
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
      // Por defecto el pedido ya tiene una foto enlazada; las pruebas del comprobante la quitan
      voucherPago: {
        findFirst: jest.fn().mockResolvedValue({ id: 9n, semaforo: 'CONFIABLE', extraido: { legible: true } }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      parametro: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prismaMock);
      }),
    };

    supervisorCodigoMock = {
      verificarYConsumirCodigo: jest.fn().mockImplementation(async (codigo: string | undefined, partyId?: any) => {
        const claveIntentos = `pin:supervisor:intentos:${partyId ?? 'general'}`;
        let intentos;
        try {
          intentos = await redisClientMock.get(claveIntentos);
        } catch {
          throw new HttpException(
            { codigo: 'PIN_NO_DISPONIBLE', mensaje: 'No se puede validar el código ahora, intenta en unos minutos' },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (intentos && parseInt(intentos, 10) >= 3) {
          throw new HttpException(
            { codigo: 'CODIGO_BLOQUEADO', mensaje: 'Demasiados intentos fallidos de código de supervisor. Espera 5 minutos.' },
            HttpStatus.FORBIDDEN,
          );
        }
        if (!codigo || codigo !== '123456') {
          await auditoriaMock.registrar({
            categoria: 'ACCESO',
            modulo: 'caja',
            accion: 'CODIGO_FALLIDO',
            resultado: 'RECHAZADO',
          });
          throw new HttpException(
            { codigo: 'CODIGO_INVALIDO', mensaje: 'Código de supervisor inválido o no proporcionado' },
            HttpStatus.FORBIDDEN,
          );
        }
        await redisClientMock.del(claveIntentos);
        return { party_id: 1n, id: 1n, valido: true };
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
        { provide: ImpresionService, useValue: impresionMock },
        { provide: SupervisorCodigoService, useValue: supervisorCodigoMock },
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
      cobros: [],
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
        cobros: [{ id: 50n, anulado_en: null }],
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
        pago_estado: 'PAGADO',
        cambio: 'cobrado',
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

    it('al cobrar genera la nota de venta dentro de la transacción; si falla, el cobro se deshace', async () => {
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

      await expect(service.cobrar({ pedidoId: '100', pagos: [{ medio: 'YAPE', monto: 50 }] }, cajeroUsuario)).rejects.toThrow('serie sin configurar');
      expect(comprobantesMock.emitirParaPedido).toHaveBeenCalledWith(100n, expect.anything(), cajeroUsuario, undefined);
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

    it('con un cobro anulado y otro vigente -> 409 YA_COBRADO (solo cuenta el vigente)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        cobros: [
          { id: 7n, anulado_en: new Date('2026-10-21T20:00:00.000Z') },
          { id: 8n, anulado_en: null },
        ],
      });

      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'YA_COBRADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('cobrar de nuevo un pedido cuyo cobro fue anulado -> conserva el anulado y crea una fila nueva', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        cobros: [{ id: 7n, anulado_en: new Date('2026-10-21T20:00:00.000Z') }],
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
      // RNF-CAP-014: el cobro anulado no se borra; el nuevo es otra fila
      expect(prismaMock.cobroPago.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.cobro.delete).not.toHaveBeenCalled();
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

  describe('comprobante del pago digital (foto obligatoria, IA solo informa)', () => {
    const cajaAbiertaMock = { id: 10n, fecha: new Date('2026-10-21T00:00:00.000Z'), estado: 'ABIERTA' };
    const pedidoMock = {
      id: 100n,
      codigo: 'CP-0100',
      total: new Prisma.Decimal(50.0),
      estado: 'ENTREGADO',
      pago_estado: 'PENDIENTE',
      pago_metodo: null,
      es_personal: false,
      cobros: [],
    };
    const mozoUsuario = { id: 3n, partyId: 3n, rol: 'MOZO', debeCambiar: false };
    const cobroCreado = {
      id: 77n,
      pedido_id: 100n,
      caja_id: 10n,
      total: new Prisma.Decimal(50.0),
      credito_personal: false,
      cobrado_por: 2n,
      en: new Date(),
      pagos: [{ id: 5n, medio: 'YAPE', monto: new Prisma.Decimal(50.0), recibido: null, vuelto: null }],
    };

    beforeEach(() => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock });
      prismaMock.cobro.create.mockResolvedValue(cobroCreado);
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'YAPE' });
    });

    const sinFoto = () => prismaMock.voucherPago.findFirst.mockResolvedValue(null);
    const pagoYape = [{ medio: 'YAPE', monto: 50 }];

    it('cobro digital sin foto ni excepción -> 400 VOUCHER_REQUERIDO y no cobra', async () => {
      sinFoto();
      await expect(service.cobrar({ pedidoId: '100', pagos: pagoYape }, cajeroUsuario)).rejects.toMatchObject({
        response: { codigo: 'VOUCHER_REQUERIDO' },
      });
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('cobro en efectivo sin foto sigue permitido', async () => {
      sinFoto();
      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario);
      expect(res.id).toBe('77');
    });

    it('con foto ya subida (voucherId) la enlaza al pedido y cobra', async () => {
      // La foto aún no tiene pedido: se enlaza dentro de la transacción y luego el pedido ya tiene prueba
      prismaMock.voucherPago.findUnique.mockResolvedValue({ id: 9n, pedido_id: null });

      const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape, voucherId: '9' } as any, cajeroUsuario);

      expect(prismaMock.voucherPago.update).toHaveBeenCalledWith({ where: { id: 9n }, data: { pedido_id: 100n } });
      expect(res.id).toBe('77');
    });

    it('voucherId de otro pedido -> 409 VOUCHER_DE_OTRO_PEDIDO', async () => {
      prismaMock.voucherPago.findUnique.mockResolvedValue({ id: 9n, pedido_id: 555n });
      await expect(
        service.cobrar({ pedidoId: '100', pagos: pagoYape, voucherId: '9' } as any, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'VOUCHER_DE_OTRO_PEDIDO' } });
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('voucherId inexistente -> 404 VOUCHER_NO_ENCONTRADO', async () => {
      prismaMock.voucherPago.findUnique.mockResolvedValue(null);
      await expect(
        service.cobrar({ pedidoId: '100', pagos: pagoYape, voucherId: '9' } as any, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'VOUCHER_NO_ENCONTRADO' } });
    });

    it('sin foto con motivo y PIN de supervisor correcto -> cobra y audita COBRAR_SIN_VOUCHER', async () => {
      sinFoto();
      const res = await service.cobrar(
        {
          pedidoId: '100',
          pagos: pagoYape,
          sinVoucher: { motivo: 'El cliente no tenía señal', pinSupervisor: '123456' },
        } as any,
        cajeroUsuario,
        '10.0.0.1',
      );

      expect(res.id).toBe('77');
      expect(supervisorCodigoMock.verificarYConsumirCodigo).toHaveBeenCalledWith(
        '123456',
        2n,
        'caja/cobrar_sin_voucher',
        '10.0.0.1',
        'cobro',
        undefined,
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'COBRAR_SIN_VOUCHER',
          motivo: 'El cliente no tenía señal',
          conPinAdmin: true,
          despues: expect.objectContaining({
            sin_voucher: expect.objectContaining({ motivo: 'El cliente no tenía señal' }),
          }),
        }),
      );
    });

    it('sin foto con PIN de supervisor incorrecto -> 403 y no cobra', async () => {
      sinFoto();
      await expect(
        service.cobrar(
          { pedidoId: '100', pagos: pagoYape, sinVoucher: { motivo: 'Motivo válido', pinSupervisor: '000000' } } as any,
          cajeroUsuario,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('un voucher ILEGIBLE no cuenta como comprobante: sin otra foto -> 400 VOUCHER_REQUERIDO', async () => {
      // La búsqueda del comprobante excluye ILEGIBLE: lo que devuelve es null
      prismaMock.voucherPago.findFirst.mockResolvedValue(null);
      await expect(service.cobrar({ pedidoId: '100', pagos: pagoYape }, cajeroUsuario)).rejects.toMatchObject({
        response: { codigo: 'VOUCHER_REQUERIDO' },
      });
      expect(prismaMock.voucherPago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pedido_id: 100n, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } } }),
      );
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('un voucher ILEGIBLE puede seguir con la excepción del supervisor (motivo y PIN) y queda auditado', async () => {
      prismaMock.voucherPago.findFirst.mockResolvedValue(null);
      const res = await service.cobrar(
        {
          pedidoId: '100',
          pagos: pagoYape,
          sinVoucher: { motivo: 'La foto salió borrosa', pinSupervisor: '123456' },
        } as any,
        cajeroUsuario,
      );
      expect(res.id).toBe('77');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'COBRAR_SIN_VOUCHER', conPinAdmin: true }),
      );
    });

    it('MOZO sin foto ni excepción -> 400 VOUCHER_REQUERIDO, sin consultar parámetros', async () => {
      sinFoto();
      await expect(service.cobrar({ pedidoId: '100', pagos: pagoYape }, mozoUsuario)).rejects.toMatchObject({
        response: { codigo: 'VOUCHER_REQUERIDO' },
      });
      expect(prismaMock.parametro.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('MOZO sin foto con motivo y código del supervisor válidos -> cobra y audita COBRAR_SIN_VOUCHER con su partyId', async () => {
      sinFoto();
      const res = await service.cobrar(
        {
          pedidoId: '100',
          pagos: pagoYape,
          sinVoucher: { motivo: 'El cliente no tenía señal', pinSupervisor: '123456' },
        } as any,
        mozoUsuario,
      );

      expect(res.id).toBe('77');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'COBRAR_SIN_VOUCHER',
          partyId: 3n,
          motivo: 'El cliente no tenía señal',
          conPinAdmin: true,
        }),
      );
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

    it('anular sin pin -> 403 CODIGO_INVALIDO y audita CODIGO_FALLIDO', async () => {
      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Error en cobro del pedido' },
          undefined,
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'CODIGO_INVALIDO' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'caja',
          accion: expect.stringMatching(/CODIGO_FALLIDO|PIN_FALLIDO/),
          resultado: 'RECHAZADO',
        }),
      );
    });

    it('anular con pin incorrecto -> 403 CODIGO_INVALIDO', async () => {
      await expect(
        service.anularCobro(
          '10',
          { motivo: 'Error en cobro del pedido' },
          '999999',
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'CODIGO_INVALIDO' }),
          status: HttpStatus.FORBIDDEN,
        }),
      );
    });

    it('3 fallos de PIN bloquean 5 min en Redis -> 403 CODIGO_BLOQUEADO', async () => {
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
          response: expect.objectContaining({ codigo: 'CODIGO_BLOQUEADO' }),
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
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:pago', { id: '100', pago_estado: 'PENDIENTE', cambio: 'anulado' });
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
    beforeEach(() => {
      prismaMock.caja.findUnique.mockResolvedValue({ estado: 'ABIERTA' });
    });

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
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:pago', expect.objectContaining({ id: '20', cambio: 'coordinado' }));
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

  describe('marcarCoordinado con comprobante del medio digital', () => {
    beforeEach(() => {
      prismaMock.caja.findUnique.mockResolvedValue({ estado: 'ABIERTA' });
    });

    const pedidoPendiente = (pago_preferido: string | null, pago_metodo: string | null = null) => ({
      id: 20n,
      codigo: 'CP-W020',
      estado: 'COLA',
      pago_estado: 'PENDIENTE',
      pago_preferido,
      pago_metodo,
    });
    const coordinado = { id: 20n, codigo: 'CP-W020', pago_estado: 'COORDINADO', pago_coordinado_en: new Date(), pago_coordinado_por: 2n };
    const sinFoto = () => prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    beforeEach(() => {
      prismaMock.pedido.update.mockResolvedValue(coordinado);
    });

    it('medio YAPE sin voucher útil -> 400 VOUCHER_REQUERIDO y no marca', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('YAPE'));
      sinFoto();

      await expect(service.marcarCoordinado('20', cajeroUsuario)).rejects.toMatchObject({
        response: { codigo: 'VOUCHER_REQUERIDO' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).not.toHaveBeenCalled();
    });

    it('medio YAPE con voucher útil enlazado -> marca COORDINADO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('YAPE'));

      const res = await service.marcarCoordinado('20', cajeroUsuario);

      expect(res.pago_estado).toBe('COORDINADO');
      expect(prismaMock.voucherPago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pedido_id: 20n, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } } }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'MARCAR_COORDINADO' }),
      );
    });

    it('voucher solo ILEGIBLE (excluido por la búsqueda) -> 400 VOUCHER_REQUERIDO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('PLIN'));
      sinFoto();

      await expect(service.marcarCoordinado('20', cajeroUsuario, '10.0.0.1', {})).rejects.toMatchObject({
        response: { codigo: 'VOUCHER_REQUERIDO' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('sin voucher con motivo y PIN de supervisor correcto -> marca y audita con el motivo', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('TRANSFERENCIA'));
      sinFoto();

      const res = await service.marcarCoordinado('20', cajeroUsuario, '10.0.0.1', {
        sinVoucher: { motivo: 'El cliente no tiene la foto', pinSupervisor: '123456' },
      } as any);

      expect(res.pago_estado).toBe('COORDINADO');
      expect(supervisorCodigoMock.verificarYConsumirCodigo).toHaveBeenCalledWith(
        '123456',
        2n,
        'caja/coordinado_sin_voucher',
        '10.0.0.1',
        'cobro',
        undefined,
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'MARCAR_COORDINADO_SIN_VOUCHER',
          conPinAdmin: true,
          motivo: 'El cliente no tiene la foto',
          despues: expect.objectContaining({
            sin_voucher: expect.objectContaining({ motivo: 'El cliente no tiene la foto' }),
          }),
        }),
      );
    });

    it('sin voucher con PIN de supervisor incorrecto -> 403 y no marca', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('YAPE'));
      sinFoto();

      await expect(
        service.marcarCoordinado('20', cajeroUsuario, undefined, {
          sinVoucher: { motivo: 'Motivo válido', pinSupervisor: '000000' },
        } as any),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('medio EFECTIVO o TARJETA no pide voucher', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('EFECTIVO'));
      sinFoto();
      await service.marcarCoordinado('20', cajeroUsuario);

      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('TARJETA'));
      await service.marcarCoordinado('20', cajeroUsuario);

      expect(prismaMock.voucherPago.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.pedido.update).toHaveBeenCalledTimes(2);
    });

    it('si no hay medio preferido usa pago_metodo para decidir si exige voucher', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente(null, 'YAPE'));
      sinFoto();

      await expect(service.marcarCoordinado('20', cajeroUsuario)).rejects.toMatchObject({
        response: { codigo: 'VOUCHER_REQUERIDO' },
      });
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
        pago_estado: 'PENDIENTE', es_personal: false, cobros: [],
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

  describe('PIN de supervisor sin Redis', () => {
    it('con Redis caído no anula aunque el PIN sea correcto: 503 PIN_NO_DISPONIBLE', async () => {
      redisClientMock.get.mockRejectedValue(new Error('ECONNREFUSED'));
      prismaMock.cobro.findUnique.mockResolvedValue({ caja_id: 10n });

      await expect(
        service.anularCobro('5', { motivo: 'Cobro duplicado de prueba' }, '123456', adminUsuario),
      ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE, response: { codigo: 'PIN_NO_DISPONIBLE' } });
      expect(prismaMock.userAccount.findMany).not.toHaveBeenCalled();
    });
  });

  describe('cobrar en cierre', () => {
    const pedidoDeAyer = {
      id: 100n,
      codigo: 'CP-W062',
      total: new Prisma.Decimal(42),
      estado: 'ENTREGADO',
      pago_estado: 'PENDIENTE',
      pago_metodo: null,
      es_personal: false,
      cobros: [],
    };

    const cobroCreado = (cajaId: bigint) => ({
      id: 900n,
      pedido_id: 100n,
      caja_id: cajaId,
      total: new Prisma.Decimal(42),
      credito_personal: false,
      cobrado_por: 2n,
      en: new Date('2026-10-24T15:00:00.000Z'),
      pagos: [{ id: 1n, medio: 'EFECTIVO', monto: new Prisma.Decimal(42), recibido: null, vuelto: null }],
    });

    it('cobra un pedido de otro día en la caja que se cierra y lo deja marcado como cobrado durante el cierre', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({ id: 7n, estado: 'ABIERTA' });
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoDeAyer);
      prismaMock.cobro.create.mockResolvedValue(cobroCreado(7n));
      prismaMock.pedido.update.mockResolvedValue({ pago_estado: 'PAGADO' });

      await service.cobrarEnCierre(7n, { pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 42 }] }, cajeroUsuario);

      expect(prismaMock.cobro.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ caja_id: 7n, cobrado_por: 2n }) }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'COBRAR_EN_CIERRE',
          despues: expect.objectContaining({ cobrado_durante_cierre: true }),
        }),
      );
    });

    it('sin doble cobro: un pedido ya cobrado no se cobra otra vez en el cierre (YA_COBRADO)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({ id: 7n, estado: 'ABIERTA' });
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoDeAyer, pago_estado: 'PAGADO' });

      await expect(
        service.cobrarEnCierre(7n, { pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 42 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'YA_COBRADO' } });
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });

    it('no cobra en una caja que ya está cerrada (CAJA_CERRADA)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({ id: 7n, estado: 'CERRADA' });

      await expect(
        service.cobrarEnCierre(7n, { pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 42 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });
  });

  describe('ticket de pago al confirmar el cobro', () => {
    const cajaAbierta = { id: 10n, fecha: new Date('2026-10-21T00:00:00.000Z'), estado: 'ABIERTA' };
    const pedido = {
      id: 100n,
      codigo: 'CP-0100',
      total: new Prisma.Decimal(50),
      estado: 'ENTREGADO',
      pago_estado: 'PENDIENTE',
      pago_metodo: null,
      es_personal: false,
      cobros: [],
    };

    /** El mozo envió el cobro (cobro_mozo_en) y, si `notaVigente`, emitió la nota de venta al enviar. */
    const preparar = (mozo: { enviadoPorMozo: boolean; notaVigente: boolean }) => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbierta);
      prismaMock.pedido.findUnique.mockImplementation(async (args: any) =>
        args?.select?.comprobante
          ? {
              cobro_mozo_en: mozo.enviadoPorMozo ? new Date() : null,
              comprobante: mozo.notaVigente ? [{ id: 5n }] : [],
            }
          : pedido,
      );
      prismaMock.cobro.create.mockResolvedValue({
        id: 77n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedido, pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO' });
    };
    const cobrarEfectivo = () =>
      service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50, recibido: 50 }] }, cajeroUsuario);

    it('nota de venta ya emitida por el mozo al enviar a Caja: al confirmar no se encola el ticket de pago', async () => {
      preparar({ enviadoPorMozo: true, notaVigente: true });

      await cobrarEfectivo();

      expect(impresionMock.encolarTicketPedido).not.toHaveBeenCalled();
    });

    it('cobro normal sin envío del mozo: se encola el ticket de pago como siempre', async () => {
      preparar({ enviadoPorMozo: false, notaVigente: false });

      await cobrarEfectivo();

      expect(impresionMock.encolarTicketPedido).toHaveBeenCalledWith(100n);
    });

    it('el mozo envió con boleta (sin nota de venta): sí se encola el ticket de pago', async () => {
      preparar({ enviadoPorMozo: true, notaVigente: false });

      await cobrarEfectivo();

      expect(impresionMock.encolarTicketPedido).toHaveBeenCalledWith(100n);
    });
  });
});
