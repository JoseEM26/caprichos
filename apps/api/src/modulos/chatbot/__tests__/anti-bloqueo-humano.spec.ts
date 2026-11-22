jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { MenuNumeradoStore } from '../evolution/menu-numerado.store';
import { ContadorSalientesService, inicioDiaLima, umbralDiario } from '../evolution/contador-salientes.service';
import { ChatbotConfiguracionService } from '../configuracion/chatbot-configuracion.service';

function prismaFalso(params: Record<string, unknown> = {}) {
  return {
    parametro: {
      findMany: jest.fn(async ({ where }: any) => Object.entries(params).filter(([k]) => where.clave.in.includes(k)).map(([clave, valor]) => ({ clave, valor }))),
      findUnique: jest.fn(async () => null),
    },
    notificacion: { create: jest.fn(async () => ({ id: 1n })) },
    whatsappMensaje: { count: jest.fn(async () => 0), create: jest.fn(async () => ({})) },
  } as any;
}

describe('pausa humana antes de responder', () => {
  const montar = () => {
    const prisma = prismaFalso({ evolution_pausa_min_seg: 0, evolution_pausa_max_seg: 0 });
    const api = { configurado: () => true, instancia: 'p', llamar: jest.fn(async () => ({ ok: true, status: 201, data: { key: { id: 'W' } } })) } as any;
    const ad = new WhatsAppEvolutionAdaptador(api, new EvolutionConfigService(prisma), new MenuNumeradoStore(), prisma);
    return { api, ad };
  };
  const rutas = (api: any) => api.llamar.mock.calls.map((c: any[]) => `${c[1].split('/').slice(1, 3).join('/')}:${c[2].number}`);
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('espera entre 2 y 5 s con «escribiendo…» y luego envía', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { ad, api } = montar();
    const p = ad.enviarTexto('51900000001', 'Hola', { replyToWaMessageId: 'M1' });
    await jest.advanceTimersByTimeAsync(1900);
    expect(rutas(api)).toEqual(['chat/sendPresence:51900000001']);
    expect(api.llamar.mock.calls[0][2]).toMatchObject({ presence: 'composing', delay: 2000 });
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(rutas(api)).toEqual(['chat/sendPresence:51900000001', 'message/sendText:51900000001']);
  });

  it('el máximo es 5 s', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9999);
    const { ad, api } = montar();
    const p = ad.enviarTexto('51900000001', 'Hola', { replyToWaMessageId: 'M1' });
    await jest.advanceTimersByTimeAsync(4900);
    expect(api.llamar).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(api.llamar).toHaveBeenCalledTimes(2);
  });

  it('conserva el orden entre chats y no repite la pausa en la misma respuesta', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { ad, api } = montar();
    const ps = [
      ad.enviarTexto('51900000001', 'a', { replyToWaMessageId: 'M1' }),
      ad.enviarTexto('51900000001', 'b', { replyToWaMessageId: 'M1' }), // segundo mensaje de la misma respuesta: sin pausa extra
      ad.enviarTexto('51900000002', 'c', { replyToWaMessageId: 'M2' }),
    ];
    await jest.advanceTimersByTimeAsync(10_000);
    await Promise.all(ps);
    expect(rutas(api).filter((r: string) => r.startsWith('message'))).toEqual(['message/sendText:51900000001', 'message/sendText:51900000001', 'message/sendText:51900000002']);
    expect(api.llamar.mock.calls.filter((c: any[]) => c[1].includes('sendPresence'))).toHaveLength(2);
  });

  it('un aviso de pedido (sin respuesta a un mensaje) sale sin pausa extra', async () => {
    const { ad, api } = montar();
    await ad.enviarTexto('51900000001', 'Tu pedido está listo', { pedidoId: '5' });
    expect(rutas(api)).toEqual(['message/sendText:51900000001']);
  });
});

