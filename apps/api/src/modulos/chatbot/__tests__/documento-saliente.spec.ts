jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Envío de documentos del equipo al cliente con Meta simulado (fetch falso): primero se SUBE a la Media API y el mensaje
// va con `id` (nunca con `link`: por link Meta responde 131000).

import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { WhatsAppMetaGateway } from '../../mensajes/whatsapp-meta.gateway';
import { MensajesService } from '../../mensajes/mensajes.service';
import { MAX_DOCUMENTO_ENVIO_BYTES } from '../../../comun/documentos-whatsapp.util';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ZIP = Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3, 4]);
const PDF = Buffer.from('%PDF-1.4 contenido de prueba');

describe('Envío de documentos por Meta (media id, no link)', () => {
  let adaptador: WhatsAppMetaAdaptador;
  let gateway: WhatsAppMetaGateway;
  let prisma: any;
  let fetchFalso: jest.Mock;
  const original = global.fetch;

  beforeEach(() => {
    const config = {
      get: jest.fn((k: string, d?: any) =>
        k === 'WHATSAPP_TOKEN' ? 'token_falso' : k === 'WHATSAPP_PHONE_ID' ? '100200300' : k === 'WHATSAPP_API_VERSION' ? 'v20.0' : k === 'WHATSAPP_TIMEOUT_MS' ? 1000 : d,
      ),
    } as unknown as ConfigService;
    prisma = {
      whatsappMensaje: { create: jest.fn(async ({ data }: any) => ({ id: 77n, ...data })) },
      mensajeChat: { create: jest.fn(async ({ data }: any) => ({ id: 5n, en: new Date(), ...data })) },
      conversacion: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    };
    adaptador = new WhatsAppMetaAdaptador(config, prisma);
    gateway = new WhatsAppMetaGateway(prisma, adaptador as any);
    fetchFalso = jest.fn(async (url: string) => {
      if (String(url).endsWith('/media')) return { ok: true, status: 200, json: async () => ({ id: 'MEDIA-123' }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ messages: [{ id: 'wamid.OK' }] }) };
    });
    global.fetch = fetchFalso as any;
  });

  afterEach(() => {
    global.fetch = original;
  });

  it('sube a /media y envía type=document con id y filename (sin link)', async () => {
    const m = await gateway.enviarDocumento(1n, '51987654321', ZIP, DOCX, 'menu del dia.docx', 'PERSONA', '900');
    const [urlMedia, optsMedia] = fetchFalso.mock.calls[0];
    expect(String(urlMedia)).toBe('https://graph.facebook.com/v20.0/100200300/media');
    const form = (optsMedia as any).body as FormData;
    expect(form.get('type')).toBe(DOCX);
    expect((form.get('file') as File).name).toBe('menu del dia.docx');

    const [urlMsg, optsMsg] = fetchFalso.mock.calls[1];
    expect(String(urlMsg)).toBe('https://graph.facebook.com/v20.0/100200300/messages');
    const cuerpo = JSON.parse((optsMsg as any).body);
    expect(cuerpo.type).toBe('document');
    expect(cuerpo.document).toEqual({ id: 'MEDIA-123', filename: 'menu del dia.docx' });
    expect(JSON.stringify(cuerpo)).not.toContain('"link"');

    expect(m.estado).toBe('ENVIADO');
    const guardado = prisma.mensajeChat.create.mock.calls[0][0].data;
    expect(guardado).toMatchObject({ direccion: 'SALE', autor: 'PERSONA', tipo: 'DOCUMENTO', meta_id: 'wamid.OK' });
    expect(guardado.contenido.texto).toBe('📄 menu del dia.docx (8 B)');
    expect(guardado.contenido.documento).toEqual({ archivoId: '900', nombre: 'menu del dia.docx', mime: DOCX, bytes: 8 });
  });

  it('si Meta rechaza la subida, no manda el mensaje y queda FALLIDO con el motivo', async () => {
    fetchFalso.mockImplementation(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'x' } }) }));
    const m = await gateway.enviarDocumento(1n, '51987654321', ZIP, DOCX, 'a.docx', 'PERSONA', '900');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(m.estado).toBe('FALLIDO');
    expect(m.errorCodigo).toBe('SUBIDA_MEDIA');
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido.estado).toBe('FALLIDO');
  });

  it('un error de Meta al enviar el mensaje queda registrado como FALLIDO (sin reintentar una subida duplicada)', async () => {
    fetchFalso.mockImplementation(async (url: string) =>
      String(url).endsWith('/media')
        ? { ok: true, status: 200, json: async () => ({ id: 'MEDIA-1' }) }
        : { ok: false, status: 400, text: async () => JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }) },
    );
    const m = await gateway.enviarDocumento(1n, '51987654321', ZIP, DOCX, 'a.docx', 'PERSONA', '900');
    expect(m.estado).toBe('FALLIDO');
    expect(fetchFalso.mock.calls.filter((c) => String(c[0]).endsWith('/media'))).toHaveLength(1);
  });
});

