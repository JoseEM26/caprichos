jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';
import {
  carruselEnviable,
  enviarCarruselConRespaldo,
  imagenProductoCarrusel,
  normalizarCarrusel,
  ordenarPorVentas,
  payloadInteractivoCarrusel,
  resumenCarrusel,
  urlPublicaFoto,
} from '../servicios/carrusel.util';
import { inicialesProducto, pngImagenInicial } from '../../catalogo/imagen-inicial';
import { CatalogoService } from '../../catalogo/catalogo.service';
import { urlPublicaCarta } from '../servicios/carrusel.util';
import { CartaController } from '../../catalogo/catalogo.controller';

const BASE = 'https://caprichos.pe/carta';
const tarj = (i: number, extra: any = {}) => ({
  nombre: `Prod ${i}`,
  imagenUrl: `https://caprichos.pe/archivos/${i}.jpg`,
  cuerpo: `Prod ${i}\nS/ 10.00`,
  boton: { id: `ped_prod_${i}`, titulo: 'Pedir este' },
  ...extra,
});
const carga = (n: number) => ({ cuerpo: 'Cuerpo', tarjetas: Array.from({ length: n }, (_, i) => tarj(i + 1)) });

describe('carrusel: payload y límites (doc de Meta)', () => {
  it('2 a 10 tarjetas con header imagen y botón quick_reply con el productoId', () => {
    const p: any = payloadInteractivoCarrusel(carga(3));
    expect(p.type).toBe('carousel');
    expect(p.action.cards).toHaveLength(3);
    expect(p.action.cards[1]).toMatchObject({
      card_index: 1,
      type: 'cta_url', // la doc de Meta usa «cta_url» también en tarjetas con quick_reply
      header: { type: 'image', image: { link: 'https://caprichos.pe/archivos/2.jpg' } },
      action: { buttons: [{ type: 'quick_reply', quick_reply: { id: 'ped_prod_2', title: 'Pedir este' } }] },
    });
  });
  it('recorta a 10 tarjetas y exige mínimo 2', () => {
    expect(normalizarCarrusel(carga(14)).tarjetas).toHaveLength(10);
    expect(() => normalizarCarrusel(carga(1))).toThrow();
  });
  it('límites: cuerpo 1024, tarjeta 160 con 2 saltos, botón 20, id 256', () => {
    const n = normalizarCarrusel({
      cuerpo: 'x'.repeat(2000),
      tarjetas: [tarj(1, { cuerpo: 'a\nb\nc\nd' + 'z'.repeat(300), boton: { id: 'i'.repeat(300), titulo: 't'.repeat(40) } }), tarj(2)],
    });
    expect(n.cuerpo).toHaveLength(1024);
    expect(n.tarjetas[0].cuerpo.length).toBeLessThanOrEqual(160);
    expect(n.tarjetas[0].cuerpo.split('\n').length).toBeLessThanOrEqual(3);
    expect(n.tarjetas[0].boton.titulo).toHaveLength(20);
    expect(n.tarjetas[0].boton.id).toHaveLength(256);
  });
  it('resumen legible y exige imágenes HTTPS', () => {
    expect(resumenCarrusel(carga(2))).toBe('Carrusel: Prod 1, Prod 2');
    expect(carruselEnviable(carga(2))).toBe(true);
    expect(carruselEnviable({ ...carga(2), tarjetas: [tarj(1, { imagenUrl: null }), tarj(2)] })).toBe(false);
  });
});