describe('contador diario y alertas', () => {
  const AHORA = new Date('2026-11-22T20:00:00Z'); // 15:00 Lima
  const montar = (hoy: number, previos: number, enHora = 0, existentes = 0) => {
    const prisma = prismaFalso();
    prisma.whatsappMensaje.count = jest.fn(async ({ where }: any) => {
      if (where.telefono_hash) return enHora;
      return where.creado_en.lt ? previos : hoy;
    });
    prisma.notificacion.findFirst = jest.fn(async () => (existentes ? { id: 9n } : null));
    return { prisma, svc: new ContadorSalientesService(prisma, new EvolutionConfigService(prisma)) };
  };

  it('día de Lima y umbral con mínimo', () => {
    expect(inicioDiaLima(AHORA).toISOString()).toBe('2026-11-22T05:00:00.000Z');
    expect(inicioDiaLima(new Date('2026-11-22T03:00:00Z')).toISOString()).toBe('2026-11-21T05:00:00.000Z');
    expect(umbralDiario(100, 2, 300)).toBe(300);
    expect(umbralDiario(400, 2, 300)).toBe(800);
  });
  it('resumen: hoy, promedio de 7 días y umbral', async () => {
    const { svc } = montar(120, 2800);
    expect(await svc.resumen(AHORA)).toEqual({ hoy: 120, promedio7: 400, umbral: 800 });
  });
  it('no alerta bajo el umbral', async () => {
    const { svc, prisma } = montar(500, 2800); // umbral 800
    await svc.vigilar('h', '51***1', AHORA);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
  it('alerta a ADMIN sobre el umbral, y una sola vez por día', async () => {
    const { svc, prisma } = montar(900, 2800);
    await svc.vigilar('h', '51***1', AHORA);
    expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'WHATSAPP_ALERTA', rol_destino: 'ADMIN', titulo: 'WhatsApp: volumen diario alto' }) });
    const otra = montar(900, 2800, 0, 1); // ya existe la alerta de hoy
    await otra.svc.vigilar('h', '51***1', AHORA);
    expect(otra.prisma.notificacion.create).not.toHaveBeenCalled();
  });
  it('con poco historial el umbral mínimo es 300', async () => {
    const { svc, prisma } = montar(301, 0);
    await svc.vigilar('h', '51***1', AHORA);
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
  });
  it('un chat con más de 30 salientes en una hora alerta (una vez); con 30 no', async () => {
    const a = montar(50, 0, 31);
    await a.svc.vigilar('h', '51***1', AHORA);
    expect(a.prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ titulo: 'WhatsApp: demasiados mensajes a 51***1' }) });
    const b = montar(50, 0, 30);
    await b.svc.vigilar('h', '51***1', AHORA);
    expect(b.prisma.notificacion.create).not.toHaveBeenCalled();
    const c = montar(50, 0, 40, 1);
    await c.svc.vigilar('h', '51***1', AHORA);
    expect(c.prisma.notificacion.create).not.toHaveBeenCalled();
  });
});

describe('spam: aviso único y silencio', () => {
  const TEL = '51987654321';
  const montar = () => {
    const datos = new Map<string, string>();
    const redis = {
      datos,
      incr: jest.fn(async (k: string) => { const n = Number(datos.get(k) ?? 0) + 1; datos.set(k, String(n)); return n; }),
      expire: jest.fn(async () => 1),
      get: jest.fn(async (k: string) => datos.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => { datos.set(k, v); return 'OK'; }),
      exists: jest.fn(async (k: string) => (datos.has(k) ? 1 : 0)),
      del: jest.fn(async (...ks: string[]) => ks.length),
    };
    const prisma = { parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) } } as any;
    return { redis, svc: new ChatbotConfiguracionService(prisma, { obtenerCliente: () => redis } as any, { registrar: jest.fn() } as any) };
  };

  it('8 mensajes en un minuto: un solo aviso, silencio, y al pasar la ventana responde normal', async () => {
    const { svc, redis } = montar();
    const r: any[] = [];
    for (let i = 0; i < 8; i++) r.push(await svc.verificarAntiSpam(TEL));
    expect(r.slice(0, 7).every((x) => x.permitido)).toBe(true);
    expect(r[7]).toMatchObject({ permitido: false, enviarAvisoSpam: true, mensajeAviso: 'Recibí tus mensajes 😊 dame un momento y te respondo' });
    const mas = [await svc.verificarAntiSpam(TEL)]; // un exceso más: aún no llega al bloqueo por reincidencia (3)
    expect(mas.every((x) => !x.permitido && !x.enviarAvisoSpam)).toBe(true);
    // pasa la ventana de 60 s: Redis vence las marcas
    for (const k of [...redis.datos.keys()]) if (/:(min|aviso):/.test(k)) redis.datos.delete(k);
    expect(await svc.verificarAntiSpam(TEL)).toEqual({ permitido: true, enviarAvisoSpam: false });
  });

  it('el tope de la IA usa el mismo aviso único', async () => {
    const { svc } = montar();
    expect(await svc.avisoSpamUnaVez(TEL)).toContain('Recibí tus mensajes');
    expect(await svc.avisoSpamUnaVez(TEL)).toBeNull();
  });
});
