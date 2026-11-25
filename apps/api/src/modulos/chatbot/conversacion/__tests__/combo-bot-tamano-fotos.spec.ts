import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { armarPasosCombo, pideFoto } from '../flujos/pedido/combo-bot';

/** Combo por tamaño en el bot: cantidad del tamaño elegido y fotos SOLO si el cliente las pide. */
describe('Bot: combo por tamaño y fotos a pedido', () => {
  const jug = (id: string, nombre: string, fotoUrl?: string) => ({ id, nombre, disponible: true, ...(fotoUrl ? { fotoUrl } : {}) });
  const cajita = {
    id: 'prod_cajita',
    nombre: 'Cajita Caprikids',
    precio: 27,
    disponible: true,
    tamanos: [
      { id: 'tam_per', nombre: 'Personal', precio: 27, tamanoValorId: '7' },
      { id: 'tam_fam', nombre: 'Familiar', precio: 50, tamanoValorId: '8' },
    ],
    grupos: [],
  };
  const combo = (opciones: any[]) => ({
    id: 'of_cajita',
    tipo: 'COMBO',
    nombre: 'Cajita Caprikids',
    activo: true,
    vigenteAhora: true,
    disponible: true,
    canales: ['CARTA', 'ADMIN', 'BOT'],
    alcanceProductoId: 'prod_cajita',
    combosPrecio: [],
    combosParte: [{ id: 'parte_jug', tipo: 'A_ELECCION', cantidad: 2, cantidadPorTamano: { '8': 4 }, categorias: [], productos: opciones.map((o) => o.id), alternativas: [], opcionesDetalle: opciones }],
  });
  const conFotos = [jug('j1', 'Sirena', '/archivos/sirena.jpg'), jug('j2', 'Burbujas', '/archivos/burbujas.jpg'), jug('j3', 'Pelota')];

  const ctx = (opciones: any[]): ContextoConversacion => ({
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: 'https://m', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0 },
    datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: { efectivo: { activo: true } } },
    categoriasCarta: [{ id: 'cat_combos', nombre: 'Combos', productos: [cajita] }],
    ofertas: [combo(opciones)],
    productosComboNoBot: [],
  });

  type R = ReturnType<typeof transicionarEstado>;
  const paso = (r: R, c: ContextoConversacion, e: Parameters<typeof normalizarEntrada>[0]): R => transicionarEstado(r.nuevoFlujo as FlujoConversacion, normalizarEntrada(e), c);
  const boton = (r: R, c: ContextoConversacion, id: string) => paso(r, c, { buttonPayload: id });
  const textos = (r: R) => r.acciones.map((a: any) => a.texto).join('\n');
  const enPartes = (c: ContextoConversacion, tam: string): R => {
    let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), c);
    r = boton(r, c, 'ped_mod_recojer');
    r = paso(r, c, { listRowId: 'ped_cat_cat_combos' });
    r = paso(r, c, { listRowId: 'ped_prod_prod_cajita' });
    r = boton(r, c, `ped_tam_${tam}`);
    return boton(r, c, 'ped_cant_1');
  };

  it('Personal pide 2 y Familiar pide 4 (la cantidad del tamaño)', () => {
    const c = ctx(conFotos);
    expect(textos(enPartes(c, 'tam_per'))).toContain('Elige tu opción 1 de 2');
    let r = enPartes(c, 'tam_fam');
    expect(textos(r)).toContain('Elige tu opción 1 de 4');
    for (let i = 0; i < 3; i++) r = boton(r, c, 'ped_cb_j1');
    expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
    r = boton(r, c, 'ped_cb_j2');
    expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
  });

  it('una parte con cantidad 0 en el tamaño no se pide (va solo en el otro tamaño)', () => {
    const oferta = combo(conFotos);
    oferta.combosParte.push({ ...oferta.combosParte[0], id: 'parte_extra', cantidad: 1, cantidadPorTamano: { '7': 0 } } as any);
    const pasosDe = (tam: string) => {
      const cb: any = {};
      armarPasosCombo(cb, oferta, 1, [], tam);
      return cb.pasos.map((x: any) => `${x.parteId}:${x.total}`);
    };
    expect(pasosDe('7')).toEqual(['parte_jug:2']);
    expect(pasosDe('8')).toEqual(['parte_jug:4', 'parte_extra:1']);
  });

  it('sin pedirla no manda ninguna foto', () => {
    const c = ctx(conFotos);
    let r = enPartes(c, 'tam_per');
    expect(r.acciones.some((a: any) => a.tipo === 'enviarImagen')).toBe(false);
    r = boton(r, c, 'ped_cb_j1');
    expect(r.acciones.some((a: any) => a.tipo === 'enviarImagen')).toBe(false);
  });

  it('«¿cómo son?» manda las fotos de los que tienen foto y repite la pregunta sin cambiar la elección', () => {
    const c = ctx(conFotos);
    const r = paso(enPartes(c, 'tam_per'), c, { texto: '¿cómo son?', textoOriginal: '¿cómo son?' });
    const imgs = r.acciones.filter((a: any) => a.tipo === 'enviarImagen') as any[];
    expect(imgs.map((i) => i.url)).toEqual(['https://carta.caprichos.pe/archivos/sirena.jpg', 'https://carta.caprichos.pe/archivos/burbujas.jpg']);
    expect(imgs.map((i) => i.caption)).toEqual(['Sirena', 'Burbujas']);
    expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
    expect(textos(r)).toContain('Elige tu opción 1 de 2');
  });

  it('pedir la foto de uno manda solo esa; sin fotos avisa y sigue', () => {
    const c = ctx(conFotos);
    const r = paso(enPartes(c, 'tam_per'), c, { texto: 'muéstrame la sirena', textoOriginal: 'muéstrame la sirena' });
    expect(r.acciones.filter((a: any) => a.tipo === 'enviarImagen')).toHaveLength(1);
    const c2 = ctx([jug('j1', 'Sirena'), jug('j2', 'Burbujas')]);
    const s = paso(enPartes(c2, 'tam_per'), c2, { texto: 'foto', textoOriginal: 'foto' });
    expect(s.acciones.some((a: any) => a.tipo === 'enviarImagen')).toBe(false);
    expect(textos(s)).toContain('no tengo fotos');
    expect(textos(s)).toContain('Elige tu opción 1 de 2');
  });

  it('manda como máximo 6 fotos', () => {
    const muchas = Array.from({ length: 9 }, (_, i) => jug(`m${i}`, `Juguete ${i}`, `/archivos/m${i}.jpg`));
    const c = ctx(muchas);
    const r = paso(enPartes(c, 'tam_per'), c, { texto: 'foto', textoOriginal: 'foto' });
    expect(r.acciones.filter((a: any) => a.tipo === 'enviarImagen')).toHaveLength(6);
  });

  it('elegir por nombre no se confunde con pedir una foto', () => {
    const c = ctx(conFotos);
    const r = paso(enPartes(c, 'tam_per'), c, { texto: 'Pelota', textoOriginal: 'Pelota' });
    expect(r.acciones.some((a: any) => a.tipo === 'enviarImagen')).toBe(false);
    expect(textos(r)).toContain('Elige tu opción 2 de 2');
  });

  it('pideFoto reconoce las frases del cliente', () => {
    for (const t of ['foto', 'me mandas una imagen', '¿Cómo es?', 'cómo se ve', 'cómo son', 'muéstrame', 'fotos?']) expect(pideFoto(t)).toBe(true);
    for (const t of ['Sirena', 'atrás', 'quiero el de burbujas', '2']) expect(pideFoto(t)).toBe(false);
  });
});
