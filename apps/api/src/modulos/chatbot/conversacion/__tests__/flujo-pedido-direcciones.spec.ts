import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { BOTONES_PEDIDO_UBICACION, BOTONES_PEDIDO_UBICACION_FALLIDA, TEXTOS_BOT } from '../textos-bot';

describe('Flujo de Pedido: direcciones anteriores del cliente con cuenta', () => {
  const direccionesCliente = [
    {
      id: '7',
      direccion: 'Av. Las Palmeras 123',
      referencia: 'Portón azul',
      lat: -12.046374,
      lng: -77.042793,
      alias: null,
    },
    {
      id: '9',
      direccion: 'Jr. Campoy 456',
      referencia: null,
      lat: null,
      lng: null,
      alias: 'Casa de mamá',
    },
  ];

  const contextoBase: ContextoConversacion = {
    nombreCliente: 'Ana',
    telefonoCliente: '987654321',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: '', telefono: '999888777' } as any,
    categoriasCarta: [
      {
        id: 'cat_hamb',
        nombre: 'Hamburguesas',
        productos: [{ id: 'prod_1', nombre: 'Clásica', precio: 20, disponible: true, categoria_id: 'cat_hamb' }],
      },
    ],
    ofertas: [],
  };

  const conDirecciones = (extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
    ...contextoBase,
    direccionesCliente,
    ...extra,
  });

  /** Lleva el flujo hasta la elección de delivery (paso de modalidad -> delivery). */
  function llegarAlPasoDelivery(contexto: ContextoConversacion): FlujoConversacion {
    let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), contexto);
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contexto);
    return r.nuevoFlujo as FlujoConversacion;
  }

  describe('cliente con direcciones guardadas', () => {
    it('recibe la lista con sus direcciones y la opción «Otra dirección»', () => {
      const contexto = conDirecciones();
      const flujo = llegarAlPasoDelivery(contexto);
      const r = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contexto);

      expect(r.nuevoEstado).toBe('PEDIDO_DIRECCION_ELEGIR');
      const accion = r.acciones[0];
      expect(accion.tipo).toBe('enviarLista');
      if (accion.tipo !== 'enviarLista') return;
      expect(accion.texto).toBe('¿Dónde te lo llevamos? 📍 Elige una dirección anterior o «Otra dirección».');
      expect(accion.filas.map((f) => f.id)).toEqual(['ped_dir_7', 'ped_dir_9', 'ped_dir_nueva']);
      expect(accion.filas[0]).toEqual({
        id: 'ped_dir_7',
        titulo: 'Av. Las Palmeras 123',
        descripcion: 'Av. Las Palmeras 123 · Ref: Portón azul',
      });
      expect(accion.filas[1].titulo).toBe('Casa de mamá');
      expect(accion.filas[1].descripcion).toBe('Jr. Campoy 456');
      expect(accion.filas[2]).toEqual({ id: 'ped_dir_nueva', titulo: 'Otra dirección', descripcion: 'Escríbela aquí' });
    });

    it('elegir una dirección con cobertura carga dirección, referencia y coordenadas y avanza a categorías', () => {
      const contextoEnvio = conDirecciones({
        resultadoEnvio: { cubierto: true, tarifa: 5, gratisDesde: 70, zona: { id: 3, nombre: 'San Juan' } },
        vistaPreviaPedido: { subtotal: 20, descuento: 0, descuentoNombre: null, envio: 5, envioGratis: false },
      });
      const flujo = llegarAlPasoDelivery(contextoEnvio);
      const lista = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contextoEnvio);

      const r = transicionarEstado(lista.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_dir_7' }), contextoEnvio);

      expect(r.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      const entrega = (r.nuevoFlujo as any).pedido.entrega;
      expect(entrega).toMatchObject({
        modalidad: 'DELIVERY',
        direccion: 'Av. Las Palmeras 123',
        referencia: 'Portón azul',
        lat: -12.046374,
        lng: -77.042793,
        origen: 'WHATSAPP',
        zonaId: '3',
        zonaNombre: 'San Juan',
        tarifaEnvio: 5,
      });
      const encabezado = r.acciones[0];
      expect(r.acciones).toHaveLength(1);
      expect(encabezado.tipo === 'enviarLista' && encabezado.texto).toBe(
        'Perfecto, lo enviamos a Av. Las Palmeras 123. El envío cuesta S/ 5.00. Elige una categoría:',
      );
    });

    it('elegir una dirección sin coordenadas la carga como dirección escrita, sin calcular zona', () => {
      const flujo = llegarAlPasoDelivery(conDirecciones());
      const lista = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), conDirecciones());

      const r = transicionarEstado(lista.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_dir_9' }), conDirecciones());

      expect(r.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      expect((r.nuevoFlujo as any).pedido.entrega).toMatchObject({
        direccion: 'Jr. Campoy 456',
        origen: 'ESCRITA',
        tarifaEnvio: null,
      });
    });

    it('elegir una dirección fuera de cobertura avisa y pide una ubicación nueva', () => {
      const contextoFuera = conDirecciones({ resultadoEnvio: { cubierto: false, tarifa: null } });
      const flujo = llegarAlPasoDelivery(contextoFuera);
      const lista = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contextoFuera);

      const r = transicionarEstado(lista.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_dir_7' }), contextoFuera);

      expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
      const accion = r.acciones[0];
      expect(accion.tipo).toBe('enviarBotones');
      if (accion.tipo === 'enviarBotones') {
        expect(accion.texto).toContain('zona de reparto');
        expect(accion.botones).toEqual(BOTONES_PEDIDO_UBICACION_FALLIDA);
      }
      expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
    });

    it('«Otra dirección» va directo a escribir la dirección, sin menú de ubicación', () => {
      const flujo = llegarAlPasoDelivery(conDirecciones());
      const lista = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), conDirecciones());

      const r = transicionarEstado(lista.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_dir_nueva' }), conDirecciones());

      expect(r.nuevoEstado).toBe('PEDIDO_DIRECCION_TEXTO');
      expect(r.acciones).toEqual([{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoEscribirDireccion() }]);
      expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
    });

    it('una dirección guardada solo con coordenadas se muestra en letras, nunca con zona', () => {
      const libreta = [
        { id: '4', direccion: 'Ubicación guardada el 3 nov', referencia: null, lat: -12.01, lng: -76.95, alias: null },
        { id: '5', direccion: 'Cerca de: Portón azul', referencia: 'Portón azul', lat: -12.02, lng: -76.96, alias: null },
      ];
      const ctx = conDirecciones({ direccionesCliente: libreta });
      const flujo = llegarAlPasoDelivery(ctx);
      const r = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), ctx);

      const accion = r.acciones[0];
      expect(accion.tipo === 'enviarLista' && accion.filas[0]).toEqual({
        id: 'ped_dir_4',
        titulo: 'Ubicación guardada el 3',
        descripcion: 'Ubicación guardada el 3 nov',
      });
      expect(accion.tipo === 'enviarLista' && accion.filas[1].descripcion).toBe('Cerca de: Portón azul');
      expect(JSON.stringify(r.acciones)).not.toMatch(/zona|Punto marcado|-12\.01/);
    });

    it('un id que no está en su libreta no carga nada y vuelve a mostrar la lista', () => {
      const flujo = llegarAlPasoDelivery(conDirecciones());
      const lista = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), conDirecciones());

      const r = transicionarEstado(lista.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_dir_999' }), conDirecciones());

      expect(r.nuevoEstado).toBe('PEDIDO_DIRECCION_ELEGIR');
      expect(r.acciones[0].tipo).toBe('enviarLista');
      expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
    });
  });

  describe('sin cuenta o sin direcciones: flujo actual sin cambios', () => {
    it.each([
      ['sin cuenta (null)', { direccionesCliente: null }],
      ['sin cuenta (undefined)', { direccionesCliente: undefined }],
      ['con cuenta y sin direcciones', { direccionesCliente: [] }],
    ])('%s pide ubicación directamente', (_nombre, extra) => {
      const contexto: ContextoConversacion = { ...contextoBase, ...extra } as ContextoConversacion;
      const flujo = llegarAlPasoDelivery(contexto);
      const r = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contexto);

      expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
      expect(r.acciones[0]).toEqual({
        tipo: 'enviarBotones',
        texto: TEXTOS_BOT.pedidoPedirUbicacion(),
        botones: BOTONES_PEDIDO_UBICACION,
      });
    });
  });

  describe('delivery sin direcciones guardadas: un solo mensaje, dos botones', () => {
    it('pregunta dónde y ofrece «Mi ubicación actual» y «Escribir dirección» en un mensaje', () => {
      const contexto = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const r = transicionarEstado(llegarAlPasoDelivery(contexto), normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contexto);

      expect(r.acciones).toHaveLength(1);
      expect(r.acciones[0]).toEqual({
        tipo: 'enviarBotones',
        texto: '¿Dónde te lo llevamos? 📍\nEnvíanos tu ubicación actual o escribe tu dirección.',
        botones: [
          { id: 'ped_loc_share', titulo: 'Mi ubicación actual' },
          { id: 'ped_loc_escribir', titulo: 'Escribir dirección' },
        ],
      });
    });

    it('«Mi ubicación actual» responde con la instrucción corta del clip (un mensaje)', () => {
      const contexto = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const flujo = llegarAlPasoDelivery(contexto);
      const r = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_loc_share' }), contexto);

      expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
      expect(r.acciones).toHaveLength(1);
      expect(r.acciones[0].tipo === 'enviarBotones' && r.acciones[0].texto).toBe(
        'Toca el clip 📎 > Ubicación > Enviar mi ubicación actual.',
      );
    });

    it('«Escribir dirección» pide la dirección y la referencia en un solo mensaje, y acepta el texto', () => {
      const contexto = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const flujo = llegarAlPasoDelivery(contexto);
      const pide = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_loc_escribir' }), contexto);

      expect(pide.nuevoEstado).toBe('PEDIDO_DIRECCION_TEXTO');
      expect(pide.acciones).toEqual([{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoEscribirDireccion() }]);

      const recibe = transicionarEstado(pide.nuevoFlujo, normalizarEntrada({ texto: 'San Juan, Av. Las Palmeras 123, portón azul' }), contexto);

      expect(recibe.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      expect(recibe.acciones).toHaveLength(1);
      expect(recibe.acciones[0].tipo === 'enviarLista' && recibe.acciones[0].texto).toBe(
        'Anotado: lo enviamos a San Juan, Av. Las Palmeras 123, portón azul. Un asesor te confirmará el costo del envío. Elige una categoría:',
      );
      expect((recibe.nuevoFlujo as any).pedido.entrega).toMatchObject({
        modalidad: 'DELIVERY',
        direccion: 'San Juan, Av. Las Palmeras 123, portón azul',
        origen: 'ESCRITA',
        tarifaEnvio: null,
      });
    });

    it('una dirección escrita muy corta vuelve a pedirla sin pasar de paso', () => {
      const contexto = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const pide = transicionarEstado(llegarAlPasoDelivery(contexto), normalizarEntrada({ buttonPayload: 'ped_loc_escribir' }), contexto);
      const r = transicionarEstado(pide.nuevoFlujo, normalizarEntrada({ texto: 'ok' }), contexto);

      expect(r.nuevoEstado).toBe('PEDIDO_DIRECCION_TEXTO');
    });
  });

  describe('mensajes del bot desde «Delivery» hasta «Elige una categoría»', () => {
    /** Suma los mensajes (acciones) de cada respuesta, desde el tap de Delivery hasta llegar a categorías. */
    function contarMensajes(pasos: Array<{ entrada: any; ctx: ContextoConversacion }>, flujo: FlujoConversacion): number {
      let total = 0;
      let actual = flujo;
      for (const paso of pasos) {
        const r = transicionarEstado(actual, normalizarEntrada(paso.entrada), paso.ctx);
        total += r.acciones.length;
        actual = r.nuevoFlujo as FlujoConversacion;
      }
      expect(actual.estado).toBe('PEDIDO_CATEGORIAS');
      return total;
    }

    it('ubicación por WhatsApp (sin direcciones): 4 mensajes', () => {
      const ctxSinDir = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const ctxEnvio: ContextoConversacion = {
        ...ctxSinDir,
        resultadoEnvio: { cubierto: true, tarifa: 5, gratisDesde: 70, zona: { id: 3, nombre: 'San Juan' } },
        vistaPreviaPedido: { subtotal: 20, descuento: 0, descuentoNombre: null, envio: 5, envioGratis: false },
      };
      const flujo = llegarAlPasoDelivery(ctxSinDir);
      const total = contarMensajes(
        [
          { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx: ctxSinDir }, // 1: ¿Dónde te lo llevamos?
          { entrada: { buttonPayload: 'ped_loc_share' }, ctx: ctxSinDir }, // 2: clip
          { entrada: { tipo: 'location', ubicacion: { latitud: -12.02, longitud: -76.96 } }, ctx: ctxEnvio }, // 3: localizada + referencia
          { entrada: { texto: 'Frente al parque, portón blanco' }, ctx: ctxEnvio }, // 4: categorías
        ],
        flujo,
      );
      expect(total).toBe(4);
    });

    it('dirección escrita (sin direcciones): 3 mensajes', () => {
      const ctxSinDir = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const total = contarMensajes(
        [
          { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx: ctxSinDir }, // 1
          { entrada: { buttonPayload: 'ped_loc_escribir' }, ctx: ctxSinDir }, // 2: pide la dirección
          { entrada: { texto: 'San Juan, Av. Las Palmeras 123, portón azul' }, ctx: ctxSinDir }, // 3: categorías
        ],
        llegarAlPasoDelivery(ctxSinDir),
      );
      expect(total).toBe(3);
    });

    it('dirección anterior con cobertura (cliente con cuenta): 2 mensajes', () => {
      const ctx: ContextoConversacion = {
        ...conDirecciones(),
        resultadoEnvio: { cubierto: true, tarifa: 5, gratisDesde: 70, zona: { id: 3, nombre: 'San Juan' } },
        vistaPreviaPedido: { subtotal: 20, descuento: 0, descuentoNombre: null, envio: 5, envioGratis: false },
      };
      const total = contarMensajes(
        [
          { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx }, // 1: lista de direcciones
          { entrada: { listRowId: 'ped_dir_7' }, ctx }, // 2: «Perfecto, lo enviamos a…» + categorías
        ],
        llegarAlPasoDelivery(ctx),
      );
      expect(total).toBe(2);
    });

    it('«Otra dirección» (cliente con cuenta): 3 mensajes', () => {
      const ctx = conDirecciones();
      const total = contarMensajes(
        [
          { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx }, // 1: lista
          { entrada: { listRowId: 'ped_dir_nueva' }, ctx }, // 2: pide la dirección
          { entrada: { texto: 'Jr. Campoy 456, casa verde' }, ctx }, // 3: categorías
        ],
        llegarAlPasoDelivery(ctx),
      );
      expect(total).toBe(3);
    });
  });

  describe('textos del bot: nunca zona, punto ni coordenadas', () => {
    it('ninguna respuesta del paso de delivery menciona zona, «Punto marcado» ni coordenadas', () => {
      const ctxSinDir = { ...contextoBase, direccionesCliente: null } as ContextoConversacion;
      const respuestas = [
        transicionarEstado(llegarAlPasoDelivery(ctxSinDir), normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), ctxSinDir),
        transicionarEstado(llegarAlPasoDelivery(conDirecciones()), normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), conDirecciones()),
      ];
      const textos = JSON.stringify(respuestas.map((r) => r.acciones));
      expect(textos).not.toMatch(/Punto marcado|zona \d|zona [A-Z0-9]|-\d+\.\d+/);
    });
  });
});
