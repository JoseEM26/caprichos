// El gateway importa @nestjs/jwt (ESM): en las pruebas unitarias basta con un mock
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../comprobantes/comprobantes.service', () => ({ ComprobantesService: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CobrosService } from './cobros.service';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
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
    comprobantesMock = {
      emitirParaPedido: jest.fn().mockResolvedValue({ id: '1' }),
      firmarPorPedido: jest.fn().mockResolvedValue(undefined),
      transmitirEnSegundoPlano: jest.fn(),
      darDeBajaPorAnulacion: jest.fn().mockResolvedValue(null),
    };
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
      movimientoCaja: {
        create: jest.fn().mockResolvedValue({ id: 55n }),
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
      // El cierre silencioso de Validar pago consulta conversaciones en espera (sin ninguna por defecto)
      conversacion: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      mensajeChat: {
        create: jest.fn().mockResolvedValue({}),
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
        { provide: ImpresionService, useValue: impresionMock },
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
      comprobante_tipo: 'BOLETA',
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

    it('delivery sin ubicación no se cobra -> 409 DELIVERY_SIN_UBICACION', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock, estado: 'COLA', modalidad: 'DELIVERY', entrega_lat: null, entrega_lng: null, zona_id: null });
      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'DELIVERY_SIN_UBICACION' }),
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

    it('cobro con propina: el cliente entrega venta + propina; la propina va aparte en el renglón y el vuelto cuenta la propina', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock, propina: new Prisma.Decimal(5) }); // total 50 + propina 5

      prismaMock.cobro.create.mockResolvedValue({
        id: 78n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [{ id: 1n, medio: 'EFECTIVO', monto: new Prisma.Decimal(50.0), propina: new Prisma.Decimal(5), recibido: new Prisma.Decimal(60.0), vuelto: new Prisma.Decimal(5.0) }],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO' });

      // Cuadra con venta + propina (55): con solo el total (50) sería PAGO_NO_CUADRA
      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50, recibido: 60 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'PAGO_NO_CUADRA' } });

      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 55, recibido: 60 }] }, cajeroUsuario);

      const renglon = prismaMock.cobro.create.mock.calls[0][0].data.pagos.create[0];
      expect(Number(renglon.monto)).toBe(50); // venta del renglón
      expect(Number(renglon.propina)).toBe(5); // propina del renglón
      expect(Number(renglon.vuelto)).toBe(5); // recibido 60 - (venta + propina) 55
      expect(res.pagos[0].propina).toBe(5);
      expect(res.total).toBe(50); // el total de la venta no cambia
    });

    it('crédito del personal + delivery: el cobro es solo el envío (total - monto_credito) y el cobro guarda ese monto', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock, total: new Prisma.Decimal(26), monto_credito: new Prisma.Decimal(21) });
      prismaMock.cobro.create.mockResolvedValue({
        id: 79n, pedido_id: 100n, caja_id: 10n, total: new Prisma.Decimal(5), credito_personal: false, cobrado_por: 2n, en: new Date(),
        pagos: [{ id: 1n, medio: 'EFECTIVO', monto: new Prisma.Decimal(5), propina: new Prisma.Decimal(0), recibido: null, vuelto: null }],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO' });

      // El total (26) ya no cuadra: solo se cobra el envío
      await expect(
        service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 26 }] }, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'PAGO_NO_CUADRA' } });

      await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 5 }] }, cajeroUsuario);
      expect(Number(prismaMock.cobro.create.mock.calls[0][0].data.total)).toBe(5);
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

    it('al cobrar firma el comprobante ANTES de encolar el ticket y transmite a SUNAT sin esperarla', async () => {
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
      // SUNAT nunca responde: la transmisión queda en segundo plano y el cobro igual termina
      comprobantesMock.transmitirEnSegundoPlano.mockImplementation(() => new Promise(() => undefined));

      await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'YAPE', monto: 50 }] }, cajeroUsuario);

      const firma = comprobantesMock.firmarPorPedido.mock.invocationCallOrder[0];
      const ticket = impresionMock.encolarTicketPedido.mock.invocationCallOrder[0];
      const transmision = comprobantesMock.transmitirEnSegundoPlano.mock.invocationCallOrder[0];
      expect(firma).toBeLessThan(ticket);
      expect(ticket).toBeLessThan(transmision);
      expect(comprobantesMock.transmitirEnSegundoPlano).toHaveBeenCalledWith(100n);
    });

    it('si la firma falla, el cobro no se deshace y el ticket sale igual', async () => {
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
      comprobantesMock.firmarPorPedido.mockRejectedValue(new Error('certificado vencido'));

      await expect(service.cobrar({ pedidoId: '100', pagos: [{ medio: 'YAPE', monto: 50 }] }, cajeroUsuario)).resolves.toBeDefined();
      expect(impresionMock.encolarTicketPedido).toHaveBeenCalledWith(100n);
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
      comprobante_tipo: 'BOLETA',
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

    it('cobro digital sin foto ni casilla: la captura es opcional, cobra y audita «sin captura»', async () => {
      sinFoto();
      const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape }, cajeroUsuario);
      expect(res.id).toBe('77');
      expect(prismaMock.cobro.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'COBRAR_SIN_VOUCHER',
          despues: expect.objectContaining({ sin_voucher: expect.objectContaining({ sin_captura: true }) }),
        }),
      );
    });

    it('cobro en efectivo sin foto sigue permitido', async () => {
      sinFoto();
      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario);
      expect(res.id).toBe('77');
    });

    describe('casilla «ya hablé con el cliente y pagó» (sin captura)', () => {
      const local = { ...pedidoMock, canal: 'MOZO', modalidad: 'MESA' };

      it('pedido del local + casilla marcada en Caja: cobra sin foto y audita sin_captura', async () => {
        sinFoto();
        prismaMock.pedido.findUnique.mockResolvedValue({ ...local });
        const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape, confirmaSinCaptura: true } as any, cajeroUsuario);

        expect(res.id).toBe('77');
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            despues: expect.objectContaining({ sin_voucher: expect.objectContaining({ sin_captura: true }) }),
          }),
        );
      });

      it('el mozo ya la dio al enviar a Caja (cobro_mozo_en): Caja cobra sin foto sin marcar nada', async () => {
        sinFoto();
        prismaMock.pedido.findUnique.mockResolvedValue({ ...local, cobro_mozo_en: new Date() });
        const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape } as any, cajeroUsuario);
        expect(res.id).toBe('77');
      });

      it('sin casilla ni mozo: cobra igual (la casilla es solo un registro opcional)', async () => {
        sinFoto();
        prismaMock.pedido.findUnique.mockResolvedValue({ ...local });
        const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape } as any, cajeroUsuario);
        expect(res.id).toBe('77');
      });

      it('delivery ya entregado (Yape que se cobra después): Caja cobra sin foto y el cierre no se descuadra (queda PAGADO con su medio)', async () => {
        sinFoto();
        prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock, canal: 'CARTA', modalidad: 'DELIVERY', estado: 'ENTREGADO', entrega_lat: 1, entrega_lng: 1, zona_id: 1n });
        const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape } as any, cajeroUsuario);
        expect(res.id).toBe('77');
        // El cierre suma por el renglón del cobro (medio y monto), no por la foto: sin captura entra igual a YAPE
        const data = prismaMock.cobro.create.mock.calls.at(-1)![0].data;
        expect(data.pagos.create).toEqual([expect.objectContaining({ medio: 'YAPE', monto: expect.anything() })]);
        expect(Number(data.pagos.create[0].monto)).toBe(50);
        expect(prismaMock.pedido.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ pago_estado: 'PAGADO', pago_metodo: 'YAPE' }) }),
        );
      });
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

    it('un voucher ILEGIBLE no cuenta como comprobante y tampoco frena el cobro', async () => {
      prismaMock.voucherPago.findFirst.mockResolvedValue(null);
      const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape }, cajeroUsuario);
      expect(res.id).toBe('77');
      expect(prismaMock.voucherPago.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pedido_id: 100n, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } } }),
      );
    });

    it('MOZO sin foto cobra igual, sin consultar parámetros, y audita con su partyId', async () => {
      sinFoto();
      const res = await service.cobrar({ pedidoId: '100', pagos: pagoYape }, mozoUsuario);
      expect(res.id).toBe('77');
      expect(prismaMock.parametro.findUnique).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'COBRAR_SIN_VOUCHER', partyId: 3n }));
    });
  });

  describe('anularCobro', () => {
    it('motivo menor a 5 caracteres -> 400 MOTIVO_REQUERIDO', async () => {
      await expect(
        service.anularCobro(
          '10',
          { motivo: 'err' },
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
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'COBRO_YA_ANULADO' }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('anula exitosamente sin ningún código, revierte pedido a PENDIENTE y audita a nombre de quien anula', async () => {
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
        comprobante_tipo: 'BOLETA',
      });

      const res = await service.anularCobro(
        '10',
        { motivo: 'Cliente solicitó cambio de medio de pago' },
        cajeroUsuario,
      );

      expect(res.id).toBe('10');
      expect(res.pago_estado).toBe('PENDIENTE');
      expect(res.motivo_anulacion).toBe('Cliente solicitó cambio de medio de pago');
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:pago', { id: '100', pago_estado: 'PENDIENTE', cambio: 'anulado' });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'caja',
          accion: 'ANULAR_COBRO',
          resultado: 'OK',
          partyId: cajeroUsuario.partyId,
          motivo: 'Cliente solicitó cambio de medio de pago',
        }),
      );
    });
  });

  describe('anularCobroCajaCerrada (solo ADMIN)', () => {
    const admin = { partyId: 1n, rol: 'ADMIN', roles: ['ADMIN'] };
    const motivo = 'Cobro mal registrado ayer';
    const ef = { medio: 'EFECTIVO', monto: new Prisma.Decimal(40), propina: new Prisma.Decimal(2), recibido: null, vuelto: null };
    const yape = { medio: 'YAPE', monto: new Prisma.Decimal(30), propina: new Prisma.Decimal(0), recibido: null, vuelto: null };

    const preparar = (opts: { hoy?: any; cobro?: any } = {}) => {
      const hoy = opts.hoy === undefined ? { id: 9n, estado: 'ABIERTA' } : opts.hoy;
      prismaMock.caja.findUnique.mockImplementation(async ({ where }: any) =>
        where.fecha ? hoy : where.id === 9n ? hoy : { id: 5n, estado: 'CERRADA' },
      );
      prismaMock.cobro.findUnique
        .mockResolvedValueOnce({ caja_id: 5n })
        .mockResolvedValueOnce({
          id: 10n, pedido_id: 100n, caja_id: 5n, anulado_en: null,
          caja: { estado: 'CERRADA' }, pedido: { codigo: 'CP-0100' }, pagos: [ef, yape],
          ...opts.cobro,
        });
    };

    it('ADMIN anula, crea egreso solo por el efectivo (con propina) en la caja de hoy y audita', async () => {
      preparar();
      const res: any = await service.anularCobroCajaCerrada('10', { motivo }, admin);
      expect(prismaMock.movimientoCaja.create).toHaveBeenCalledWith({
        data: { caja_id: 9n, tipo: 'EGRESO', monto: new Prisma.Decimal(42), motivo: 'Anulación de cobro de caja cerrada (pedido CP-0100)' },
        select: { id: true },
      });
      expect(res.movimiento_ajuste_id).toBe('55');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith({ where: { id: 100n }, data: { pago_estado: 'PENDIENTE' } });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ANULAR_COBRO_CAJA_CERRADA',
          modulo: 'caja',
          despues: expect.objectContaining({ caja_original_id: '5', movimiento_ajuste_id: '55' }),
        }),
      );
      // bloquea primero la caja de menor id
      expect(prismaMock.$queryRaw.mock.calls.length).toBe(2);
    });

    it('sin efectivo no crea egreso', async () => {
      preparar({ cobro: { pagos: [yape] } });
      const res: any = await service.anularCobroCajaCerrada('10', { motivo }, admin);
      expect(prismaMock.movimientoCaja.create).not.toHaveBeenCalled();
      expect(res.movimiento_ajuste_id).toBeNull();
    });

    it('no-ADMIN -> 403 SOLO_ADMIN', async () => {
      await expect(service.anularCobroCajaCerrada('10', { motivo }, cajeroUsuario)).rejects.toMatchObject({
        response: { codigo: 'SOLO_ADMIN' },
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('sin caja abierta hoy -> 409 SIN_CAJA_HOY', async () => {
      preparar({ hoy: null });
      await expect(service.anularCobroCajaCerrada('10', { motivo }, admin)).rejects.toMatchObject({
        response: { codigo: 'SIN_CAJA_HOY' },
        status: HttpStatus.CONFLICT,
      });
      expect(prismaMock.movimientoCaja.create).not.toHaveBeenCalled();
    });

    it('motivo corto -> 400', async () => {
      await expect(service.anularCobroCajaCerrada('10', { motivo: 'corto' }, admin)).rejects.toMatchObject({
        response: { codigo: 'MOTIVO_REQUERIDO' },
      });
    });

    it('cobro ya anulado -> 409 COBRO_YA_ANULADO', async () => {
      preparar({ cobro: { anulado_en: new Date() } });
      await expect(service.anularCobroCajaCerrada('10', { motivo }, admin)).rejects.toMatchObject({
        response: { codigo: 'COBRO_YA_ANULADO' },
      });
    });

    it('caja del cobro abierta -> 409 CAJA_ABIERTA (usar la anulación normal)', async () => {
      preparar({ cobro: { caja: { estado: 'ABIERTA' } } });
      await expect(service.anularCobroCajaCerrada('10', { motivo }, admin)).rejects.toMatchObject({
        response: { codigo: 'CAJA_ABIERTA' },
      });
    });
  });

  describe('anularCobro da de baja la boleta/factura (H3)', () => {
    const preparar = () => {
      prismaMock.cobro.findUnique
        .mockResolvedValueOnce({ caja_id: 10n })
        .mockResolvedValueOnce({ id: 10n, pedido_id: 100n, anulado_en: null, caja: { estado: 'ABIERTA' }, pagos: [] });
      prismaMock.pedido.update.mockResolvedValue({ id: 100n, pago_estado: 'PENDIENTE' });
    };

    it('pide la baja del comprobante del pedido y avisa a Caja', async () => {
      preparar();
      comprobantesMock.darDeBajaPorAnulacion.mockResolvedValue({ comprobante: 'B002-5', estado: 'PENDIENTE_BAJA' });
      const res: any = await service.anularCobro('10', { motivo: 'Cliente cambió el pedido' }, cajeroUsuario);
      expect(comprobantesMock.darDeBajaPorAnulacion).toHaveBeenCalledWith(100n, 'Cliente cambió el pedido', cajeroUsuario, undefined);
      expect(res.aviso_comprobante).toContain('B002-5');
      expect(res.aviso_comprobante).toContain('pendiente');
    });

    it('si la baja falla de forma inesperada, el cobro igual queda anulado', async () => {
      preparar();
      comprobantesMock.darDeBajaPorAnulacion.mockRejectedValue(new Error('boom'));
      const res: any = await service.anularCobro('10', { motivo: 'Cliente cambió el pedido' }, cajeroUsuario);
      expect(res.pago_estado).toBe('PENDIENTE');
      expect(res.aviso_comprobante).toBeNull();
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
          comprobante_tipo: 'BOLETA',
          total: new Prisma.Decimal(45.0),
          cliente_nombre: 'María López',
          cliente_telefono: '987654321',
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
        comprobante_tipo: 'BOLETA',
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

    it('delivery sin ubicación no se coordina -> 409 DELIVERY_SIN_UBICACION y no actualiza', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n, codigo: 'CP-W020', estado: 'COLA', pago_estado: 'PENDIENTE', comprobante_tipo: 'BOLETA',
        modalidad: 'DELIVERY', entrega_lat: null, entrega_lng: null, zona_id: null,
      });
      await expect(service.marcarCoordinado('20', cajeroUsuario)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ codigo: 'DELIVERY_SIN_UBICACION' }),
          status: HttpStatus.CONFLICT,
        }),
      );
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('delivery con punto y zona se coordina sin trabas', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n, codigo: 'CP-W020', estado: 'COLA', pago_estado: 'PENDIENTE', comprobante_tipo: 'BOLETA',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
      });
      prismaMock.pedido.update.mockResolvedValue({ id: 20n, codigo: 'CP-W020', pago_estado: 'COORDINADO', pago_coordinado_en: new Date(), pago_coordinado_por: 2n });
      const res = await service.marcarCoordinado('20', cajeroUsuario);
      expect(res.pago_estado).toBe('COORDINADO');
    });

    it('pedido anulado no puede coordinarse -> 409 PEDIDO_ANULADO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n,
        codigo: 'CP-W020',
        estado: 'ANULADO',
        pago_estado: 'PENDIENTE',
        comprobante_tipo: 'BOLETA',
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
      comprobante_tipo: 'BOLETA',
      pago_preferido,
      pago_metodo,
    });
    const coordinado = { id: 20n, codigo: 'CP-W020', pago_estado: 'COORDINADO', pago_coordinado_en: new Date(), pago_coordinado_por: 2n };
    const sinFoto = () => prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    beforeEach(() => {
      prismaMock.pedido.update.mockResolvedValue(coordinado);
    });

    it('medio YAPE sin voucher: marca COORDINADO igual y audita «sin captura»', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('YAPE'));
      sinFoto();

      const res = await service.marcarCoordinado('20', cajeroUsuario);
      expect(res.pago_estado).toBe('COORDINADO');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'MARCAR_COORDINADO_SIN_VOUCHER' }));
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

    it('voucher solo ILEGIBLE (excluido por la búsqueda): marca igual, sin supervisor', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente('PLIN'));
      sinFoto();

      const res = await service.marcarCoordinado('20', cajeroUsuario, '10.0.0.1', {});
      expect(res.pago_estado).toBe('COORDINADO');
    });

    it('delivery sin voucher (repartidor ya en la puerta): marca COORDINADO igual', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoPendiente('YAPE'), canal: 'CARTA', modalidad: 'DELIVERY', entrega_lat: 1, entrega_lng: 1, zona_id: 1n });
      sinFoto();
      const res = await service.marcarCoordinado('20', cajeroUsuario, '10.0.0.1', { confirmaSinCaptura: true } as any);
      expect(res.pago_estado).toBe('COORDINADO');
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

    it('si no hay medio preferido usa pago_metodo y marca sin captura sin bloquear', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoPendiente(null, 'YAPE'));
      sinFoto();

      const res = await service.marcarCoordinado('20', cajeroUsuario);
      expect(res.pago_estado).toBe('COORDINADO');
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
        pago_estado: 'PENDIENTE', comprobante_tipo: 'BOLETA', es_personal: false, cobros: [],
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

  describe('cobrar en cierre', () => {
    const pedidoDeAyer = {
      id: 100n,
      codigo: 'CP-W062',
      total: new Prisma.Decimal(42),
      estado: 'ENTREGADO',
      pago_estado: 'PENDIENTE',
      comprobante_tipo: 'BOLETA',
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
      comprobante_tipo: 'BOLETA',
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

  describe('cierre silencioso de Validar pago al cobrar o coordinar', () => {
    const cajaAbiertaMock = { id: 10n, fecha: new Date('2026-10-21T00:00:00.000Z'), estado: 'ABIERTA' };
    const pedidoMock = {
      id: 100n,
      codigo: 'CP-0100',
      total: new Prisma.Decimal(50.0),
      estado: 'ENTREGADO',
      pago_estado: 'PENDIENTE',
      comprobante_tipo: 'BOLETA',
      pago_metodo: null,
      es_personal: false,
      cobros: [],
    };
    const conversacionEnEspera = (id: bigint, pedidoId: string) => ({
      id,
      flujo: { estado: 'VALIDAR_PAGO', pago: { pedidoId } },
      tomado_por: null,
      motivo_derivacion: null,
    });

    beforeEach(() => {
      prismaMock.conversacion = {
        findMany: jest.fn().mockResolvedValue([conversacionEnEspera(5n, '100'), conversacionEnEspera(6n, '999')]),
        update: jest.fn().mockResolvedValue({}),
      };
      prismaMock.mensajeChat = { create: jest.fn().mockResolvedValue({}) };
      prismaMock.caja.findUnique.mockResolvedValue(cajaAbiertaMock);
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.cobro.create.mockResolvedValue({
        id: 77n,
        pedido_id: 100n,
        caja_id: 10n,
        total: new Prisma.Decimal(50.0),
        credito_personal: false,
        cobrado_por: 2n,
        en: new Date(),
        pagos: [{ id: 1n, medio: 'EFECTIVO', monto: new Prisma.Decimal(50.0), recibido: null, vuelto: null }],
      });
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO' });
    });

    it('al cobrar sale de Validar pago solo la conversación de ese pedido, sin mensaje al cliente', async () => {
      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario);

      expect(res.id).toBe('77');
      expect(prismaMock.conversacion.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: expect.objectContaining({ estado: 'MENU', duenio: 'BOT', urgente: false }),
      });
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '5' });
    });

    it('si el cierre de la espera falla, el cobro queda registrado igual', async () => {
      prismaMock.conversacion.findMany.mockRejectedValueOnce(new Error('BD caída'));

      const res = await service.cobrar({ pedidoId: '100', pagos: [{ medio: 'EFECTIVO', monto: 50 }] }, cajeroUsuario);

      expect(res.id).toBe('77');
      expect(prismaMock.cobro.create).toHaveBeenCalled();
    });

    it('al coordinar el pago (Caja aprueba el digital) también sale de Validar pago en silencio', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoMock, estado: 'COLA', pago_preferido: null });
      prismaMock.pedido.update.mockResolvedValue({
        id: 100n,
        codigo: 'CP-0100',
        pago_estado: 'COORDINADO',
        pago_coordinado_en: new Date(),
        pago_coordinado_por: 2n,
      });

      await service.marcarCoordinado('100', cajeroUsuario);

      expect(prismaMock.conversacion.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: expect.objectContaining({ estado: 'MENU' }),
      });
    });
  });
});
