jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ChatbotIaService, MAX_RESPUESTAS_IA_POR_MINUTO } from '../chatbot-ia.service';
import { IaHerramientasService } from '../ia-herramientas.service';
import { IaConsumoService } from '../ia-consumo.service';

/**
 * IA encendida para texto libre (decisión del dueño 22/11): pedidos del chat de cualquier canal, acciones estructuradas,
 * límite por minuto, caché solo de preguntas genéricas y respaldo ante fallos. OpenAI simulado con respuestas fijas.
 */

const TEL = '51987654321';
const CEL9 = '987654321';

const ahora = Date.now();
const pedidoBase = (extra: any = {}) => ({
  id: 1n,
  codigo: 'CP-0001',
  canal: 'CARTA',
  estado: 'COLA',
  modalidad: 'DELIVERY',
  cliente_telefono: CEL9,
  cliente_party_id: null,
  es_personal: false,
  total: 30,
  subtotal: 30,
  envio: 5,
  propina: 0,
  pago_estado: 'PENDIENTE',
  pago_metodo: null,
  pago_preferido: 'YAPE',
  paga_con: null,
  programado_para: null,
  creado_en: new Date(ahora - 5 * 60_000),
  eta_min: 25,
  eta_max: 35,
  entrega_direccion: 'Av. Los Olivos 123, Campoy',
  cliente_nombre: 'Carlos Pérez Quispe',
  lineas: [{ cantidad: 1, nombre: 'Frappe Oreo', linea_combo_id: null }],
  planPago: [{ medio: 'YAPE', monto: 30 }],
  cobros: [],
  vouchers: [],
  comandas: [],
  zona: null,
  ...extra,
});

