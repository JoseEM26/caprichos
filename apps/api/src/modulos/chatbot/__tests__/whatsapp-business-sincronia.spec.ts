jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { EvolutionWebhookService } from '../evolution/evolution-webhook.service';
import { normalizarMensajeEvolution } from '../evolution/evolution-mensaje.util';
import { personaAtiendeDesdeWhatsapp } from '../utilidades/canal-whatsapp-business';
import { atiendeDe } from '../../mensajes/mensajes.service';

const CLIENTE = '51987654321';
const dato = (id: string, extra: any = {}, fromMe = true) => ({
  key: { id, remoteJid: `${CLIENTE}@s.whatsapp.net`, fromMe },
  pushName: 'Local Caprichos',
  message: { conversation: 'Hola, ya va tu pedido' },
  ...extra,
});

describe('Mensajes que el local escribe desde WhatsApp Business (fromMe)', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let eventos: any;

  beforeEach(() => {
    eventos = { emitirAdmin: jest.fn() };
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null) },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      conversacion: {
        findUnique: jest.fn().mockResolvedValue({ id: 5n, duenio: 'BOT' }),
        findFirst: jest.fn().mockResolvedValue({ id: 5n }),
        create: jest.fn(async ({ data }: any) => ({ id: 9n, ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 5n, ...data })),
      },
      mensajeChat: { create: jest.fn().mockResolvedValue({ id: 70n }), findUnique: jest.fn().mockResolvedValue(null) },
    };
    const config = { get: (_k: string, d?: any) => d } as unknown as ConfigService;
    webhook = new WhatsappWebhookService(config, prisma, { enviarTexto: jest.fn() } as any, { subirArchivo: jest.fn() } as any, eventos);
    webhook.esperaEcoMs = 0;
  });

  const msg = (extra: any = {}) => {
    const n = normalizarMensajeEvolution(dato('HUMANO1', extra), { propios: true });
    if (!n.ok) throw new Error('no normaliza');
    return n.msg;
  };

  it('el parser normal sigue ignorando lo propio; con propios lo entrega con el número del cliente', () => {
    expect(normalizarMensajeEvolution(dato('X'))).toEqual({ ok: false, razon: 'PROPIO' });
    const n = normalizarMensajeEvolution(dato('X'), { propios: true });
    expect(n.ok && n.msg.from).toBe(CLIENTE);
    expect(n.ok && n.contacto.profile.name).toBeUndefined(); // pushName es el del local, no el del cliente
  });

  it('humano: lo guarda como PERSONA/SALE «WhatsApp Business» y pasa el chat a persona (el bot calla)', async () => {
    expect(await webhook.registrarMensajeDelLocal(msg())).toBe('GUARDADO');
    const data = prisma.mensajeChat.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ conversacion_id: 5n, direccion: 'SALE', autor: 'PERSONA', tipo: 'TEXTO', meta_id: 'HUMANO1' });
    expect(data.contenido).toMatchObject({ texto: 'Hola, ya va tu pedido', canal: 'WHATSAPP_BUSINESS' });
    expect(prisma.conversacion.update.mock.calls[0][0].data).toMatchObject({ duenio: 'PERSONA' });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '5' });
  });

  it('humano a un cliente sin chat: crea la conversación en manos de una persona', async () => {
    prisma.conversacion.findUnique.mockResolvedValue(null);
    prisma.conversacion.findFirst.mockResolvedValue(null);
    expect(await webhook.registrarMensajeDelLocal(msg())).toBe('GUARDADO');
    expect(prisma.conversacion.create.mock.calls[0][0].data).toMatchObject({ telefono: CLIENTE, duenio: 'PERSONA' });
  });

  it('chat que entró sin número (LID) y quedó vinculado al celular: la respuesta desde el celular va a ESE chat, no a uno nuevo', async () => {
    prisma.conversacion.findUnique.mockResolvedValue(null);
    prisma.conversacion.findFirst.mockResolvedValue({ id: 33n, duenio: 'BOT' });
    expect(await webhook.registrarMensajeDelLocal(msg())).toBe('GUARDADO');
    expect(prisma.conversacion.findFirst.mock.calls[0][0].where).toEqual({ celular_vinculado: String(CLIENTE).slice(-9) });
    expect(prisma.conversacion.create).not.toHaveBeenCalled();
    expect(prisma.conversacion.update.mock.calls[0][0].where).toEqual({ id: 33n });
  });

  it.each([
    ['whatsapp_mensaje (lo envió el bot o un aviso)', () => prisma.whatsappMensaje.findUnique.mockResolvedValue({ id: 1n })],
    ['mensaje_chat (ya guardado, p. ej. el panel)', () => prisma.mensajeChat.findUnique.mockResolvedValue({ id: 2n })],
    ['cola de salientes', () => prisma.salienteWhatsapp.findFirst.mockResolvedValue({ id: 3n })],
  ])('envío de NUESTRO sistema (%s): no se guarda ni pausa al bot', async (_n, preparar) => {
    preparar();
    expect(await webhook.registrarMensajeDelLocal(msg())).toBe('SISTEMA');
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
    expect(prisma.conversacion.update).not.toHaveBeenCalled();
    expect(prisma.conversacion.create).not.toHaveBeenCalled();
  });

  it('el eco llega antes de que el sistema registre su envío: espera y lo reconoce como suyo', async () => {
    prisma.whatsappMensaje.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1n });
    expect(await webhook.registrarMensajeDelLocal(msg())).toBe('SISTEMA');
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  it('una reacción del local no es una respuesta: no se guarda ni pausa', async () => {
    const r = await webhook.registrarMensajeDelLocal({ id: 'R1', from: CLIENTE, type: 'reaction', reaction: { emoji: '👍' } });
    expect(r).toBe('OMITIDO');
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  it('el mismo mensaje entregado dos veces no se duplica (meta_id único)', async () => {
    prisma.mensajeChat.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    expect(await webhook.registrarMensajeDelLocal(msg())).toBe('OMITIDO');
  });

  it('foto del local: se guarda como IMAGEN y se pide el archivo a Evolution', async () => {
    const recuperar = jest.spyOn(webhook, 'recuperarArchivoDeMensaje').mockResolvedValue({ ok: true });
    const m = normalizarMensajeEvolution(dato('FOTO1', { message: { imageMessage: { mimetype: 'image/jpeg', caption: 'Así quedó' } } }), { propios: true });
    if (!m.ok) throw new Error('x');
    await webhook.registrarMensajeDelLocal(m.msg);
    expect(prisma.mensajeChat.create.mock.calls[0][0].data).toMatchObject({ tipo: 'IMAGEN', direccion: 'SALE', autor: 'PERSONA' });
    expect(recuperar).toHaveBeenCalledWith(70n);
  });

  it('chats.update sin mensajes por leer marca el chat como visto; con pendientes no hace nada', async () => {
    expect(await webhook.marcarLeidoDesdeWhatsapp(`${CLIENTE}@s.whatsapp.net`)).toBe(true);
    expect(prisma.conversacion.update.mock.calls[0][0].data).toMatchObject({ marcado_no_visto: false });
    expect(prisma.conversacion.update.mock.calls[0][0].data.visto_en).toBeInstanceOf(Date);
    prisma.conversacion.findFirst.mockResolvedValue(null);
    expect(await webhook.marcarLeidoDesdeWhatsapp('51900000000@s.whatsapp.net')).toBe(false);
  });
});

