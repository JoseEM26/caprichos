jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';

const PROPIO = '51977123456';
const BLOQ = '51955111222';
const CLIENTE = '51987654321';

describe('Webhook: ignora entrantes del número propio y de bloqueados', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let motor: any;
  let numeros: any;

  const payload = (from: string, extra: Record<string, unknown> = {}, field = 'messages') => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field,
            value: {
              metadata: { phone_number_id: '111222333444', display_phone_number: '51 977 123 456' },
              contacts: [{ wa_id: from, profile: { name: 'X' } }],
              messages: [{ id: `wamid.${from}`, from, type: 'text', text: { body: 'hola' } }],
              ...extra,
            },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      pedido: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 1n, flujo: null, duenio: 'BOT', estado: 'ABIERTA', nombre_editado: false, ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 1n, ...data })),
      },
      mensajeChat: { create: jest.fn().mockResolvedValue({ id: 1n }), findMany: jest.fn().mockResolvedValue([]) },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
    };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    numeros = {
      aprenderNumeroVisible: jest.fn(),
      logOmitido: jest.fn(),
      motivoOmision: jest.fn(async (t: string) => (t.endsWith('977123456') ? 'DESTINO_NUMERO_PROPIO' : t.endsWith('955111222') ? 'DESTINO_BLOQUEADO' : null)),
    };
    const config = { get: (k: string, d?: any) => ({ WHATSAPP_PHONE_ID: '111222333444' } as any)[k] ?? d } as unknown as ConfigService;
    const mensajeria = { enviarTexto: jest.fn() };
    webhook = new WhatsappWebhookService(
      config, prisma, mensajeria as any, { subirArchivo: jest.fn() } as any,
      { emitirAdmin: jest.fn() } as any, motor, undefined, undefined, undefined,
      { encolar: jest.fn(), despertar: jest.fn() } as any, undefined, undefined, undefined, numeros,
    );
    (webhook as any).mensajeria = mensajeria;
  });

  it.each([
    ['número propio', PROPIO],
    ['número bloqueado', BLOQ],
  ])('%s: 200 sin procesar, sin conversación, sin bot', async (_n, from) => {
    const r = await webhook.procesarPayload(payload(from));
    expect(r).toEqual({ procesados: 0, estados: 0 });
    expect(prisma.conversacion.create).not.toHaveBeenCalled();
    expect(prisma.whatsappMensaje.create).not.toHaveBeenCalled();
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect((webhook as any).mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(numeros.logOmitido).toHaveBeenCalled();
  });

  it('los «echo» de mensajes salientes del negocio se ignoran', async () => {
    const r = await webhook.procesarPayload(payload(CLIENTE, {}, 'smb_message_echoes'));
    expect(r.procesados).toBe(0);
    expect(prisma.conversacion.create).not.toHaveBeenCalled();
  });

  it('un cliente normal se procesa y aprende el número visible del negocio', async () => {
    const r = await webhook.procesarPayload(payload(CLIENTE));
    expect(r.procesados).toBe(1);
    expect(numeros.aprenderNumeroVisible).toHaveBeenCalledWith('51977123456');
  });

  it('los mensajes de estado (entregado/leído) siguen igual aunque vengan del número propio', async () => {
    const p: any = payload(PROPIO, { statuses: [{ id: 'wamid.S', status: 'delivered', recipient_id: PROPIO }] });
    p.entry[0].changes[0].value.messages = [];
    const r = await webhook.procesarPayload(p);
    expect(r.estados).toBe(1);
  });
});
