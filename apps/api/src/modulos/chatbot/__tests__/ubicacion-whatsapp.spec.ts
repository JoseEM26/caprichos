jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { UbicacionWhatsappController } from '../controladores/ubicacion-whatsapp.controller';
import { codificarPlusCode } from '@caprichos/compartido';
import { ubicacionValida } from '../servicios/ubicacion-cliente.util';

const TEL = '51987654321';
const payloadUbicacion = (location: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }], messages: [{ id: 'wamid.U1', from: TEL, type: 'location', location }] } }] }],
});

const tick = () => new Promise((r) => setImmediate(r));

describe('ubicacionValida', () => {
  it('acepta coordenadas en rango y rechaza las demás', () => {
    expect(ubicacionValida(-12.05, -77.04)).toBe(true);
    expect(ubicacionValida(90, 180)).toBe(true);
    expect(ubicacionValida(91, 0)).toBe(false);
    expect(ubicacionValida(0, -181)).toBe(false);
    expect(ubicacionValida(NaN, 1)).toBe(false);
    expect(ubicacionValida(undefined, 1)).toBe(false);
    expect(ubicacionValida('-12.05', '-77.04')).toBe(false);
  });
});

describe('Ubicación del cliente en el webhook', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let direcciones: any;
  let eventos: any;
  let contenidoGuardado: any;

  beforeEach(() => {
    contenidoGuardado = null;
    eventos = { emitirAdmin: jest.fn() };
    direcciones = { inversa: jest.fn().mockResolvedValue('Av. Brasil 1234, Jesús María, Lima') };
    const conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: {}, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      encuestaPosventa: { findFirst: jest.fn().mockResolvedValue(null) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn(), upsert: jest.fn() },
      pedido: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findUnique: jest.fn(async () => conv), create: jest.fn(), update: jest.fn(async ({ data }: any) => ({ ...conv, ...data })) },
      mensajeChat: {
        create: jest.fn(async ({ data }: any) => {
          contenidoGuardado = data.contenido;
          return { id: 9n };
        }),
        findUnique: jest.fn(async () => ({ contenido: contenidoGuardado })),
        update: jest.fn(async ({ data }: any) => {
          contenidoGuardado = data.contenido;
          return {};
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn() },
    };
    const motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    const outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    const config = { get: (_k: string, d?: any) => d } as unknown as ConfigService;
    webhook = new WhatsappWebhookService(
      config, prisma, { enviarTexto: jest.fn() } as any, { subirArchivo: jest.fn() } as any,
      eventos, motor as any, undefined, undefined, undefined, outbox as any, undefined, direcciones,
    );
  });

  it('guarda lat, lng, nombre y dirección y deja el mensaje como TEXTO', async () => {
    await webhook.procesarPayload(payloadUbicacion({ latitude: -12.0701, longitude: -77.0355, name: 'Casa', address: 'Av. Brasil 1234' }));
    const data = prisma.mensajeChat.create.mock.calls[0][0].data;
    expect(data.tipo).toBe('TEXTO');
    expect(data.contenido).toEqual({
      texto: 'Av. Brasil 1234',
      ubicacion: { lat: -12.0701, lng: -77.0355, nombre: 'Casa', direccion: 'Av. Brasil 1234' },
    });
  });

  it('pide la dirección aproximada sin bloquear y la guarda en la ubicación', async () => {
    await webhook.procesarPayload(payloadUbicacion({ latitude: -12.0701, longitude: -77.0355 }));
    await tick();
    await tick();
    expect(direcciones.inversa).toHaveBeenCalledWith(-12.0701, -77.0355);
    expect(prisma.mensajeChat.update).toHaveBeenCalledTimes(1);
    expect(contenidoGuardado.ubicacion.direccionAprox).toBe('Av. Brasil 1234, Jesús María, Lima');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '42' });
  });

  it('si la geocodificación falla o no hay dato, la ubicación queda sin dirección aproximada', async () => {
    direcciones.inversa.mockRejectedValue(new Error('caído'));
    await webhook.procesarPayload(payloadUbicacion({ latitude: -12.0701, longitude: -77.0355 }));
    await tick();
    await tick();
    expect(prisma.mensajeChat.update).not.toHaveBeenCalled();
    expect(contenidoGuardado.ubicacion).toEqual({ lat: -12.0701, lng: -77.0355 });
  });

  it('un Plus Code escrito en texto se guarda como ubicación; un código corto sin localidad se ignora', async () => {
    const texto = (body: string) => ({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL, profile: { name: 'Ana' } }], messages: [{ id: 'wamid.T1', from: TEL, type: 'text', text: { body } }] } }] }],
    });
    const cod = codificarPlusCode(-12.0701, -77.0355);
    await webhook.procesarPayload(texto(`Mi ubicación: ${cod.slice(4)} Lima`));
    const u = prisma.mensajeChat.create.mock.calls[0][0].data.contenido.ubicacion;
    expect(u.lat).toBeCloseTo(-12.0701, 3);
    expect(u.lng).toBeCloseTo(-77.0355, 3);
    expect(u.nombre).toBe(`Código Plus ${cod}`);
    prisma.mensajeChat.create.mockClear();
    await webhook.procesarPayload(texto(`Mi ubicación: ${cod.slice(4)}`));
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido).toEqual({ texto: `Mi ubicación: ${cod.slice(4)}` });
  });

  it('con coordenadas inválidas no agrega el objeto ubicación', async () => {
    await webhook.procesarPayload(payloadUbicacion({ latitude: 200, longitude: -77.03, address: 'Algún lugar' }));
    expect(contenidoGuardado).toEqual({ texto: 'Algún lugar' });
    expect(direcciones.inversa).not.toHaveBeenCalled();
  });

  it('sin coordenadas no agrega el objeto ubicación', async () => {
    await webhook.procesarPayload(payloadUbicacion({ name: 'Solo nombre' }));
    expect(contenidoGuardado).toEqual({ texto: 'Solo nombre' });
  });
});

