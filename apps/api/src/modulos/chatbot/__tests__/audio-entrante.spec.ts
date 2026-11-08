jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Notas de voz: se descargan con el mismo mecanismo seguro que las imágenes, se guardan en privado,
// se transcriben con IA y el bot las recibe como texto (solo si el chat es suyo).

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService, MAX_AUDIO_BYTES, TEXTO_AUDIO_NO_ENTENDIDO, TEXTO_AUDIO_DERIVADO } from '../servicios/whatsapp-webhook.service';

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
  let transcripcion: any;
  let conv: any;
  let entrantes: any[];
  const fetchOriginal = global.fetch;

  const creados = () => prisma.mensajeChat.create.mock.calls.map((c: any[]) => c[0].data);
  const encolados = () => outbox.encolar.mock.calls.map((c: any[]) => c[0]);

  beforeEach(() => {
    conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: { estado: 'MENU', nombre_perfil_wa: 'Ana' }, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    entrantes = [];
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
      mensajeChat: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
        findMany: jest.fn(async ({ where, take }: any) => (where.direccion === 'ENTRA' ? entrantes.slice(0, take) : [])),
      },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
    };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    archivos = { subirAudio: jest.fn().mockResolvedValue({ id: '900', url: '/admin/archivos/900' }), subirArchivo: jest.fn() };
    transcripcion = { transcribir: jest.fn().mockResolvedValue({ intentado: true, texto: 'quiero dos donas para hoy' }) };
    const config = { get: (k: string, d?: any) => (k === 'WHATSAPP_TOKEN' ? 'token-prueba' : d) } as unknown as ConfigService;
    webhook = new WhatsappWebhookService(
      config, prisma, { enviarTexto: jest.fn() } as any, archivos,
      { emitirAdmin: jest.fn() } as any, motor, undefined, undefined, undefined, outbox,
      undefined, undefined, undefined, transcripcion,
    );
    global.fetch = respuestaFetch(2048) as any;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('descarga validando el tipo (audio/ogg; codecs=opus se guarda como audio/ogg) y lo guarda en privado', async () => {
    await webhook.procesarPayload(payload(nota()));
    expect(archivos.subirAudio).toHaveBeenCalledTimes(1);
    expect(archivos.subirAudio.mock.calls[0][1]).toBe('audio/ogg');
    expect(archivos.subirAudio.mock.calls[0][0]).toHaveLength(2048);
    const chat = creados()[0];
    expect(chat.tipo).toBe('AUDIO');
    expect(chat.direccion).toBe('ENTRA');
    expect(chat.contenido.audio).toEqual({ archivoId: '900', mime: 'audio/ogg' });
    expect(chat.contenido.transcripcion).toBe('quiero dos donas para hoy');
    expect(chat.contenido.transcritoConIa).toBe(true);
    expect(chat.contenido.clase).toBe('AUDIO');
  });

  it('rechaza un tipo de audio no permitido y no lo guarda ni lo transcribe (queda como mensaje no compatible)', async () => {
    await webhook.procesarPayload(payload(nota('audio/x-raro')));
    expect(archivos.subirAudio).not.toHaveBeenCalled();
    expect(transcripcion.transcribir).not.toHaveBeenCalled();
    expect(creados()[0].contenido.clase).toBe('NO_COMPATIBLE');
    expect(creados()[0].contenido.audio).toBeUndefined();
  });

  it('descarta un audio sobrante de tamaño (cabecera o bytes) sin guardarlo', async () => {
    global.fetch = respuestaFetch(1024, MAX_AUDIO_BYTES + 1) as any;
    await webhook.procesarPayload(payload(nota()));
    expect(archivos.subirAudio).not.toHaveBeenCalled();

    prisma.whatsappMensaje.findUnique.mockResolvedValue(null);
    global.fetch = respuestaFetch(MAX_AUDIO_BYTES + 1, 10) as any; // cabecera mentirosa: se valida también el cuerpo
    await webhook.procesarPayload(payload({ ...nota(), id: 'wamid.A2' }));
    expect(archivos.subirAudio).not.toHaveBeenCalled();
  });

  it('chat del bot: la transcripción llega al motor como texto, con la marca interna de audio', async () => {
    await webhook.procesarPayload(payload(nota()));
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
    const entrada = motor.procesarMensajeEntrante.mock.calls[0][1];
    expect(entrada.texto).toBe('quiero dos donas para hoy');
    expect(entrada.tipo).toBe('text');
    expect(entrada.desdeAudio).toBe(true);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('transcripción fallida: el bot pide amablemente que lo escriban, una vez, sin pasar nada al motor', async () => {
    transcripcion.transcribir.mockResolvedValue({ intentado: true, texto: null });
    await webhook.procesarPayload(payload(nota()));
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(encolados()).toHaveLength(1);
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_AUDIO_NO_ENTENDIDO);
    expect(conv.duenio).toBe('BOT');
    expect(creados()[0].contenido.clase).toBe('AUDIO_SIN_ENTENDER');
  });

  it('segundo audio seguido sin entenderse: deriva a una persona', async () => {
    transcripcion.transcribir.mockResolvedValue({ intentado: true, texto: null });
    entrantes = [{ contenido: { clase: 'AUDIO_SIN_ENTENDER' } }, { contenido: { clase: 'AUDIO_SIN_ENTENDER' } }];
    await webhook.procesarPayload(payload(nota()));
    expect(conv.duenio).toBe('PERSONA');
    expect(prisma.notificacion.create).toHaveBeenCalled();
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_AUDIO_DERIVADO);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it.each([
    ['tomado por una persona', { duenio: 'PERSONA', tomado_por: 5n }],
    ['atención por persona', { flujo: { estado: 'ATENCION_PERSONA' } }],
    ['validando pago', { estado: 'VALIDAR_PAGO' }],
    ['archivado como Atendido', { estado: 'ATENDIDA' }],
  ])('chat %s: se guarda y se transcribe pero no pasa al bot ni se le responde', async (_n, cambio) => {
    conv = { ...conv, ...cambio };
    await webhook.procesarPayload(payload(nota()));
    expect(transcripcion.transcribir).toHaveBeenCalledTimes(1);
    expect(creados()[0].contenido.transcripcion).toBe('quiero dos donas para hoy');
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('chat con persona y transcripción fallida: tampoco se le responde al cliente', async () => {
    conv = { ...conv, duenio: 'PERSONA', tomado_por: 5n };
    transcripcion.transcribir.mockResolvedValue({ intentado: true, texto: null });
    await webhook.procesarPayload(payload(nota()));
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(conv.duenio).toBe('PERSONA');
  });

  it('IA apagada (transcripción no intentada): se guarda y el bot responde el aviso de siempre', async () => {
    transcripcion.transcribir.mockResolvedValue({ intentado: false, texto: null });
    await webhook.procesarPayload(payload(nota()));
    expect(archivos.subirAudio).toHaveBeenCalled();
    expect(creados()[0].contenido.audio.archivoId).toBe('900');
    expect(creados()[0].contenido.clase).toBe('NO_COMPATIBLE');
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(encolados()[0].carga.textoLibre).toContain('Por ahora no puedo escuchar audios');
  });
});
