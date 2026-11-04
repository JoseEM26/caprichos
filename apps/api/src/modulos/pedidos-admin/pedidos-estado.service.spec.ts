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
import * as argon2 from 'argon2';
import { PedidosEstadoService } from './pedidos-estado.service';
import { SalonService } from '../salon/salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { SupervisorCodigoService } from '../supervisor-codigo/supervisor-codigo.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('PedidosEstadoService', () => {
  let service: PedidosEstadoService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;
  let salonMock: any;

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

    const supervisorCodigoMock = {
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
        if (!codigo || codigo !== '654321') {
          await redisClientMock.incr(claveIntentos);
          await auditoriaMock.registrar({
            categoria: 'ACCESO',
            modulo: 'pedidos',
            accion: 'PIN_FALLIDO',
            resultado: 'RECHAZADO',
          });
          throw new HttpException(
            { codigo: 'CODIGO_INVALIDO', mensaje: 'Código de supervisor inválido o no proporcionado' },
            HttpStatus.FORBIDDEN,
          );
        }
        await redisClientMock.del(claveIntentos);
        return { party_id: 99n, id: 99n, valido: true };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosEstadoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: SalonService, useValue: salonMock },
        { provide: SupervisorCodigoService, useValue: supervisorCodigoMock },
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
        modalidad: 'DELIVERY',
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
      const delivery = { ...mesa, id: 11n, codigo: 'CP-W011', modalidad: 'DELIVERY' };
      prismaMock.pedido.findUnique.mockResolvedValue(delivery);
      prismaMock.pedido.update.mockResolvedValue({ ...delivery, estado: 'LISTO' });
      await service.cambiarEstado(11n, { estado: 'LISTO' }, cocinaAuth);
      expect(salonMock.avisarListo).not.toHaveBeenCalled();
    });

    it('debe pasar de PREPARANDO a LISTO', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
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
        modalidad: 'DELIVERY',
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
        modalidad: 'DELIVERY',
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

  describe('transición inválida (409)', () => {
    it('un delivery sin repartidor no pasa a ENTREGADO: 409 REPARTIDOR_REQUERIDO y no se actualiza', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
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
        modalidad: 'DELIVERY',
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
        modalidad: 'DELIVERY',
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
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Cliente no contesta' }, adminAuth, '123456'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('anulación de pedidos (DT-61)', () => {
    it('debe rechazar anulación si el motivo tiene menos de 5 caracteres', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'mal' }, adminAuth, '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar anulación sin PIN con 403 y auditar PIN_FALLIDO', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Cliente canceló por WhatsApp' }, adminAuth, undefined),
      ).rejects.toThrow(HttpException);

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PIN_FALLIDO',
          resultado: 'RECHAZADO',
        }),
      );
      expect(redisClientMock.incr).toHaveBeenCalled();
    });

    it('debe rechazar anulación con PIN incorrecto con 403 y auditar PIN_FALLIDO', async () => {
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 1n,
          party_id: 1n,
          rol: 'ADMIN',
          activo: true,
          pin_hash: await argon2.hash('654321'),
        },
      ]);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Cliente canceló el pedido' }, adminAuth, '111111'),
      ).rejects.toThrow(HttpException);

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PIN_FALLIDO',
          resultado: 'RECHAZADO',
        }),
      );
    });

    it('3 pines malos bloquean 10 minutos en Redis', async () => {
      redisClientMock.get.mockResolvedValue('3'); // Ya tiene 3 fallos

      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      try {
        await service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Cliente canceló el pedido' }, adminAuth, '654321');
        fail('Debió lanzar excepción');
      } catch (err: any) {
        expect(err.getStatus()).toBe(403);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'CODIGO_BLOQUEADO',
          }),
        );
      }
    });

    it('anular un pedido libera sus mesas y un fallo al liberar no deshace la anulación', async () => {
      const supervisorHash = await argon2.hash('654321');
      const pedidoMock = { id: 10n, codigo: 'CP-M010', modalidad: 'MESA', estado: 'COLA' };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.userAccount.findMany.mockResolvedValue([
        { id: 99n, party_id: 99n, rol: 'ADMIN', activo: true, pin_hash: supervisorHash },
      ]);
      prismaMock.pedido.update.mockResolvedValue({ ...pedidoMock, estado: 'ANULADO' });
      salonMock.liberarMesasDePedido.mockRejectedValue(new Error('falló al liberar'));

      const res = await service.cambiarEstado(
        10n,
        { estado: 'ANULADO', motivo: 'Cliente desistió de compra' },
        adminAuth,
        '654321',
      );

      expect(res.estado).toBe('ANULADO');
      expect(salonMock.liberarMesasDePedido).toHaveBeenCalledWith(10n);
    });

    it('anula exitosamente con PIN correcto de supervisor ADMIN', async () => {
      const supervisorPin = '654321';
      const supervisorHash = await argon2.hash(supervisorPin);

      const pedidoMock = {
        id: 10n,
        codigo: 'CP-W001',
        modalidad: 'DELIVERY',
        estado: 'COLA',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 99n,
          party_id: 99n,
          rol: 'ADMIN',
          activo: true,
          pin_hash: supervisorHash,
        },
      ]);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'ANULADO',
        anulacion_aprobada_por: 99n,
        motivo_anulacion: 'Cliente desistió de compra',
      });

      const res = await service.cambiarEstado(
        10n,
        { estado: 'ANULADO', motivo: 'Cliente desistió de compra' },
        adminAuth,
        supervisorPin,
      );

      expect(res.estado).toBe('ANULADO');
      expect(redisClientMock.del).toHaveBeenCalled(); // Resetea contador
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({
            estado: 'ANULADO',
            anulacion_aprobada_por: 99n,
            motivo_anulacion: 'Cliente desistió de compra',
          }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ANULAR',
          resultado: 'OK',
          conPinAdmin: true,
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('pedido:estado', {
        id: 10,
        codigo: 'CP-W001',
        estado: 'ANULADO',
      });
    });
  });

  describe('anulación de un entregado sin cobro (FT-CIE-02)', () => {
    const entregado = { id: 10n, codigo: 'CP-W062', modalidad: 'RECOGER', estado: 'ENTREGADO' };

    it('con PIN de supervisor válido un cajero anula el entregado sin cobro; queda quién lo aprobó', async () => {
      const supervisorHash = await argon2.hash('654321');
      prismaMock.pedido.findUnique.mockResolvedValue(entregado);
      prismaMock.userAccount.findMany.mockResolvedValue([
        { id: 99n, party_id: 99n, rol: 'ADMIN', activo: true, pin_hash: supervisorHash },
      ]);
      prismaMock.pedido.update.mockResolvedValue({ ...entregado, estado: 'ANULADO' });

      const res = await service.cambiarEstado(
        10n,
        { estado: 'ANULADO', motivo: 'Pedido entregado sin cobrar, error de caja' },
        cajeroAuth,
        '654321',
      );

      expect(res.estado).toBe('ANULADO');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'ANULADO', anulacion_aprobada_por: 99n }),
        }),
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

    it('un cajero sin PIN no lo anula (403 CODIGO_INVALIDO)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(entregado);

      await expect(
        service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Pedido entregado sin cobrar' }, cajeroAuth),
      ).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('un ADMIN lo anula solo con motivo, sin PIN, y queda como aprobado por él mismo', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(entregado);
      prismaMock.pedido.update.mockResolvedValue({ ...entregado, estado: 'ANULADO' });

      await service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Pedido entregado sin cobrar' }, adminAuth);

      expect(prismaMock.userAccount.findMany).not.toHaveBeenCalled();
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ anulacion_aprobada_por: 1n }) }),
      );
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

      it('excepción con código de supervisor válido -> registra y audita con el motivo', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        const res = await service.registrarPago(
          10n,
          {
            metodo: 'YAPE',
            estado: 'PAGADO',
            sinVoucher: { motivo: 'El cliente no tenía señal', pinSupervisor: '654321' },
            codigosOperacion: [{ medio: 'YAPE', codigo: '777001' }],
          },
          cajeroAuth,
        );

        expect(res.pago_estado).toBe('PAGADO');
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            accion: 'REGISTRAR_PAGO_SIN_VOUCHER',
            conPinAdmin: true,
            motivo: 'El cliente no tenía señal',
            despues: expect.objectContaining({
              sin_voucher: expect.objectContaining({ motivo: 'El cliente no tenía señal' }),
            }),
          }),
        );
      });

      it('excepción con código de supervisor inválido -> error y no registra el pago', async () => {
        prismaMock.voucherPago.findFirst.mockResolvedValue(null);

        await expect(
          service.registrarPago(
            10n,
            {
              metodo: 'YAPE',
              estado: 'PAGADO',
              sinVoucher: { motivo: 'Motivo válido', pinSupervisor: '000000' },
              codigosOperacion: [{ medio: 'YAPE', codigo: '777001' }],
            },
            cajeroAuth,
          ),
        ).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
        expect(prismaMock.pedido.update).not.toHaveBeenCalled();
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
            NOT: {
              pago_metodo: { in: ['YAPE', 'PLIN', 'TRANSFERENCIA'] },
              pago_estado: 'PENDIENTE',
              pago_coordinado_en: null,
              modalidad: { not: 'MESA' },
            },
          },
          orderBy: { creado_en: 'asc' },
        }),
      );
      expect(res).toHaveLength(2);
      expect(res[0].codigo).toBe('CP-W001');
      expect(res[1].codigo).toBe('CP-W002');
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

    it('lista: digital sin voucher legible lleva faltaVoucher, mozo y hora', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([pedidoBase]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo).toEqual({ en: horaCobro, medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: true, recibido: null, vuelto: null, pide: null });
    });

    it('lista: con voucher vigente y legible no falta voucher; un ILEGIBLE no cuenta (filtro en la consulta)', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([pedidoBase]);
      prismaMock.voucherPago.findMany.mockResolvedValue([{ pedido_id: 10n }]);

      const res = await service.listar({}, cajeroAuth);

      expect(res.items[0].cobroMozo?.faltaVoucher).toBe(false);
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

      expect(res.items[0].cobroMozo).toMatchObject({ medio: 'EFECTIVO+YAPE', faltaVoucher: true });
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
      expect(pendiente.cobroMozo).toEqual({ en: horaCobro, medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: true, recibido: null, vuelto: null, pide: null });

      prismaMock.pedido.findUnique.mockResolvedValue({ ...pedidoBase, pago_estado: 'PAGADO' });
      const pagado = await service.obtenerPorId(10n, cajeroAuth);
      expect(pagado.cobroMozo).toBeNull();
    });
  });
});