describe('MensajesService.enviarDocumento', () => {
  const usuario = { partyId: 10n, rol: 'ADMIN', debeCambiar: false } as any;
  let prisma: any;
  let auditoria: any;
  let gateway: any;
  let archivos: any;
  let ventana: any;
  let service: MensajesService;

  const archivo = (extra: any = {}) => ({ buffer: PDF, mimetype: 'application/pdf', originalname: 'carta.pdf', ...extra });

  beforeEach(() => {
    prisma = {
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 100n }) },
      conversacion: {
        findUnique: jest.fn().mockResolvedValue({ id: 1n, telefono: '51987654321', tomado_por: null, estado: 'ABIERTA', phone_number_id: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    gateway = {
      enviarDocumento: jest.fn().mockResolvedValue({ id: '5', autor: 'PERSONA', texto: 't', en: new Date(), metaId: 'wamid.1', estado: 'ENVIADO' }),
    };
    archivos = { subirDocumento: jest.fn().mockResolvedValue({ id: '900', url: '/admin/archivos/900', nombre: 'carta.pdf' }) };
    ventana = { esVentanaAbierta: jest.fn().mockResolvedValue(true) };
    service = new MensajesService(prisma, auditoria, gateway, { emitirAdmin: jest.fn() } as any, ventana, undefined, archivos);
  });

  it('guarda en privado, envía y audita quién lo envió', async () => {
    const r = await service.enviarDocumento('1', archivo(), 'carta final.pdf', usuario, '10.0.0.1');
    expect(r).toEqual({ id: '5' });
    expect(archivos.subirDocumento).toHaveBeenCalledWith(PDF, 'application/pdf', 'carta final.pdf');
    expect(gateway.enviarDocumento).toHaveBeenCalledWith(1n, '51987654321', PDF, 'application/pdf', 'carta final.pdf', 'PERSONA', '900', undefined);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'mensajes', accion: 'ENVIAR_DOCUMENTO', entidad: 'conversacion', entidadId: 1n, partyId: 10n, ip: '10.0.0.1' }),
    );
    expect(prisma.conversacion.update).toHaveBeenCalled(); // el chat queda a cargo de la persona
  });

  it.each([
    ['ejecutable con mime pdf', { originalname: 'virus.exe' }],
    ['doble extensión', { originalname: 'carta.pdf.exe' }],
    ['mime que no coincide', { mimetype: DOCX }],
    ['contenido que no es pdf', { buffer: Buffer.from('MZ-programa') }],
  ])('rechaza %s con 415 sin guardar ni enviar', async (_n, extra) => {
    await expect(service.enviarDocumento('1', archivo(extra), undefined, usuario)).rejects.toMatchObject({ status: 415 });
    expect(archivos.subirDocumento).not.toHaveBeenCalled();
    expect(gateway.enviarDocumento).not.toHaveBeenCalled();
  });

  it('el nombre con ../ se sanea antes de guardarlo y enviarlo', async () => {
    await service.enviarDocumento('1', archivo(), '../../secreto/carta.pdf', usuario);
    expect(gateway.enviarDocumento.mock.calls[0][4]).toBe('carta.pdf');
  });

  it('rechaza vacío y más de 16 MB con 400 y 413', async () => {
    await expect(service.enviarDocumento('1', archivo({ buffer: Buffer.alloc(0) }), undefined, usuario)).rejects.toMatchObject({ status: 400 });
    await expect(
      service.enviarDocumento('1', archivo({ buffer: Buffer.alloc(MAX_DOCUMENTO_ENVIO_BYTES + 1) }), undefined, usuario),
    ).rejects.toMatchObject({ status: 413 });
    expect(gateway.enviarDocumento).not.toHaveBeenCalled();
  });

  it('fuera de la ventana de 24 h responde 409 VENTANA_CERRADA y no envía (igual que el texto)', async () => {
    ventana.esVentanaAbierta.mockResolvedValue(false);
    const e: any = await service.enviarDocumento('1', archivo(), undefined, usuario).catch((x) => x);
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(409);
    expect(e.getResponse().codigo).toBe('VENTANA_CERRADA');
    expect(gateway.enviarDocumento).not.toHaveBeenCalled();
    expect(archivos.subirDocumento).not.toHaveBeenCalled();
  });

  it('chat tomado por otra persona: 409 CHAT_TOMADO', async () => {
    prisma.conversacion.findUnique.mockResolvedValue({ id: 1n, telefono: '51987654321', tomado_por: 200n, estado: 'ABIERTA', tomadoPorUsuario: null });
    await expect(service.enviarDocumento('1', archivo(), undefined, usuario)).rejects.toMatchObject({ status: 409 });
    expect(gateway.enviarDocumento).not.toHaveBeenCalled();
  });

  it('si Meta falla, responde 400 con el motivo y el mensaje queda en el hilo', async () => {
    gateway.enviarDocumento.mockResolvedValue({ id: '5', autor: 'PERSONA', texto: 't', en: new Date(), metaId: null, estado: 'FALLIDO', errorCodigo: 'SUBIDA_MEDIA', errorDetalle: 'Meta no aceptó el documento' });
    await expect(service.enviarDocumento('1', archivo(), undefined, usuario)).rejects.toMatchObject({ status: 400 });
    expect(auditoria.registrar).toHaveBeenCalled();
  });
});

