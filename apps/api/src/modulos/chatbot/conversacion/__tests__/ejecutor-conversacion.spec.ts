jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';
import { LocalService } from '../../../local/local.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../../puerto/whatsapp-mensajeria.puerto';

describe('EjecutorConversacionService (Integración de Conversación)', () => {
  let service: EjecutorConversacionService;
  let mockPrisma: any;
  let mockLocalService: any;
  let mockConfigService: any;
  let mockRedisService: any;
  let mockMensajeria: any;
  let mockEventos: any;
  let redisMemory: Map<string, string>;

  beforeEach(async () => {
    redisMemory = new Map();

    const mockRedisClient = {
      incr: jest.fn().mockImplementation((key: string) => {
        const val = Number(redisMemory.get(key) || 0) + 1;
        redisMemory.set(key, String(val));
        return Promise.resolve(val);
      }),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockImplementation((key: string) => Promise.resolve(redisMemory.get(key) || null)),
      set: jest.fn().mockImplementation((key: string, val: string) => {
        redisMemory.set(key, val);
        return Promise.resolve('OK');
      }),
    };

    mockRedisService = {
      obtenerCliente: jest.fn().mockReturnValue(mockRedisClient),
    };

    mockPrisma = {
      conversacion: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 10n, ...data })),
      },
      parametro: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.clave === 'chatbot_activo') {
            return Promise.resolve({ clave: 'chatbot_activo', valor: 'si' });
          }
          return Promise.resolve(null);
        }),
      },
      mensajeChat: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 100n, ...data })),
      },
      notificacion: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 50n, ...data })),
      },
    };

    mockLocalService = {
      obtenerEstadoCarta: jest.fn().mockResolvedValue({
        abierta: true,
        abre: '17:00',
        cierra: '23:00',
        texto: 'Abierto',
        pausaAltaDemanda: false,
      }),
      obtenerDatosLocal: jest.fn().mockResolvedValue({
        direccion: 'Av. Campoy 789',
        enlace_mapa: 'https://maps.google.com/local',
      }),
    };

    mockConfigService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'CARTA_URL_PUBLICA') return 'https://carta.caprichos.pe';
        return def;
      }),
    };

    mockMensajeria = {
      enviarTexto: jest.fn().mockResolvedValue({
        exito: true,
        id: '1',
        waMessageId: 'wamid.texto.123',
        estado: 'SIMULADO',
      }),
      enviarBotones: jest.fn().mockResolvedValue({
        exito: true,
        id: '2',
        waMessageId: 'wamid.btn.123',
        estado: 'SIMULADO',
      }),
      enviarLista: jest.fn().mockResolvedValue({
        exito: true,
        id: '3',
        waMessageId: 'wamid.list.123',
        estado: 'SIMULADO',
      }),
    };

    mockEventos = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EjecutorConversacionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocalService, useValue: mockLocalService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mockMensajeria },
        { provide: EventosGateway, useValue: mockEventos },
      ],
    }).compile();

    service = module.get<EjecutorConversacionService>(EjecutorConversacionService);
  });

  describe('1. Validaciones y exclusiones de ejecución', () => {
    it('no responde si chatbot_activo es "no"', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValueOnce({
        clave: 'chatbot_activo',
        valor: 'no',
      });
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 1n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
      });

      const procesado = await service.procesarMensajeEntrante(1n, { texto: 'hola' });

      expect(procesado).toBe(false);
      expect(mockMensajeria.enviarBotones).not.toHaveBeenCalled();
      expect(mockMensajeria.enviarTexto).not.toHaveBeenCalled();
    });

    it('no responde si la conversación está en manos de PERSONA', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 2n,
        telefono: '+51987654321',
        duenio: 'PERSONA',
        tomado_por: null,
      });

      const procesado = await service.procesarMensajeEntrante(2n, { texto: 'hola' });

      expect(procesado).toBe(false);
      expect(mockMensajeria.enviarBotones).not.toHaveBeenCalled();
    });

    it('no responde si la conversación ha sido tomada por un agente (tomado_por !== null)', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 3n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: 99n,
      });

      const procesado = await service.procesarMensajeEntrante(3n, { texto: 'hola' });

      expect(procesado).toBe(false);
      expect(mockMensajeria.enviarBotones).not.toHaveBeenCalled();
    });
  });

  describe('2. Idempotencia por wa_message_id', () => {
    it('no genera dos respuestas si Meta reentrega el mismo wa_message_id', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: 4n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const entrada = { texto: 'hola', waMessageId: 'wamid.meta.repetido.100' };

      // Primer procesamiento: exitoso
      const res1 = await service.procesarMensajeEntrante(4n, entrada);
      expect(res1).toBe(true);
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledTimes(1);

      // Segundo procesamiento con el mismo wa_message_id: omitido por idempotencia
      const res2 = await service.procesarMensajeEntrante(4n, entrada);
      expect(res2).toBe(false);
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledTimes(1); // No aumentó
    });
  });

  describe('3. Límite de 5 respuestas por minuto en Redis (Rate Limiting)', () => {
    it('permite hasta 5 respuestas en el minuto y bloquea a partir de la 6ta', async () => {
      mockPrisma.conversacion.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: 5n,
          telefono: '+51987654321',
          duenio: 'BOT',
          tomado_por: null,
          flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        }),
      );

      // 5 llamadas permitidas
      for (let i = 1; i <= 5; i++) {
        const ok = await service.procesarMensajeEntrante(5n, {
          texto: 'horario',
          waMessageId: `wamid.msg.${i}`,
        });
        expect(ok).toBe(true);
      }
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledTimes(5);

      // 6ta llamada: bloqueada por límite de tasa
      const bloqueado = await service.procesarMensajeEntrante(5n, {
        texto: 'horario',
        waMessageId: 'wamid.msg.6',
      });
      expect(bloqueado).toBe(false);
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledTimes(5); // No aumentó
    });
  });

  describe('4. Ejecución del motor y almacenamiento en mensaje_chat', () => {
    it('responde saludo enviando botones y registrando en mensaje_chat con autor BOT', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 10n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        nombre_contacto: 'Ana',
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const ok = await service.procesarMensajeEntrante(10n, {
        texto: 'hola',
        waMessageId: 'wamid.saludo.ana',
      });

      expect(ok).toBe(true);
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Hola Ana'),
        expect.arrayContaining([expect.objectContaining({ id: 'btn_pedido' })]),
        expect.objectContaining({ conversacionId: 10n }),
      );

      // Verificar persistencia en mensaje_chat con autor BOT y dirección SALE
      expect(mockPrisma.mensajeChat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversacion_id: 10n,
          direccion: 'SALE',
          autor: 'BOT',
          tipo: 'BOTON',
          meta_id: 'wamid.btn.123',
        }),
      });

      // Emisión websocket
      expect(mockEventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '10' });
    });

    it('ejecuta derivación a persona cuando el cliente elige "btn_persona"', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 11n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        estado: 'ABIERTA',
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      const ok = await service.procesarMensajeEntrante(11n, {
        buttonPayload: 'btn_persona',
        tipo: 'interactive',
        waMessageId: 'wamid.pase.11',
      });

      expect(ok).toBe(true);

      // Actualiza conversación a duenio PERSONA
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 11n },
          data: expect.objectContaining({
            duenio: 'PERSONA',
            estado: 'ABIERTA',
            tomado_por: null,
          }),
        }),
      );

      // Genera notificación para la campana
      expect(mockPrisma.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'ATENCION_WHATSAPP',
          titulo: expect.stringContaining('atención humana'),
          enlace: '/admin/mensajes',
        }),
      });

      // Notifica al cliente
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Te pasamos con una persona del equipo'),
        expect.any(Object),
      );
    });

    it('ejecuta repregunta una vez y luego deriva a persona ante mensaje no entendido', async () => {
      // Intento 1: no entiende -> repregunta
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 12n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      await service.procesarMensajeEntrante(12n, {
        texto: 'asdfghjk',
        waMessageId: 'wamid.fallo.1',
      });

      expect(mockMensajeria.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Disculpa, no entendi tu mensaje'),
        expect.any(Array),
        expect.any(Object),
      );

      // Intento 2: vuelve a no entender con repreguntasFallidas = 1 -> deriva
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 12n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 1 },
      });

      await service.procesarMensajeEntrante(12n, {
        texto: 'otra cosa incomprensible',
        waMessageId: 'wamid.fallo.2',
      });

      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 12n },
          data: expect.objectContaining({ duenio: 'PERSONA' }),
        }),
      );
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('No pude entender tu mensaje. Te comunico con una persona'),
        expect.any(Object),
      );
    });

    it('responde a remitente USUARIO_WA identificado por BSUID invocando al puerto de Meta', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 13n,
        telefono: 'wa-user:PE.1048174911395155',
        identificador_tipo: 'USUARIO_WA',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const ok = await service.procesarMensajeEntrante(13n, {
        texto: 'hola',
        waMessageId: 'wamid.bsuid.1',
      });

      expect(ok).toBe(true);
      // El puerto sí es invocado enviando al BSUID
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledWith(
        'wa-user:PE.1048174911395155',
        expect.stringContaining('Hola'),
        expect.any(Array),
        expect.objectContaining({
          conversacionId: 13n,
          replyToWaMessageId: 'wamid.bsuid.1',
        }),
      );
      expect(mockPrisma.mensajeChat.create).toHaveBeenCalled();
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flujo: expect.objectContaining({ estado: 'MENU' }),
          }),
        }),
      );
    });

    it('maneja remitente sin ningún identificador registrando mensaje sin invocar al puerto de Meta', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 14n,
        telefono: '',
        identificador_tipo: 'USUARIO_WA',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const ok = await service.procesarMensajeEntrante(14n, {
        texto: 'hola',
        waMessageId: 'wamid.sin_id.1',
      });

      expect(ok).toBe(true);
      // Al no haber ningún identificador, no puede invocar al puerto
      expect(mockMensajeria.enviarBotones).not.toHaveBeenCalled();
      expect(mockPrisma.mensajeChat.create).toHaveBeenCalled();
    });
  });
});
