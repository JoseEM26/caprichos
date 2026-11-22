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


import { ReanudacionBotService } from '../../servicios/reanudacion-bot.service';

const base = { telefono: '51987654321', tomado_por: null, ultima_actividad: new Date(), urgente: false, motivo_derivacion: null, tomado_en: null, atendido_en: null };
const hace = (min: number) => new Date(Date.now() - min * 60000);

describe('Regla única de silencio tras atender una persona (20 min sin actividad del equipo)', () => {
  let service: EjecutorConversacionService;
  let prismaMock: any;
  let mensajeriaMock: any;
  let reanudacion: any;
  let sistema: string[];

  beforeEach(async () => {
    sistema = [];
    prismaMock = {
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      mensajeChat: {
        create: jest.fn(({ data }: any) => { if (data.tipo === 'SISTEMA') sistema.push(String(data.contenido?.texto)); return Promise.resolve({ id: 1n }); }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 99n }) },
      pedido: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
      solicitudReserva: { count: jest.fn().mockResolvedValue(0) },
    };
    mensajeriaMock = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm1' }),
      enviarBotones: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm2' }),
      enviarLista: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm3' }),
      enviarCarrusel: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm4' }),
      enviarImagen: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm5' }),
    };
    const eventosMock = { emitirAdmin: jest.fn() };
    reanudacion = { liberarUna: jest.fn().mockResolvedValue(true) };
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
        { provide: ReanudacionBotService, useValue: reanudacion },
      ],
    }).compile();

    service = module.get<EjecutorConversacionService>(EjecutorConversacionService);
    jest.spyOn(service as any, 'estaChatbotActivo').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarRateLimit').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarIdempotencia').mockResolvedValue(true);
  });

  const correr = async (conv: any, personaHaceMin: number | null, texto = 'hola') => {
    prismaMock.mensajeChat.findFirst = jest.fn(({ where }: any) =>
      Promise.resolve(where?.autor === 'PERSONA' && personaHaceMin != null ? { en: hace(personaHaceMin), contenido: {} } : null),
    );
    prismaMock.conversacion.findUnique.mockResolvedValue({ id: 1n, estado: 'ABIERTA', ...base, ...conv });
    await service.procesarMensajeEntrante(1n, { texto, waMessageId: undefined });
  };
  const salio = () => Object.values(mensajeriaMock).some((f: any) => f.mock.calls.length > 0);
  const textos = () => JSON.stringify(Object.values(mensajeriaMock).flatMap((f: any) => f.mock.calls), (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  const enPersona = { duenio: 'PERSONA', flujo: { version: 2, estado: 'ATENCION_PERSONA', repreguntasFallidas: 0 } };

  it('la persona escribió hace 5 min: el bot calla y deja el motivo en el chat', async () => {
    await correr(enPersona, 5);
    expect(salio()).toBe(false);
    expect(reanudacion.liberarUna).not.toHaveBeenCalled();
    expect(sistema.join('|')).toContain('escribió hace 5 min');
  });

  it('la persona escribió hace 21 min: el chat vuelve al bot y responde', async () => {
    await correr(enPersona, 21);
    expect(reanudacion.liberarUna).toHaveBeenCalledTimes(1);
    expect(salio()).toBe(true);
  });

  it('chat tomado: con actividad reciente calla; tras 20 min sin que esa persona escriba se libera', async () => {
    const tomado = (min: number) => ({ ...enPersona, tomado_por: 7n, tomado_en: hace(min) });
    await correr(tomado(5), null);
    expect(salio()).toBe(false);
    await correr(tomado(25), null);
    expect(reanudacion.liberarUna).toHaveBeenCalledTimes(1);
    expect(salio()).toBe(true);
  });

  it('el cliente pidió una persona hace 25 min y nadie respondió: «Perdona la espera» una sola vez, el chat sigue pendiente', async () => {
    const pedida = (extra: any = {}) => ({ ...enPersona, urgente: true, flujo: { ...enPersona.flujo, derivado_en: hace(25).toISOString(), ...extra } });
    await correr(pedida(), null);
    expect(textos()).toContain('Perdona la espera');
    const guardado = prismaMock.conversacion.update.mock.calls.map((c: any) => c[0].data).find((d: any) => d.flujo?.perdona_espera_ts);
    expect(guardado.flujo.perdona_espera_ts).toBeGreaterThan(0);
    expect(guardado.duenio).toBe('PERSONA'); // no se suelta: el equipo sigue viéndolo en Por atender
    expect(reanudacion.liberarUna).not.toHaveBeenCalled();

    Object.values(mensajeriaMock).forEach((f: any) => f.mockClear());
    await correr(pedida({ perdona_espera_ts: Date.now() }), null);
    expect(textos()).not.toContain('Perdona la espera');
  });

  it('el cliente pidió una persona hace 5 min: texto libre sin respuesta, sin «Perdona la espera»', async () => {
    await correr({ ...enPersona, urgente: true, flujo: { ...enPersona.flujo, derivado_en: hace(5).toISOString() } }, null, 'necesito algo muy especial para mañana');
    expect(salio()).toBe(false);
    expect(sistema.join('|')).toContain('Esperando a una persona');
  });
});