describe('EvolutionWebhookService: enruta lo propio y la lectura', () => {
  const armar = () => {
    const web = { registrarMensajeDelLocal: jest.fn().mockResolvedValue('GUARDADO'), marcarLeidoDesdeWhatsapp: jest.fn().mockResolvedValue(true), procesarPayload: jest.fn() };
    const menus = { obtener: jest.fn().mockResolvedValue(null), borrar: jest.fn() };
    const svc = new EvolutionWebhookService(new ConfigService({}), { registrarConexion: jest.fn() } as any, menus as any, web as any);
    return { svc, web };
  };

  it('messages.upsert con fromMe va al registro del local y NO al bot', async () => {
    const { svc, web } = armar();
    const r = await svc.procesar({ event: 'messages.upsert', data: dato('H2') });
    expect(web.registrarMensajeDelLocal).toHaveBeenCalledWith(expect.objectContaining({ id: 'H2', from: CLIENTE }));
    expect(web.procesarPayload).not.toHaveBeenCalled();
    expect(r.procesados).toBe(1);
  });

  it('messages.upsert de un cliente sigue yendo al bot', async () => {
    const { svc, web } = armar();
    await svc.procesar({ event: 'messages.upsert', data: dato('C1', {}, false) });
    expect(web.registrarMensajeDelLocal).not.toHaveBeenCalled();
    expect(web.procesarPayload).toHaveBeenCalled();
  });

  it('chats.update con unreadCount 0 marca leído; con 3 no', async () => {
    const { svc, web } = armar();
    await svc.procesar({ event: 'CHATS_UPDATE', data: [{ remoteJid: `${CLIENTE}@s.whatsapp.net`, unreadCount: 0 }, { remoteJid: '51911111111@s.whatsapp.net', unreadCount: 3 }] });
    expect(web.marcarLeidoDesdeWhatsapp).toHaveBeenCalledTimes(1);
    expect(web.marcarLeidoDesdeWhatsapp).toHaveBeenCalledWith(`${CLIENTE}@s.whatsapp.net`);
  });
});

