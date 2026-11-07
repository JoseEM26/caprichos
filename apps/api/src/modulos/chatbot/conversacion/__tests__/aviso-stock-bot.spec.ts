import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion } from '../tipos-conversacion';
import { lineaAvisoStock, lineasAvisoResumen } from '../flujos/pedido/aviso-stock-bot.util';
import { TEXTOS_BOT } from '../textos-bot';
import { TEXTOS_BOT_DEFECTO } from '../../configuracion/chatbot-configuracion.tipos';

const dona = (quedan: number | null, extra: any = {}) => ({ id: 'p1', nombre: 'Donas', precio: 3, disponible: true, quedan, ...extra });
const ctx = (productos: any[], extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
  nombreCliente: 'Ana',
  telefonoCliente: '987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: 'x', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0 },
  datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: {} },
  categoriasCarta: [{ id: 'c1', nombre: 'Donas', productos }],
  ofertas: [],
  ...extra,
});

describe('Bot: aviso de «se está acabando»', () => {
  it('línea de aviso según lo que queda (umbrales por defecto 5 y 3)', () => {
    const c = ctx([]);
    expect(lineaAvisoStock(dona(1), c)).toBe('🍩 ¡Última dona!');
    expect(lineaAvisoStock(dona(2), c)).toBe('🍩 ¡Últimas 2!');
    expect(lineaAvisoStock(dona(3), c)).toBe('🍩 ¡Quedan solo 3, ya se acaban!');
    expect(lineaAvisoStock(dona(5), c)).toBe('🍩 Quedan 5');
  });

  it('sin aviso fuera de rango, agotado o sin control de stock', () => {
    const c = ctx([]);
    expect(lineaAvisoStock(dona(6), c)).toBeNull();
    expect(lineaAvisoStock(dona(0), c)).toBeNull();
    expect(lineaAvisoStock(dona(null), c)).toBeNull();
    expect(lineaAvisoStock({ nombre: 'Frappé' }, c)).toBeNull();
  });

  it('respeta los umbrales configurables y 0 los apaga', () => {
    const c8 = ctx([], { datosLocalPublicos: { avisoStock: { quedan: 8, ultimas: 2 } } });
    expect(lineaAvisoStock(dona(8), c8)).toBe('🍩 Quedan 8');
    expect(lineaAvisoStock(dona(3), c8)).toBe('🍩 Quedan 3');
    expect(lineaAvisoStock(dona(2), c8)).toBe('🍩 ¡Últimas 2!');
    const c0 = ctx([], { datosLocalPublicos: { avisoStock: { quedan: 0, ultimas: 0 } } });
    expect(lineaAvisoStock(dona(1), c0)).toBeNull();
  });

  it('el texto es configurable con {aviso}', () => {
    const c = ctx([], { textosPersonalizados: { chatbot_texto_aviso_stock: '⚠️ Ojo: {aviso}' } });
    expect(lineaAvisoStock(dona(3), c)).toBe('⚠️ Ojo: ¡Quedan solo 3, ya se acaban!');
    expect(TEXTOS_BOT_DEFECTO.chatbot_texto_aviso_stock).toBe('🍩 {aviso}');
  });

  it('pregunta de cantidad lleva el aviso', () => {
    expect(TEXTOS_BOT.pedidoPreguntarCantidad('Donas', '🍩 ¡Última dona!')).toBe(
      '🍩 ¡Última dona!\n¿Cuántas unidades deseas de Donas? Elige una opción o escribe el número:',
    );
    expect(TEXTOS_BOT.pedidoPreguntarCantidad('Donas')).not.toContain('🍩');
  });

  describe('flujo: ficha (cantidad), menú y tope', () => {
    const hastaCantidad = (c: ContextoConversacion) => {
      let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), c);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), c);
      const menu = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_c1' }), c);
      const sel = transicionarEstado(menu.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_p1' }), c);
      return { menu, sel };
    };

    it('al elegir el producto, la pregunta de cantidad trae el aviso', () => {
      const c = ctx([dona(3), { ...dona(9), id: 'p2', nombre: 'Galletas' }]);
      const { sel } = hastaCantidad(c);
      expect(sel.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect((sel.acciones[0] as any).texto).toContain('🍩 ¡Quedan solo 3, ya se acaban!');
    });

    it('con stock lejano no hay aviso', () => {
      const { sel } = hastaCantidad(ctx([dona(20), { ...dona(9), id: 'p2', nombre: 'Galletas' }]));
      expect((sel.acciones[0] as any).texto).not.toContain('🍩');
    });

    it('el menú muestra el aviso y el agotado sigue oculto', () => {
      const c = ctx([dona(2), { ...dona(0, { disponible: false }), id: 'p2', nombre: 'Galletas' }, { ...dona(30), id: 'p3', nombre: 'Brownie' }]);
      const { menu } = hastaCantidad(c);
      const json = JSON.stringify(menu.acciones);
      expect(json).toContain('¡Últimas 2!');
      expect(json).not.toContain('Galletas');
      expect(json).toContain('Brownie');
    });

    it('pedir más de lo que queda dice cuántas quedan', () => {
      const c = ctx([dona(3), { ...dona(9), id: 'p2', nombre: 'Galletas' }]);
      const { sel } = hastaCantidad(c);
      const r = transicionarEstado(sel.nuevoFlujo, normalizarEntrada({ texto: '5' }), c);
      expect((r.acciones[0] as any).texto).toBe('Solo quedan 3 de Donas 😅 ¿Cuántas quieres?');
    });
  });

  describe('resumen del pedido', () => {
    const prods: Record<string, any> = { p1: dona(4), p2: { ...dona(40), id: 'p2', nombre: 'Galletas' }, p3: { id: 'p3', nombre: 'Café', quedan: 3 } };
    const productoDe = (id: string) => prods[id];
    const unid = (p: any, t?: string) => (t === 'media' ? 6 : 1);

    it('avisa si el pedido usa todo o casi todo el saldo', () => {
      const r = (cantidad: number) => lineasAvisoResumen([{ productoId: 'p1', cantidad }], productoDe, unid, ctx([]));
      expect(r(4)).toEqual(['🍩 Donas: Quedan 4']);
      expect(r(3)).toEqual(['🍩 Donas: Quedan 4']);
      expect(r(2)).toEqual([]);
    });

    it('suma las líneas del mismo producto, usa unidades por tamaño y no avisa fuera de rango', () => {
      const lineas = [
        { productoId: 'p1', cantidad: 1 },
        { productoId: 'p1', cantidad: 2 },
        { productoId: 'p2', cantidad: 39 },
      ];
      expect(lineasAvisoResumen(lineas, productoDe, unid, ctx([]))).toEqual(['🍩 Donas: Quedan 4']);
      expect(lineasAvisoResumen([{ productoId: 'p2', cantidad: 1, tamanoId: 'media' }], productoDe, unid, ctx([]))).toEqual([]);
    });
  });
});