describe('fotos: URL pública e imagen de iniciales', () => {
  it('iniciales: palabras de más de 2 letras, máximo 2, mayúscula', () => {
    expect(inicialesProducto('frappe de oreo grande')).toBe('FO');
    expect(inicialesProducto('Té')).toBe('');
    expect(inicialesProducto('Dúo para compartir')).toBe('DP');
  });
  it('con foto usa la suya; sin foto usa el endpoint de iniciales; sin URL pública HTTPS, null', () => {
    expect(imagenProductoCarrusel(BASE, { id: '7', nombre: 'Frappe Oreo', fotoUrl: '/archivos/a.webp' })).toBe(
      'https://caprichos.pe/carta/productos/7/imagen-wa.jpg?v=%2Farchivos%2Fa.webp',
    );
    expect(imagenProductoCarrusel(BASE, { id: '7', nombre: 'Frappe Oreo' })).toBe('https://caprichos.pe/carta/productos/7/imagen-wa.jpg?v=FO');
    expect(imagenProductoCarrusel('http://localhost:5173', { id: '7', nombre: 'Frappe Oreo' })).toBeNull();
    expect(urlPublicaFoto('', '/archivos/a.jpg')).toBeNull();
  });
  it('el PNG se genera con sharp', async () => {
    const png = await pngImagenInicial('Frappe Oreo');
    expect([...png.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  });
  it('endpoint: devuelve PNG para un producto visible y 404 para oculto o id inválido', async () => {
    const svc: any = { nombreProductoVisible: jest.fn(async (id: string) => (id === '7' ? 'Frappe Oreo' : null)) };
    const ctrl = new CartaController(svc);
    expect(await ctrl.imagenInicial('7')).toBeDefined();
    await expect(ctrl.imagenInicial('8')).rejects.toThrow('no encontrado');
    await expect(ctrl.imagenInicial('abc')).rejects.toThrow();
    expect(Reflect.getMetadata('__httpCode__', ctrl.imagenInicial) ?? 200).toBe(200);
    expect(Reflect.getMetadata('__headers__', CartaController.prototype.imagenInicial)).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Content-Type', value: 'image/png' })]),
    );
  });
});

describe('imagen-wa.jpg y URL pública', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
  const sharp = require('sharp');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
  const path = require('path');
  it('devuelve JPEG 5:3 (1200x720) desde webp, desde iniciales y 404 si está oculto', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'));
    fs.mkdirSync(path.join(dir, 'publico'));
    await sharp({ create: { width: 300, height: 200, channels: 3, background: '#f00' } }).webp().toFile(path.join(dir, 'publico/a.webp'));
    const svc: any = {
      fotoProductoVisible: jest.fn(async (id: string) =>
        id === '1' ? { nombre: 'Frappe Oreo', ruta: 'publico/a.webp' } : id === '2' ? { nombre: 'Frappe Oreo', ruta: null } : null,
      ),
    };
    const ctrl = new CartaController(svc, { get: () => dir } as any);
    for (const id of ['1', '2']) {
      const buf = Buffer.from(await (await ctrl.imagenWhatsApp(id)).getStream().toArray().then((c: any[]) => Buffer.concat(c)));
      const m = await sharp(buf).metadata();
      expect([m.format, m.width, m.height]).toEqual(['jpeg', 1200, 720]);
      const h = (await ctrl.imagenWhatsApp(id)).getHeaders();
      expect(h).toMatchObject({ type: 'image/jpeg', length: buf.length });
    }
    await expect(ctrl.imagenWhatsApp('3')).rejects.toThrow('no encontrado');
    expect(Reflect.getMetadata('__headers__', CartaController.prototype.imagenWhatsApp)).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Content-Type', value: 'image/jpeg' })]),
    );
  });
  it('sin CARTA_URL_PUBLICA usa https://DOMINIO_BASE', () => {
    const env = (o: any) => (k: string) => o[k];
    expect(urlPublicaCarta(env({ CARTA_URL_PUBLICA: ' https://a.pe ', DOMINIO_BASE: 'b.pe' }))).toBe('https://a.pe');
    expect(urlPublicaCarta(env({ CARTA_URL_PUBLICA: '', DOMINIO_BASE: 'b.pe' }))).toBe('https://b.pe');
    expect(urlPublicaCarta(env({}))).toBe('');
  });
});

describe('ranking por ventas', () => {
  const prisma: any = { pedidoLinea: { groupBy: jest.fn(async () => [{ producto_id: 2n, _sum: { cantidad: 9 } }, { producto_id: 3n, _sum: { cantidad: 4 } }]) } };
  const svc = new CatalogoService(prisma, {} as any);
  it('suma ventas reales de los últimos 90 días sin rechazados ni anulados, con caché de 15 min', async () => {
    const t0 = 1_800_000_000_000;
    expect(await svc.ventasPorProducto(t0)).toEqual({ '2': 9, '3': 4 });
    const w = prisma.pedidoLinea.groupBy.mock.calls[0][0].where;
    expect(w.pedido.estado).toEqual({ notIn: ['RECHAZADO', 'ANULADO'] });
    expect(w.pedido.creado_en.gte.getTime()).toBe(t0 - 90 * 86_400_000);
    await svc.ventasPorProducto(t0 + 14 * 60_000);
    expect(prisma.pedidoLinea.groupBy).toHaveBeenCalledTimes(1);
    await svc.ventasPorProducto(t0 + 16 * 60_000);
    expect(prisma.pedidoLinea.groupBy).toHaveBeenCalledTimes(2);
  });
  it('ordena por ventas y los sin ventas quedan al final en orden de carta', () => {
    const ps = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(ordenarPorVentas(ps, { '3': 9, '2': 4 }).map((p) => p.id)).toEqual([3, 2, 1, 4]);
  });
});

