jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import {
  RESPUESTA_NO_VERIFICADO,
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

  it('un celular distinto con el mismo token no verifica y recibe la frase de «no pudimos verificar»', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    await webhook.procesarPayload(mensajeTexto('wamid.V2', OTRO, `Mi código: ${token}`));
    await tick();

    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(OTRO, RESPUESTA_NO_VERIFICADO);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
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
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_NO_VERIFICADO);
  });

  it('el mismo mensaje (mismo wa_message_id) no se procesa dos veces', async () => {
    const token = await iniciarVerificacion(redis as any, secretoVerificacion(config), '987654321', 'REGISTRO');
    prisma.whatsappMensaje.findUnique.mockResolvedValueOnce({ id: 1n });
    await webhook.procesarPayload(mensajeTexto('wamid.V3', TEL, `Mi código: ${token}`));
    await tick();

    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
  });
});
