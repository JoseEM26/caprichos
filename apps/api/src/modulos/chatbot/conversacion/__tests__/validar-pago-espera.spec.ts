jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { LocalService } from '../../../local/local.service';
import { CatalogoService } from '../../../catalogo/catalogo.service';
import { OfertasService } from '../../../ofertas/ofertas.service';
import { ZonasService } from '../../../zonas/zonas.service';
import { ReservasService } from '../../../reservas/reservas.service';
import { PedidosService } from '../../../pedidos/pedidos.service';
import { ChatbotIaService } from '../../ia/chatbot-ia.service';
import { ChatbotConfiguracionService } from '../../configuracion/chatbot-configuracion.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../../puerto/whatsapp-mensajeria.puerto';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';

describe('Comportamiento del Bot en estado VALIDAR_PAGO (Contrato Sección 3)', () => {
  let service: EjecutorConversacionService;
  let prismaMock: any;
  let mensajeriaMock: any;
  let eventosMock: any;

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      conversacion: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      mensajeChat: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: 99n }),
      },
      pedido: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      reserva: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      solicitudReserva: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    mensajeriaMock = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'msg_1' }),
      enviarBotones: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'msg_2' }),
    };

    eventosMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EjecutorConversacionService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: RedisService,
          useValue: {
            obtenerCliente: () => ({
              set: jest.fn().mockResolvedValue('OK'),
              get: jest.fn().mockResolvedValue(null),
              incr: jest.fn().mockResolvedValue(1),
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: any) => {
              if (key === 'CARTA_URL_PUBLICA') return 'https://caprichos.pe/carta';
              return def;
            },
          },
        },
        {
          provide: LocalService,
          useValue: {
            obtenerEstadoCarta: jest.fn().mockResolvedValue({
              abierta: true,
              abre: '12:00',
              cierra: '23:00',
              texto: 'Abierto',
            }),
            obtenerDatosPublicosLocal: jest.fn().mockResolvedValue({
              direccion: 'Campoy, SJL',
              whatsapp: '977503006',
            }),
          },
        },
        {
          provide: CatalogoService,
          useValue: { obtenerCarta: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: OfertasService,
          useValue: { listarOfertas: jest.fn().mockResolvedValue([]) },
        },
        { provide: ZonasService, useValue: {} },
        { provide: ReservasService, useValue: {} },
        { provide: PedidosService, useValue: {} },
        {
          provide: ChatbotConfiguracionService,
          useValue: {
            verificarAntiSpam: jest.fn().mockResolvedValue({ permitido: true }),
            obtenerFuncionesActivas: jest.fn().mockResolvedValue({}),
            obtenerTextosBot: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mensajeriaMock },
        { provide: EventosGateway, useValue: eventosMock },
      ],
    }).compile();

    service = module.get<EjecutorConversacionService>(EjecutorConversacionService);
    // Simular chatbot activo
    jest.spyOn(service as any, 'estaChatbotActivo').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarRateLimit').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarIdempotencia').mockResolvedValue(true);
  });

  describe('Atención continua de consultas en VALIDAR_PAGO', () => {
    it('responde a la consulta de carta y conserva estado VALIDAR_PAGO y duenio PERSONA', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 10n,
        telefono: '51987654321',
        duenio: 'PERSONA',
        estado: 'VALIDAR_PAGO',
        tomado_por: null,
        flujo: { pago: { capturasEnviadas: 1 } },
      });

      const procesado = await service.procesarMensajeEntrante(10n, {
        texto: 'ver la carta',
      });

      expect(procesado).toBe(true);

      // El bot debe haber respondido con la carta o botones
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('carta'),
        expect.any(Array),
        expect.any(Object),
      );

      // Conserva estrictamente estado VALIDAR_PAGO y duenio PERSONA
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({
            estado: 'VALIDAR_PAGO',
            duenio: 'PERSONA',
          }),
        }),
      );
    });

    it('responde a consulta de horario y conserva VALIDAR_PAGO', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 11n,
        telefono: '51987654321',
        duenio: 'PERSONA',
        estado: 'VALIDAR_PAGO',
        tomado_por: null,
        flujo: { pago: { capturasEnviadas: 1 } },
      });

      const procesado = await service.procesarMensajeEntrante(11n, {
        texto: '¿cuál es su horario de atención?',
      });

      expect(procesado).toBe(true);
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('12:00'),
        expect.any(Array),
        expect.any(Object),
      );

      expect(prismaMock.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 11n },
          data: expect.objectContaining({
            estado: 'VALIDAR_PAGO',
            duenio: 'PERSONA',
          }),
        }),
      );
    });

    it('responde al botón "Seguir esperando" sin derivar ni autoaprobar', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 12n,
        telefono: '51987654321',
        duenio: 'PERSONA',
        estado: 'VALIDAR_PAGO',
        tomado_por: null,
        flujo: { pago: { capturasEnviadas: 1 } },
      });

      const procesado = await service.procesarMensajeEntrante(12n, {
        buttonPayload: 'btn_esp_esperar',
      });

      expect(procesado).toBe(true);
      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('Seguimos revisando tu pago'),
        expect.any(Object),
      );
    });

    it('responde al botón "Hablar con persona" y emite aviso a campana', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 13n,
        telefono: '51987654321',
        duenio: 'PERSONA',
        estado: 'VALIDAR_PAGO',
        tomado_por: null,
        flujo: { pago: { capturasEnviadas: 1 } },
      });

      const procesado = await service.procesarMensajeEntrante(13n, {
        buttonPayload: 'btn_esp_persona',
      });

      expect(procesado).toBe(true);
      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        'Ya avisé a una persona, te responde en breve.',
        expect.any(Object),
      );

      expect(prismaMock.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ATENCION_WHATSAPP',
            enlace: '/admin/mensajes',
          }),
        }),
      );
    });

    it('ante texto libre fuera de consultas, responde una sola vez y luego calla para no spamear', async () => {
      // 1er mensaje libre
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 14n,
        telefono: '51987654321',
        duenio: 'PERSONA',
        estado: 'VALIDAR_PAGO',
        tomado_por: null,
        flujo: { pago: { capturasEnviadas: 1, avisoPersonaEnviado: false } },
      });

      await service.procesarMensajeEntrante(14n, {
        texto: 'Por favor apuren que se me hace tarde',
      });

      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        'Ya avisé a una persona, te responde en breve.',
        expect.any(Object),
      );

      // Marca en flujo avisoPersonaEnviado = true
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 14n },
          data: expect.objectContaining({
            flujo: expect.objectContaining({
              pago: expect.objectContaining({ avisoPersonaEnviado: true }),
            }),
          }),
        }),
      );

      mensajeriaMock.enviarTexto.mockClear();

      // 2do mensaje libre (ya tiene avisoPersonaEnviado = true)
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 14n,
        telefono: '51987654321',
        duenio: 'PERSONA',
        estado: 'VALIDAR_PAGO',
        tomado_por: null,
        flujo: { pago: { capturasEnviadas: 1, avisoPersonaEnviado: true } },
      });

      await service.procesarMensajeEntrante(14n, {
        texto: 'Sigo esperando amigos',
      });

      // El bot NO repite el mensaje para no hacer spam al cliente
      expect(mensajeriaMock.enviarTexto).not.toHaveBeenCalled();
    });
  });
});
