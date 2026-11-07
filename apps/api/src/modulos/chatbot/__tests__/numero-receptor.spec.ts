jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Responder desde el mismo numero al que escribio el cliente (varios numeros en una misma cuenta de WhatsApp).

import { ConfigService } from '@nestjs/config';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { clasificarFallo } from '../servicios/outbox-whatsapp.service';
import { esErrorVentana24h, mapearErrorWhatsApp, TEXTO_VENTANA_24H } from '../../mensajes/utilidades/error-whatsapp.util';

const PRINCIPAL = '977000000001';
const ANTIGUO = '914000000002';
const TEL = '51987654321';

describe('Adaptador Meta: numero emisor', () => {
  let conversaciones: any[];
  let adaptador: WhatsAppMetaAdaptador;
  let fetchMock: jest.Mock;
  const original = global.fetch;

  beforeEach(() => {
    conversaciones = [];
    const config = {
      get: (k: string, d?: any) => ({ WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: PRINCIPAL, WHATSAPP_API_VERSION: 'v20.0' } as any)[k] ?? d,
    };
    const prisma: any = {
      whatsappMensaje: { create: jest.fn(async ({ data }: any) => ({ id: 1n, ...data })) },
      conversacion: {
        findFirst: jest.fn(async ({ where }: any) =>
          conversaciones.find((c) => (where.id ? c.id === where.id : where.telefono.in.includes(c.telefono))) ?? null,
        ),
      },
    };
    adaptador = new WhatsAppMetaAdaptador(config as unknown as ConfigService, prisma);
    fetchMock = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ messages: [{ id: 'wamid.1' }] }) }));
    global.fetch = fetchMock as any;
  });
  afterEach(() => {
    global.fetch = original;
  });

  const urlUsada = () => String(fetchMock.mock.calls[0][0]);

  it('sin numero de conversacion usa el WHATSAPP_PHONE_ID de siempre', async () => {
    await adaptador.enviarTexto(TEL, 'hola');
    expect(urlUsada()).toContain(`/${PRINCIPAL}/messages`);
  });

  it('usa el numero pedido por quien llama', async () => {
    await adaptador.enviarTexto(TEL, 'hola', { phoneNumberId: ANTIGUO });
    expect(urlUsada()).toContain(`/${ANTIGUO}/messages`);
  });

  it('usa el numero de la conversacion por telefono (outbox, avisos, verificacion) y por id (bot, Mensajes)', async () => {
    conversaciones = [{ id: 7n, telefono: TEL, phone_number_id: ANTIGUO }];
    await adaptador.enviarTexto(TEL, 'hola');
    expect(urlUsada()).toContain(`/${ANTIGUO}/messages`);
    fetchMock.mockClear();
    await adaptador.enviarBotones('999', 'x', [{ id: 'a', titulo: 'A' }], { conversacionId: 7n });
    expect(urlUsada()).toContain(`/${ANTIGUO}/messages`);
  });

  it('un phone id que no es numerico se ignora y se usa el de siempre', async () => {
    await adaptador.enviarTexto(TEL, 'hola', { phoneNumberId: '../evil?x=1' });
    expect(urlUsada()).toContain(`/${PRINCIPAL}/messages`);
  });

  it('plantilla y marcar leido tambien usan el numero indicado', async () => {
    await adaptador.enviarPlantilla(TEL, 'reabrir', 'es', [], { phoneNumberId: ANTIGUO });
    expect(urlUsada()).toContain(`/${ANTIGUO}/messages`);
    fetchMock.mockClear();
    await adaptador.marcarLeido('wamid.9', ANTIGUO);
    expect(urlUsada()).toContain(`/${ANTIGUO}/messages`);
  });
});

