jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));

import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import {
  RESPUESTA_NO_VERIFICADO,
  RESPUESTA_OTRO_CELULAR,
  RESPUESTA_SIN_NUMERO,
  RESPUESTA_VERIFICADO,
  iniciarVerificacion,
  secretoVerificacion,
} from '../../clientes/verificacion-whatsapp.util';

const TEL = '51987654321';
const OTRO = '51912345678';

/** Redis en memoria: lo que usan el candado de serie, el spam y la verificación. */
function redisFalso() {
  const datos = new Map<string, string>();
  const contadores = new Map<string, number>();
  return {
    datos,
    obtenerCliente() {
      return this;
    },
    set: jest.fn(async (k: string, v: string, ...resto: unknown[]) => {
      if (resto.includes('NX') && datos.has(k)) return null;
      datos.set(k, v);
      return 'OK';
    }),
    get: jest.fn(async (k: string) => datos.get(k) ?? null),
    incr: jest.fn(async (k: string) => {
      const n = (contadores.get(k) ?? 0) + 1;
      contadores.set(k, n);
      return n;
    }),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn(async (...ks: string[]) => ks.length),
    exists: jest.fn(async (k: string) => (datos.has(k) ? 1 : 0)),
    // Libera el candado de serie como el script de Redis (si el token coincide)
    eval: jest.fn(async (_script: string, _n: number, llave: string) => {
      datos.delete(llave);
      return 1;
    }),
  };
}

const mensajeTexto = (id: string, de: string, body: string) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: de, profile: { name: 'Ana' } }], messages: [{ id: id, from: de, type: 'text', text: { body } }] } }] }],
});

const tick = () => new Promise((r) => setImmediate(r));