describe('respaldo a lista y outbox', () => {
  const respaldo = { texto: 'Elige', botonTexto: 'Ver productos', filas: [{ id: 'ped_prod_1', titulo: 'Prod 1' }] };
  it('si Meta rechaza el carrusel, reenvía como lista', async () => {
    const m: any = {
      enviarCarrusel: jest.fn(async () => ({ exito: false, estado: 'FALLIDO', errorCodigo: 'ERROR_META' })),
      enviarLista: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
      enviarBotones: jest.fn(),
    };
    const r = await enviarCarruselConRespaldo(m, '51999', { ...carga(2), respaldo });
    expect(m.enviarLista).toHaveBeenCalledWith('51999', 'Elige', 'Ver productos', respaldo.filas, expect.anything());
    expect(r).toMatchObject({ exito: true, respaldo: true, motivoRespaldo: 'ERROR_META' });
  });
  it('si sale como carrusel no hay respaldo', async () => {
    const m: any = { enviarCarrusel: jest.fn(async () => ({ exito: true, estado: 'SIMULADO' })), enviarLista: jest.fn() };
    expect((await enviarCarruselConRespaldo(m, '51999', { ...carga(2), respaldo })).respaldo).toBeUndefined();
    expect(m.enviarLista).not.toHaveBeenCalled();
  });
  it('outbox: encola el carrusel, lo envía y registra «Carrusel: …» en el chat; con rechazo cae a lista', async () => {
    let lote: any[] = [];
    const prisma: any = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      $queryRaw: jest.fn(async () => { const f = lote; lote = []; prisma._l = f; return f.map((x) => ({ id: x.id })); }),
      salienteWhatsapp: { createMany: jest.fn(async () => ({ count: 1 })), updateMany: jest.fn(async () => ({ count: 1 })), findMany: jest.fn(async () => prisma._l), findFirst: jest.fn(async () => null) },
      parametro: { findUnique: jest.fn(async () => ({ valor: 5 })) },
      conversacion: { upsert: jest.fn(async () => ({ id: 5n })) },
      mensajeChat: { create: jest.fn(async () => ({})) },
      mensajeReparto: { updateMany: jest.fn() },
      notificacion: { create: jest.fn(async () => ({ id: 3n })) },
    };
    const ventana: any = { tieneConsentimiento: async () => true, esVentanaAbierta: async () => true, enviarMensajeNegocio: jest.fn() };
    const m: any = {
      enviarCarrusel: jest.fn(async () => ({ exito: false, estado: 'FALLIDO', errorCodigo: 'ERROR_META' })),
      enviarLista: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    };
    const svc = new OutboxWhatsappService(prisma, ventana, m);
    const interactivo = { cuerpo: 'Cuerpo', carrusel: { ...carga(2), respaldo } };
    await svc.encolar({ telefono: '51999', tipo: 'INTERACTIVO', clave: 'c1', origen: 'X', carga: { interactivo } as any });
    const cargaGuardada = prisma.salienteWhatsapp.createMany.mock.calls[0][0].data[0].carga;
    lote = [{ id: 1n, secuencia: 1n, telefono_destino: '51999', tipo: 'INTERACTIVO', carga: cargaGuardada, intentos: 0, max_intentos: 5, pedido_id: null, origen: 'X' }];
    await svc.procesarLote();
    expect(m.enviarLista).toHaveBeenCalled();
    ventana.esVentanaAbierta = async () => true;
    m.enviarCarrusel.mockResolvedValueOnce({ exito: true, estado: 'SIMULADO' });
    lote = [{ id: 2n, secuencia: 2n, telefono_destino: '51999', tipo: 'INTERACTIVO', carga: cargaGuardada, intentos: 0, max_intentos: 5, pedido_id: null, origen: 'X' }];
    await svc.procesarLote();
    const chat = prisma.mensajeChat.create.mock.calls.at(-1)[0].data;
    expect(chat.contenido.texto).toBe('Carrusel: Prod 1, Prod 2');
    expect(chat.tipo).toBe('BOTON');
  });
});

