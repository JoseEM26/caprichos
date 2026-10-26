jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';
import { LocalService } from '../../../local/local.service';
import { CatalogoService } from '../../../catalogo/catalogo.service';
import { OfertasService } from '../../../ofertas/ofertas.service';
import { SeguimientoService } from '../../../pedidos/seguimiento.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../../puerto/whatsapp-mensajeria.puerto';

describe('EjecutorConversacionService (Integración de Conversación)', () => {
  let service: EjecutorConversacionService;
  let mockPrisma: any;
  let mockLocalService: any;
  let mockCatalogoService: any;
  let mockOfertasService: any;
  let mockSeguimientoService: any;
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
      pedido: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
      obtenerDatosPublicosLocal: jest.fn().mockResolvedValue({
        direccion: 'Av. Campoy 789',
        telefono: '987 654 321',
        pedidoMinimo: 14.5,
        envioGratisDesde: 70,
        mediosPago: { yape: { activo: true, nombre: 'Yape' } },
      }),
    };

    mockCatalogoService = {
      obtenerCarta: jest.fn().mockResolvedValue([
        {
          id: '1',
          nombre: 'Frappes',
          productos: [
            { id: 'p1', nombre: 'Frappe Oreo', precio: 14.5, disponible: true },
            { id: 'p2', nombre: 'Frappe Fresa', precio: 15.0, disponible: false },
          ],
        },
      ]),
    };

    mockOfertasService = {
      listarOfertas: jest.fn().mockResolvedValue([
        {
          nombre: '2x1 Frappe Oreo',
          descripcion: 'Paga 1 y lleva 2',
          vigenteAhora: true,
          compraMinima: 14.5,
        },
      ]),
    };

    mockSeguimientoService = {
      obtener: jest.fn(),
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
        waMessageId: 'wamid.lista.123',
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
        { provide: CatalogoService, useValue: mockCatalogoService },
        { provide: OfertasService, useValue: mockOfertasService },
        { provide: SeguimientoService, useValue: mockSeguimientoService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mockMensajeria },
        { provide: EventosGateway, useValue: mockEventos },
      ],
    }).compile();

    service = module.get<EjecutorConversacionService>(EjecutorConversacionService);
  });

  describe('1. Verificación del interruptor general chatbot_activo', () => {
    it('procesa el mensaje cuando chatbot_activo está configurado en "si"', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 1n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const procesado = await service.procesarMensajeEntrante(1n, { texto: 'hola' });
      expect(procesado).toBe(true);
      expect(mockMensajeria.enviarLista).toHaveBeenCalled();
    });

    it('no procesa mensajes cuando chatbot_activo está en "no"', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValueOnce({
        clave: 'chatbot_activo',
        valor: 'no',
      });
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 2n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const procesado = await service.procesarMensajeEntrante(2n, { texto: 'hola' });
      expect(procesado).toBe(false);
      expect(mockMensajeria.enviarLista).not.toHaveBeenCalled();
    });
  });

  describe('2. Verificación de exclusión: solo responde a conversaciones con duenio BOT', () => {
    it('no responde si la conversación tiene duenio PERSONA', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 3n,
        telefono: '+51987654321',
        duenio: 'PERSONA',
        tomado_por: null,
      });

      const procesado = await service.procesarMensajeEntrante(3n, { texto: 'hola' });
      expect(procesado).toBe(false);
      expect(mockMensajeria.enviarLista).not.toHaveBeenCalled();
    });

    it('no responde si la conversación tiene un asesor asignado en tomado_por', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 3n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: 123n,
      });

      const procesado = await service.procesarMensajeEntrante(3n, { texto: 'hola' });
      expect(procesado).toBe(false);
      expect(mockMensajeria.enviarLista).not.toHaveBeenCalled();
    });

    it('evita procesar dos veces el mismo wa_message_id por idempotencia', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: 4n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      const entrada = { texto: 'hola', waMessageId: 'wamid.meta.repetido.100' };

      const res1 = await service.procesarMensajeEntrante(4n, entrada);
      expect(res1).toBe(true);
      expect(mockMensajeria.enviarLista).toHaveBeenCalledTimes(1);

      const res2 = await service.procesarMensajeEntrante(4n, entrada);
      expect(res2).toBe(false);
      expect(mockMensajeria.enviarLista).toHaveBeenCalledTimes(1);
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

      for (let i = 1; i <= 5; i++) {
        const ok = await service.procesarMensajeEntrante(5n, {
          texto: 'horario',
          waMessageId: `wamid.msg.${i}`,
        });
        expect(ok).toBe(true);
      }
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledTimes(5);

      const bloqueado = await service.procesarMensajeEntrante(5n, {
        texto: 'horario',
        waMessageId: 'wamid.msg.6',
      });
      expect(bloqueado).toBe(false);
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledTimes(5);
    });
  });

  describe('4. Ejecución del menú interactivo de lista y almacenamiento en mensaje_chat', () => {
    it('responde saludo enviando lista con botón "Ver opciones" y registra en mensaje_chat con autor BOT', async () => {
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
      expect(mockMensajeria.enviarLista).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Ana'),
        'Ver opciones',
        expect.arrayContaining([
          expect.objectContaining({ id: 'pedir', titulo: '☕ Hacer un pedido' }),
          expect.objectContaining({ id: 'carta', titulo: '🧁 Ver la carta' }),
        ]),
        expect.objectContaining({ conversacionId: 10n, tituloSeccion: 'Menú' }),
      );

      // Verificar persistencia en mensaje_chat con autor BOT y dirección SALE
      expect(mockPrisma.mensajeChat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversacion_id: 10n,
          direccion: 'SALE',
          autor: 'BOT',
          tipo: 'LISTA',
          meta_id: 'wamid.lista.123',
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

      // Genera notificación para la campana visible a Caja y Admin
      expect(mockPrisma.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'ATENCION_WHATSAPP',
          titulo: expect.stringContaining('Atención requerida en WhatsApp'),
          enlace: '/admin/mensajes',
        }),
      });

      // Notifica al cliente
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Te paso con alguien del equipo'),
        expect.any(Object),
      );
    });

    it('ejecuta repregunta una vez y luego deriva a persona ante mensaje no entendido', async () => {
      // Intento 1: no entiende -> repregunta enviando lista
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

      expect(mockMensajeria.enviarLista).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('No estoy seguro de haber entendido'),
        'Ver opciones',
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
        expect.stringContaining('No logro entender bien tu mensaje, mejor te paso con una persona'),
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
      expect(mockMensajeria.enviarLista).toHaveBeenCalledWith(
        'wa-user:PE.1048174911395155',
        expect.stringContaining('Soy Capri'),
        'Ver opciones',
        expect.any(Array),
        expect.objectContaining({
          conversacionId: 13n,
          replyToWaMessageId: 'wamid.bsuid.1',
        }),
      );
    });
  });

  describe('5. Pruebas de ampliación (a) a (f): consumo real de BD y seguridad', () => {
    it('(a) Carta navegable: consulta CatalogoService y envía lista de categorías', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 20n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      const ok = await service.procesarMensajeEntrante(20n, {
        listRowId: 'carta',
        waMessageId: 'wamid.carta.1',
      });

      expect(ok).toBe(true);
      expect(mockCatalogoService.obtenerCarta).toHaveBeenCalled();
      expect(mockMensajeria.enviarLista).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Elige una categoría'),
        'Ver categorías',
        expect.arrayContaining([expect.objectContaining({ id: 'cat_1', titulo: 'Frappes' })]),
        expect.objectContaining({ tituloSeccion: 'Categorías' }),
      );
    });

    it('(b) Disponibilidad: avisa si el local está cerrado con datos reales', async () => {
      mockLocalService.obtenerEstadoCarta.mockResolvedValueOnce({
        abierta: false,
        abre: '18:00',
        cierra: '23:00',
        texto: 'Cerrado',
        pausaAltaDemanda: false,
      });

      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 21n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'INICIO', repreguntasFallidas: 0 },
      });

      await service.procesarMensajeEntrante(21n, { texto: 'hola' });
      expect(mockMensajeria.enviarLista).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Ahora estamos cerrados. Abrimos hoy a las 18:00.'),
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('(c) Promociones vigentes obtenidas de OfertasService', async () => {
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 22n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      await service.procesarMensajeEntrante(22n, {
        listRowId: 'promos',
        waMessageId: 'wamid.promos.1',
      });

      expect(mockOfertasService.listarOfertas).toHaveBeenCalled();
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('2x1 Frappe Oreo'),
        expect.arrayContaining([expect.objectContaining({ id: 'btn_carta' })]),
        expect.any(Object),
      );
    });

    it('(d) Mi pedido propio aceptado y pedido ajeno rechazado (seguridad)', async () => {
      // 1. Pedido propio
      mockPrisma.pedido.findUnique.mockResolvedValueOnce({
        codigo: 'CP-0110',
        cliente_telefono: '+51987654321',
        estado: 'PREPARANDO',
        creado_en: new Date(),
      });
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 23n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      await service.procesarMensajeEntrante(23n, { texto: 'CP-0110' });
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('¿Qué necesitas de tu pedido CP-0110?'),
        expect.any(Array),
        expect.any(Object),
      );

      // 2. Pedido ajeno (teléfono distinto) -> Rechazado
      mockPrisma.pedido.findUnique.mockResolvedValueOnce({
        codigo: 'CP-0999',
        cliente_telefono: '+51911111111', // Teléfono ajeno
        estado: 'PREPARANDO',
        creado_en: new Date(),
      });
      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 24n,
        telefono: '+51987654321', // Teléfono del cliente actual
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      await service.procesarMensajeEntrante(24n, { texto: 'CP-0999' });
      expect(mockMensajeria.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('No encuentro un pedido activo con tu número'),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('(f) Fallo de servicio/BD notifica a Caja por la campana y responde con mensaje honesto', async () => {
      mockCatalogoService.obtenerCarta.mockRejectedValueOnce(new Error('Conexión perdida a PostgreSQL'));

      mockPrisma.conversacion.findUnique.mockResolvedValueOnce({
        id: 25n,
        telefono: '+51987654321',
        duenio: 'BOT',
        tomado_por: null,
        flujo: { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
      });

      const ok = await service.procesarMensajeEntrante(25n, { texto: 'carta' });
      expect(ok).toBe(true);

      // Deriva la conversación a PERSONA
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 25n },
          data: expect.objectContaining({ duenio: 'PERSONA' }),
        }),
      );

      // Crea notificación de campana para Caja
      expect(mockPrisma.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'ATENCION_WHATSAPP',
          enlace: '/admin/mensajes',
        }),
      });

      // Responde al cliente informando honestamente el problema
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        'Estoy teniendo un problema para ver eso, te paso con una persona.',
        expect.any(Object),
      );
    });
  });
});
