jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { transicionarEstado } from '../conversacion/maquina-estados';
import { normalizarEntrada } from '../conversacion/normalizador-entrada.util';
import { ContextoConversacion } from '../conversacion/tipos-conversacion';
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
  const sharp = require('sharp');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  it('devuelve JPEG cuadrado desde webp, desde iniciales y 404 si está oculto', async () => {
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
      expect([m.format, m.width, m.height]).toEqual(['jpeg', 800, 800]);
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

describe('flujo del bot: carrusel de productos y promociones', () => {
  const productos = (n: number, extra: any = {}) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i + 1), nombre: `Frappe ${i + 1}`, precio: 10, disponible: true, fotoUrl: null, tamanos: [], ...extra }));
  const ctx = (cats: any[], extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
    cartaUrlPublica: BASE,
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: '', telefono: '1' } as any,
    categoriasCarta: cats,
    ofertas: [],
    ...extra,
  });
  const aCategorias = (c: ContextoConversacion) => {
    let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), c);
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), c);
    return r;
  };
  const elegir = (c: ContextoConversacion, id = 'ped_cat_c1') => {
    const r = aCategorias(c);
    return transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: id }), c);
  };

  it('primer envío = solo los 10 más vendidos + botones «Ver más» / «Ver lista completa»', () => {
    const ventas: Record<string, number> = { '25': 100, '24': 90 };
    const r = elegir(ctx([{ id: 'c1', nombre: 'Frappes', productos: productos(25) }], { ventasProductos: ventas }));
    const [a, b, ...resto] = r.acciones as any[];
    expect(resto).toHaveLength(0);
    expect(a.tipo).toBe('enviarCarrusel');
    expect(a.carga.cuerpo).toContain('favoritos');
    expect(a.carga.cuerpo).toContain('de 25');
    expect(a.carga.tarjetas.map((t: any) => t.boton.id).slice(0, 3)).toEqual(['ped_prod_25', 'ped_prod_24', 'ped_prod_1']);
    expect(a.carga.tarjetas).toHaveLength(10);
    expect(a.carga.respaldo.filas.length).toBeGreaterThan(0);
    expect(b.tipo).toBe('enviarBotones');
    expect(b.botones.map((x: any) => x.id)).toEqual(['ped_prod_mas_2', 'ped_prod_lista', 'btn_categorias']);
    expect(a.carga.tarjetas[0].imagenUrl).toBe('https://caprichos.pe/carta/productos/25/imagen-wa.jpg?v=F');
  });
  it('«Ver más» trae la siguiente página de 10, luego la última; con 1 sobrante va como lista', () => {
    const c = ctx([{ id: 'c1', nombre: 'Frappes', productos: productos(25) }]);
    const r = elegir(c);
    const p2 = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_prod_mas_2' }), c);
    const [a2, b2] = p2.acciones as any[];
    expect(a2.tipo).toBe('enviarCarrusel');
    expect(a2.carga.cuerpo).toContain('Más opciones');
    expect(a2.carga.tarjetas.map((t: any) => t.boton.id)[0]).toBe('ped_prod_11');
    expect(b2.botones[0].id).toBe('ped_prod_mas_3');
    const p3 = transicionarEstado(p2.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_prod_mas_3' }), c);
    expect(p3.acciones.map((x: any) => x.tipo)).toEqual(['enviarCarrusel']);
    expect((p3.acciones[0] as any).carga.tarjetas).toHaveLength(5);
    const c11 = ctx([{ id: 'c1', nombre: 'Frappes', productos: productos(11) }]);
    const q = transicionarEstado(elegir(c11).nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_prod_mas_2' }), c11);
    expect(q.acciones.map((x: any) => x.tipo)).toEqual(['enviarLista']);
    expect((q.acciones[0] as any).filas[0].id).toBe('ped_prod_11');
  });
  it('hasta 10 productos: solo el carrusel, sin botones de «Ver más»', () => {
    const r = elegir(ctx([{ id: 'c1', nombre: 'Frappes', productos: productos(10) }]));
    expect(r.acciones.map((x: any) => x.tipo)).toEqual(['enviarCarrusel']);
  });
  it('«Desde S/ X» si tiene tamaños', () => {
    const ps = productos(2, { tamanos: [{ nombre: 'M', precio: 12 }, { nombre: 'G', precio: 15 }] });
    const r = elegir(ctx([{ id: 'c1', nombre: 'Frappes', productos: ps }]));
    expect((r.acciones[0] as any).carga.tarjetas[0].cuerpo).toContain('Desde S/ 12.00');
  });
  it('categoría con 1 solo producto: lista directa, sin carrusel', () => {
    const r = elegir(ctx([{ id: 'c1', nombre: 'Frappes', productos: productos(1) }]));
    expect(r.acciones.map((a: any) => a.tipo)).toEqual(['enviarLista']);
  });
  it('ignora agotados al armar el carrusel', () => {
    const ps = productos(3);
    ps[0].disponible = false;
    const r = elegir(ctx([{ id: 'c1', nombre: 'Frappes', productos: ps }]));
    expect((r.acciones[0] as any).carga.tarjetas).toHaveLength(2);
  });
  it('«Ver lista completa» muestra la lista; «Pedir este» entra a la configuración del producto', () => {
    const c = ctx([{ id: 'c1', nombre: 'Frappes', productos: productos(25) }]);
    const r = elegir(c);
    const lista = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_prod_lista' }), c);
    expect(lista.acciones[0].tipo).toBe('enviarLista');
    const pedir = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_prod_3' }), c);
    expect(pedir.nuevoFlujo?.pedido?.itemEnConfiguracion?.productoId).toBe('3');
  });
  it('promociones: carrusel con 2 o más vigentes de producto, ordenadas por ventas; con 1, botones como hoy', () => {
    const cats = [{ id: 'c1', nombre: 'Frappes', productos: productos(3) }];
    const of = (id: string, p: string) => ({ nombre: `Promo ${id}`, vigenteAhora: true, alcanceProductoId: p, imagenUrl: null });
    const c = ctx(cats, { ofertas: [of('a', '1'), of('b', '2')], ventasProductos: { '2': 5 } });
    const r = transicionarEstado(null, normalizarEntrada({ listRowId: 'menu_promos' }), c);
    const acc = r.acciones as any[];
    if (acc[0].tipo === 'enviarCarrusel') {
      expect(acc[0].carga.tarjetas.map((t: any) => t.boton.id)).toEqual(['ped_prod_2', 'ped_prod_1']);
      expect(acc[1].soloSiCarruselSalio).toBe(true);
    } else {
      throw new Error('se esperaba carrusel; id del menú de promos distinto: ' + JSON.stringify(acc[0]));
    }
    const uno = transicionarEstado(null, normalizarEntrada({ listRowId: 'menu_promos' }), ctx(cats, { ofertas: [of('a', '1')] }));
    expect(uno.acciones[0].tipo).toBe('enviarBotones');
  });
});