describe('Webhook: numero receptor', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let creadas: any[];
  let env: Record<string, string>;

  const payload = (phoneId: string | undefined, display = '51 914 244 077', wa = 'wamid.A1') => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              ...(phoneId !== undefined ? { metadata: { phone_number_id: phoneId, display_phone_number: display } } : {}),
              contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }],
              messages: [{ id: wa, from: TEL, type: 'audio', audio: { id: 'm' } }],
            },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    creadas = [];
    env = { WHATSAPP_PHONE_ID: PRINCIPAL };
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      pedido: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => {
          creadas.push(data);
          return { id: 1n, flujo: null, duenio: 'BOT', estado: 'ABIERTA', nombre_editado: false, ...data };
        }),
        update: jest.fn(async ({ data }: any) => ({ id: 1n, ...data })),
      },
      mensajeChat: { create: jest.fn().mockResolvedValue({ id: 1n }), findMany: jest.fn().mockResolvedValue([]) },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
    };
    const config = { get: (k: string, d?: any) => env[k] ?? d } as unknown as ConfigService;
    const outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    webhook = new WhatsappWebhookService(
      config, prisma, { enviarTexto: jest.fn() } as any, { subirArchivo: jest.fn() } as any,
      { emitirAdmin: jest.fn() } as any, { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) } as any, undefined, undefined, undefined, outbox as any,
    );
  });

  it('dos numeros distintos: cada conversacion guarda el numero que la recibio', async () => {
    await webhook.procesarPayload(payload(ANTIGUO, '51 914 244 077', 'wamid.A1'));
    await webhook.procesarPayload(payload(PRINCIPAL, '51 977 503 006', 'wamid.A2'));
    expect(creadas[0]).toMatchObject({ phone_number_id: ANTIGUO, numero_receptor: '51914244077' });
    expect(creadas[1]).toMatchObject({ phone_number_id: PRINCIPAL, numero_receptor: '51977503006' });
  });

  it('si la conversacion existe con otro numero, se actualiza al ultimo por el que escribio', async () => {
    prisma.conversacion.findUnique.mockResolvedValue({ id: 5n, telefono: TEL, phone_number_id: PRINCIPAL, flujo: null, nombre_editado: false, identificador_tipo: 'TELEFONO' });
    await webhook.procesarPayload(payload(ANTIGUO));
    expect(prisma.conversacion.update.mock.calls[0][0].data).toMatchObject({ phone_number_id: ANTIGUO });
  });

  it('sin metadata se procesa y no fija numero (usa el de siempre)', async () => {
    await webhook.procesarPayload(payload(undefined));
    expect(creadas[0].phone_number_id).toBeNull();
  });

  it('phone id no numerico: se ignora sin error', async () => {
    const r = await webhook.procesarPayload(payload('abc;DROP'));
    expect(r).toEqual({ procesados: 0, estados: 0 });
    expect(creadas).toHaveLength(0);
  });

  it('con WHATSAPP_PHONE_IDS_EXTRA definida, un numero fuera de la lista se ignora; el principal y los extra valen', async () => {
    env.WHATSAPP_PHONE_IDS_EXTRA = ANTIGUO;
    expect((await webhook.procesarPayload(payload('555000000009', 'x', 'w1'))).procesados).toBe(0);
    expect((await webhook.procesarPayload(payload(ANTIGUO, 'x', 'w2'))).procesados).toBe(1);
    expect((await webhook.procesarPayload(payload(PRINCIPAL, 'x', 'w3'))).procesados).toBe(1);
  });
});

describe('Error 131047 (ventana de 24 h)', () => {
  it('se explica en español simple y no es reintentable', () => {
    expect(mapearErrorWhatsApp('FUERA_DE_VENTANA_24H', 'x')).toBe(TEXTO_VENTANA_24H);
    expect(mapearErrorWhatsApp(null, '(#131047) Re-engagement message')).toBe(TEXTO_VENTANA_24H);
    expect(TEXTO_VENTANA_24H).toContain('otro numero de la cuenta');
    expect(TEXTO_VENTANA_24H).toContain('Reabrir con plantilla');
    expect(esErrorVentana24h('FUERA_DE_VENTANA_24H')).toBe(true);
    expect(esErrorVentana24h('ERROR_RED', 'timeout')).toBe(false);
    expect(clasificarFallo('FUERA_DE_VENTANA_24H', false)).toBe('PERMANENTE');
  });
});