describe('Verificación del celular en el webhook (WHATSAPP_ENTRANTE)', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let redis: ReturnType<typeof redisFalso>;
  let mensajeria: { enviarTexto: jest.Mock };
  let motor: { procesarMensajeEntrante: jest.Mock };
  let config: ConfigService;

  beforeEach(() => {
    redis = redisFalso();
    mensajeria = { enviarTexto: jest.fn().mockResolvedValue(undefined) };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    config = { get: (_k: string, d?: any) => d } as unknown as ConfigService;
    const conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: {}, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      encuestaPosventa: { findFirst: jest.fn().mockResolvedValue(null) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn(), upsert: jest.fn() },
      pedido: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findUnique: jest.fn(async () => conv), create: jest.fn(), update: jest.fn(async ({ data }: any) => ({ ...conv, ...data })) },
      mensajeChat: { create: jest.fn(async () => ({ id: 9n })), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn() },
    };
    webhook = new WhatsappWebhookService(
      config,
      prisma,
      mensajeria as any,
      { subirArchivo: jest.fn() } as any,
      { emitirAdmin: jest.fn() } as any,
      motor as any,
      undefined,
      undefined,
      undefined,
      undefined,
      redis as any,
      undefined,
    );
  });

  it('el mensaje con el token verifica el celular: confirma en texto libre y no llega al menú del bot', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    await webhook.procesarPayload(mensajeTexto('wamid.V1', TEL, `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    await tick();

    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_VERIFICADO);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    // Queda registrado en el chat como cualquier mensaje del cliente
    expect(prisma.mensajeChat.create).toHaveBeenCalled();
  });

  it('un celular distinto con el mismo token no verifica, le dice para qué celular es el código y la respuesta queda en el chat', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    await webhook.procesarPayload(mensajeTexto('wamid.V2', OTRO, `Mi código: ${token}`));
    await tick();

    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(OTRO, RESPUESTA_OTRO_CELULAR('987654321'));
    expect(RESPUESTA_OTRO_CELULAR('987654321')).toContain('terminado en 321');
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    // La respuesta queda guardada como mensaje del bot (el vigilante ya no ve el chat «sin respuesta»)
    expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direccion: 'SALE', autor: 'BOT', contenido: { texto: RESPUESTA_OTRO_CELULAR('987654321') } }) }),
    );
  });

  it('un mensaje normal sigue al menú del bot', async () => {
    await webhook.procesarPayload(mensajeTexto('wamid.N1', TEL, 'hola, quiero pedir'));
    await tick();

    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
  });

  it('verifica con cualquier formato de remitente que Meta envía (con o sin 51, en el mismo número)', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    // Sin código de país: Meta lo manda con 51 en from, pero el 9 local también se acepta
    await webhook.procesarPayload(mensajeTexto('wamid.F1', '987654321', `Mi código: ${token}`));
    await tick();

    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_VERIFICADO);
  });

  it('acepta el texto prellenado con variaciones: mayúsculas, «código» sin tilde, espacio antes de los dos puntos, saltos de línea y tilde descompuesta', async () => {
    const variantes = [
      (t: string) => `MI CÓDIGO: ${t}`,
      (t: string) => `hola caprichos, quiero verificar mi celular. mi codigo: ${t.toLowerCase()}`,
      (t: string) => `Hola Caprichos, quiero verificar mi celular. Mi código : ${t}`,
      (t: string) => `Hola Caprichos, quiero verificar mi celular.\nMi código:\n${t}`,
      (t: string) => `Hola Caprichos, quiero verificar mi celular. Mi cO\u0301digo: ${t}`,
    ];
    for (const [i, variante] of variantes.entries()) {
      const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
      mensajeria.enviarTexto.mockClear();
      await webhook.procesarPayload(mensajeTexto(`wamid.T${i}`, TEL, variante(token)));
      await tick();
      expect({ variante: i, enviado: mensajeria.enviarTexto.mock.calls[0]?.[1] }).toEqual({ variante: i, enviado: RESPUESTA_VERIFICADO });
    }
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('un token ajeno (de otro celular) no verifica aunque el texto sea perfecto', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '912345678', 'REGISTRO');
    await webhook.procesarPayload(mensajeTexto('wamid.A1', TEL, `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    await tick();

    expect(redis.datos.has('cliente:reg:ok:912345678')).toBe(false);
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_OTRO_CELULAR('912345678'));
  });

  it('el mismo mensaje (mismo wa_message_id) no se procesa dos veces', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    prisma.whatsappMensaje.findUnique.mockResolvedValueOnce({ id: 1n });
    await webhook.procesarPayload(mensajeTexto('wamid.V3', TEL, `Mi código: ${token}`));
    await tick();

    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
  });

  /** Montaje alterno: sin Redis inyectado (caso de error de cableado). */
  const montarSinRedis = (mensajeriaMock: { enviarTexto: jest.Mock }, motorMock: { procesarMensajeEntrante: jest.Mock }, prismaMock: any) =>
    new WhatsappWebhookService(
      config, prismaMock, mensajeriaMock as any, { subirArchivo: jest.fn() } as any, { emitirAdmin: jest.fn() } as any, motorMock as any,
      undefined, undefined, undefined, undefined, undefined, undefined,
    );

  it('fuera de horario o con el chat tomado por una persona: el token se marca y la respuesta sale igual (no es conversación del bot)', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    prisma.conversacion.findUnique.mockResolvedValueOnce({ id: 42n, telefono: TEL, duenio: 'PERSONA', estado: 'ATENCION_PERSONA', tomado_por: 7, flujo: { estado: 'ATENCION_PERSONA' }, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' });
    await webhook.procesarPayload(mensajeTexto('wamid.P1', TEL, `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));

    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_VERIFICADO);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('un error al responder no impide la marca: la web la verá igualmente', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    mensajeria.enviarTexto.mockRejectedValueOnce(new Error('Evolution no respondió'));
    await expect(webhook.procesarPayload(mensajeTexto('wamid.E1', TEL, `Mi código: ${token}`))).resolves.toBeDefined();

    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
  });

  it('si el envío sale FALLIDO (p. ej. pausa de Evolution) la marca se escribe igual y el motivo queda en el log, sin token ni número', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    mensajeria.enviarTexto.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_PAUSADO', errorDetalle: 'pausa' });
    const warn = jest.spyOn((webhook as any).logger, 'warn').mockImplementation(() => undefined);
    await webhook.procesarPayload(mensajeTexto('wamid.E2', TEL, `Mi código: ${token}`));

    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    const textos = warn.mock.calls.map((c) => String(c[0]));
    expect(textos.some((t) => t.includes('[verificacion]') && t.includes('EVOLUTION_PAUSADO'))).toBe(true);
    expect(textos.join(' ')).not.toContain(token);
    expect(textos.join(' ')).not.toContain(TEL);
    warn.mockRestore();
  });

  it('el log de verificación nunca escribe el token completo ni el número completo', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    const log = jest.spyOn((webhook as any).logger, 'log').mockImplementation(() => undefined);
    await webhook.procesarPayload(mensajeTexto('wamid.L1', TEL, `Mi código: ${token}`));
    const todo = log.mock.calls.map((c) => String(c[0])).join(' ');
    expect(todo).toContain('[verificacion]');
    expect(todo).toContain('MARCADO');
    expect(todo).not.toContain(token);
    expect(todo).not.toContain('987654321');
    expect(todo).not.toContain(TEL);
    log.mockRestore();
  });

  it('sin Redis inyectado el mensaje de verificación NO pasa al bot: se responde que no se pudo verificar', async () => {
    const m = { enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }) };
    const mo = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    const w = montarSinRedis(m, mo, prisma);
    await w.procesarPayload(mensajeTexto('wamid.R1', TEL, 'Mi código: ABCDEFGH'));

    expect(mo.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(m.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_NO_VERIFICADO);
  });

  it('un error de Redis al verificar tampoco manda el mensaje al bot', async () => {
    const roto = { ...redis, get: jest.fn(async () => { throw new Error('Connection is closed'); }) };
    const w = new WhatsappWebhookService(
      config, prisma, mensajeria as any, { subirArchivo: jest.fn() } as any, { emitirAdmin: jest.fn() } as any, motor as any,
      undefined, undefined, undefined, undefined, roto as any, undefined,
    );
    await w.procesarPayload(mensajeTexto('wamid.R2', TEL, 'Mi código: ABCDEFGH'));

    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_NO_VERIFICADO);
  });

  it('token inexistente o vencido: responde «no pudimos verificar» y no marca nada', async () => {
    await webhook.procesarPayload(mensajeTexto('wamid.X1', TEL, 'Mi código: ZZZZZZZZ'));
    expect(mensajeria.enviarTexto).toHaveBeenLastCalledWith(TEL, RESPUESTA_NO_VERIFICADO);

    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    redis.datos.delete(`cliente:wa:tok:${createHmac('sha256', secretoVerificacion(config)).update(token).digest('hex')}`);
    await webhook.procesarPayload(mensajeTexto('wamid.X2', TEL, `Mi código: ${token}`));
    expect(mensajeria.enviarTexto).toHaveBeenLastCalledWith(TEL, RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('un LID sin número visible con token inexistente: no verifica (RESPUESTA_NO_VERIFICADO) y no va al bot', async () => {
    const lid = '123456789012345@lid';
    await webhook.procesarPayload(mensajeTexto('wamid.D1', lid, 'Mi código: ABCDEFGH'));

    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(`wa-user:${lid}`, RESPUESTA_NO_VERIFICADO);
    expect(RESPUESTA_SIN_NUMERO).not.toBe(RESPUESTA_NO_VERIFICADO);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('el código con espacios raros (no separable, ancho cero) también verifica', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    await webhook.procesarPayload(mensajeTexto('wamid.U1', TEL, `Hola Caprichos, quiero verificar mi​celular. Mi código: ${token}`));
    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_VERIFICADO);
  });
});

describe('Evolution: la respuesta de verificación no depende del horario del local', () => {
  it('el adaptador envía el texto aunque el local esté cerrado (no consulta la política de horario)', async () => {
    const llamar = jest.fn(async () => ({ ok: true, status: 201, data: { key: { id: 'V1' } } }));
    const api: any = { configurado: () => true, instancia: 'prueba', llamar };
    const config: any = {
      estaPausado: async () => false,
      obtener: async () => ({ evolution_pausa_min_seg: 0, evolution_pausa_max_seg: 0, evolution_max_enlaces: 9, evolution_max_texto_identico: 9, evolution_escribiendo_ms_por_caracter: 0 }),
      registrarResultadoEnvio: async () => undefined,
    };
    const ad = new WhatsAppEvolutionAdaptador(api, config, { borrar: async () => undefined } as any, { whatsappMensaje: { create: async () => ({}) } } as any);
    const r = await ad.enviarTexto('51987654321', RESPUESTA_VERIFICADO);
    expect(r.exito).toBe(true);
    expect(llamar).toHaveBeenCalledTimes(1);
  });
});

