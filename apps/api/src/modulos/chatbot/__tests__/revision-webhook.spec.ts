jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';

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

describe('Revisión del chatbot: webhook', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let mensajeria: { enviarTexto: jest.Mock };
  let motor: { procesarMensajeEntrante: jest.Mock };
  let outbox: { encolar: jest.Mock; despertar: jest.Mock; marcarFalloAsincrono: jest.Mock };

  beforeEach(() => {
    mensajeria = { enviarTexto: jest.fn().mockResolvedValue(undefined) };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn(), marcarFalloAsincrono: jest.fn().mockResolvedValue(true) };
    const config = { get: (_k: string, d?: any) => d } as unknown as ConfigService;
    const conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: {}, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    prisma = {
      whatsappMensaje: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 1n, estado: 'ENVIADO', direccion: 'SALIENTE', conversacion_id: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      encuestaPosventa: { findFirst: jest.fn().mockResolvedValue(null) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
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
      outbox as any,
      redisFalso() as any,
      undefined,
    );
  });

  it('«no mas» (respuesta normal a «¿algo más?») NO da de baja al cliente y llega al bot', async () => {
    await webhook.procesarPayload(mensajeTexto('wamid.A1', TEL, 'no mas'));
    await tick();
    expect(prisma.clienteWhatsappConsentimiento.upsert).not.toHaveBeenCalled();
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
  });

  it('«baja» sigue dando de baja', async () => {
    await webhook.procesarPayload(mensajeTexto('wamid.A2', TEL, 'baja'));
    await tick();
    expect(prisma.clienteWhatsappConsentimiento.upsert).toHaveBeenCalled();
  });

  it('si el motor del bot falla, el cliente recibe una disculpa una sola vez (clave por mensaje)', async () => {
    motor.procesarMensajeEntrante.mockRejectedValue(new Error('boom'));
    await webhook.procesarPayload(mensajeTexto('wamid.A3', TEL, 'quiero un combo'));
    await tick();
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    const dato = outbox.encolar.mock.calls[0][0];
    expect(dato.clave).toBe('error-bot-wamid.A3');
    expect(dato.telefono).toBe(TEL);
    expect(dato.carga.textoLibre).toContain('asesor');
    expect(outbox.despertar).toHaveBeenCalled();
  });

  it('un estado «failed» de Meta marca el saliente del outbox como FALLIDO', async () => {
    await webhook.procesarPayload({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.S1', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message', message: 'Re-engagement message' }] }] } }] }],
    });
    expect(outbox.marcarFalloAsincrono).toHaveBeenCalledWith('wamid.S1', '131047', expect.stringContaining('Re-engagement'));
  });

  it('un estado «delivered» no toca el outbox', async () => {
    await webhook.procesarPayload({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.S2', status: 'delivered' }] } }] }],
    });
    expect(outbox.marcarFalloAsincrono).not.toHaveBeenCalled();
  });
});
