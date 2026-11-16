jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('fs/promises', () => ({ readFile: jest.fn(async () => Buffer.from('foto')) }));

import { ConfigService } from '@nestjs/config';
import { EvolutionApiCliente } from '../evolution/evolution-api.cliente';
import { extraerAdjuntoEvolution } from '../evolution/evolution-mensaje.util';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';

const b64 = Buffer.from('imagen-de-prueba').toString('base64');
const dato = (extra: any = {}, msg: any = {}) => ({
  key: { id: 'MSG1', remoteJid: '51999999999@s.whatsapp.net', fromMe: false },
  message: { imageMessage: { mimetype: 'image/jpeg' }, ...msg },
  ...extra,
});
const cliente = () =>
  new EvolutionApiCliente(new ConfigService({ EVOLUTION_API_URL: 'http://evo', EVOLUTION_API_KEY: 'k', EVOLUTION_INSTANCE: 'caprichos' }));

describe('adjuntos de Evolution', () => {
  afterEach(() => jest.restoreAllMocks());

  it('imageMessage con base64 en el webhook: se usa sin llamar a Evolution y el base64 no queda en el mensaje', async () => {
    const adj = extraerAdjuntoEvolution(dato({}, { base64: b64 }))!;
    expect(adj.base64).toBe(b64);
    expect(JSON.stringify(adj.message)).not.toContain(b64);
    const c = cliente();
    const f = jest.spyOn(global, 'fetch' as any);
    c.recordarAdjunto(adj.id, adj);
    const r = await c.descargarMedia('MSG1');
    expect(r?.buffer.toString()).toBe('imagen-de-prueba');
    expect(r?.mime).toBe('image/jpeg');
    expect(f).not.toHaveBeenCalled();
  });

  it('imageMessage sin base64: pide a Evolution con el mensaje completo (no depende de su base)', async () => {
    const adj = extraerAdjuntoEvolution(dato())!;
    expect(adj.base64).toBeUndefined();
    const c = cliente();
    c.recordarAdjunto(adj.id, adj);
    const f = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ base64: `data:image/jpeg;base64,${b64}`, mimetype: 'image/jpeg' }) } as any);
    const r = await c.descargarMedia('MSG1');
    expect(r?.buffer.toString()).toBe('imagen-de-prueba');
    const cuerpo = JSON.parse((f.mock.calls[0][1] as any).body);
    expect(cuerpo.message.key.id).toBe('MSG1');
    expect(cuerpo.message.message.imageMessage.mimetype).toBe('image/jpeg');
  });

  it('documentMessage se reconoce como adjunto; un texto no', () => {
    expect(extraerAdjuntoEvolution(dato({}, { imageMessage: undefined, documentMessage: { mimetype: 'application/pdf' } }))?.mime).toBe('application/pdf');
    expect(extraerAdjuntoEvolution({ key: { id: 'T' }, message: { conversation: 'hola' } })).toBeNull();
  });

  it('sin mensaje a mano y con error de Evolution: reintenta una vez y devuelve null', async () => {
    const c = cliente();
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    const f = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'x' }) } as any);
    const p = c.descargarMedia('OTRO');
    await jest.advanceTimersByTimeAsync(2500);
    expect(await p).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe('recuperar archivo y asignar voucher', () => {
  const armar = (extra: any = {}) => {
    const s: any = Object.create(WhatsappWebhookService.prototype);
    s.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    s.eventos = { emitirAdmin: jest.fn() };
    s.prisma = {
      mensajeChat: {
        findUnique: jest.fn(async () => ({ id: 7n, conversacion_id: 3n, direccion: 'ENTRA', tipo: 'IMAGEN', meta_id: 'MSG1', contenido: { texto: 'foto' }, conversacion: { id: 3n, telefono: '51999999999', flujo: {} }, ...extra.mensaje })),
        update: jest.fn(),
      },
      pedido: { findFirst: jest.fn(async () => ({ id: 9n, codigo: 'P-9', cliente_telefono: '999999999', planPago: [] })) },
      notificacion: { create: jest.fn(async () => ({ id: 1n, titulo: 't' })) },
      conversacion: { update: jest.fn() },
    };
    s.archivosService = {
      subirArchivo: jest.fn(async () => ({ id: 55n })),
      obtenerArchivoPrivado: jest.fn(async () => ({ rutaAbsoluta: '/x', tipoMime: 'image/jpeg', bytes: 4 })),
    };
    s.evolutionApi = { descargarMedia: jest.fn(async () => ({ buffer: Buffer.from('foto'), mime: 'image/jpeg' })) };
    s.vouchersService = { registrarDesdeWhatsapp: jest.fn(async () => undefined) };
    return s;
  };

  it('Recuperar archivo: baja la imagen, la guarda privada y la liga al mensaje', async () => {
    const s = armar();
    expect(await s.recuperarArchivoDeMensaje(7n)).toEqual({ ok: true });
    expect(s.archivosService.subirArchivo).toHaveBeenCalledWith(expect.objectContaining({ mimetype: 'image/jpeg' }), true);
    expect(s.prisma.mensajeChat.update.mock.calls[0][0].data.contenido).toMatchObject({ archivoId: '55', texto: 'foto' });
  });

  it('Recuperar archivo: si Evolution no lo tiene, avisa y no guarda nada', async () => {
    const s = armar();
    s.evolutionApi.descargarMedia = jest.fn(async () => null);
    const r = await s.recuperarArchivoDeMensaje(7n);
    expect(r.ok).toBe(false);
    expect(s.prisma.mensajeChat.update).not.toHaveBeenCalled();
  });

  it('Recuperar archivo: tipo no permitido se rechaza', async () => {
    const s = armar();
    s.evolutionApi.descargarMedia = jest.fn(async () => ({ buffer: Buffer.from('x'), mime: 'application/x-msdownload' }));
    expect((await s.recuperarArchivoDeMensaje(7n)).ok).toBe(false);
  });

  it('Asignar como voucher: registra el voucher del pedido y avisa a Caja', async () => {
    const s = armar({ mensaje: { contenido: { archivoId: '55' } } });
    const r = await s.asignarImagenComoVoucher(7n, 9n, { partyId: 1n });
    expect(r).toEqual({ ok: true, codigo: 'P-9' });
    expect(s.vouchersService.registrarDesdeWhatsapp).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', '55', expect.objectContaining({ id: 9n }), expect.anything(), 7n);
    expect(s.prisma.notificacion.create).toHaveBeenCalled();
  });

  it('Asignar como voucher: pedido de otro cliente se rechaza', async () => {
    const s = armar({ mensaje: { contenido: { archivoId: '55' } } });
    s.prisma.pedido.findFirst = jest.fn(async () => ({ id: 9n, codigo: 'P-9', cliente_telefono: '911111111' }));
    await expect(s.asignarImagenComoVoucher(7n, 9n, {})).rejects.toBeTruthy();
    expect(s.vouchersService.registrarDesdeWhatsapp).not.toHaveBeenCalled();
  });
});
