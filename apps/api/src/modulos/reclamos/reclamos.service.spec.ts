jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ReclamosService } from './reclamos.service';
import { CrearReclamoDto } from './dto';

describe('ReclamosService', () => {
  let service: ReclamosService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;

  beforeEach(async () => {
    redisClientMock = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
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

    prismaMock = {
      $transaction: jest.fn(async (callback) => callback(prismaMock)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      reclamo: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReclamosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
      ],
    }).compile();

    service = module.get<ReclamosService>(ReclamosService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. Número correlativo por año con fecha fija y reinicio el 1 de enero', () => {
    it('genera LR-2026-000001 si es el primer reclamo del año 2026', async () => {
      // Fijamos fecha en Lima: 2026-10-21 a las 15:00 UTC (10:00 Lima)
      jest.useFakeTimers({ now: new Date('2026-10-21T15:00:00.000Z') });

      prismaMock.reclamo.findFirst.mockResolvedValue(null);
      prismaMock.parametro.findUnique.mockResolvedValue({ valor: 15 });
      prismaMock.reclamo.create.mockImplementation(({ data }: any) => ({
        id: 1n,
        ...data,
      }));

      const dto: CrearReclamoDto = {
        tipo: 'RECLAMO',
        nombre: 'Carlos Gonzales',
        documento: '45678912',
        domicilio: 'Av. Larco 123',
        telefono: '987654321',
        detalle: 'El pedido llegó frío y con demora de más de 60 minutos',
        aceptaPrivacidad: true,
      };

      const res = await service.crear(dto, '192.168.1.10');

      expect(res.numero).toBe('LR-2026-000001');
      expect(prismaMock.reclamo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            numero: 'LR-2026-000001',
          }),
        }),
      );
    });

    it('incrementa correlativo consecutivamente (ej. LR-2026-000006 si el último fue LR-2026-000005)', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-21T15:00:00.000Z') });

      prismaMock.reclamo.findFirst.mockResolvedValue({ numero: 'LR-2026-000005' });
      prismaMock.parametro.findUnique.mockResolvedValue({ valor: 15 });
      prismaMock.reclamo.create.mockImplementation(({ data }: any) => ({
        id: 6n,
        ...data,
      }));

      const dto: CrearReclamoDto = {
        tipo: 'QUEJA',
        nombre: 'Maria Lopez',
        documento: '87654321',
        domicilio: 'Calle Lima 456',
        telefono: '912345678',
        detalle: 'Mala atención en el mostrador del establecimiento',
        aceptaPrivacidad: true,
      };

      const res = await service.crear(dto, '192.168.1.11');

      expect(res.numero).toBe('LR-2026-000006');
    });

    it('se reinicia el 1 de enero a LR-2027-000001 independientemente del número en 2026', async () => {
      // 2027-01-01T15:00:00.000Z en Lima es 10:00 del 1 de enero de 2027
      jest.useFakeTimers({ now: new Date('2027-01-01T15:00:00.000Z') });

      // En 2027 no hay reclamos previos (startsWith: 'LR-2027-')
      prismaMock.reclamo.findFirst.mockImplementation(({ where }: any) => {
        if (where.numero.startsWith === 'LR-2027-') {
          return Promise.resolve(null);
        }
        return Promise.resolve({ numero: 'LR-2026-000999' });
      });
      prismaMock.parametro.findUnique.mockResolvedValue({ valor: 15 });
      prismaMock.reclamo.create.mockImplementation(({ data }: any) => ({
        id: 100n,
        ...data,
      }));

      const dto: CrearReclamoDto = {
        tipo: 'RECLAMO',
        nombre: 'Ana Perez',
        documento: '11223344',
        domicilio: 'Jr. Huancavelica 789',
        telefono: '998877665',
        detalle: 'Cobro indebido en la cuenta del día de año nuevo',
        aceptaPrivacidad: true,
      };

      const res = await service.crear(dto, '192.168.1.12');

      expect(res.numero).toBe('LR-2027-000001');
    });
  });

  describe('2. Plazo en días hábiles saltando fin de semana', () => {
    it('un reclamo del viernes vence 15 días hábiles después, no 15 naturales (21 días naturales)', async () => {
      // Viernes 23 de octubre de 2026 a las 17:00 UTC (12:00 mediodía en Lima)
      jest.useFakeTimers({ now: new Date('2026-10-23T17:00:00.000Z') });

      prismaMock.reclamo.findFirst.mockResolvedValue(null);
      prismaMock.parametro.findUnique.mockResolvedValue({ valor: 15 });
      prismaMock.reclamo.create.mockImplementation(({ data }: any) => ({
        id: 1n,
        ...data,
      }));

      const dto: CrearReclamoDto = {
        tipo: 'RECLAMO',
        nombre: 'Pedro Suarez',
        documento: '44556677',
        domicilio: 'Av. Arequipa 500',
        telefono: '955443322',
        detalle: 'El pedido no contenía los cubiertos ni las salsas solicitadas',
        aceptaPrivacidad: true,
      };

      const res = await service.crear(dto, '192.168.1.20');

      // Viernes 23/10/2026 + 15 días hábiles = Viernes 13/11/2026
      expect(res.fechaLimite).toBe('2026-11-13');
      expect(res.fechaLimite).not.toBe('2026-11-07'); // 15 días naturales sería 07/11 (sábado)
    });
  });

  describe('3. Privacidad obligatoria', () => {
    it('lanza 400 PRIVACIDAD_REQUERIDA si no se acepta la privacidad', async () => {
      const dto: any = {
        tipo: 'RECLAMO',
        nombre: 'Juan Perez',
        documento: '12345678',
        domicilio: 'Av. Brasil 123',
        telefono: '987654321',
        detalle: 'Descripción de más de veinte caracteres sobre el hecho reclamado',
        aceptaPrivacidad: false,
      };

      await expect(service.crear(dto, '192.168.1.30')).rejects.toThrow(
        new BadRequestException({
          codigo: 'PRIVACIDAD_REQUERIDA',
          mensaje: 'Debe aceptar la política de privacidad para enviar el reclamo',
        }),
      );
    });
  });

  describe('4. Límite por IP con Redis (5 por hora)', () => {
    it('lanza 429 TOO_MANY con mensaje en español al superar 5 solicitudes por hora por IP', async () => {
      // Simulamos que Redis devuelve 6 (superando el límite de 5)
      redisClientMock.incr.mockResolvedValue(6);

      const dto: CrearReclamoDto = {
        tipo: 'QUEJA',
        nombre: 'Abuso De Peticiones',
        documento: '77889900',
        domicilio: 'Calle Falsa 123',
        telefono: '999888777',
        detalle: 'Texto de prueba de más de veinte caracteres para la verificación',
        aceptaPrivacidad: true,
      };

      await expect(service.crear(dto, '192.168.1.40')).rejects.toThrow(
        new HttpException(
          {
            codigo: 'TOO_MANY',
            mensaje: 'Ha superado el límite de 5 solicitudes por hora. Por favor, intente más tarde.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
      expect(redisClientMock.incr).toHaveBeenCalledWith('reclamos:ip:192.168.1.40');
    });
  });

  describe('5. Constancia con documento correcto e incorrecto', () => {
    it('devuelve constancia si el documento coincide exactamente', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue({
        id: 10n,
        numero: 'LR-2026-000010',
        tipo: 'RECLAMO',
        nombre: 'Rosa Martinez',
        documento: '45678912',
        domicilio: 'Av. Benavides 456',
        telefono: '987112233',
        detalle: 'Pedido entregado en otra dirección y con productos faltantes',
        monto_reclamado: 75.5,
        estado: 'RECIBIDO',
        respuesta: null,
        respondido_en: null,
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });

      const res = await service.obtenerConstanciaPublica('LR-2026-000010', '45678912');

      expect(res.numero).toBe('LR-2026-000010');
      expect(res.tipo).toBe('RECLAMO');
      expect(res.nombre).toBe('Rosa Martinez');
      expect(res.fechaLimite).toBe('2026-11-13');
    });

    it('devuelve 404 genérico sin revelar si existe si el documento es incorrecto', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue({
        id: 10n,
        numero: 'LR-2026-000010',
        documento: '45678912',
      });

      await expect(
        service.obtenerConstanciaPublica('LR-2026-000010', '99999999'),
      ).rejects.toThrow(
        new NotFoundException({
          codigo: 'RECLAMO_NO_ENCONTRADO',
          mensaje: 'Reclamo no encontrado',
        }),
      );
    });

    it('devuelve 404 genérico si el número de reclamo no existe', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue(null);

      await expect(
        service.obtenerConstanciaPublica('LR-2026-999999', '45678912'),
      ).rejects.toThrow(
        new NotFoundException({
          codigo: 'RECLAMO_NO_ENCONTRADO',
          mensaje: 'Reclamo no encontrado',
        }),
      );
    });
  });

  describe('6. Cálculo de «Faltan 3 días» en listado de administración', () => {
    it('muestra «Faltan 3 días» cuando faltan 3 días hábiles para vencer', async () => {
      // Hoy en Lima: Martes 2026-10-20
      jest.useFakeTimers({ now: new Date('2026-10-20T17:00:00.000Z') });

      // Fecha límite: Viernes 2026-10-23 (3 días hábiles restantes)
      prismaMock.reclamo.count.mockResolvedValue(1);
      prismaMock.reclamo.findMany.mockResolvedValue([
        {
          id: 1n,
          numero: 'LR-2026-000001',
          tipo: 'RECLAMO',
          nombre: 'Juan Perez',
          documento: '45678912',
          domicilio: 'Calle Real 123',
          telefono: '987654321',
          correo: 'juan@example.com',
          pedido_id: null,
          detalle: 'Reclamo formal por entrega tardía y producto en mal estado',
          monto_reclamado: 50.0,
          estado: 'RECIBIDO',
          respuesta: null,
          respondido_por: null,
          respondido_en: null,
          fecha_limite: new Date('2026-10-23T00:00:00.000Z'),
          creado_en: new Date('2026-10-02T15:00:00.000Z'),
        },
      ]);

      const res = await service.listarAdmin({}, { partyId: 1n, rol: 'ADMIN', debeCambiar: false });

      expect(res.items).toHaveLength(1);
      expect(res.items[0].diasHabilesRestantes).toBe(3);
      expect(res.items[0].plazoTexto).toBe('Faltan 3 días');
    });
  });

  describe('7. Responder dos veces (409 YA_RESPONDIDO)', () => {
    it('responde exitosamente la primera vez pasando a RESPONDIDO', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue({
        id: 5n,
        numero: 'LR-2026-000005',
        estado: 'RECIBIDO',
        respuesta: null,
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });
      prismaMock.reclamo.update.mockResolvedValue({
        id: 5n,
        numero: 'LR-2026-000005',
        estado: 'RESPONDIDO',
        respuesta: 'Se verificó con cocina y se procede a la nota de crédito respectiva.',
        respondido_por: 1n,
        respondido_en: new Date(),
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });

      const res = await service.responder(
        '5',
        { respuesta: 'Se verificó con cocina y se procede a la nota de crédito respectiva.' },
        { partyId: 1n, rol: 'ADMIN', debeCambiar: false },
        '127.0.0.1',
      );

      expect(res.estado).toBe('RESPONDIDO');
      expect(prismaMock.reclamo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'RESPONDIDO',
            respondido_por: 1n,
          }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'reclamos',
          accion: 'RESPONDER',
        }),
      );
    });

    it('lanza 409 YA_RESPONDIDO al intentar responder por segunda vez', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue({
        id: 5n,
        numero: 'LR-2026-000005',
        estado: 'RESPONDIDO',
        respuesta: 'Ya respondido previamente',
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });

      await expect(
        service.responder(
          '5',
          { respuesta: 'Segunda respuesta intentando sobreescribir la anterior respuesta formal' },
          { partyId: 1n, rol: 'ADMIN', debeCambiar: false },
          '127.0.0.1',
        ),
      ).rejects.toThrow(
        new HttpException(
          {
            codigo: 'YA_RESPONDIDO',
            mensaje: 'El reclamo ya ha sido respondido previamente',
          },
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('8. Enmascarado para no ADMIN', () => {
    it('enmascara documento y teléfono para rol CAJERO en la lista administrativa', async () => {
      prismaMock.reclamo.count.mockResolvedValue(1);
      prismaMock.reclamo.findMany.mockResolvedValue([
        {
          id: 1n,
          numero: 'LR-2026-000001',
          tipo: 'RECLAMO',
          nombre: 'Juan Perez',
          documento: '45678912',
          telefono: '987654321',
          domicilio: 'Av. Arequipa 123',
          correo: 'juan@example.com',
          pedido_id: null,
          detalle: 'Descripción completa del reclamo del cliente',
          monto_reclamado: 50.0,
          estado: 'RECIBIDO',
          respuesta: null,
          respondido_por: null,
          respondido_en: null,
          fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
          creado_en: new Date('2026-10-23T15:00:00.000Z'),
        },
      ]);

      const res = await service.listarAdmin(
        {},
        { partyId: 2n, rol: 'CAJERO', debeCambiar: false },
      );

      expect(res.items[0].documento).toBe('45****12');
      expect(res.items[0].telefono).toBe('98*****21');
    });

    it('no enmascara documento y teléfono para rol ADMIN', async () => {
      prismaMock.reclamo.count.mockResolvedValue(1);
      prismaMock.reclamo.findMany.mockResolvedValue([
        {
          id: 1n,
          numero: 'LR-2026-000001',
          tipo: 'RECLAMO',
          nombre: 'Juan Perez',
          documento: '45678912',
          telefono: '987654321',
          domicilio: 'Av. Arequipa 123',
          correo: 'juan@example.com',
          pedido_id: null,
          detalle: 'Descripción completa del reclamo del cliente',
          monto_reclamado: 50.0,
          estado: 'RECIBIDO',
          respuesta: null,
          respondido_por: null,
          respondido_en: null,
          fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
          creado_en: new Date('2026-10-23T15:00:00.000Z'),
        },
      ]);

      const res = await service.listarAdmin(
        {},
        { partyId: 1n, rol: 'ADMIN', debeCambiar: false },
      );

      expect(res.items[0].documento).toBe('45678912');
      expect(res.items[0].telefono).toBe('987654321');
    });
  });

  describe('búsqueda en el servidor', () => {
    const fila = (id: bigint, nombre: string) => ({
      id, numero: `LR-2026-00000${id}`, tipo: 'RECLAMO', nombre, documento: '45678912', telefono: '987654321',
      domicilio: 'x', correo: null, pedido_id: null, detalle: 'Demora', monto_reclamado: null, estado: 'RECIBIDO',
      respuesta: null, respondido_por: null, respondido_en: null,
      fecha_limite: new Date('2026-11-13T00:00:00.000Z'), creado_en: new Date('2026-10-23T15:00:00.000Z'),
    });

    it('buscar ignora tildes, da el total real y pagina sobre lo encontrado', async () => {
      prismaMock.reclamo.findMany.mockResolvedValue([fila(1n, 'José Peña'), fila(2n, 'Ana'), fila(3n, 'Josefina')]);
      const res = await service.listarAdmin({ buscar: 'jose', pagina: 2, limite: 1 }, { partyId: 1n, rol: 'ADMIN', debeCambiar: false });
      expect(res.total).toBe(2);
      expect(res.items.map((i) => i.nombre)).toEqual(['Josefina']);
    });

    it('un no-admin no puede buscar por el documento completo (solo lo enmascarado)', async () => {
      prismaMock.reclamo.findMany.mockResolvedValue([fila(1n, 'Ana')]);
      const res = await service.listarAdmin({ buscar: '45678912' }, { partyId: 2n, rol: 'CAJERO', debeCambiar: false });
      expect(res.total).toBe(0);
    });
  });

  describe('GET /carta/legal y auditoría de lectura sensible', () => {
    it('obtiene términos, privacidad y plazo legal desde los parámetros del sistema', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'terminos_texto', valor: 'Términos de servicio Caprichos' },
        { clave: 'privacidad_texto', valor: 'Aviso de privacidad oficial' },
        { clave: 'terminos_version', valor: '2026-10-29' },
        { clave: 'privacidad_version', valor: '2026-10-30' },
      ]);
      prismaMock.parametro.findUnique = jest.fn().mockResolvedValue({ clave: 'reclamo_plazo_dias_habiles', valor: 15 });

      const res = await service.obtenerCartaLegal();

      expect(res).toEqual({
        terminos: 'Términos de servicio Caprichos',
        terminosVersion: '2026-10-29',
        privacidad: 'Aviso de privacidad oficial',
        privacidadVersion: '2026-10-30',
        textoConsentimiento: expect.stringContaining('mi celular y mis datos'),
        reclamoPlazoDiasHabiles: 15,
      });
    });

    it('GET /admin/reclamos/:id audita lectura sensible (VER_RECLAMO)', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue({
        id: 7n,
        numero: 'LR-2026-000007',
        tipo: 'RECLAMO',
        nombre: 'Carlos Ramos',
        documento: '12345678',
        domicilio: 'Calle Las Flores 123',
        telefono: '912345678',
        correo: 'carlos@example.com',
        pedido_id: null,
        pedido: null,
        detalle: 'Detalle extenso del reclamo con más de veinte caracteres',
        monto_reclamado: null,
        estado: 'RECIBIDO',
        respuesta: null,
        respondido_por: null,
        respondidoPor: null,
        respondido_en: null,
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        aceptacion_privacidad: true,
        aceptado_en: new Date('2026-10-23T15:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });

      const res = await service.obtenerPorIdAdmin(
        '7',
        { partyId: 1n, rol: 'ADMIN', debeCambiar: false },
        '10.0.0.1',
      );

      expect(res.id).toBe('7');
      expect(res.documento).toBe('12345678');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LECTURA_SENSIBLE',
          modulo: 'reclamos',
          accion: 'VER_RECLAMO',
          entidadId: 7n,
        }),
      );
    });

    it('POST /admin/reclamos/:id/en-revision cambia estado a EN_REVISION y audita', async () => {
      prismaMock.reclamo.findUnique.mockResolvedValue({
        id: 8n,
        numero: 'LR-2026-000008',
        estado: 'RECIBIDO',
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });
      prismaMock.reclamo.update.mockResolvedValue({
        id: 8n,
        numero: 'LR-2026-000008',
        estado: 'EN_REVISION',
        fecha_limite: new Date('2026-11-13T00:00:00.000Z'),
        creado_en: new Date('2026-10-23T15:00:00.000Z'),
      });

      const res = await service.marcarEnRevision(
        '8',
        { partyId: 1n, rol: 'ADMIN', debeCambiar: false },
        '10.0.0.2',
      );

      expect(res.estado).toBe('EN_REVISION');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'reclamos',
          accion: 'EN_REVISION',
          entidadId: 8n,
        }),
      );
    });

    it('emite evento reclamo:nuevo al crear un reclamo', async () => {
      prismaMock.reclamo.findFirst.mockResolvedValue(null);
      prismaMock.parametro.findUnique.mockResolvedValue({ valor: 15 });
      prismaMock.reclamo.create.mockImplementation(({ data }: any) => ({
        id: 15n,
        ...data,
      }));

      const dto: CrearReclamoDto = {
        tipo: 'RECLAMO',
        nombre: 'Evento Test',
        documento: '45678912',
        domicilio: 'Av. Test 123',
        telefono: '987654321',
        detalle: 'Reclamo para verificar la emisión del evento websocket',
        aceptaPrivacidad: true,
      };

      await service.crear(dto, '127.0.0.1');

      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'reclamo:nuevo',
        expect.objectContaining({
          id: '15',
          numero: 'LR-2026-000001',
          tipo: 'RECLAMO',
          nombre: 'Evento Test',
        }),
      );
    });
  });
});
