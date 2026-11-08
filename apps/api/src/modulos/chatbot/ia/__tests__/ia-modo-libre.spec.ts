jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ChatbotIaService } from '../chatbot-ia.service';
import { IaHerramientasService } from '../ia-herramientas.service';
import { IaConsumoService } from '../ia-consumo.service';

function armar(params: Record<string, any>) {
  const prisma: any = {
    parametro: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(where.clave in params ? { valor: params[where.clave] } : null)),
    },
    iaConsumo: {
      create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 1 }, _sum: { tokens_entrada: 1, tokens_salida: 1, costo_usd_estimado: 0.01 } }),
    },
    pedido: { findUnique: jest.fn(), findFirst: jest.fn() },
    notificacion: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
  };
  const redis: any = {
    obtenerCliente: () => ({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
  };
  const config: any = { get: (k: string, d?: any) => (k === 'OPENAI_API_KEY' ? 'sk-test' : k === 'OPENAI_MODEL' ? 'gpt-4o-mini' : d) };
  const catalogo: any = {
    obtenerCarta: jest.fn().mockResolvedValue([{ nombre: 'Postres', productos: [{ nombre: 'Carrot Cake', precio: 16, disponible: true }] }]),
  };
  const herr = new IaHerramientasService(prisma, catalogo);
  const consumo = new IaConsumoService(prisma, redis, config, { emitirAdmin: jest.fn() } as any);
  return { prisma, catalogo, svc: new ChatbotIaService(config, herr, consumo, redis), herr, consumo };
}

const llamada = (name: string, args: any) => ({
  ok: true,
  json: async () => ({
    choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  }),
});
const texto = (t: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { role: 'assistant', content: t } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
});

describe('IA en conversación libre', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it('pregunta de precio usa la carta (herramienta) y no deriva', async () => {
    const { svc, catalogo } = armar({ chatbot_ia_activo: 'si' });
    const f = jest.fn().mockResolvedValueOnce(llamada('buscarEnCarta', { texto: 'carrot' })).mockResolvedValueOnce(texto('El Carrot Cake cuesta S/ 16.00 😊'));
    global.fetch = f as any;
    const r = await svc.procesarConsulta({ textoUsuario: '¿cuánto cuesta el carrot cake?', conversacionId: '1', telefonoCliente: '912345678' });
    expect(catalogo.obtenerCarta).toHaveBeenCalled();
    expect(r.herramientasUsadas).toContain('buscarEnCarta');
    expect(r.necesitaDerivar).toBe(false);
    // modo libre: el prompt de sistema incluye las reglas de conversación libre
    expect(JSON.parse(f.mock.calls[0][1].body).messages[0].content).toContain('MODO CONVERSACIÓN LIBRE');
  });

  it('reclamo: pasa a persona sin gastar tokens y avisa el motivo', async () => {
    const { svc } = armar({ chatbot_ia_activo: 'si' });
    const f = jest.fn();
    global.fetch = f as any;
    const r = await svc.procesarConsulta({ textoUsuario: 'Quiero hacer un reclamo, mi pedido llegó frío', conversacionId: '1', telefonoCliente: '912345678' });
    expect(f).not.toHaveBeenCalled();
    expect(r.necesitaDerivar).toBe(true);
    expect(r.herramientasUsadas).toContain('pasarAPersona');
    expect(r.motivoDerivacion).toBe('TEMA_DELICADO');
  });

  it('la IA puede invocar pasarAPersona y se deriva con su motivo', async () => {
    const { svc } = armar({ chatbot_ia_activo: 'si' });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(llamada('pasarAPersona', { motivo: 'cliente pide hablar con alguien' }))
      .mockResolvedValueOnce(texto('Te paso con una persona del equipo 😊')) as any;
    const r = await svc.procesarConsulta({ textoUsuario: 'necesito ayuda con algo raro', conversacionId: '1', telefonoCliente: '912345678' });
    expect(r.necesitaDerivar).toBe(true);
    expect(r.motivoDerivacion).toBe('cliente pide hablar con alguien');
  });

  it('modo libre apagado: prompt anterior, sin atajo de reclamos', async () => {
    const { svc } = armar({ chatbot_ia_activo: 'si', chatbot_modo_libre: 'no' });
    const f = jest.fn().mockResolvedValueOnce(texto('Claro, ¿en qué te ayudo?'));
    global.fetch = f as any;
    await svc.procesarConsulta({ textoUsuario: 'tengo un reclamo', conversacionId: '1', telefonoCliente: '912345678' });
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse(f.mock.calls[0][1].body).messages[0].content).not.toContain('MODO CONVERSACIÓN LIBRE');
  });

  it('IA apagada: no llama a OpenAI y deriva (el bot actual sigue igual)', async () => {
    const { svc } = armar({ chatbot_ia_activo: 'no' });
    const f = jest.fn();
    global.fetch = f as any;
    const r = await svc.procesarConsulta({ textoUsuario: 'hola, qué hay de postres', conversacionId: '1', telefonoCliente: '912345678' });
    expect(f).not.toHaveBeenCalled();
    expect(r.exito).toBe(false);
  });

  it('límites: defaults x5 (100 USD y 50 por hora) y se respetan los configurados', async () => {
    const sin = armar({});
    expect(await sin.consumo.obtenerTopeMensualUsd()).toBe(100);
    expect(await sin.consumo.obtenerMaxPorHoraTelefono()).toBe(50);
    const con = armar({ chatbot_ia_tope_mensual_usd: 30, chatbot_ia_max_por_hora_telefono: 7 });
    expect(await con.consumo.obtenerTopeMensualUsd()).toBe(30);
    expect(await con.consumo.obtenerMaxPorHoraTelefono()).toBe(7);
  });

  it('estadoDePedido sin código devuelve el último pedido del mismo teléfono', async () => {
    const { herr, prisma } = armar({});
    prisma.pedido.findFirst.mockResolvedValue({
      codigo: 'CP-0001', estado: 'EN_PREPARACION', modalidad: 'DELIVERY', total: 30, cliente_telefono: '51912345678',
      creado_en: new Date(), lineas: [], eta_min: 20, eta_max: 30,
    });
    const r: any = await herr.estadoDePedido('', '912345678');
    expect(r.encontrado).toBe(true);
    expect(r.tiempoEstimadoMin).toEqual({ desde: 20, hasta: 30 });
  });
});