describe('fallo asíncrono de Meta (statuses[].failed)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
  const { WhatsappWebhookService } = require('../servicios/whatsapp-webhook.service');
  const montar = (contenido: any, previo: any = { id: 7n, estado: 'ENVIADO', direccion: 'SALIENTE', conversacion_id: 5n }) => {
    const prisma: any = {
      whatsappMensaje: { findFirst: jest.fn(async () => previo), updateMany: jest.fn(async () => ({ count: 1 })) },
      mensajeChat: { findFirst: jest.fn(async () => ({ contenido })), create: jest.fn(async () => ({})) },
      conversacion: { findUnique: jest.fn(async () => ({ telefono: '51999111222' })) },
    };
    const mensajeria: any = {
      enviarLista: jest.fn(async () => ({ exito: true, waMessageId: 'wamid.L' })),
      enviarBotones: jest.fn(async () => ({ exito: true, waMessageId: 'wamid.B' })),
    };
    const svc: any = new WhatsappWebhookService({ get: () => '' } as any, prisma, mensajeria, {} as any);
    return { svc, prisma, mensajeria };
  };
  const failed = { id: 'wamid.X', status: 'failed', errors: [{ code: 131053, title: 'Media upload error', message: 'No se pudo bajar', error_data: { details: 'Unsupported image' } }] };

  it('guarda código y detalle de Meta, avisa en el chat y reenvía la lista del carrusel una sola vez', async () => {
    const respaldo = { texto: 'Estos son', botonTexto: 'Ver productos', filas: [{ id: 'ped_prod_1', titulo: 'A' }] };
    const { svc, prisma, mensajeria } = montar({ carrusel: true, respaldo });
    await svc.procesarEstado(failed);
    expect(prisma.whatsappMensaje.updateMany.mock.calls[0][0].data).toMatchObject({
      estado: 'FALLIDO',
      error_codigo: '131053',
      error_detalle: 'Media upload error | No se pudo bajar | Unsupported image',
    });
    expect(mensajeria.enviarLista).toHaveBeenCalledTimes(1);
    expect(prisma.mensajeChat.create.mock.calls[0][0].data).toMatchObject({ tipo: 'SISTEMA' });
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido.texto).toContain('El carrusel no se entregó (131053');
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido.texto).toContain('se envió la lista');
  });
  it('si ya estaba FALLIDO no reenvía; un saliente que no es carrusel solo registra el motivo', async () => {
    const a = montar({ carrusel: true, respaldo: { texto: 't', filas: [{ id: 'x', titulo: 'x' }] } }, { id: 7n, estado: 'FALLIDO', direccion: 'SALIENTE', conversacion_id: 5n });
    await a.svc.procesarEstado(failed);
    expect(a.mensajeria.enviarLista).not.toHaveBeenCalled();
    const b = montar({ texto: 'hola' });
    await b.svc.procesarEstado(failed);
    expect(b.mensajeria.enviarLista).not.toHaveBeenCalled();
    expect(b.prisma.mensajeChat.create.mock.calls[0][0].data.contenido.texto).toContain('El mensaje no se entregó (131053');
  });
});

describe('carrusel: simulado no sube nada y resumen informa la vía', () => {
  it('simulado no llama a fetch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
    const { WhatsAppSimuladoAdaptador } = require('../adaptadores/whatsapp-simulado.adaptador');
    const f = jest.fn();
    const orig = global.fetch;
    global.fetch = f as any;
    const a = new WhatsAppSimuladoAdaptador({ whatsappMensaje: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) } } as any);
    await a.enviarCarrusel('51987654321', carga(2));
    global.fetch = orig;
    expect(f).not.toHaveBeenCalled();
  });
  it('resumen indica tarjetas por id y por link', () => {
    const c: any = carga(2);
    c.tarjetas[0].via = 'id';
    c.tarjetas[1].via = 'link';
    expect(resumenCarrusel(c)).toContain('[imagen: 1 por id, 1 por link]');
  });
});

describe('botón común en todas las tarjetas', () => {
  it('cada tarjeta lleva «Pedir este» y el segundo botón igual (mismos tipos y cantidad)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro del describe/it, local a esa prueba
    const { payloadInteractivoCarrusel: armar } = require('../servicios/carrusel.util');
    const t = (id: string) => ({ nombre: id, imagenUrl: 'https://x.pe/a.jpg', cuerpo: id, boton: { id: `ped_prod_${id}`, titulo: 'Pedir este' } });
    const p = armar({ cuerpo: 'Hola', tarjetas: [t('1'), t('2')], botonComun: { id: 'btn_categorias', titulo: 'Otra categoría' } });
    for (const card of p.action.cards) {
      expect(card.action.buttons.map((b: any) => b.quick_reply.id)).toEqual([expect.stringMatching(/^ped_prod_/), 'btn_categorias']);
    }
    const sin = armar({ cuerpo: 'Hola', tarjetas: [t('1'), t('2')] });
    expect(sin.action.cards[0].action.buttons).toHaveLength(1);
  });
});
