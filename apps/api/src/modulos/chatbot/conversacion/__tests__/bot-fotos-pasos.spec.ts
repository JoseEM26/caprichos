import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

/** Fotos a pedido en el pedido guiado: tamaño, sabor y producto (nunca por defecto). */
describe('Bot: fotos a pedido en tamaño, sabor y producto', () => {
  const tam = (id: string, nombre: string, fotoUrl?: string) => ({ id, nombre, precio: 10, ...(fotoUrl ? { fotoUrl } : {}) });
  const sab = (id: string, nombre: string, fotoUrl?: string) => ({ id, nombre, disponible: true, ...(fotoUrl ? { fotoUrl } : {}) });
  const frappe = (extra: any = {}) => ({
    id: 'p_frappe',
    nombre: 'Frappe Oreo',
    precio: 10,
    disponible: true,
    fotoUrl: '/archivos/frappe.jpg',
    mostrarImagenesTamanos: true,
    mostrarImagenesSabores: true,
    tamanos: [tam('t1', 'Chico', '/archivos/chico.jpg'), tam('t2', 'Mediano', '/archivos/mediano.jpg'), tam('t3', 'Grande', '/archivos/grande.jpg')],
    sabores: [],
    grupos: [],
    ...extra,
  });
  const ctx = (prod: any): ContextoConversacion => ({
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: 'https://m', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0 },
    datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: { efectivo: { activo: true } } },
    categoriasCarta: [{ id: 'cat1', nombre: 'Bebidas', productos: [prod, { id: 'p_otro', nombre: 'Te Helado', precio: 8, disponible: true, tamanos: [], sabores: [], grupos: [] }] }],
    ofertas: [],
    productosComboNoBot: [],
  });

  type R = ReturnType<typeof transicionarEstado>;
  const paso = (r: R, c: ContextoConversacion, e: Parameters<typeof normalizarEntrada>[0]): R => transicionarEstado(r.nuevoFlujo as FlujoConversacion, normalizarEntrada(e), c);
  const texto = (r: R, c: ContextoConversacion, t: string) => paso(r, c, { texto: t, textoOriginal: t });
  const imgs = (r: R) => r.acciones.filter((a: any) => a.tipo === 'enviarImagen') as any[];
  const textos = (r: R) => r.acciones.map((a: any) => a.texto).join('\n');
  const enProductos = (c: ContextoConversacion): R => {
    let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), c);
    r = paso(r, c, { buttonPayload: 'ped_mod_recojer' });
    return paso(r, c, { listRowId: 'ped_cat_cat1' });
  };
  const enTamano = (c: ContextoConversacion): R => paso(enProductos(c), c, { listRowId: 'ped_prod_p_frappe' });

  it('TAMANO: «cómo es el grande» manda la foto del tamaño y repite la pregunta', () => {
    const c = ctx(frappe());
    const r = texto(enTamano(c), c, '¿cómo es el grande?');
    expect(imgs(r).map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/grande.jpg']);
    expect(r.nuevoEstado).toBe('PEDIDO_TAMANO');
  });

  it('TAMANO: «muéstrame los tamaños» manda una por tamaño, sin repetir URL', () => {
    const c = ctx(frappe({ tamanos: [tam('t1', 'Chico', '/archivos/a.jpg'), tam('t2', 'Mediano', '/archivos/a.jpg'), tam('t3', 'Grande')] }));
    const r = texto(enTamano(c), c, 'muéstrame los tamaños');
    expect(imgs(r).map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/a.jpg', 'https://carta.caprichos.pe/archivos/frappe.jpg']);
  });

  it('TAMANO: con el interruptor apagado usa la foto del producto', () => {
    const c = ctx(frappe({ mostrarImagenesTamanos: false }));
    const r = texto(enTamano(c), c, 'foto del mediano');
    expect(imgs(r).map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/frappe.jpg']);
  });

  it('TAMANO: sin foto avisa y repite la pregunta', () => {
    const c = ctx(frappe({ fotoUrl: undefined, tamanos: [tam('t1', 'Chico'), tam('t2', 'Grande')] }));
    const r = texto(enTamano(c), c, 'foto');
    expect(imgs(r)).toHaveLength(0);
    expect(textos(r)).toContain('No tengo foto de eso por aquí');
    expect(r.nuevoEstado).toBe('PEDIDO_TAMANO');
  });

  it('TAMANO: elegir por nombre no manda foto', () => {
    const c = ctx(frappe());
    const r = texto(enTamano(c), c, 'grande');
    expect(imgs(r)).toHaveLength(0);
    expect(r.nuevoEstado).not.toBe('PEDIDO_TAMANO');
  });

  const enSabor = (c: ContextoConversacion): R => {
    const r = paso(enProductos(c), c, { listRowId: 'ped_prod_p_frappe' });
    return r.nuevoEstado === 'PEDIDO_CANTIDAD' ? paso(r, c, { buttonPayload: 'ped_cant_1' }) : r;
  };

  it('SABOR: «cómo es la de fresa» manda la foto del sabor; elegir por nombre no manda foto', () => {
    const c = ctx(frappe({ tamanos: [], sabores: [sab('s1', 'Fresa', '/archivos/fresa.jpg'), sab('s2', 'Limon')], saboresConStock: true }));
    const r = enSabor(c);
    expect(r.nuevoEstado).toBe('PEDIDO_SABOR');
    const f = texto(r, c, '¿cómo es la de fresa?');
    expect(imgs(f).map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/fresa.jpg']);
    expect(f.nuevoEstado).toBe('PEDIDO_SABOR');
    // Sin foto propia usa la del producto
    expect(imgs(texto(r, c, 'foto del limon')).map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/frappe.jpg']);
    // Elegir por nombre no es pedir foto
    expect(imgs(texto(r, c, 'Fresa'))).toHaveLength(0);
  });

  it('SABOR: máximo 6 fotos', () => {
    const sabores = Array.from({ length: 9 }, (_, i) => sab(`s${i}`, `Sabor ${i}`, `/archivos/s${i}.jpg`));
    const c = ctx(frappe({ tamanos: [], sabores, saboresConStock: true }));
    const f = texto(enSabor(c), c, 'fotos de los sabores');
    expect(imgs(f)).toHaveLength(6);
  });

  it('PRODUCTO: «foto del frappe oreo» manda la foto del producto de la carta', () => {
    const c = ctx(frappe());
    const r = texto(enProductos(c), c, 'foto del frappe oreo');
    expect(imgs(r).map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/frappe.jpg']);
    expect(r.nuevoEstado).toBe('PEDIDO_PRODUCTOS');
  });

  it('PRODUCTO: sin foto avisa; un producto que no existe no inventa nada', () => {
    const c = ctx(frappe({ fotoUrl: undefined }));
    const r = texto(enProductos(c), c, 'foto del frappe oreo');
    expect(imgs(r)).toHaveLength(0);
    expect(textos(r)).toContain('No tengo foto de eso por aquí');
    const c2 = ctx(frappe());
    const s = texto(enProductos(c2), c2, 'foto de la torta de lucuma');
    expect(imgs(s)).toHaveLength(0);
    expect(textos(s)).toContain('No tengo foto de eso por aquí');
  });
});