describe('MensajesService.documentoDeMensaje (descarga)', () => {
  it('solo sirve mensajes de tipo DOCUMENTO y devuelve el nombre saneado', async () => {
    const prisma: any = { mensajeChat: { findUnique: jest.fn() } };
    const archivos: any = { obtenerArchivoPrivado: jest.fn().mockResolvedValue({ rutaAbsoluta: '/x/y.pdf', tipoMime: 'application/pdf', bytes: 3 }) };
    const service = new MensajesService(prisma, {} as any, {} as any, undefined, undefined, undefined, archivos);
    prisma.mensajeChat.findUnique.mockResolvedValue({ tipo: 'DOCUMENTO', contenido: { documento: { archivoId: '900', nombre: '../carta.pdf' } } });
    const r = await service.documentoDeMensaje('5', { partyId: 1n } as any, '1.1.1.1', 'ua');
    expect(r.nombre).toBe('carta.pdf');
    expect(archivos.obtenerArchivoPrivado).toHaveBeenCalledWith('900', { partyId: 1n }, '1.1.1.1', 'ua');

    prisma.mensajeChat.findUnique.mockResolvedValue({ tipo: 'IMAGEN', contenido: { archivoId: '1' } });
    await expect(service.documentoDeMensaje('6', { partyId: 1n } as any)).rejects.toMatchObject({ status: 404 });
    await expect(service.documentoDeMensaje('no-numero', { partyId: 1n } as any)).rejects.toMatchObject({ status: 404 });
  });
});
