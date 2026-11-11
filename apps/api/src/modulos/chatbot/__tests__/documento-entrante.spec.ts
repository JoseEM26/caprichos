jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Documentos del cliente (PDF, Word...): sin voucher esperado se guardan en privado y una persona los revisa;
// con voucher esperado se mantiene el pedido de foto. Tipos fuera de la lista blanca se rechazan con aviso.

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import {
  MAX_DOCUMENTO_BYTES,
  TEXTO_DOCUMENTO_NO_RECIBIDO,
  TEXTO_DOCUMENTO_RECIBIDO,
  TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO,
} from '../../../comun/documentos-whatsapp.util';

const TEL = '51987654321';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const payload = (msg: Record<string, unknown>, id = 'wamid.D1') => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }], messages: [{ id, from: TEL, ...msg }] } }] }],
});
const documento = (filename = 'menu.docx', mime = DOCX) => ({ type: 'document', document: { id: 'media-9', filename, mime_type: mime } });

function fetchConBytes(bytes: Buffer, longitudDeclarada?: number) {
  return jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://cdn.meta/x' }) })
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: (k: string) => (k === 'content-length' ? String(longitudDeclarada ?? bytes.length) : null) },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
}
const ZIP = Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6]);

describe('Documentos del cliente en el webhook', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let outbox: any;
  let archivos: any;
  let conv: any;
  let pedidoEspera: any;
  const fetchOriginal = global.fetch;

  const creados = () => prisma.mensajeChat.create.mock.calls.map((c: any[]) => c[0].data);
  const encolados = () => outbox.encolar.mock.calls.map((c: any[]) => c[0]);

  beforeEach(() => {
    pedidoEspera = null;
    conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: { estado: 'MENU' }, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      pedido: { findFirst: jest.fn(async () => pedidoEspera), findUnique: jest.fn().mockResolvedValue(null) },
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
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    archivos = { subirDocumento: jest.fn().mockResolvedValue({ id: '901', url: '/admin/archivos/901', nombre: 'menu.docx' }), subirAudio: jest.fn(), subirArchivo: jest.fn() };
    const config = { get: (k: string, d?: any) => (k === 'WHATSAPP_TOKEN' ? 'token-prueba' : d) } as unknown as ConfigService;
    const motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    webhook = new WhatsappWebhookService(config, prisma, { enviarTexto: jest.fn() } as any, archivos, { emitirAdmin: jest.fn() } as any, motor as any, undefined, undefined, undefined, outbox);
    global.fetch = fetchConBytes(ZIP) as any;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('sin voucher esperado: lo guarda en privado, lo registra como DOCUMENTO, deriva a una persona y responde UNA vez', async () => {
    await webhook.procesarPayload(payload(documento()));
    expect(archivos.subirDocumento).toHaveBeenCalledTimes(1);
    expect(archivos.subirDocumento.mock.calls[0][1]).toBe(DOCX);
    expect(archivos.subirDocumento.mock.calls[0][2]).toBe('menu.docx');
    const chat = creados()[0];
    expect(chat.tipo).toBe('DOCUMENTO');
    expect(chat.direccion).toBe('ENTRA');
    expect(chat.contenido.clase).toBe('DOCUMENTO'); // no cuenta para el límite de «no compatibles»
    expect(chat.contenido.documento).toEqual({ archivoId: '901', nombre: 'menu.docx', mime: DOCX, bytes: ZIP.length });
    expect(chat.contenido.texto).toBe('📄 menu.docx (10 B)');
    expect(encolados()).toHaveLength(1);
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_DOCUMENTO_RECIBIDO);
    expect(conv).toMatchObject({ duenio: 'PERSONA', urgente: true, motivo_derivacion: 'DOCUMENTO' });
    const notif = prisma.notificacion.create.mock.calls[0][0].data;
    expect(notif.enlace).toBe(`/admin/mensajes?telefono=${TEL}`);
  });

  it('20 documentos seguidos: el aviso al cliente sale como mucho una vez cada 2 minutos', async () => {
    await webhook.procesarPayload(payload(documento()));
    expect(encolados()).toHaveLength(1);
    // el aviso anterior sigue en la cola dentro de la ventana
    prisma.salienteWhatsapp.findFirst.mockResolvedValue({ id: 1n });
    conv = { ...conv, duenio: 'BOT', urgente: false, motivo_derivacion: null }; // el bot sigue siendo el dueño: aun así no repite
    outbox.encolar.mockClear();
    global.fetch = fetchConBytes(ZIP) as any;
    await webhook.procesarPayload(payload(documento('otro.docx'), 'wamid.D2'));
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(archivos.subirDocumento).toHaveBeenCalledTimes(2);
  });

  it('con un voucher esperado (VALIDAR_PAGO) mantiene el pedido de foto y no guarda el documento', async () => {
    conv = { ...conv, estado: 'VALIDAR_PAGO' };
    await webhook.procesarPayload(payload(documento('pago.pdf', 'application/pdf')));
    expect(archivos.subirDocumento).not.toHaveBeenCalled();
    expect(creados()[0].contenido.clase).toBe('NO_COMPATIBLE');
    expect(encolados()[0].carga.textoLibre).toContain('foto o captura de pantalla del pago');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['ejecutable disfrazado de pdf', 'factura.exe', 'application/pdf'],
    ['doble extensión', 'factura.pdf.exe', 'application/pdf'],
    ['zip', 'fotos.zip', 'application/zip'],
    ['tipo incoherente', 'carta.pdf', DOCX],
  ])('rechaza %s: no descarga, no guarda y avisa el formato permitido', async (_n, filename, mime) => {
    await webhook.procesarPayload(payload(documento(filename, mime)));
    expect(archivos.subirDocumento).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(creados()[0].contenido.clase).toBe('NO_COMPATIBLE');
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO);
  });

  it('rechaza un contenido que no coincide con la extensión (mime y extensión pdf pero es un ejecutable)', async () => {
    global.fetch = fetchConBytes(Buffer.from('MZ-ejecutable')) as any;
    await webhook.procesarPayload(payload(documento('carta.pdf', 'application/pdf')));
    expect(archivos.subirDocumento).not.toHaveBeenCalled();
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO);
  });

  it('un documento sobrante de tamaño se descarta y se avisa sin guardarlo', async () => {
    global.fetch = fetchConBytes(Buffer.alloc(8), MAX_DOCUMENTO_BYTES + 1) as any;
    await webhook.procesarPayload(payload(documento()));
    expect(archivos.subirDocumento).not.toHaveBeenCalled();
    expect(encolados()[0].carga.textoLibre).toBe(TEXTO_DOCUMENTO_NO_RECIBIDO);
  });

  it('un documento no cuenta para derivar por tres «no compatibles» seguidos', async () => {
    prisma.mensajeChat.findMany.mockResolvedValue([
      { contenido: { clase: 'DOCUMENTO' } }, { contenido: { clase: 'DOCUMENTO' } }, { contenido: { clase: 'DOCUMENTO' } },
    ]);
    await webhook.procesarPayload(payload({ type: 'video', video: { id: 'v' } }, 'wamid.V1'));
    expect(conv.motivo_derivacion).not.toBe('MEDIOS_NO_COMPATIBLES');
  });
});
