// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PedidosEstadoService } from './pedidos-estado.service';
import { SalonService } from '../salon/salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CobrosService } from '../caja/cobros.service';
import { ImpresionService } from '../impresion/impresion.service';

describe('PedidosEstadoService', () => {
  let service: PedidosEstadoService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;
  let salonMock: any;
  let cobrosMock: any;
  let impresionMock: any;

  const adminAuth: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  const cajeroAuth: UsuarioAutenticado = {
    partyId: 2n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const cocinaAuth: UsuarioAutenticado = {
    partyId: 3n,
    rol: 'COCINA',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
      caja: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTA' }) },
      pedido: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      pedidoEstadoHistorial: {
        create: jest.fn(),
      },
      cobro: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      // Cambios de ubicación: por defecto ninguno (ajuste pendiente = null)
      pedidoCambioUbicacion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Por defecto el pedido ya tiene un voucher útil; las pruebas del pago digital lo quitan
      voucherPago: {
        findFirst: jest.fn().mockResolvedValue({ id: 9n }),
        update: jest.fn().mockResolvedValue({}),
      },
      userAccount: {
        findMany: jest.fn(),
      },
      rolPermiso: {
        findFirst: jest.fn(),
      },
      parametro: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    redisClientMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
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

    salonMock = {
      liberarMesasDePedido: jest.fn().mockResolvedValue(0),
      avisarListo: jest.fn().mockResolvedValue(undefined),
    };
    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };
    cobrosMock = { anularCobro: jest.fn().mockResolvedValue({}) };
    impresionMock = { vencerTrabajosObsoletos: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosEstadoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: SalonService, useValue: salonMock },
        { provide: CobrosService, useValue: cobrosMock },
        { provide: ImpresionService, useValue: impresionMock },
      ],
    }).compile();

    service = module.get<PedidosEstadoService>(PedidosEstadoService);
  });

  describe('calcularMinutosYColor', () => {
    it('debe devolver verde si los minutos son menores a 35', () => {
      const ahora = new Date('2026-10-21T15:00:00Z');
      const creadoEn = new Date('2026-10-21T14:40:00Z'); // 20 minutos

      const res = service.calcularMinutosYColor(creadoEn, ahora, 35, 50);
      expect(res.minutosEspera).toBe(20);
      expect(res.color).toBe('verde');
      expect(res.colorEspera).toBe('verde');
    });

    it('debe devolver naranja si los minutos están entre 35 y 49', () => {
      const ahora = new Date('2026-10-21T15:00:00Z');
      const creadoEn = new Date('2026-10-21T14:20:00Z'); // 40 minutos

      const res = service.calcularMinutosYColor(creadoEn, ahora, 35, 50);
      expect(res.minutosEspera).toBe(40);
      expect(res.color).toBe('naranja');
      expect(res.colorEspera).toBe('naranja');
    });

    it('debe devolver rojo si los minutos son 50 o más', () => {
      const ahora = new Date('2026-10-21T15:00:00Z');
      const creadoEn = new Date('2026-10-21T14:05:00Z'); // 55 minutos

      const res = service.calcularMinutosYColor(creadoEn, ahora, 35, 50);
      expect(res.minutosEspera).toBe(55);
      expect(res.color).toBe('rojo');
      expect(res.colorEspera).toBe('rojo');
    });

    it('debe respetar los parámetros de BD si existen', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'rep_naranja_min', valor: 20 },
        { clave: 'rep_rojo_min', valor: 30 },
      ]);

      const umbrales = await service.obtenerUmbrales();
      expect(umbrales.naranjaMin).toBe(20);
      expect(umbrales.rojoMin).toBe(30);

      const ahora = new Date('2026-10-21T15:00:00Z');
      const creadoEn = new Date('2026-10-21T14:35:00Z'); // 25 minutos

      const res = service.calcularMinutosYColor(creadoEn, ahora, umbrales.naranjaMin, umbrales.rojoMin);
      expect(res.minutosEspera).toBe(25);
      expect(res.color).toBe('naranja');
    });
  });

  describe('transición válida', () => {
    it('debe pasar de COLA a PREPARANDO en DELIVERY', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'COLA',
        pasa_cocina_en: null,
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'PREPARANDO',
        pasa_cocina_en: new Date(),
      });

      const res = await service.cambiarEstado(10n, { estado: 'PREPARANDO' }, cocinaAuth);

      expect(res.estado).toBe('PREPARANDO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({ estado: 'PREPARANDO' }),
        }),
      );
      expect(prismaMock.pedidoEstadoHistorial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pedido_id: 10n,
            estado_anterior: 'COLA',
            estado_nuevo: 'PREPARANDO',
          }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CAMBIAR_ESTADO',
          entidad: 'pedido',
          entidadId: 10n,
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:estado', {
        id: 10,
        codigo: 'CP-W001',
        estado: 'PREPARANDO',
      });
    });

    it('un pedido de MESA que pasa a LISTO avisa al mozo; uno de DELIVERY no', async () => {
      const mesa = { id: 10n, codigo: 'CP-M001', modalidad: 'MESA', estado: 'PREPARANDO', listo_en: null };
      prismaMock.pedido.findUnique.mockResolvedValue(mesa);
      prismaMock.pedido.update.mockResolvedValue({ ...mesa, estado: 'LISTO' });
      await service.cambiarEstado(10n, { estado: 'LISTO' }, cocinaAuth);
      expect(salonMock.avisarListo).toHaveBeenCalledWith(10n);

      salonMock.avisarListo.mockClear();
      const delivery = { ...mesa, id: 11n, codigo: 'CP-W011', modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n };
      prismaMock.pedido.findUnique.mockResolvedValue(delivery);
      prismaMock.pedido.update.mockResolvedValue({ ...delivery, estado: 'LISTO' });
      await service.cambiarEstado(11n, { estado: 'LISTO' }, cocinaAuth);
      expect(salonMock.avisarListo).not.toHaveBeenCalled();
    });

    it('debe pasar de PREPARANDO a LISTO', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'PREPARANDO',
        listo_en: null,
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'LISTO',
        listo_en: new Date(),
      });

      const res = await service.cambiarEstado(10n, { estado: 'LISTO' }, cocinaAuth);

      expect(res.estado).toBe('LISTO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'LISTO' }),
        }),
      );
    });

    it('debe pasar de LISTO a EN_CAMINO en modalidad DELIVERY', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'LISTO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'EN_CAMINO',
      });

      const res = await service.cambiarEstado(10n, { estado: 'EN_CAMINO' }, cajeroAuth);
      expect(res.estado).toBe('EN_CAMINO');
    });

    it('debe saltar EN_CAMINO e ir de LISTO a ENTREGADO en RECOJO', async () => {
      const pedidoMock = {
        id: 11n,
        codigo: 'CP-W002',
        modalidad: 'RECOGER',
        estado: 'LISTO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'ENTREGADO',
      });

      const res = await service.cambiarEstado(11n, { estado: 'ENTREGADO' }, cajeroAuth);
      expect(res.estado).toBe('ENTREGADO');
    });

    it('debe saltar EN_CAMINO e ir de LISTO a ENTREGADO en SALON', async () => {
      const pedidoMock = {
        id: 12n,
        codigo: 'CP-W003',
        modalidad: 'MESA',
        estado: 'LISTO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'ENTREGADO',
      });

      const res = await service.cambiarEstado(12n, { estado: 'ENTREGADO' }, cajeroAuth);
      expect(res.estado).toBe('ENTREGADO');
    });

    it('debe pasar de EN_CAMINO a ENTREGADO en DELIVERY', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'EN_CAMINO',
        repartidor_party_id: 55n,
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'ENTREGADO',
      });

      const res = await service.cambiarEstado(10n, { estado: 'ENTREGADO' }, cajeroAuth);
      expect(res.estado).toBe('ENTREGADO');
    });
  });

  describe('delivery sin ubicación: DELIVERY_SIN_UBICACION', () => {
    const sinUbicar = { id: 10n, codigo: 'CP-W031', modalidad: 'DELIVERY', estado: 'COLA', pago_estado: 'PENDIENTE', entrega_lat: null, entrega_lng: null, zona_id: null, pasa_cocina_en: null };

    it.each(['PREPARANDO', 'LISTO'])('cambiarEstado a %s no pasa a cocina: 409 y no actualiza', async (estado) => {
      prismaMock.pedido.findUnique.mockResolvedValue(sinUbicar);
      await expect(service.cambiarEstado(10n, { estado }, cocinaAuth)).rejects.toMatchObject({
        response: { codigo: 'DELIVERY_SIN_UBICACION', mensaje: 'Para delivery primero ubica la dirección en el mapa (calcula la zona y el envío).' },
        status: 409,
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('con punto pero sin zona tampoco pasa', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...sinUbicar, entrega_lat: -12.1, entrega_lng: -77 });
      await expect(service.cambiarEstado(10n, { estado: 'PREPARANDO' }, cocinaAuth)).rejects.toMatchObject({
        response: { codigo: 'DELIVERY_SIN_UBICACION' },
      });
    });

    it('registrarPago (confirmar pedido y pago) queda bloqueado', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(sinUbicar);
      await expect(service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'COORDINADO' }, cajeroAuth)).rejects.toMatchObject({
        response: { codigo: 'DELIVERY_SIN_UBICACION' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('un pedido de MESA sin punto no se toca', async () => {
      const mesa = { ...sinUbicar, modalidad: 'MESA' };
      prismaMock.pedido.findUnique.mockResolvedValue(mesa);
      prismaMock.pedido.update.mockResolvedValue({ ...mesa, estado: 'PREPARANDO' });
      const res = await service.cambiarEstado(10n, { estado: 'PREPARANDO' }, cocinaAuth);
      expect(res.estado).toBe('PREPARANDO');
    });
  });

  describe('transición inválida (409)', () => {
    it('un delivery sin repartidor no pasa a ENTREGADO: 409 REPARTIDOR_REQUERIDO y no se actualiza', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'EN_CAMINO',
        repartidor_party_id: null,
      });

      await expect(
        service.cambiarEstado(10n, { estado: 'ENTREGADO' }, cajeroAuth),
      ).rejects.toMatchObject({
        status: 409,
        response: {
          codigo: 'REPARTIDOR_REQUERIDO',
          mensaje: 'Asigna un repartidor antes de marcar el pedido como entregado',
        },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('debe rechazar salto de COLA a ENTREGADO con 409', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'ENTREGADO' }, cajeroAuth),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar LISTO a EN_CAMINO en modalidad RECOJO con 409', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'RECOGER',
        estado: 'LISTO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'EN_CAMINO' }, cajeroAuth),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar cambiar estado desde un estado final (ENTREGADO)', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'ENTREGADO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'PREPARANDO' }, cajeroAuth),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar anular si el pedido ya está EN_CAMINO (409)', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'EN_CAMINO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Cliente no contesta' }, adminAuth),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('anulación de pedidos (DT-61)', () => {
    it('debe rechazar anulación si el motivo tiene menos de 5 caracteres', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'mal' }, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('anular un pedido libera sus mesas y un fallo al liberar no deshace la anulación', async () => {
      const pedidoMock = { id: 10n, codigo: 'CP-M010', modalidad: 'MESA', estado: 'COLA' };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, estado: 'ANULADO' });
      salonMock.liberarMesasDePedido.mockRejectedValue(new Error('falló al liberar'));

      const res = await service.cambiarEstado(
        10n,
        { estado: 'ANULADO', motivo: 'Cliente desistió de compra' },
        adminAuth,
      );

      expect(res.estado).toBe('ANULADO');
      expect(salonMock.liberarMesasDePedido).toHaveBeenCalledWith(10n);
    });

    it('anula con motivo, sin ningún código, y audita a nombre de quien anula', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY', entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n,
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'ANULADO',
        anulacion_aprobada_por: adminAuth.partyId,
        motivo_anulacion: 'Cliente desistió de compra',
      });

      const res = await service.cambiarEstado(
        10n,
        { estado: 'ANULADO', motivo: 'Cliente desistió de compra' },
        adminAuth,
      );

      expect(res.estado).toBe('ANULADO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({
            estado: 'ANULADO',
            anulado_por: adminAuth.partyId,
            motivo_anulacion: 'Cliente desistió de compra',
          }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ANULAR',
          resultado: 'OK',
          partyId: adminAuth.partyId,
          motivo: 'Cliente desistió de compra',
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:estado', {
        id: 10,
        codigo: 'CP-W001',
        estado: 'ANULADO',
      });
    });
  });

  describe('anular desde cocina un pedido en curso (completo, caja cuadrada)', () => {
    const enCola = { id: 10n, codigo: 'CP-K010', modalidad: 'RECOGER', estado: 'COLA' };
    const motivo = 'Cliente se arrepintió';

    it('sin cobro no toca la caja; vence las etiquetas pendientes y avisa a todas las pantallas', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(enCola);
      prismaMock.pedido.update.mockResolvedValue({ ...enCola, estado: 'ANULADO' });

      await service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, adminAuth);

      expect(cobrosMock.anularCobro).not.toHaveBeenCalled();
      expect(impresionMock.vencerTrabajosObsoletos).toHaveBeenCalled();
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:estado', expect.objectContaining({ estado: 'ANULADO' }));
    });

    it('con cobro vigente lo anula primero por el flujo de Caja (queda fuera del arqueo) y luego el pedido', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(enCola);
      prismaMock.cobro.findFirst.mockResolvedValue({ id: 5n });
      prismaMock.pedido.update.mockResolvedValue({ ...enCola, estado: 'ANULADO' });

      await service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, adminAuth);

      expect(cobrosMock.anularCobro).toHaveBeenCalledWith(5n, { motivo: `Pedido anulado: ${motivo}` }, adminAuth, undefined);
      expect(cobrosMock.anularCobro.mock.invocationCallOrder[0]).toBeLessThan(prismaMock.pedido.update.mock.invocationCallOrder[0]);
    });

    it('si la caja del cobro ya cerró no anula nada (409 PEDIDO_COBRADO_CAJA_CERRADA)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(enCola);
      prismaMock.cobro.findFirst.mockResolvedValue({ id: 5n });
      cobrosMock.anularCobro.mockRejectedValue(new HttpException({ codigo: 'CAJA_CERRADA', mensaje: 'x' }, HttpStatus.CONFLICT));

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, adminAuth),
      ).rejects.toMatchObject({ response: { codigo: 'PEDIDO_COBRADO_CAJA_CERRADA' } });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('cocina sin permiso pedidos/anular recibe 403; con permiso anula y queda la marca de auditoría del alcance limitado', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(enCola);
      prismaMock.rolPermiso.findFirst.mockResolvedValue(null);
      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, cocinaAuth),
      ).rejects.toMatchObject({ response: { codigo: 'SIN_PERMISO' } });

      prismaMock.rolPermiso.findFirst.mockResolvedValue({ id: 1n });
      prismaMock.pedido.update.mockResolvedValue({ ...enCola, estado: 'ANULADO' });
      const res = await service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, cocinaAuth);
      expect(res.estado).toBe('ANULADO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ anulado_por: 3n, anulacion_aprobada_por: 3n }) }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ANULAR',
          despues: expect.objectContaining({ alcanceLimitadoPorRol: true }),
        }),
      );
    });

    it('cocina anula con cobro vigente (anula el cobro con caja cuadrada) y sigue sin código', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(enCola);
      prismaMock.rolPermiso.findFirst.mockResolvedValue({ id: 1n });
      prismaMock.cobro.findFirst.mockResolvedValue({ id: 5n });
      prismaMock.pedido.update.mockResolvedValue({ ...enCola, estado: 'ANULADO' });
      await service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, cocinaAuth);
      expect(cobrosMock.anularCobro).toHaveBeenCalled();
    });

    it('cocina no anula un ENTREGADO sin aprobación (409)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...enCola, estado: 'ENTREGADO' });
      await expect(service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, cocinaAuth)).rejects.toMatchObject({
        response: { codigo: 'ANULAR_REQUIERE_APROBACION' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });
  });

  describe('anular el mozo SU pedido (alcance limitado)', () => {
    const mozoAuth: UsuarioAutenticado = { partyId: 7n, rol: 'MOZO', debeCambiar: false };
    const suyo = { id: 10n, codigo: 'CP-M010', modalidad: 'SALON', estado: 'COLA', canal: 'MOZO', party_id: 7n, pago_estado: 'PENDIENTE' };
    const motivo = 'El cliente se fue de la mesa';

    beforeEach(() => {
      prismaMock.rolPermiso.findFirst.mockResolvedValue({ id: 1n });
      prismaMock.voucherPago.findFirst.mockResolvedValue(null);
      prismaMock.pedido.update.mockResolvedValue({ ...suyo, estado: 'ANULADO' });
    });

    it('anula el suyo sin código y deja la marca de auditoría', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(suyo);
      const res = await service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, mozoAuth);
      expect(res.estado).toBe('ANULADO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ anulacion_aprobada_por: 7n }) }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ despues: expect.objectContaining({ alcanceLimitadoPorRol: true }) }),
      );
    });

    it('el pedido de otro mozo -> 403 PEDIDO_AJENO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...suyo, party_id: 8n });
      await expect(service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, mozoAuth)).rejects.toMatchObject({
        response: { codigo: 'PEDIDO_AJENO' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('un pedido de otro canal (carta) aunque el party coincida -> 403', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...suyo, canal: 'CARTA' });
      await expect(service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, mozoAuth)).rejects.toMatchObject({
        response: { codigo: 'PEDIDO_AJENO' },
      });
    });

    it('entregado -> 409 ANULAR_REQUIERE_APROBACION', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...suyo, estado: 'ENTREGADO' });
      await expect(service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, mozoAuth)).rejects.toMatchObject({
        response: { codigo: 'ANULAR_REQUIERE_APROBACION' },
      });
    });

    it.each([
      ['cobro vigente', () => prismaMock.cobro.findFirst.mockResolvedValue({ id: 5n })],
      ['voucher aprobado', () => prismaMock.voucherPago.findFirst.mockResolvedValue({ id: 4n })],
    ])('con %s -> 409 PEDIDO_COBRADO', async (_n, preparar) => {
      prismaMock.pedido.findUnique.mockResolvedValue(suyo);
      preparar();
      await expect(service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, mozoAuth)).rejects.toMatchObject({
        response: { codigo: 'PEDIDO_COBRADO' },
      });
      expect(cobrosMock.anularCobro).not.toHaveBeenCalled();
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('sin motivo de 5 caracteres no anula (400)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(suyo);
      await expect(service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'no' }, mozoAuth)).rejects.toMatchObject({
        response: { codigo: 'MOTIVO_REQUERIDO' },
      });
    });

    it('el mozo no puede cambiar a otros estados (solo anular): 403', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(suyo);
      await expect(service.cambiarEstado(10n, { estado: 'ENTREGADO' }, mozoAuth)).rejects.toMatchObject({
        response: { codigo: 'SIN_PERMISO' },
      });
    });

    it('un cajero (también con rol extra MOZO) tiene el alcance amplio del cajero: anula sin código', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ ...suyo, party_id: 2n });
      const cajeroMozo: UsuarioAutenticado = { partyId: 2n, rol: 'CAJERO', roles: ['CAJERO', 'MOZO'], debeCambiar: false };
      const res = await service.cambiarEstado(10n, { estado: 'ANULADO', motivo }, cajeroMozo);
      expect(res.estado).toBe('ANULADO');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ANULAR', partyId: 2n, despues: expect.not.objectContaining({ alcanceLimitadoPorRol: true }) }),
      );
    });
  });

  describe('anulación de un entregado sin cobro (FT-CIE-02)', () => {
    const entregado = { id: 10n, codigo: 'CP-W062', modalidad: 'RECOGER', estado: 'ENTREGADO' };

    it('un cajero anula el entregado sin cobro con motivo, sin código; queda a su nombre', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(entregado);
      prismaMock.pedido.update.mockResolvedValue({ ...entregado, estado: 'ANULADO' });

      const res = await service.cambiarEstado(
        10n,
        { estado: 'ANULADO', motivo: 'Pedido entregado sin cobrar, error de caja' },
        cajeroAuth,
      );

      expect(res.estado).toBe('ANULADO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'ANULADO', anulado_por: cajeroAuth.partyId, anulacion_aprobada_por: cajeroAuth.partyId }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ANULAR', partyId: cajeroAuth.partyId }),
      );
    });

    it('no se anula si tiene un cobro vigente (409 PEDIDO_COBRADO)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(entregado);
      prismaMock.cobro.findFirst.mockResolvedValue({ id: 5n });

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Pedido entregado sin cobrar' }, adminAuth),
      ).rejects.toMatchObject({ response: { codigo: 'PEDIDO_COBRADO' } });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('un ADMIN lo anula solo con motivo y queda como aprobado por él mismo', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(entregado);
      prismaMock.pedido.update.mockResolvedValue({ ...entregado, estado: 'ANULADO' });

      await service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Pedido entregado sin cobrar' }, adminAuth);

      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ anulacion_aprobada_por: 1n }) }),
      );
    });
  });

  describe('numero del día, dirección editada y ajuste pendiente en el detalle', () => {
    it('obtenerPorId expone numero_dia, fecha_dia y ubicacion_editada_en; ajuste pendiente si lo hay', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 10n,
        codigo: 'CP-W010',
        comprobante_doc: null,
        creado_en: new Date(),
        numero_dia: 7,
        fecha_dia: new Date('2026-11-06T00:00:00.000Z'),
        ubicacion_editada_en: new Date('2026-11-06T16:00:00Z'),
        lineas: [],
        historial: [],
      });
      prismaMock.pedidoCambioUbicacion.findMany.mockResolvedValueOnce([
        { pedido_id: 10n, ajuste_tipo: 'DEVOLUCION', ajuste_monto: 2.5 },
      ]);

      const res: any = await service.obtenerPorId(10n, adminAuth);
      expect(res).toMatchObject({
        numero_dia: 7,
        ubicacion_editada_en: new Date('2026-11-06T16:00:00Z'),
        ajusteUbicacionPendiente: { tipo: 'DEVOLUCION', monto: 2.5 },
      });
    });

    it('sin número del día (pedido anterior) llega null y sin ajuste llega null', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 11n,
        codigo: 'CP-W011',
        comprobante_doc: null,
        creado_en: new Date(),
        numero_dia: null,
        lineas: [],
        historial: [],
      });
      const res: any = await service.obtenerPorId(11n, adminAuth);
      expect(res.numero_dia).toBeNull();
      expect(res.ajusteUbicacionPendiente).toBeNull();
    });
  });

  describe('enmascaramiento de DNI/RUC (DT-75)', () => {
    it('debe enmascarar comprobante_doc para rol CAJERO en obtenerPorId', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        comprobante_doc: '12345678',
        creado_en: new Date(),
        lineas: [],
        historial: [],
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      const res = await service.obtenerPorId(10n, cajeroAuth);
      expect(res.comprobante_doc).toBe('12****78');
      expect(res.cobro_vigente_id).toBeNull();
    });

    it('debe entregar cobro_vigente_id cuando el pedido tiene un cobro activo', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        comprobante_doc: '12345678',
        creado_en: new Date(),
        lineas: [],
        historial: [],
        cobros: [{ id: 99n }],
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      const res = await service.obtenerPorId(10n, cajeroAuth);
      expect(res.cobro_vigente_id).toBe('99');
    });

    it('debe entregar comprobante_doc completo para rol ADMIN en obtenerPorId y auditar VER_COMPROBANTE', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        comprobante_doc: '12345678',
        creado_en: new Date(),
        lineas: [],
        historial: [],
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      const res = await service.obtenerPorId(10n, adminAuth);
      expect(res.comprobante_doc).toBe('12345678');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LECTURA_SENSIBLE',
          accion: 'VER_COMPROBANTE',
        }),
      );
    });

    it('debe enmascarar comprobante_doc en el listado para usuarios no ADMIN', async () => {
      prismaMock.pedido.count.mockResolvedValue(1);
      prismaMock.pedido.findMany.mockResolvedValue([
        {
          id: 10n,
          codigo: 'CP-W001',
          comprobante_doc: '20123456789',
          creado_en: new Date(),
          lineas: [],
        },
      ]);

      const res = await service.listar({}, cajeroAuth);
      expect(res.items[0].comprobante_doc).toBe('20****89');
    });
  });

  describe('registro de pago en caja', () => {
    it('debe registrar pago con método válido y estado COORDINADO', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        pago_metodo: null,
        pago_estado: 'PENDIENTE',
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        pago_metodo: 'YAPE',
        pago_estado: 'COORDINADO',
      });

      const res = await service.registrarPago(
        10n,
        { metodo: 'YAPE', estado: 'COORDINADO', codigosOperacion: [{ medio: 'YAPE', codigo: '123456' }] },
        cajeroAuth,
      );

      expect(res.pago_metodo).toBe('YAPE');
      expect(res.pago_estado).toBe('COORDINADO');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'REGISTRAR_PAGO',
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:estado', {
        id: 10,
        codigo: 'CP-W001',
        estado: 'COLA',
      });
    });

    it('pago PAGADO suma los puntos del cliente (no pasa por Caja → cobrar); COORDINADO no', async () => {
      const acumular = jest.fn().mockResolvedValue({ puntos: 1, sumados: true });
      (service as any).puntosService = { acumularPorPedido: acumular };
      const pedidoMock = { id: 10n, codigo: 'CP-W001', pago_metodo: null, pago_estado: 'PENDIENTE', estado: 'EN_CAMINO' };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, pago_metodo: 'EFECTIVO', pago_estado: 'PAGADO' });

      await service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'COORDINADO' }, cajeroAuth);
      expect(acumular).not.toHaveBeenCalled();
      await service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'PAGADO' }, cajeroAuth);
      expect(acumular).toHaveBeenCalledWith(10n);
    });

    it('al confirmar Caja el pago de un pedido que sigue en cocina, encola sus etiquetas (la carta nace en COLA); si ya salió de cocina, no', async () => {
      const encolar = jest.fn().mockResolvedValue(undefined);
      (service as any).impresionService = { encolarEtiquetasPedido: encolar, encolarTicketPedido: jest.fn().mockResolvedValue(undefined) };
      const base = { id: 10n, codigo: 'CP-W014', pago_metodo: null, pago_estado: 'PENDIENTE' };

      prismaMock.pedido.findUnique.mockResolvedValue({ ...base, estado: 'COLA' });
      prismaMock.pedido.update.mockResolvedValue({ ...base, estado: 'COLA', pago_metodo: 'EFECTIVO', pago_estado: 'COORDINADO' });
      await service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'COORDINADO' }, cajeroAuth);
      expect(encolar).toHaveBeenCalledWith(10n);

      encolar.mockClear();
      prismaMock.pedido.findUnique.mockResolvedValue({ ...base, estado: 'EN_CAMINO' });
      await service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'PAGADO' }, cajeroAuth);
      expect(encolar).not.toHaveBeenCalled();
    });

    it('debe rechazar método de pago inválido', async () => {
      const pedidoMock = { id: 10n };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.registrarPago(10n, { metodo: 'BITCOIN', estado: 'PAGADO' }, cajeroAuth),
      ).rejects.toThrow(BadRequestException);
    });

    describe('pago digital exige voucher (Yape, Plin, transferencia)', () => {
      const pedidoSinPagar = { id: 10n, codigo: 'CP-W001', pago_metodo: null, pago_estado: 'PENDIENTE', estado: 'COLA' };

      beforeEach(() => {
        prismaMock.pedido.findUnique.mockResolvedValue(pedidoSinPagar);
        prismaMock.pedido.update.mockResolvedValue({ ...pedidoSinPagar, pago_metodo: 'YAPE', pago_estado: 'PAGADO' });
      });

      it('YAPE sin ningún voucher -> 400 VOUCHER_REQUERIDO, no registra ni cambia el estado', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        await expect(
          service.registrarPago(10n, { metodo: 'YAPE', estado: 'PAGADO' }, cajeroAuth),
        ).rejects.toMatchObject({ response: { codigo: 'VOUCHER_REQUERIDO' } });
        expect(prismaMock.pedido.update).not.toHaveBeenCalled();
        expect(auditoriaMock.registrar).not.toHaveBeenCalled();
      });

      it('busca solo vouchers no ILEGIBLE del pedido', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        await expect(service.registrarPago(10n, { metodo: 'PLIN', estado: 'PAGADO' }, cajeroAuth)).rejects.toThrow();
        expect(prismaMock.voucherPago.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: { pedido_id: 10n, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } } }),
        );
      });

      it('con un voucher útil enlazado -> registra el pago normal', async () => {
        const res = await service.registrarPago(
          10n,
          { metodo: 'YAPE', estado: 'PAGADO', codigosOperacion: [{ medio: 'YAPE', codigo: '123456' }] },
          cajeroAuth,
        );

        expect(res.pago_estado).toBe('PAGADO');
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REGISTRAR_PAGO' }));
      });

      it('solo un voucher ILEGIBLE -> 400 VOUCHER_REQUERIDO (no cuenta como comprobante)', async () => {
        // La consulta excluye ILEGIBLE: sin voucher útil, vuelve el error
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        await expect(
          service.registrarPago(10n, { metodo: 'TRANSFERENCIA', estado: 'PAGADO' }, cajeroAuth),
        ).rejects.toMatchObject({ response: { codigo: 'VOUCHER_REQUERIDO' } });
        expect(prismaMock.pedido.update).not.toHaveBeenCalled();
      });

      it('EFECTIVO y TARJETA no piden voucher ni código de operación', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        await service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'COORDINADO' }, cajeroAuth);
        await service.registrarPago(10n, { metodo: 'tarjeta', estado: 'PAGADO' }, cajeroAuth);

        expect(prismaMock.pedido.update).toHaveBeenCalledTimes(2);
        // Sin código no se busca el voucher donde guardarlo
        expect(prismaMock.voucherPago.findFirst).not.toHaveBeenCalled();
      });

      it('digital sin código de operación -> 400 CODIGO_OPERACION_REQUERIDO, no registra', async () => {
        await expect(
          service.registrarPago(10n, { metodo: 'YAPE', estado: 'PAGADO' }, cajeroAuth),
        ).rejects.toMatchObject({ response: { codigo: 'CODIGO_OPERACION_REQUERIDO', faltan: ['YAPE'] } });
        await expect(
          service.registrarPago(10n, { metodo: 'YAPE', estado: 'PAGADO', codigosOperacion: [{ medio: 'YAPE', codigo: '   ' }] }, cajeroAuth),
        ).rejects.toMatchObject({ response: { codigo: 'CODIGO_OPERACION_REQUERIDO' } });
        expect(prismaMock.pedido.update).not.toHaveBeenCalled();
        expect(auditoriaMock.registrar).not.toHaveBeenCalled();
      });

      it('plan mixto efectivo + Yape: pide solo el código de Yape', async () => {
        prismaMock.pedido.findUnique.mockResolvedValue({
          ...pedidoSinPagar,
          planPago: [{ medio: 'EFECTIVO', monto: 10 }, { medio: 'YAPE', monto: 25 }],
        });

        await expect(
          service.registrarPago(10n, { metodo: 'EFECTIVO', estado: 'COORDINADO' }, cajeroAuth),
        ).rejects.toMatchObject({ response: { codigo: 'CODIGO_OPERACION_REQUERIDO', faltan: ['YAPE'] } });

        const res = await service.registrarPago(
          10n,
          { metodo: 'EFECTIVO', estado: 'COORDINADO', codigosOperacion: [{ medio: 'yape', codigo: '998877' }] },
          cajeroAuth,
        );
        expect(res.pago_estado).toBe('PAGADO');
      });

      it('pago dividido Yape S/ 38 + efectivo S/ 2: validar el Yape deja el pedido COORDINADO, no PAGADO', async () => {
        prismaMock.pedido.findUnique.mockResolvedValue({
          ...pedidoSinPagar,
          total: 40,
          planPago: [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }],
        });

        await service.registrarPago(
          10n,
          { metodo: 'YAPE', estado: 'PAGADO', codigosOperacion: [{ medio: 'YAPE', codigo: '555111' }] },
          cajeroAuth,
        );

        expect(prismaMock.pedido.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ pago_estado: 'COORDINADO' }) }),
        );
      });

      it('plan solo digital (Yape + Plin): validar los vouchers sí deja el pedido PAGADO', async () => {
        prismaMock.voucherPago.findMany = jest.fn().mockResolvedValue([{ medio: 'YAPE' }, { medio: 'PLIN' }]);
        prismaMock.pedido.findUnique.mockResolvedValue({
          ...pedidoSinPagar,
          planPago: [{ medio: 'YAPE', monto: 20 }, { medio: 'PLIN', monto: 20 }],
        });

        await service.registrarPago(
          10n,
          {
            metodo: 'YAPE',
            estado: 'PAGADO',
            codigosOperacion: [{ medio: 'YAPE', codigo: '1' }, { medio: 'PLIN', codigo: '2' }],
          },
          cajeroAuth,
        );

        expect(prismaMock.pedido.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ pago_estado: 'PAGADO' }) }),
        );
      });

      it('guarda el código confirmado en el voucher vigente (si difiere de la lectura) y lo audita', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue({ id: 9n, operacion: '111' });

        await service.registrarPago(
          10n,
          { metodo: 'YAPE', estado: 'PAGADO', codigosOperacion: [{ medio: 'YAPE', codigo: '222' }] },
          cajeroAuth,
        );

        expect(prismaMock.voucherPago.update).toHaveBeenCalledWith({ where: { id: 9n }, data: { operacion: '222' } });
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            despues: expect.objectContaining({ codigos_operacion: [{ medio: 'YAPE', codigo: '222' }] }),
          }),
        );
      });

      it('excepción con motivo escrito -> registra y audita con el motivo', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        const res = await service.registrarPago(
          10n,
          {
            metodo: 'YAPE',
            estado: 'PAGADO',
            sinVoucher: { motivo: 'El cliente no tenía señal' },
            codigosOperacion: [{ medio: 'YAPE', codigo: '777001' }],
          },
          cajeroAuth,
        );

        expect(res.pago_estado).toBe('PAGADO');
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            accion: 'REGISTRAR_PAGO_SIN_VOUCHER',
            motivo: 'El cliente no tenía señal',
            despues: expect.objectContaining({
              sin_voucher: expect.objectContaining({ motivo: 'El cliente no tenía señal' }),
            }),
          }),
        );
      });

    });
  });

  describe('vista de cocina (DT-58)', () => {
    it('debe listar solo COLA y PREPARANDO ordenados más viejos primero', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        { id: 1n, codigo: 'CP-W001', estado: 'COLA', creado_en: new Date('2026-10-21T14:00:00Z'), lineas: [] },
        { id: 2n, codigo: 'CP-W002', estado: 'PREPARANDO', creado_en: new Date('2026-10-21T14:10:00Z'), lineas: [] },
      ]);

      const res = await service.listarCocina(false, cocinaAuth);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            estado: { in: ['COLA', 'PREPARANDO'] },
            NOT: [
              {
                pago_metodo: { in: ['YAPE', 'PLIN', 'TRANSFERENCIA'] },
                pago_estado: 'PENDIENTE',
                pago_coordinado_en: null,
                modalidad: { not: 'MESA' },
              },
              { modalidad: 'DELIVERY', OR: [{ entrega_lat: null }, { entrega_lng: null }, { zona_id: null }] },
            ],
          },
          orderBy: { creado_en: 'asc' },
        }),
      );
      expect(res).toHaveLength(2);
      expect(res[0].codigo).toBe('CP-W001');
      expect(res[1].codigo).toBe('CP-W002');
    });

    it('devuelve en cada línea el nombre que el cliente puso a cada bebida (nombres_persona)', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        {
          id: 4n,
          codigo: 'CP-W004',
          estado: 'COLA',
          creado_en: new Date(),
          lineas: [{ id: 1n, nombre: 'Frappe fresa', cantidad: 2, nombres_persona: ['Ana', 'Luis'] }],
        },
      ]);

      const res = await service.listarCocina(false, cocinaAuth);

      expect((res[0].lineas as any[])[0].nombres_persona).toEqual(['Ana', 'Luis']);
    });

    it('si historial=true debe buscar pedidos listos del día', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        { id: 3n, codigo: 'CP-W003', estado: 'LISTO', creado_en: new Date(), lineas: [] },
      ]);

      const res = await service.listarCocina(true, cocinaAuth);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: { in: ['LISTO', 'EN_CAMINO', 'ENTREGADO'] },
          }),
          orderBy: { listo_en: 'desc' },
        }),
      );
      expect(res).toHaveLength(1);
    });
  });

  describe('cobro por mozo (cobroMozo) en la lista y el detalle', () => {
    const horaCobro = new Date('2026-10-30T12:00:00Z');
    const pedidoBase = {
      id: 10n,
      codigo: 'CP-W010',
      estado: 'COLA',
      modalidad: 'MESA',
      canal: 'MOZO',
      total: 35,
      subtotal: 35,
      descuento: 0,
      creado_en: new Date(),
      pago_estado: 'PENDIENTE',
      pago_metodo: 'YAPE',
      cobro_mozo_en: horaCobro,
      cobro_mozo_medio: 'YAPE',
      cobro_mozo_party_id: 7n,
      lineas: [],
      historial: [],
      cobros: [],
      zona: null,
      comprobante_doc: null,
    };

    beforeEach(() => {
      prismaMock.person = {
        findMany: jest.fn().mockResolvedValue([{ party_id: 7n, nombres: 'Juan', apellidos: 'Mozo' }]),
      };
      prismaMock.voucherPago.findMany = jest.fn().mockResolvedValue([]);
      prismaMock.pedidoPagoPlan = { findMany: jest.fn().mockResolvedValue([]) };
    });

    it('lista: buscar filtra por código, cliente o mesa', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([]);
      prismaMock.pedido.count = jest.fn().mockResolvedValue(0);

      await service.listar({ buscar: ' Mesa 4 ' }, cajeroAuth);

      expect(prismaMock.pedido.findMany.mock.calls[0][0].where.OR).toEqual([
        { codigo: { contains: 'Mesa 4', mode: 'insensitive' } },
        { cliente_nombre: { contains: 'Mesa 4', mode: 'insensitive' } },
        { mesa_nombre: { contains: 'Mesa 4', mode: 'insensitive' } },
      ]);
    });

    it('lista: digital sin voucher legible lleva sinCaptura (el mozo confirmó), mozo y hora', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([pedidoBase]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo).toEqual({ en: horaCobro, medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: false, sinCaptura: true, recibido: null, vuelto: null, pide: null });
    });

    it('lista: con voucher vigente y legible no falta voucher; un ILEGIBLE no cuenta (filtro en la consulta)', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([pedidoBase]);
      prismaMock.voucherPago.findMany.mockResolvedValue([{ pedido_id: 10n }]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo?.faltaVoucher).toBe(false);
      expect(res.items[0].cobroMozo?.sinCaptura).toBe(false);
      expect(prismaMock.voucherPago.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pedido_id: { in: [10n] }, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } },
        }),
      );
    });

    it('lista: plan con efectivo y digital sigue marcando el voucher; solo efectivo no lo pide', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        { ...pedidoBase, id: 11n, cobro_mozo_medio: 'EFECTIVO+YAPE' },
        { ...pedidoBase, id: 12n, cobro_mozo_medio: 'EFECTIVO' },
      ]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo).toMatchObject({ medio: 'EFECTIVO+YAPE', faltaVoucher: false, sinCaptura: true });
      expect(res.items[1].cobroMozo).toMatchObject({ medio: 'EFECTIVO', faltaVoucher: false });
    });

    it('pedido PAGADO: cobroMozo es null aunque el mozo lo haya enviado', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([{ ...pedidoBase, pago_estado: 'PAGADO' }]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo).toBeNull();
    });

    it('sin envío del mozo: cobroMozo es null y no consulta vouchers', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        { ...pedidoBase, cobro_mozo_en: null, cobro_mozo_medio: null, cobro_mozo_party_id: null },
      ]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo).toBeNull();
      expect(prismaMock.voucherPago.findMany).not.toHaveBeenCalled();
    });

    it('detalle: entrega cobroMozo con mozo y falta de voucher; null si ya está PAGADO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoBase);
      const pendiente = await service.obtenerPorId(10n, cajeroAuth);
      expect(pendiente.cobroMozo).toEqual({ en: horaCobro, medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: false, sinCaptura: true, recibido: null, vuelto: null, pide: null });

      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoBase, pago_estado: 'PAGADO' });
      const pagado = await service.obtenerPorId(10n, cajeroAuth);
      expect(pagado.cobroMozo).toBeNull();
    });
  });
});