describe('El bot calla 20 min tras un mensaje humano de WhatsApp Business', () => {
  const hace = (min: number) => new Date(Date.now() - min * 60_000);
  const wb = (min: number) => ({ en: hace(min), contenido: { canal: 'WHATSAPP_BUSINESS' } });
  const prismaCon = (ultimo: any) => ({ mensajeChat: { findFirst: jest.fn().mockResolvedValue(ultimo) } });

  it('autorespuesta: calla dentro de los 20 min; habla pasados 25 min, si lo escribió el panel o si el chat volvió al bot', async () => {
    expect(await personaAtiendeDesdeWhatsapp(prismaCon(wb(10)), { id: 1n, duenio: 'PERSONA' })).toBe(true);
    expect(await personaAtiendeDesdeWhatsapp(prismaCon(wb(25)), { id: 1n, duenio: 'PERSONA' })).toBe(false);
    expect(await personaAtiendeDesdeWhatsapp(prismaCon({ en: hace(5), contenido: { texto: 'panel' } }), { id: 1n, duenio: 'PERSONA' })).toBe(false);
    expect(await personaAtiendeDesdeWhatsapp(prismaCon(wb(5)), { id: 1n, duenio: 'BOT' })).toBe(false); // «Devolver al bot»
  });

  it('etiqueta «quién atiende»: Bot, Persona (panel) o WhatsApp Business; Atendido y los 20 min la terminan', () => {
    const m = (min: number, canal?: string) => [{ autor: 'PERSONA', direccion: 'SALE', en: hace(min), canal }];
    expect(atiendeDe({ duenio: 'BOT' }, [])).toBe('BOT');
    expect(atiendeDe({ duenio: 'PERSONA', tomado_por: 3n }, m(5, 'WHATSAPP_BUSINESS'))).toBe('PERSONA');
    expect(atiendeDe({ duenio: 'PERSONA' }, m(5))).toBe('PERSONA');
    expect(atiendeDe({ duenio: 'PERSONA' }, m(5, 'WHATSAPP_BUSINESS'))).toBe('WHATSAPP_BUSINESS');
    expect(atiendeDe({ duenio: 'PERSONA' }, m(21, 'WHATSAPP_BUSINESS'))).toBe('PERSONA');
    expect(atiendeDe({ duenio: 'PERSONA', atendido_en: hace(1) }, m(5, 'WHATSAPP_BUSINESS'))).toBe('PERSONA');
  });
});
