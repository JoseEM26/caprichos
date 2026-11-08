import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { carritoTrasSaborAgotado } from '../flujos/pedido/flujo-pedido';

/**
 * Donas y galletas con stock POR SABOR (chatbot: un solo sabor por línea, unidades = tamaño × cantidad).
 */
describe('Flujo de Pedido: productos con stock por sabor', () => {
  const dona = {
    id: 'prod_dona',
    nombre: 'Dona',
    precio: 3,
    disponible: true,
    saboresConStock: true,
    tamanos: [
      { id: 'tam_u', nombre: 'Unidad', precio: 3, unidades: 1 },
      { id: 'tam_media', nombre: '1/2 docena', precio: 18, unidades: 6 },
      { id: 'tam_doc', nombre: 'Docena', precio: 34, unidades: 12 },
    ],
    sabores: [
      { id: 'sab_fresa', nombre: 'Fresa', disponible: true, quedan: 20 },
      { id: 'sab_choco', nombre: 'Chocolate', disponible: true, quedan: 4 },
      { id: 'sab_vaini', nombre: 'Vainilla', disponible: false, quedan: 10 },
      { id: 'sab_coco', nombre: 'Coco', disponible: true, quedan: null },
    ],
  };

  const categoriaDonas = {
    id: 'cat_donas',
    nombre: 'Donas',
    productos: [dona],
  };

  const contexto = (categorias: any[] = [categoriaDonas]): ContextoConversacion => ({
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: {
      abierta: true,
      abre: '12:00',
      cierra: '23:00',
      direccion: 'Campoy',
      enlaceMapa: 'https://maps.google.com',
      pausaAltaDemanda: false,
      altaDemandaMinutosExtra: 0,
    },
    datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: {} },
    categoriasCarta: categorias,
    ofertas: [],
  });

  /** Recorre desde «Hacer pedido» hasta la pregunta de cantidad (tamaño elegido). */
  function llegarACantidad(tamanoBoton: string, ctx = contexto()) {
    let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), ctx);
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), ctx);
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_cat_donas' }), ctx);
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_prod_dona' }), ctx);
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: `ped_tam_${tamanoBoton}` }), ctx);
    return r;
  }

  /** Hasta la lista de sabores (tamaño y cantidad con botón). */
  function llegarASabores(tamanoBoton: string, cantidadBoton: string, ctx = contexto()) {
    const r = llegarACantidad(tamanoBoton, ctx);
    return transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: `ped_cant_${cantidadBoton}` }), ctx);
  }

  describe('1. Lista de sabores: solo los disponibles, en un solo mensaje', () => {
    it('tras tamaño y cantidad muestra una lista con los sabores disponibles (sin los agotados ni los no disponibles)', () => {
      const r = llegarASabores('tam_u', '1');

      expect(r.nuevoEstado).toBe('PEDIDO_SABOR');
      expect(r.acciones).toHaveLength(1);
      const lista = r.acciones[0] as any;
      expect(lista.tipo).toBe('enviarLista');
      expect(lista.filas.map((f: any) => f.id)).toEqual(['ped_sab_sab_fresa', 'ped_sab_sab_choco', 'ped_sab_sab_coco']);
    });

    it('un sabor con menos unidades que la línea (Chocolate 4 para 1/2 docena) no se ofrece', () => {
      const r = llegarASabores('tam_media', '1');
      expect((r.acciones[0] as any).filas.map((f: any) => f.id)).toEqual(['ped_sab_sab_fresa', 'ped_sab_sab_coco']);
    });

    it('la descripción dice «Quedan N» solo cuando quedan 5 o menos; títulos de 24 caracteres como máximo', () => {
      const r = llegarASabores('tam_u', '1');
      const filas = (r.acciones[0] as any).filas;

      expect(filas[0].descripcion).toBeUndefined(); // Fresa: 20
      expect(filas[1].descripcion).toBe('Quedan 4'); // Chocolate: 4
      expect(filas[2].descripcion).toBeUndefined(); // Coco: sin apertura hoy
      expect(filas.every((f: any) => f.titulo.length <= 24)).toBe(true);
    });

    it('máximo 10 filas aunque el producto tenga más sabores', () => {
      const muchos = Array.from({ length: 14 }, (_, k) => ({ id: `s${k}`, nombre: `Sabor ${k}`, disponible: true, quedan: 50 }));
      const producto = { ...dona, sabores: muchos };
      const r = llegarASabores('tam_media', '1', contexto([{ ...categoriaDonas, productos: [producto] }]));
      expect((r.acciones[0] as any).filas).toHaveLength(10);
    });
  });

  describe('2. Línea del carrito con su sabor y unidades = tamaño × cantidad', () => {
    it('1/2 docena × 1 de Fresa: la línea lleva sabores [{saborId, cantidad: 6}] y el resumen dice «1/2 docena de Fresa»', () => {
      let r = llegarASabores('tam_media', '1');
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_sab_sab_fresa' }), contexto());

      expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
      const linea = r.nuevoFlujo.pedido?.items[0] as any;
      expect(linea.cantidad).toBe(1);
      expect(linea.sabores).toEqual([{ saborId: 'sab_fresa', nombre: 'Fresa', cantidad: 6 }]);
      expect(linea.sabor).toBeUndefined();

      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_ver_carrito' }), contexto());
      expect((r.acciones[0] as any).texto).toContain('1x Dona (1/2 docena de Fresa)');
    });

    it('Docena × 2 de Coco: suma 24 unidades en el sabor', () => {
      let r = llegarASabores('tam_doc', '2');
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_sab_sab_coco' }), contexto());

      const linea = r.nuevoFlujo.pedido?.items[0] as any;
      expect(linea.sabores).toEqual([{ saborId: 'sab_coco', nombre: 'Coco', cantidad: 24 }]);
    });

    it('el payload de crearPedido lleva sabores en la línea (saborId + cantidad)', () => {
      const flujoResumen: FlujoConversacion = {
        version: 2,
        estado: 'PEDIDO_RESUMEN_CONFIRMAR',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR',
          modalidad: 'RECOGER',
          cliente: { nombre: 'Carlos Test', telefono: '987654321' },
          pago: { metodo: 'EFECTIVO', pagaCon: 100 },
          comprobante: { tipo: 'NINGUNO' },
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_dona',
              productoNombre: 'Dona',
              categoriaId: 'cat_donas',
              categoriaNombre: 'Donas',
              tamanoId: 'tam_doc',
              tamanoNombre: 'Docena',
              cantidad: 2,
              precioUnitario: 34,
              subtotal: 68,
              opciones: [],
              sabores: [{ saborId: 'sab_fresa', nombre: 'Fresa', cantidad: 24 }],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const res = transicionarEstado(flujoResumen, normalizarEntrada({ buttonPayload: 'ped_confirmar_si' }), contexto());
      const accionCrear = res.acciones.find((a) => a.tipo === 'crearPedido') as any;

      expect(accionCrear.dto.lineas[0].productoId).toBe('prod_dona');
      expect(accionCrear.dto.lineas[0].tamanoId).toBe('tam_doc');
      expect(accionCrear.dto.lineas[0].cantidad).toBe(2);
      expect(accionCrear.dto.lineas[0].sabores).toEqual([{ saborId: 'sab_fresa', cantidad: 24 }]);
    });

    it('efectivo sin «con cuánto pagas»: no crea el pedido y vuelve a preguntar el monto', () => {
      const flujoResumen: FlujoConversacion = {
        version: 2,
        estado: 'PEDIDO_RESUMEN_CONFIRMAR',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR',
          modalidad: 'RECOGER',
          cliente: { nombre: 'Carlos Test', telefono: '987654321' },
          pago: { metodo: 'EFECTIVO', pagaCon: undefined },
          comprobante: { tipo: 'NINGUNO' },
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_dona',
              productoNombre: 'Dona',
              categoriaId: 'cat_donas',
              categoriaNombre: 'Donas',
              tamanoId: 'tam_doc',
              tamanoNombre: 'Docena',
              cantidad: 2,
              precioUnitario: 34,
              subtotal: 68,
              opciones: [],
              sabores: [{ saborId: 'sab_fresa', nombre: 'Fresa', cantidad: 24 }],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const res = transicionarEstado(flujoResumen, normalizarEntrada({ buttonPayload: 'ped_confirmar_si' }), contexto());
      expect(res.acciones.find((a) => a.tipo === 'crearPedido')).toBeUndefined();
      expect(res.nuevoEstado).toBe('PEDIDO_MONTO_EFECTIVO');
    });
  });

  describe('3. Sabor con poco stock: repregunta en el mismo mensaje', () => {
    it('pedir 1 docena de Chocolate (quedan 4) responde «Solo quedan 4 de Chocolate» con la lista, sin agregar la línea', () => {
      let r = llegarASabores('tam_doc', '1');
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_sab_sab_choco' }), contexto());

      expect(r.nuevoEstado).toBe('PEDIDO_SABOR');
      expect(r.acciones).toHaveLength(1);
      const msg = r.acciones[0] as any;
      expect(msg.tipo).toBe('enviarLista');
      expect(msg.texto).toBe('Solo quedan 4 de Chocolate 😅 Elige otro sabor:');
      expect(r.nuevoFlujo.pedido?.items ?? []).toHaveLength(0);
      // Chocolate (4) no alcanza para una docena: ya no se ofrece en la lista
      expect(msg.filas.map((f: any) => f.id)).toEqual(['ped_sab_sab_fresa', 'ped_sab_sab_coco']);
    });

    it('Unidad × 4 de Chocolate (4 unidades, quedan 4) sí alcanza: se compara unidades totales', () => {
      let r = llegarACantidad('tam_u');
      // Cantidad escrita a mano: 4 unidades sueltas
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ textoOriginal: '4' }), contexto());
      expect(r.nuevoEstado).toBe('PEDIDO_SABOR');
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_sab_sab_choco' }), contexto());
      expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
      expect(r.nuevoFlujo.pedido?.items[0].sabores).toEqual([{ saborId: 'sab_choco', nombre: 'Chocolate', cantidad: 4 }]);
    });

    it('un texto que no es un sabor de la lista vuelve a mostrar la lista', () => {
      let r = llegarASabores('tam_u', '1');
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ textoOriginal: 'de pistacho' }), contexto());
      expect(r.nuevoEstado).toBe('PEDIDO_SABOR');
      expect((r.acciones[0] as any).texto).toBe('Elige un sabor de la lista:');
    });
  });

  describe('4. Ningún sabor disponible: el producto aparece como agotado', () => {
    const donaAgotada = {
      ...dona,
      id: 'prod_agotada',
      nombre: 'Galleta Oreo',
      sabores: [
        { id: 'a', nombre: 'Oreo', disponible: true, quedan: 0 },
        { id: 'b', nombre: 'Maní', disponible: false, quedan: 3 },
      ],
    };

    it('no aparece en la lista de productos y, si se elige, responde que no hay stock', () => {
      const ctx = contexto([{ ...categoriaDonas, productos: [dona, donaAgotada] }]);
      let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_cat_donas' }), ctx);

      const lista = r.acciones.find((a) => a.tipo === 'enviarLista') as any;
      expect(lista.filas.map((f: any) => f.id)).toEqual(['ped_prod_prod_dona']);

      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_prod_agotada' }), ctx);
      expect((r.acciones[0] as any).texto).toBe('Por ahora no hay stock de Galleta Oreo. Te sugiero Dona.');
    });
  });

  describe('5. SABOR_AGOTADO: se quita la línea y se vuelve a elegir sabor (resto del carrito intacto)', () => {
    const carrito: any = {
      estadoInterno: 'PEDIDO_CANTIDAD',
      modalidad: 'RECOGER',
      items: [
        {
          lineaId: 'l_otra',
          productoId: 'prod_otro',
          productoNombre: 'Frappe',
          categoriaId: 'cat_frias',
          categoriaNombre: 'Frappes',
          cantidad: 1,
          precioUnitario: 12,
          subtotal: 12,
          opciones: [],
          noSumaBeneficios: false,
        },
        {
          lineaId: 'l_dona',
          productoId: 'prod_dona',
          productoNombre: 'Dona',
          categoriaId: 'cat_donas',
          categoriaNombre: 'Donas',
          tamanoId: 'tam_media',
          tamanoNombre: '1/2 docena',
          cantidad: 1,
          precioUnitario: 18,
          subtotal: 18,
          opciones: [],
          sabores: [{ saborId: 'sab_fresa', nombre: 'Fresa', cantidad: 6 }],
          noSumaBeneficios: false,
        },
      ],
    };

    it('quita solo la línea de ese sabor, deja el resto y pone la lista de sabores disponibles', () => {
      const vuelta = carritoTrasSaborAgotado(
        carrito,
        { productoId: 'prod_dona', saborId: 'sab_fresa', saborNombre: 'Fresa' },
        [categoriaDonas],
      );

      expect(vuelta).not.toBeNull();
      expect(vuelta!.pedido.items.map((i) => i.lineaId)).toEqual(['l_otra']);
      expect(vuelta!.pedido.estadoInterno).toBe('PEDIDO_SABOR');
      expect(vuelta!.pedido.itemEnConfiguracion).toMatchObject({ productoId: 'prod_dona', tamanoId: 'tam_media', cantidad: 1, precioBase: 18 });
      expect(vuelta!.lista.texto).toBe('Ya no quedan Fresa… ¿elegimos otro?');
      // Chocolate (4) no alcanza para 1/2 docena (6): solo se ofrecen los sabores que sí tienen las unidades
      expect(vuelta!.lista.filas.map((f) => f.id)).toEqual(['ped_sab_sab_fresa', 'ped_sab_sab_coco']);
    });

    it('el cliente elige otro sabor y la línea vuelve al carrito con ese sabor', () => {
      const vuelta = carritoTrasSaborAgotado(carrito, { productoId: 'prod_dona', saborId: 'sab_fresa' }, [categoriaDonas])!;
      const flujo: FlujoConversacion = { version: 2, estado: 'PEDIDO_SABOR', repreguntasFallidas: 0, pedido: vuelta.pedido };

      const r = transicionarEstado(flujo, normalizarEntrada({ listRowId: 'ped_sab_sab_coco' }), contexto());

      expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
      const lineas = r.nuevoFlujo.pedido!.items;
      expect(lineas.map((i) => i.lineaId)).toEqual(['l_otra', expect.any(String)]);
      expect(lineas[1].sabores).toEqual([{ saborId: 'sab_coco', nombre: 'Coco', cantidad: 6 }]);
      expect(lineas[1].precioUnitario).toBe(18);
    });

    it('si el sabor agotado era el último disponible, no hay vuelta a la lista (devuelve null)', () => {
      const sinOtros = {
        ...categoriaDonas,
        productos: [{ ...dona, sabores: [{ id: 'sab_fresa', nombre: 'Fresa', disponible: true, quedan: 0 }] }],
      };
      expect(carritoTrasSaborAgotado(carrito, { productoId: 'prod_dona', saborId: 'sab_fresa' }, [sinOtros])).toBeNull();
    });

    it('si la línea del sabor no está en el carrito, devuelve null', () => {
      expect(carritoTrasSaborAgotado(carrito, { productoId: 'prod_dona', saborId: 'sab_choco' }, [categoriaDonas])).toBeNull();
    });
  });

  describe('6. Productos sin saboresConStock no cambian', () => {
    it('un producto con sabores sin control de stock sigue preguntando con botones antes de la cantidad', () => {
      const helado = {
        id: 'prod_helado',
        nombre: 'Helado',
        precio: 10,
        disponible: true,
        sabores: [
          { id: 'h1', nombre: 'Vainilla', disponible: true },
          { id: 'h2', nombre: 'Lúcuma', disponible: true },
        ],
      };
      const ctx = contexto([{ ...categoriaDonas, id: 'cat_helados', productos: [helado] }]);
      let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_cat_helados' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_prod_helado' }), ctx);

      expect(r.nuevoEstado).toBe('PEDIDO_SABOR');
      const botones = (r.acciones[0] as any).botones;
      expect(botones.map((b: any) => b.id)).toEqual(['ped_sab_h1', 'ped_sab_h2']);
    });

    it('un producto sin sabores ni tamaños pasa directo de elegir producto a cantidad', () => {
      const ctx = contexto([
        { id: 'cat_cafe', nombre: 'Café', productos: [{ id: 'prod_cafe', nombre: 'Espresso', precio: 8, disponible: true }] },
      ]);
      let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_cat_cafe' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_prod_cafe' }), ctx);
      expect(r.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect(r.acciones).toHaveLength(1);
    });
  });

  describe('7. Lo que no cabe en lo que queda no se ofrece (tamaños, cantidades y sabores)', () => {
    /** Dona por sabor con el saldo total del producto (la carta da quedan = suma de sus sabores). */
    const donaCon = (quedan: number, sabores: any[] = dona.sabores) => ({ ...dona, quedan, sabores });

    /** Hasta la pregunta de cantidad con el tamaño elegido (sin pasar por sabores). */
    function hastaCantidad(tamano: string, producto: any) {
      const ctx = contexto([{ ...categoriaDonas, productos: [producto] }]);
      return { ctx, r: llegarACantidad(tamano, ctx) };
    }

    it('la docena no se ofrece si quedan 8: solo 1 unidad y 1/2 docena', () => {
      let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), contexto([{ ...categoriaDonas, productos: [donaCon(8)] }]));
      const ctx = contexto([{ ...categoriaDonas, productos: [donaCon(8)] }]);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_cat_donas' }), ctx);
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_prod_dona' }), ctx);

      expect(r.nuevoEstado).toBe('PEDIDO_TAMANO');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toEqual(['ped_tam_tam_u', 'ped_tam_tam_media']);
    });

    it('con 1/2 docena de Chocolate y quedan 8 de saldo total: solo se ofrece 1 vez (6 unidades)', () => {
      const { ctx, r } = hastaCantidad('tam_media', donaCon(8));
      expect(r.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toEqual(['ped_cant_1']);

      const pide2 = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_cant_2' }), ctx);
      expect(pide2.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect((pide2.acciones[0] as any).texto).toBe('Solo quedan 8 de Dona 😅 ¿Cuántas quieres?');
      expect(pide2.nuevoFlujo.pedido?.items ?? []).toHaveLength(0);
    });

    it('cantidad × unidades del tamaño: en un producto sin sabores, 2 de 1/2 docena con 8 de saldo se repregunta', () => {
      const galleta = { ...dona, nombre: 'Galleta', saboresConStock: false, sabores: [], quedan: 8 };
      const { ctx, r } = hastaCantidad('tam_media', galleta);
      expect(r.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toEqual(['ped_cant_1']);

      const pide2 = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_cant_2' }), ctx);
      expect((pide2.acciones[0] as any).texto).toBe('Solo quedan 8 de Galleta 😅 ¿Cuántas quieres?');
    });

    it('un sabor no se ofrece si no tiene las unidades de la línea (Chocolate 4 no entra en 1/2 docena)', () => {
      const { r } = hastaCantidad('tam_media', donaCon(20));
      const sab = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_cant_1' }), contexto([{ ...categoriaDonas, productos: [donaCon(20)] }]));
      expect((sab.acciones[0] as any).filas.map((f: any) => f.id)).toEqual(['ped_sab_sab_fresa', 'ped_sab_sab_coco']);
    });

    it('si ningún sabor tiene las unidades de la cantidad, pide una cantidad menor sin ofrecer sabores', () => {
      // Fresa 6 y Chocolate 8: el saldo total (14) alcanza para 2 de 1/2 docena (12), pero ningún sabor solo llega a 12
      const sabores = [
        { id: 'sab_fresa', nombre: 'Fresa', disponible: true, quedan: 6 },
        { id: 'sab_choco', nombre: 'Chocolate', disponible: true, quedan: 8 },
      ];
      const producto = donaCon(14, sabores);
      const ctx = contexto([{ ...categoriaDonas, productos: [producto] }]);
      const r = llegarACantidad('tam_media', ctx);
      const pide2 = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_cant_2' }), ctx);

      expect(pide2.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect((pide2.acciones[0] as any).texto).toBe('Ningún sabor de Dona tiene 12 unidades. ¿Cuántas quieres?');
      expect((pide2.acciones[0] as any).botones.map((b: any) => b.id)).toEqual(['ped_cant_1']);
      expect(pide2.nuevoFlujo.pedido?.items ?? []).toHaveLength(0);
    });
  });
});
