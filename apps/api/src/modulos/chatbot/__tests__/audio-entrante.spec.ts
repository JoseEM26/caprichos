jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Notas de voz: se descargan con el mismo mecanismo seguro que las imágenes, se guardan en privado y una persona las escucha.
// El bot no las interpreta ni las pasa al motor: avisa una vez, pasa el chat a una persona y notifica al equipo.

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService, MAX_AUDIO_BYTES, TEXTO_NOTA_DE_VOZ } from '../servicios/whatsapp-webhook.service';

const TEL = '51987654321';
const payload = (msg: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }], messages: [{ id: 'wamid.A1', from: TEL, ...msg }] } }] }],
});
const nota = (mime = 'audio/ogg; codecs=opus') => ({ type: 'audio', audio: { voice: true, mime_type: mime, id: 'media-1' } });

function respuestaFetch(bytes: number, longitudDeclarada?: number) {
  return jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://cdn.meta/x' }) })
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: (k: string) => (k === 'content-length' ? String(longitudDeclarada ?? bytes) : null) },
      arrayBuffer: async () => new ArrayBuffer(bytes),
    });
}

describe('Notas de voz en el webhook', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let motor: any;
  let outbox: any;
  let archivos: any;
  let eventos: any;
  let conv: any;
  const fetchOriginal = global.fetch;

  const creados = () => prisma.mensajeChat.create.mock.calls.map((c: any[]) => c[0].data);
  const encolados = () => outbox.encolar.mock.calls.map((c: any[]) => c[0]);

  beforeEach(() => {
    conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: { estado: 'MENU', nombre_perfil_wa: 'Ana' }, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      pedido: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: {
        findUnique: jest.fn(async () => conv),
        create: jest.fn(),
        update: jest.fn(async ({ data }: any) => {
          conv = { ...conv, ...data };
          return conv;
        }),
      },
      mensajeChat: { create: jest.fn().mockResolvedValue({ id: 1n }), findMany: jest.fn().mockResolvedValue([]) },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
    };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    eventos = { emitirAdmin: jest.fn() };
    archivos = { subirAudio: jest.fn().mockResolvedValue({ id: '900', url: '/admin/archivos/900' }), subirArchivo: jest.fn() };
    const config = { get: (k: string, d?: any) => (k === 'WHATSAPP_TOKEN' ? 'token-prueba' : d) } as unknown as ConfigService;
    webhook = new WhatsappWebhookService(config, prisma, { enviarTexto: jest.fn() } as any, archivos, eventos, motor, undefined, undefined, undefined, outbox);
    // Ninguna nota de voz debe llamar a OpenAI: cualquier fetch distinto a Meta falla la prueba
    global.fetch = respuestaFetch(2048) as any;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('descarga validando el tipo (audio/ogg; codecs=opus se guarda como audio/ogg), lo guarda en privado y no llama a OpenAI', async () => {
    await webhook.procesarPayload(payload(nota()));
    expect(archivos.subirAudio).toHaveBeenCalledTimes(1);
    expect(archivos.subirAudio.mock.calls[0][1]).toBe('audio/ogg');
    expect(archivos.subirAudio.mock.calls[0][0]).toHaveLength(2048);
    const chat = creados()[0];
    expect(chat.tipo).toBe('AUDIO');
    expect(chat.direccion).toBe('ENTRA');
    expect(chat.contenido.audio).toEqual({ archivoId: '900', mime: 'audio/ogg' });
    expect(chat.contenido.transcripcion).toBeUndefined();
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('openai'))).toBe(false);
  });

  it('rechaza un tipo de audio no permitido sin guardarlo; igual se avisa al equipo', async () => {
    await webhook.procesarPayload(payload(nota('audio/x-raro')));
    expect(archivos.subirAudio).not.toHaveBeenCalled();
    expect(creados()[0].contenido.audio).toBeUndefined();
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
  });

  it('descarta un audio sobrante de tamaño (cabecera o bytes) sin guardarlo', async () => {
    global.fetch = respuestaFetch(1024, MAX_AUDIO_BYTES + 1) as any;
    await webhook.procesarPayload(payload(nota()));
    expect(archivos.subirAudio).not.toHaveBeenCalled();

    global.fetch = respuestaFetch(MAX_AUDIO_BYTES + 1, 10) as any; // cabecera mentirosa: se valida también el cuerpo
    await webhook.procesarPayload(payload({ ...nota(), id: 'wamid.A2' }));
    expect(archivos.subirAudio).not.toHaveBeenCalled();
  });

  it('chat del bot: responde UNA vez, pasa el chat a una persona (urgente) y notifica con enlace al chat; el motor no recibe nada', async () => {
    await webhook.procesarPayload(payload(nota()));
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(encolados()).toHaveLength(1);
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_NOTA_DE_VOZ);
    expect(encolados()[0].telefono).toBe(TEL);
    expect(conv).toMatchObject({ duenio: 'PERSONA', urgente: true, motivo_derivacion: 'NOTA_DE_VOZ' });
    const notif = prisma.notificacion.create.mock.calls[0][0].data;
    expect(notif.titulo).toBe('Nota de voz de Ana: hay que escucharla');
    expect(notif.enlace).toBe(`/admin/mensajes?telefono=${TEL}`);
    expect(notif.rol_destino).toBeNull(); // Admin y Caja
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.anything());
  });

  it('una segunda nota con el chat ya en persona no vuelve a responder, pero sí notifica', async () => {
    await webhook.procesarPayload(payload(nota()));
    outbox.encolar.mockClear();
    await webhook.procesarPayload(payload({ ...nota(), id: 'wamid.A2' }));
    // Se ignora el idempotente de whatsappMensaje (mock): el chat ya es PERSONA
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['tomado por una persona', { duenio: 'PERSONA', tomado_por: 5n }],
    ['atención por persona', { flujo: { estado: 'ATENCION_PERSONA' } }],
    ['validando pago', { estado: 'VALIDAR_PAGO' }],
  ])('chat %s: se guarda y se notifica, sin responder al cliente ni cambiar el chat', async (_n, cambio) => {
    conv = { ...conv, ...cambio };
    const antes = { ...conv };
    await webhook.procesarPayload(payload(nota()));
    expect(creados()[0].contenido.audio.archivoId).toBe('900');
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(conv.duenio).toBe(antes.duenio);
    expect(conv.estado).toBe(antes.estado);
  });

  it('chat en Atendidos: vuelve a Por atender (abierto, persona, urgente) sin responder al cliente', async () => {
    conv = { ...conv, estado: 'ATENDIDA', atendido_en: new Date() };
    await webhook.procesarPayload(payload(nota()));
    expect(conv).toMatchObject({ estado: 'ABIERTA', duenio: 'PERSONA', urgente: true });
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
  });

  it('con consentimiento revocado el chat pasa a persona y se notifica, pero no se responde', async () => {
    prisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: false });
    await webhook.procesarPayload(payload(nota()));
    expect(conv.duenio).toBe('PERSONA');
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
});
