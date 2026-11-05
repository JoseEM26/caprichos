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
      expect(accion.texto).toBe('¡Qué gusto verte de nuevo! 😊 ¿Lo enviamos a una dirección anterior o a una nueva?');
      expect(accion.filas.map((f) => f.id)).toEqual(['ped_dir_7', 'ped_dir_9', 'ped_dir_nueva']);
      expect(accion.filas[0].descripcion).toContain('Portón azul');
      expect(accion.filas[1].titulo).toBe('Casa de mamá');
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
      const texto = r.acciones.find((a) => a.tipo === 'enviarTexto');
      expect(texto && texto.tipo === 'enviarTexto' && texto.texto).toContain('Av. Las Palmeras 123');
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

    it('«Otra dirección» sigue el flujo actual y pide ubicación', () => {
      const flujo = llegarAlPasoDelivery(conDirecciones());
      const lista = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), conDirecciones());

      const r = transicionarEstado(lista.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_dir_nueva' }), conDirecciones());

      expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
      expect(r.acciones[0]).toEqual({
        tipo: 'enviarBotones',
        texto: TEXTOS_BOT.pedidoPedirUbicacion(),
        botones: BOTONES_PEDIDO_UBICACION,
      });
      expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
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
});
