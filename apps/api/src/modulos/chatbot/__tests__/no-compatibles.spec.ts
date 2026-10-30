jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Audio, video, sticker, documento, contactos y tipos desconocidos: no avanzan el flujo,
// avisan una vez cada 2 minutos y repiten el último paso del bot.

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { clasificarMensajeEntrante } from '../utilidades/clasificar-mensaje-entrante.util';
import { armarTextoRepeticion, textoAvisoNoCompatible } from '../utilidades/no-compatibles.util';

const TEL = '51987654321';
const AVISO_AUDIO = 'Por ahora no puedo escuchar audios';

const payload = (msg: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }], messages: [{ id: 'wamid.X1', from: TEL, ...msg }] } }] }],
});

const audio = { type: 'audio', audio: { voice: true, mime_type: 'audio/ogg; codecs=opus', id: 'm-1' } };

describe('clasificarMensajeEntrante', () => {
  it('separa los tipos que el bot entiende de los no compatibles', () => {
    expect(clasificarMensajeEntrante({ type: 'text' }).clase).toBe('TEXTO');
    expect(clasificarMensajeEntrante({ type: 'button' }).clase).toBe('BOTON');
    expect(clasificarMensajeEntrante({ type: 'interactive', interactive: { type: 'list_reply' } })).toMatchObject({ clase: 'BOTON', subtipo: 'list_reply' });
    expect(clasificarMensajeEntrante({ type: 'location', location: { latitude: 1, longitude: 2 } }).clase).toBe('UBICACION');
    expect(clasificarMensajeEntrante({ type: 'image' }).clase).toBe('IMAGEN');
    expect(clasificarMensajeEntrante({ type: 'reaction' }).clase).toBe('REACCION');
    expect(clasificarMensajeEntrante(audio)).toEqual({ clase: 'NO_COMPATIBLE', subtipo: 'voice', etiqueta: 'Nota de voz' });
    expect(clasificarMensajeEntrante({ type: 'audio', audio: {} })).toEqual({ clase: 'NO_COMPATIBLE', subtipo: 'audio', etiqueta: 'Audio' });
    expect(clasificarMensajeEntrante({ type: 'video' })).toMatchObject({ clase: 'NO_COMPATIBLE', etiqueta: 'Video' });
    expect(clasificarMensajeEntrante({ type: 'sticker' })).toMatchObject({ clase: 'NO_COMPATIBLE', etiqueta: 'Sticker' });
    expect(clasificarMensajeEntrante({ type: 'document' })).toMatchObject({ clase: 'NO_COMPATIBLE', etiqueta: 'Documento' });
    expect(clasificarMensajeEntrante({ type: 'contacts' })).toMatchObject({ clase: 'NO_COMPATIBLE', etiqueta: 'Contacto' });
    expect(clasificarMensajeEntrante({ type: 'algo_nuevo' })).toMatchObject({ clase: 'NO_COMPATIBLE', etiqueta: 'Mensaje no compatible' });
  });
});

describe('armarTextoRepeticion y avisos', () => {
  it('repite el texto con sus opciones en líneas y no repite si no hay texto', () => {
    expect(armarTextoRepeticion({ texto: '¿Cuál quieres?', botones: [{ id: 'a', titulo: 'Pedir' }] })).toBe('¿Cuál quieres?\n\n• Pedir');
    expect(armarTextoRepeticion({ texto: '  ' })).toBeNull();
    expect(armarTextoRepeticion(null)).toBeNull();
  });

  it('el PDF pide captura solo cuando se espera voucher', () => {
    expect(textoAvisoNoCompatible('document', true)).toContain('foto o captura');
    expect(textoAvisoNoCompatible('document', false)).not.toContain('captura');
  });
});

