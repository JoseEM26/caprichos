// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PedidosEstadoService } from './pedidos-estado.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('PedidosEstadoService', () => {
  let service: PedidosEstadoService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;

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
      pedido: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      pedidoEstadoHistorial: {
        create: jest.fn(),
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

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosEstadoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
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
            codigo: 'PIN_BLOQUEADO',
          }),
        );
      }
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

      const res = await service.registrarPago(10n, { metodo: 'YAPE', estado: 'COORDINADO' }, cajeroAuth);

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

    it('debe rechazar método de pago inválido', async () => {
      const pedidoMock = { id: 10n };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(
        service.registrarPago(10n, { metodo: 'BITCOIN', estado: 'PAGADO' }, cajeroAuth),
      ).rejects.toThrow(BadRequestException);
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
          where: { estado: { in: ['COLA', 'PREPARANDO'] } },
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
});