describe('promociones con más de 10: «Ver más»', () => {
  const cats = (n: number) => [{ id: 'c1', nombre: 'Frappes', productos: Array.from({ length: n }, (_, i) => ({ id: String(i + 1), nombre: `Frappe ${i + 1}`, precio: 10, disponible: true, tamanos: [] })) }];
  const ctxP = (n: number): ContextoConversacion => ({
    cartaUrlPublica: BASE,
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: '', telefono: '1' } as any,
    categoriasCarta: cats(n),
    ofertas: Array.from({ length: n }, (_, i) => ({ nombre: `Promo ${i + 1}`, vigenteAhora: true, alcanceProductoId: String(i + 1), imagenUrl: null })),
  } as any);
  it('11 promos: carrusel de 10 + botones «Ver más»; la página 2 con 1 va como lista', () => {
    const c = ctxP(11);
    const r = transicionarEstado(null, normalizarEntrada({ listRowId: 'menu_promos' }), c);
    const [a, b] = r.acciones as any[];
    expect(a.tipo).toBe('enviarCarrusel');
    expect(a.carga.tarjetas).toHaveLength(10);
    expect(b.tipo).toBe('enviarBotones');
    expect(b.botones.map((x: any) => x.id)).toEqual(['promo_mas_2', 'btn_carta', 'btn_menu']);
    const p2 = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'promo_mas_2' }), c);
    expect(p2.acciones.map((x: any) => x.tipo)).toEqual(['enviarLista', 'enviarBotones']);
    expect((p2.acciones[0] as any).filas[0].id).toBe('ped_prod_11');
  });
  it('25 promos: la página 2 es otro carrusel de 10 con su «Ver más»', () => {
    const c = ctxP(25);
    const p2 = transicionarEstado(null, normalizarEntrada({ buttonPayload: 'promo_mas_2' }), c);
    const [a, b] = p2.acciones as any[];
    expect(a.carga.tarjetas).toHaveLength(10);
    expect(b.botones[0].id).toBe('promo_mas_3');
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
