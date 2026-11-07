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
      enviarLista: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'msg_3' }),
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

      // El bot NO repite el mensaje para no hacer spam al cliente (queda el silencio registrado)
      expect(mensajeriaMock.enviarTexto).not.toHaveBeenCalled();
    });
  });

  describe('VALIDAR_PAGO que no se queda mudo ni eterno', () => {
    const conv = (flujo: any, extra: any = {}) => ({
      id: 20n, telefono: '51987654321', duenio: 'PERSONA', estado: 'VALIDAR_PAGO', tomado_por: null, flujo, ...extra,
    });
    const silencios = () =>
      prismaMock.mensajeChat.create.mock.calls.filter(([a]: any) => a.data.tipo === 'SISTEMA' && a.data.contenido.silencio);

    it('«hola» responde el menú de espera', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(conv({ pago: { avisoPersonaEnviado: true } }));
      await service.procesarMensajeEntrante(20n, { texto: 'Hola!' });
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        '51987654321', expect.stringContaining('Mientras revisamos tu pago'), expect.any(Array), expect.any(Object));
    });

    it('segundo texto libre dentro del plazo registra el silencio con motivo', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(
        conv({ pago: { avisoPersonaEnviado: true, avisoPersonaEn: new Date().toISOString() } }));
      await service.procesarMensajeEntrante(20n, { texto: 'sigo esperando' });
      expect(mensajeriaMock.enviarTexto).not.toHaveBeenCalled();
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalled();
      expect(silencios()).toHaveLength(1);
      expect(silencios()[0][0].data.contenido.texto).toContain('ya se avisó a Caja');
    });

    it('total / yapear: responde con total, Yape y captura, 1 vez cada 5 min, sin tomar el chat', async () => {
      const pago = { pedidoCodigo: 'CP-W044', monto: 174.75, medio: 'YAPE', avisoPersonaEnviado: true, avisoPersonaEn: new Date().toISOString() };
      const frases = ['Cuanto sería el total porfavor', 'Esta bien rápido', 'Para poder yapear'];
      let flujo: any = { pago };
      for (const texto of frases) {
        prismaMock.conversacion.findUnique.mockResolvedValueOnce(conv(flujo));
        await service.procesarMensajeEntrante(20n, { texto });
        const ult = prismaMock.conversacion.update.mock.calls.at(-1)?.[0]?.data?.flujo;
        if (ult?.pago?.respuestaDatosEn) flujo = ult;
      }
      // «Cuanto sería el total» responde; «Esta bien rápido» calla; «yapear» cae dentro de los 5 min y calla
      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledTimes(1);
      const texto = mensajeriaMock.enviarTexto.mock.calls[0][1];
      expect(texto).toContain('S/ 174.75');
      expect(texto).toContain('Yape');
      expect(texto).toContain('captura');
      expect(silencios()).toHaveLength(2);
      for (const [a] of prismaMock.conversacion.update.mock.calls) {
        expect(a.data.duenio).toBeUndefined();
        expect(a.data.estado).toBeUndefined();
      }
      // pasados 5 min, «yapear» vuelve a responder
      const hace6 = new Date(Date.now() - 6 * 60000).toISOString();
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(conv({ pago: { ...pago, respuestaDatosEn: hace6 } }));
      await service.procesarMensajeEntrante(20n, { texto: 'Para poder yapear' });
      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledTimes(2);
    });

    it('pasado el plazo vuelve a avisar con botones y a notificar a Caja', async () => {
      const hace20 = new Date(Date.now() - 20 * 60000).toISOString();
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(
        conv({ pago: { avisoPersonaEnviado: true, avisoPersonaEn: hace20 } }));
      await service.procesarMensajeEntrante(20n, { texto: 'sigo esperando' });
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        '51987654321', expect.stringContaining('Seguimos revisando tu pago'),
        expect.arrayContaining([expect.objectContaining({ id: 'btn_esp_persona' })]), expect.any(Object));
      expect(prismaMock.notificacion.create).toHaveBeenCalled();
    });

    it.each([
      ['pago confirmado', { estado: 'COLA', pago_estado: 'PAGADO', creado_en: new Date() }],
      ['pedido anulado', { estado: 'ANULADO', pago_estado: 'PENDIENTE', creado_en: new Date() }],
      ['espera vencida', { estado: 'COLA', pago_estado: 'PENDIENTE', creado_en: new Date(Date.now() - 3 * 3600000) }],
    ])('con %s sale de VALIDAR_PAGO a MENU y atiende el mensaje', async (_n, pedido) => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedido);
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(conv({ pago: { pedidoId: '5', avisoPersonaEnviado: true } }));
      await service.procesarMensajeEntrante(20n, { texto: 'hola' });
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'MENU', duenio: 'BOT' }) }));
      expect(prismaMock.mensajeChat.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'SISTEMA' }) }));
      expect(mensajeriaMock.enviarBotones.mock.calls.length + mensajeriaMock.enviarTexto.mock.calls.length + mensajeriaMock.enviarLista.mock.calls.length).toBeGreaterThan(0);
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalledWith(
        expect.anything(), expect.stringContaining('Mientras revisamos tu pago'), expect.anything(), expect.anything());
    });

    it('derivado por calificación baja y sin persona responde al saludo', async () => {
      prismaMock.conversacion.findUnique.mockResolvedValueOnce({
        id: 21n, telefono: '51987654321', duenio: 'PERSONA', estado: 'ABIERTA', tomado_por: null,
        motivo_derivacion: 'CALIFICACION_BAJA', urgente: true, flujo: { version: 2, estado: 'MENU', repreguntasFallidas: 0 },
      });
      await service.procesarMensajeEntrante(21n, { texto: 'hola' });
      expect(mensajeriaMock.enviarBotones.mock.calls.length + mensajeriaMock.enviarTexto.mock.calls.length + mensajeriaMock.enviarLista.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Estados atascados (más de 12 h)', () => {
    const viejo = (extra: any) => ({
      id: 30n, telefono: '51987654321', duenio: 'PERSONA', estado: 'ABIERTA', tomado_por: null,
      ultima_actividad: new Date(), flujo: { version: 2, estado: 'PEDIDO_VER_CARRITO', repreguntasFallidas: 0, pedido: { items: [{ id: 1 }] } }, ...extra,
    });
    it('con carrito vuelve a MENU, saluda y queda registrado', async () => {
      prismaMock.mensajeChat.findMany = jest.fn().mockResolvedValue([
        { en: new Date() }, { en: new Date(Date.now() - 20 * 3600000) },
      ]);
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(viejo({}));
      await service.procesarMensajeEntrante(30n, { texto: 'hola' });
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ duenio: 'BOT', flujo: expect.objectContaining({ estado: 'MENU', pedido: null }) }) }));
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        '51987654321', expect.stringContaining('¡Hola de nuevo!'), expect.any(Array), expect.any(Object));
      expect(prismaMock.mensajeChat.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'SISTEMA' }) }));
    });
    it('con actividad reciente no toca el flujo', async () => {
      prismaMock.mensajeChat.findMany = jest.fn().mockResolvedValue([{ en: new Date() }, { en: new Date(Date.now() - 5 * 60000) }]);
      prismaMock.conversacion.findUnique.mockResolvedValueOnce(viejo({}));
      await service.procesarMensajeEntrante(30n, { texto: 'hola' });
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalledWith(
        expect.anything(), expect.stringContaining('¡Hola de nuevo!'), expect.anything(), expect.anything());
    });
  });
});