function armar(opts: { chat?: any; pedidos?: any[]; params?: Record<string, any> } = {}) {
  const params: Record<string, any> = { chatbot_ia_activo: 'si', chatbot_modo_libre: 'si', ...(opts.params || {}) };
  const pedidos = opts.pedidos ?? [];
  const chat = opts.chat ?? { telefono: TEL, celular_vinculado: null, party_id: null };
  const store: Record<string, string> = {};
  const prisma: any = {
    parametro: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(where.clave in params ? { valor: params[where.clave] } : null)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    iaConsumo: {
      create: jest.fn().mockResolvedValue({ id: 1n }),
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 1 }, _sum: { tokens_entrada: 1, tokens_salida: 1, costo_usd_estimado: 0.01 } }),
    },
    conversacion: { findUnique: jest.fn().mockResolvedValue(chat) },
    pedido: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(pedidos.find((p) => p.codigo === where.codigo) ?? null)),
      findFirst: jest.fn(() => Promise.resolve(pedidos[0] ?? null)),
      findMany: jest.fn(() => Promise.resolve(pedidos.slice(1))),
    },
    notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
  };
  const redis: any = {
    obtenerCliente: () => ({
      get: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
      set: jest.fn((k: string, v: string) => {
        store[k] = v;
        return Promise.resolve('OK');
      }),
      incr: jest.fn((k: string) => {
        store[k] = String(Number(store[k] || 0) + 1);
        return Promise.resolve(Number(store[k]));
      }),
      expire: jest.fn().mockResolvedValue(1),
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
  };
  const config: any = { get: (k: string, d?: any) => (k === 'OPENAI_API_KEY' ? 'sk-test' : k === 'OPENAI_MODEL' ? 'gpt-4o-mini' : d) };
  const catalogo: any = {
    obtenerCarta: jest.fn().mockResolvedValue([
      { id: '1', nombre: 'Frappes', productos: [{ id: '11', nombre: 'Frappe Oreo', precio: 14.5, disponible: true, quedan: 4 }, { id: '12', nombre: 'Frappe Fresa', precio: 15, disponible: false }] },
      { id: '2', nombre: 'Calientes', productos: [{ id: '21', nombre: 'Mocaccino', precio: 12, disponible: true }] },
    ]),
  };
  const herr = new IaHerramientasService(prisma, catalogo);
  const consumo = new IaConsumoService(prisma, redis, config, { emitirAdmin: jest.fn() } as any);
  return { prisma, catalogo, herr, svc: new ChatbotIaService(config, herr, consumo, redis) };
}

const llamada = (name: string, args: any = {}) => ({
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

describe('Pedidos del chat para la IA (cualquier canal, sin datos personales)', () => {
  it('el pedido de Caja del mismo número se ve igual que el de la carta o WhatsApp, con su progreso y que falta el voucher', async () => {
    for (const canal of ['CAJA', 'CARTA', 'WHATSAPP', 'MOZO']) {
      const { herr } = armar({ pedidos: [pedidoBase({ canal, estado: 'PREPARANDO' })] });
      const r: any = await herr.estadoDePedido('', TEL, '7');
      expect(r.encontrado).toBe(true);
      expect(r.canal).toBe(canal);
      expect(r.productos).toEqual(['1x Frappe Oreo']);
      expect(r.pago.faltaVoucher).toBe(true);
      expect(r.progreso).toEqual(expect.objectContaining({ etapa: 'EN_COCINA', etiqueta: expect.any(String) }));
      expect(r.tiempoEstimadoMin).toEqual({ desde: 25, hasta: 35 });
    }
  });

  it('no manda DNI, dirección, nombre completo ni el celular al prompt', async () => {
    const { herr } = armar({ pedidos: [pedidoBase()] });
    const r = await herr.estadoDePedido('', TEL, '7');
    const json = JSON.stringify(r);
    expect(json).not.toContain('Los Olivos');
    expect(json).not.toContain('Pérez');
    expect(json).not.toContain(CEL9);
    expect(json).not.toMatch(/\b\d{8}\b/);
  });

  it('chat LID con celular vinculado: busca por ese celular (llave común del chat)', async () => {
    const { herr, prisma } = armar({ chat: { telefono: 'wa-user:123@lid', celular_vinculado: CEL9, party_id: null }, pedidos: [pedidoBase({ canal: 'CAJA' })] });
    const r: any = await herr.estadoDePedido('', null, '9');
    expect(r.encontrado).toBe(true);
    expect(prisma.pedido.findFirst.mock.calls[0][0].where.OR).toEqual([{ cliente_telefono: { endsWith: CEL9 } }]);
  });

  it('chat LID sin vincular y sin party: no encuentra nada (no adivina)', async () => {
    const { herr, prisma } = armar({ chat: { telefono: 'wa-user:123@lid', celular_vinculado: null, party_id: null }, pedidos: [pedidoBase()] });
    const r: any = await herr.estadoDePedido('', null, '9');
    expect(r.encontrado).toBe(false);
    expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
  });

  it('por party: un pedido de Caja a nombre del cliente identificado también aparece', async () => {
    const { herr, prisma } = armar({ chat: { telefono: TEL, celular_vinculado: null, party_id: 55n }, pedidos: [pedidoBase({ cliente_telefono: null, cliente_party_id: 55n })] });
    const r: any = await herr.estadoDePedido('', TEL, '7');
    expect(r.encontrado).toBe(true);
    expect(JSON.stringify(prisma.pedido.findFirst.mock.calls[0][0].where, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).toContain('cliente_party_id');
  });

  it('el código de un pedido de OTRO cliente se rechaza sin mostrar datos', async () => {
    const ajeno = pedidoBase({ codigo: 'CP-0999', cliente_telefono: '911111111' });
    const { herr } = armar({ pedidos: [ajeno] });
    const r: any = await herr.estadoDePedido('CP-0999', TEL, '7');
    expect(r.encontrado).toBe(false);
    expect(JSON.stringify(r)).not.toContain('Frappe');
  });

  it('pedido programado: dice para cuándo; y lista los otros pedidos recientes del chat', async () => {
    const prog = pedidoBase({ estado: 'PROGRAMADO', programado_para: new Date('2026-11-23T19:00:00-05:00') });
    const otro = { codigo: 'CP-0002', estado: 'ENTREGADO', modalidad: 'RECOGER', total: 12, canal: 'CAJA', programado_para: null };
    const { herr } = armar({ pedidos: [prog, otro] });
    const r: any = await herr.estadoDePedido('', TEL, '7');
    expect(r.programadoPara).toBe('2026-11-23 19:00');
    expect(r.otrosPedidos).toEqual([expect.objectContaining({ codigo: 'CP-0002', canal: 'CAJA' })]);
  });

  it('con voucher enviado ya no falta; con el pago registrado tampoco', async () => {
    const conVoucher = armar({ pedidos: [pedidoBase({ vouchers: [{ revisado_en: null, retirado: false, reemplazado_en: null }] })] });
    expect(((await conVoucher.herr.estadoDePedido('', TEL, '7')) as any).pago.faltaVoucher).toBe(false);
    const pagado = armar({ pedidos: [pedidoBase({ pago_estado: 'PAGADO' })] });
    expect(((await pagado.herr.estadoDePedido('', TEL, '7')) as any).pago.faltaVoucher).toBe(false);
  });
});

describe('IA: acciones estructuradas y carta completa', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it('cartaCompleta trae precio, disponibilidad y cuántos quedan', async () => {
    const { herr } = armar();
    const r: any = await herr.cartaCompleta();
    expect(r.categorias[0].productos[0]).toEqual(expect.objectContaining({ nombre: 'Frappe Oreo', precio: 14.5, disponible: true, quedan: 4 }));
    expect(r.categorias[0].productos[1].disponible).toBe(false);
  });

  it('accionDelBot solo acepta productos y categorías reales y disponibles', async () => {
    const { herr } = armar();
    expect(await herr.accionDelBot('AGREGAR_PRODUCTO', 'Frappe Oreo')).toEqual(expect.objectContaining({ ok: true, accion: { tipo: 'AGREGAR_PRODUCTO', productoId: '11', nombre: 'Frappe Oreo' } }));
    expect(((await herr.accionDelBot('AGREGAR_PRODUCTO', 'Frappe Fresa')) as any).ok).toBe(false); // agotado
    expect(((await herr.accionDelBot('AGREGAR_PRODUCTO', 'Pizza')) as any).ok).toBe(false); // no existe
    expect(await herr.accionDelBot('VER_CATEGORIA', undefined, 'calientes')).toEqual(expect.objectContaining({ ok: true, accion: { tipo: 'VER_CATEGORIA', categoriaId: '2', nombre: 'Calientes' } }));
    expect(((await herr.accionDelBot('EMPEZAR_PEDIDO')) as any).accion).toEqual({ tipo: 'EMPEZAR_PEDIDO' });
  });

  it('la acción que pidió OpenAI sale en el resultado para que la ejecute el motor', async () => {
    const { svc } = armar();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(llamada('accionDelBot', { accion: 'AGREGAR_PRODUCTO', producto: 'Frappe Oreo' }))
      .mockResolvedValueOnce(texto('¡Claro! El Frappe Oreo cuesta S/ 14.50 😊')) as any;
    const r = await svc.procesarConsulta({ textoUsuario: 'quiero ese frappe oreo', conversacionId: '1', telefonoCliente: TEL });
    expect(r.accionIa).toEqual({ tipo: 'AGREGAR_PRODUCTO', productoId: '11', nombre: 'Frappe Oreo' });
  });
});

describe('IA: anti-bloqueo, caché y fallos', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  it(`pasadas ${MAX_RESPUESTAS_IA_POR_MINUTO} respuestas en un minuto, la IA espera (omitir) y no llama a OpenAI`, async () => {
    const { svc } = armar();
    const f = jest.fn().mockResolvedValue(texto('Hola 😊'));
    global.fetch = f as any;
    for (let i = 0; i < MAX_RESPUESTAS_IA_POR_MINUTO; i++) {
      const r = await svc.procesarConsulta({ textoUsuario: `pregunta distinta número ${i}`, conversacionId: '5', telefonoCliente: TEL });
      expect(r.omitir).toBeUndefined();
    }
    const llamadas = f.mock.calls.length;
    const espera = await svc.procesarConsulta({ textoUsuario: 'otra más', conversacionId: '5', telefonoCliente: TEL });
    expect(espera.omitir).toBe(true);
    expect(espera.respuestaTexto).toBe('');
    expect(f.mock.calls.length).toBe(llamadas);
    // otro chat no se ve afectado
    expect((await svc.procesarConsulta({ textoUsuario: 'pregunta de otro chat', conversacionId: '6', telefonoCliente: TEL })).omitir).toBeUndefined();
  });

  it('caché: una pregunta genérica (horario) se contesta una vez para todos; la de SU pedido nunca se cachea', async () => {
    const { svc } = armar();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(llamada('horarioYUbicacion'))
      .mockResolvedValueOnce(texto('Abrimos de 14:00 a 22:00 💛'))
      .mockResolvedValue(texto('Tu pedido va en cocina')) as any;
    const a = await svc.procesarConsulta({ textoUsuario: 'hasta que hora atienden los domingos', conversacionId: '1', telefonoCliente: TEL, historialReciente: [] });
    const llamadasTrasPrimera = (global.fetch as jest.Mock).mock.calls.length;
    const b = await svc.procesarConsulta({ textoUsuario: 'Hasta qué hora atienden los domingos?', conversacionId: '2', telefonoCliente: '51911111111', historialReciente: [] });
    expect(b.respuestaTexto).toBe(a.respuestaTexto);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(llamadasTrasPrimera);

    const antes = (global.fetch as jest.Mock).mock.calls.length;
    await svc.procesarConsulta({ textoUsuario: 'mi pedido ya sale o todavía no', conversacionId: '3', telefonoCliente: TEL, historialReciente: [] });
    await svc.procesarConsulta({ textoUsuario: 'mi pedido ya sale o todavía no', conversacionId: '4', telefonoCliente: TEL, historialReciente: [] });
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(antes + 2);
  });

  it('fallo de OpenAI (error HTTP o tiempo): exito=false y sin texto técnico, para que el motor use sus reglas', async () => {
    const { svc } = armar();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }) as any;
    const r = await svc.procesarConsulta({ textoUsuario: 'que postres tienen sin azucar', conversacionId: '1', telefonoCliente: TEL });
    expect(r.exito).toBe(false);
    expect(r.resultadoRegistro).toBe('ERROR');
    expect(r.respuestaTexto).not.toMatch(/500|boom|OpenAI/);
  });

  it('reclamo o descuento: directo a una persona, sin llamar a OpenAI', async () => {
    const { svc } = armar();
    const f = jest.fn();
    global.fetch = f as any;
    const r = await svc.procesarConsulta({ textoUsuario: 'quiero poner un reclamo', conversacionId: '1', telefonoCliente: TEL });
    expect(r.necesitaDerivar).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
});