describe('UbicacionWhatsappController.ubicacionReciente', () => {
  const ahora = Date.now();
  let mensajes: any[];
  let prisma: any;
  let ctrl: UbicacionWhatsappController;

  beforeEach(() => {
    mensajes = [];
    prisma = {
      conversacion: { findMany: jest.fn(async () => [{ id: 42n }]) },
      mensajeChat: {
        findMany: jest.fn(async ({ where, take }: any) =>
          mensajes.filter((m) => m.en >= where.en.gte).sort((a, b) => b.en.getTime() - a.en.getTime()).slice(0, take),
        ),
      },
    };
    ctrl = new UbicacionWhatsappController(prisma);
  });

  const ubic = (hace: number, lat = -12.05, lng = -77.04) => ({
    en: new Date(ahora - hace),
    contenido: { texto: 'x', ubicacion: { lat, lng, direccion: 'Av. Brasil', direccionAprox: 'Jesús María' } },
  });

  it('devuelve la ubicación más reciente de las últimas 24 horas', async () => {
    mensajes = [ubic(3 * 3600e3, -12.1, -77.1), ubic(1 * 3600e3, -12.2, -77.2)];
    const r = await ctrl.ubicacionReciente('987654321');
    expect(r).toEqual({ encontrada: true, lat: -12.2, lng: -77.2, direccion: 'Av. Brasil', direccionAprox: 'Jesús María', en: new Date(ahora - 3600e3) });
    expect(prisma.mensajeChat.findMany.mock.calls[0][0].where).toMatchObject({ direccion: 'ENTRA', autor: 'CLIENTE' });
  });

  it('ignora ubicaciones de más de 24 horas', async () => {
    mensajes = [ubic(25 * 3600e3)];
    expect(await ctrl.ubicacionReciente('987654321')).toMatchObject({ encontrada: false, lat: null, lng: null });
  });

  it('ignora mensajes sin ubicación válida', async () => {
    mensajes = [{ en: new Date(ahora), contenido: { texto: 'hola' } }, { en: new Date(ahora - 1000), contenido: { texto: 'x', ubicacion: { lat: 999, lng: 1 } } }];
    expect(await ctrl.ubicacionReciente('987654321')).toMatchObject({ encontrada: false });
  });

  it('sin conversaciones del celular responde no encontrada', async () => {
    prisma.conversacion.findMany.mockResolvedValue([]);
    expect(await ctrl.ubicacionReciente('987654321')).toMatchObject({ encontrada: false, direccion: null });
  });

  it('rechaza un celular que no tiene 9 dígitos empezando con 9', async () => {
    for (const malo of ['12345678', '887654321', '98765432a', '9876543210', '']) {
      await expect(ctrl.ubicacionReciente(malo)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.conversacion.findMany).not.toHaveBeenCalled();
  });
});
