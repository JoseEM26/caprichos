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


const ENTRADAS: any[] = [
  { texto: 'hola' }, { texto: '?' }, { texto: 'gracias' }, { texto: 'asdf qwer zxcv' },
  { texto: 'x', buttonPayload: 'ped_viejo_xyz' }, { texto: 'x', buttonPayload: 'id_que_no_existe' },
];

const base = { telefono: '51987654321', tomado_por: null, ultima_actividad: new Date(), urgente: false, motivo_derivacion: null };
const ESCENARIOS: Array<[string, any, { apagado?: boolean; antispam?: boolean; personaHaceMin?: number }]> = [
  ...['INICIO', 'MENU', 'CARTA_CATEGORIAS', 'PEDIDO_MODALIDAD', 'PEDIDO_VER_CARRITO', 'PAGO_ESPERANDO_VOUCHER', 'RESERVA_FECHA', 'DUDA_IA'].map(
    (e): [string, any, any] => [`BOT en ${e}`, { ...base, id: 1n, duenio: 'BOT', estado: 'ABIERTA', flujo: { version: 2, estado: e, repreguntasFallidas: 0 } }, {}],
  ),
  ['VALIDAR_PAGO sin aviso', { ...base, id: 1n, duenio: 'PERSONA', estado: 'VALIDAR_PAGO', flujo: { pago: {} } }, {}],
  ['VALIDAR_PAGO ya avisado', { ...base, id: 1n, duenio: 'PERSONA', estado: 'VALIDAR_PAGO', flujo: { pago: { avisoPersonaEnviado: true, avisoPersonaEn: new Date().toISOString() } } }, {}],
  ['ATENCION_PERSONA sin tomar', { ...base, id: 1n, duenio: 'PERSONA', estado: 'ABIERTA', flujo: { version: 2, estado: 'ATENCION_PERSONA', repreguntasFallidas: 0 } }, {}],
  ['duenio PERSONA sin tomar (calificación baja)', { ...base, id: 1n, duenio: 'PERSONA', estado: 'ABIERTA', motivo_derivacion: 'CALIFICACION_BAJA', flujo: { version: 2, estado: 'MENU', repreguntasFallidas: 0 } }, {}],
  ['modo asistido (persona escribió hace 1 min)', { ...base, id: 1n, duenio: 'PERSONA', estado: 'ABIERTA', flujo: { version: 2, estado: 'ATENCION_PERSONA', repreguntasFallidas: 0 } }, { personaHaceMin: 1 }],
  ['chatbot apagado', { ...base, id: 1n, duenio: 'BOT', estado: 'ABIERTA', flujo: { version: 2, estado: 'MENU', repreguntasFallidas: 0 } }, { apagado: true }],
  ['anti-spam', { ...base, id: 1n, duenio: 'BOT', estado: 'ABIERTA', flujo: { version: 2, estado: 'MENU', repreguntasFallidas: 0 } }, { antispam: true }],
];

describe('Invariante: ningún mensaje del cliente queda sin respuesta ni evento de silencio', () => {
  let service: EjecutorConversacionService;
  let prismaMock: any;
  let salidas: number;
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


  for (const [nombre, conv, opts] of ESCENARIOS) {
    for (const entrada of ENTRADAS) {
      it(`${nombre} + ${JSON.stringify(entrada)}`, async () => {
        salidas = 0;
        const cuenta = () => { salidas++; return Promise.resolve({ exito: true, waMessageId: 'm' }); };
        for (const k of Object.keys(mensajeriaMock)) mensajeriaMock[k] = jest.fn(cuenta);
        mensajeriaMock.enviarLista = jest.fn(cuenta);
        mensajeriaMock.enviarCarrusel = jest.fn(cuenta);
        mensajeriaMock.enviarImagen = jest.fn(cuenta);
        prismaMock.mensajeChat.create.mockImplementation(({ data }: any) => {
          if (data.tipo === 'SISTEMA' || data.direccion === 'SALE') salidas++;
          return Promise.resolve({ id: 1n });
        });
        prismaMock.mensajeChat.findFirst = jest.fn().mockResolvedValue(
          opts.personaHaceMin != null ? { en: new Date(Date.now() - opts.personaHaceMin * 60000) } : null,
        );
        prismaMock.mensajeChat.findMany = jest.fn().mockResolvedValue([]);
        prismaMock.conversacion.findUnique.mockResolvedValue(JSON.parse(JSON.stringify(conv, (_, v) => (typeof v === 'bigint' ? v.toString() + 'n' : v)), (_, v) => (typeof v === 'string' && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v)));
        (service as any).estaChatbotActivo.mockResolvedValue(!opts.apagado);
        (service as any).chatbotConfiguracionService.verificarAntiSpam = jest.fn().mockResolvedValue(
          opts.antispam ? { permitido: false, enviarAvisoSpam: false, bloqueado: true } : { permitido: true },
        );
        await service.procesarMensajeEntrante(1n, { ...entrada, waMessageId: undefined });
        expect(salidas).toBeGreaterThan(0);
      });
    }
  }
});