describe('Mensajes no compatibles en el webhook', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let motor: any;
  let outbox: any;
  let eventos: any;
  let conv: any;
  let consentimiento: any;
  let ultimoAviso: any;
  let mensajesEntrantes: any[];
  let mensajesSalientes: any[];

  const encolados = () => outbox.encolar.mock.calls.map((c: any[]) => c[0]);

  beforeEach(() => {
    conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: { estado: 'PEDIDO_REFERENCIA', nombre_perfil_wa: 'Ana' }, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    consentimiento = null;
    ultimoAviso = null;
    mensajesEntrantes = [];
    mensajesSalientes = [{ contenido: { texto: '¿Cuál es la referencia de tu casa?' } }];
    eventos = { emitirAdmin: jest.fn() };

    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn(async () => consentimiento), upsert: jest.fn() },
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
        findMany: jest.fn(async ({ where, take }: any) => {
          if (where.direccion === 'ENTRA') return mensajesEntrantes.slice(0, take);
          return mensajesSalientes;
        }),
      },
      salienteWhatsapp: { findFirst: jest.fn(async () => ultimoAviso) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
    };

    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    const config = { get: (_k: string, d?: any) => d } as unknown as ConfigService;
    webhook = new WhatsappWebhookService(
      config, prisma, { enviarTexto: jest.fn() } as any, { subirArchivo: jest.fn() } as any,
      eventos, motor, undefined, undefined, undefined, outbox,
    );
  });

  describe.each([
    ['pedido (productos)', 'PEDIDO_PRODUCTOS', [{ id: 'ped_x', titulo: 'Elegir' }], '¿Qué te provoca hoy?'],
    ['dirección (texto)', 'PEDIDO_DIRECCION_TEXTO', [], '¿En qué dirección te entregamos?'],
    ['referencia', 'PEDIDO_REFERENCIA', [], '¿Cuál es la referencia de tu casa?'],
    ['voucher', 'PAGO_ESPERANDO_VOUCHER', [], 'Envíame la captura del pago'],
    ['encuesta', 'ENCUESTA', [{ id: 'enc_5', titulo: '5 estrellas' }], '¿Cómo calificarías tu pedido?'],
  ])('audio durante el paso de %s', (_nombre, estadoFlujo, botones, prompt) => {
    it('no avanza el flujo, no guarda dato y repite el paso', async () => {
      conv.flujo = { nombre_perfil_wa: 'Ana', estado: estadoFlujo, repreguntasFallidas: 0 };
      mensajesSalientes = [{ contenido: { texto: prompt, botones } }];

      await webhook.procesarPayload(payload(audio));

      expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
      expect(conv.flujo.estado).toBe(estadoFlujo);
      expect(conv.flujo.repreguntasFallidas).toBe(0);
      expect(encolados()).toHaveLength(1);
      const enviado = encolados()[0];
      expect(enviado.origen).toBe('NO_COMPATIBLE');
      expect(enviado.telefono).toBe(TEL);
      expect(enviado.carga.textoLibre).toContain(AVISO_AUDIO);
      expect(enviado.carga.textoLibre).toContain(prompt);
      expect(outbox.despertar).toHaveBeenCalled();
    });
  });

  it('si el último mensaje del bot tenía botones o lista, el aviso sale INTERACTIVO con las opciones reales', async () => {
    mensajesSalientes = [{ contenido: { texto: '¿Qué hacemos?', botones: [{ id: 'ped_x', titulo: 'Elegir' }] } }];
    await webhook.procesarPayload(payload(audio));
    expect(encolados()[0].tipo).toBe('INTERACTIVO');
    expect(encolados()[0].carga.interactivo.botones).toEqual([{ id: 'ped_x', titulo: 'Elegir' }]);
    expect(encolados()[0].carga.interactivo.cuerpo).toContain(AVISO_AUDIO);

    outbox.encolar.mockClear();
    ultimoAviso = null;
    mensajesSalientes = [{ contenido: { texto: 'Menú', botonTexto: 'Ver', filas: [{ id: 'f1', titulo: 'Pollo' }] } }];
    await webhook.procesarPayload({ ...payload(audio), entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL }], messages: [{ id: 'wamid.X2', from: TEL, ...audio }] } }] }] });
    expect(encolados()[0].carga.interactivo.lista.secciones[0].filas).toEqual([{ id: 'f1', titulo: 'Pollo' }]);
  });

  it('registra el audio en mensaje_chat con su tipo y el id de WhatsApp', async () => {
    await webhook.procesarPayload(payload(audio));
    expect(prisma.mensajeChat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direccion: 'ENTRA',
        tipo: 'AUDIO',
        meta_id: 'wamid.X1',
        contenido: expect.objectContaining({ clase: 'NO_COMPATIBLE', etiqueta: 'Nota de voz', waMessageId: 'wamid.X1' }),
      }),
    });
  });

  it.each([
    ['video', { type: 'video', video: { id: 'v' } }, 'No puedo ver videos'],
    ['sticker', { type: 'sticker', sticker: { id: 's' } }, 'No puedo usar stickers'],
    ['contactos', { type: 'contacts', contacts: [] }, 'No puedo usar contactos'],
    ['tipo desconocido', { type: 'unsupported' }, 'No puedo revisar este tipo de mensaje'],
  ])('%s: aviso específico y sin pasar al motor', async (_n, msg, aviso) => {
    await webhook.procesarPayload(payload(msg));
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(encolados()[0].carga.textoLibre).toContain(aviso);
  });

  it('PDF esperando voucher pide una foto; PDF fuera de ese contexto, aviso genérico', async () => {
    conv.estado = 'VALIDAR_PAGO';
    await webhook.procesarPayload(payload({ type: 'document', document: { id: 'd', mime_type: 'application/pdf' } }));
    expect(encolados()[0].carga.textoLibre).toContain('Envíame una foto o captura de pantalla del pago');

    outbox.encolar.mockClear();
    conv = { ...conv, estado: 'ABIERTA' };
    await webhook.procesarPayload(payload({ type: 'document', document: { id: 'd2', mime_type: 'application/pdf' } }));
    expect(encolados()[0].carga.textoLibre).toContain('No puedo abrir documentos');
  });

  it('como mucho un aviso cada 2 minutos por conversación', async () => {
    ultimoAviso = { id: 9n };
    await webhook.procesarPayload(payload(audio));
    expect(prisma.salienteWhatsapp.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ telefono_destino: TEL, origen: 'NO_COMPATIBLE', creado_en: { gte: expect.any(Date) } }),
    }));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('chat tomado por una persona: no responde, solo registra', async () => {
    conv.tomado_por = 5n;
    await webhook.procesarPayload(payload(audio));
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.mensajeChat.create).toHaveBeenCalled();
  });

  it('chat en manos de persona (dueño PERSONA): no responde', async () => {
    conv.duenio = 'PERSONA';
    await webhook.procesarPayload(payload(audio));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('consentimiento revocado: no responde', async () => {
    consentimiento = { acepta: false };
    await webhook.procesarPayload(payload(audio));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('tres no compatibles seguidos: derivan a una persona y dejan de avisar', async () => {
    mensajesEntrantes = [{ contenido: { clase: 'NO_COMPATIBLE' } }, { contenido: { clase: 'NO_COMPATIBLE' } }, { contenido: { clase: 'NO_COMPATIBLE' } }];
    await webhook.procesarPayload(payload(audio));

    expect(prisma.conversacion.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ duenio: 'PERSONA', motivo_derivacion: 'MEDIOS_NO_COMPATIBLES' }),
    }));
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'ATENCION_WHATSAPP', enlace: `/admin/mensajes?telefono=${TEL}` }),
    });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.any(Object));

    // Después de la derivación el bot calla
    outbox.encolar.mockClear();
    await webhook.procesarPayload(payload({ ...audio, id: 'wamid.X2' }));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('dos no compatibles seguidos no derivan', async () => {
    mensajesEntrantes = [{ contenido: { clase: 'NO_COMPATIBLE' } }, { contenido: { clase: 'NO_COMPATIBLE' } }, { contenido: { texto: 'hola' } }];
    await webhook.procesarPayload(payload(audio));
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
    expect(prisma.conversacion.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ duenio: 'PERSONA' }) }));
  });

  it('un fallo de la cola no tumba el webhook', async () => {
    outbox.encolar.mockRejectedValueOnce(new Error('bd caída'));
    await expect(webhook.procesarPayload(payload(audio))).resolves.toBeDefined();
  });

  it('un texto normal sigue yendo al motor', async () => {
    await webhook.procesarPayload(payload({ type: 'text', text: { body: 'hola' } }));
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledWith(42n, expect.objectContaining({ texto: 'hola', tipo: 'text' }));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
});
