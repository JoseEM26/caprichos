import { MODO_SOLO_MENUS, transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { lineaPromoSaludo } from '../textos-bot';
import { ContextoConversacion } from '../tipos-conversacion';

const URL_CARTA = 'https://carta.test';

const producto = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  id,
  nombre,
  precio: 10,
  disponible: true,
  fotoUrl: null,
  tamanos: [],
  ...extra,
});

const contextoBase = (extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
  nombreCliente: 'Carlos',
  cartaUrlPublica: URL_CARTA,
  datosLocal: {
    abierta: true,
    abre: '12:00',
    cierra: '23:00',
    direccion: 'Av. Principal 123',
    enlaceMapa: 'https://maps.test',
    telefono: '999888777',
  } as any,
  categoriasCarta: [
    {
      id: 'c1',
      nombre: 'Frappes',
      productos: [producto('1', 'Frappe Maracuyá'), producto('2', 'Frappe Fresa'), producto('3', 'Frappe Oreo', { disponible: false })],
    },
    { id: 'c2', nombre: 'Waffles', productos: [producto('4', 'Waffle Nutella')] },
  ],
  ofertas: [],
  ventasProductos: { '2': 50, '4': 30, '1': 5 },
  ...extra,
});

const ejecutar = (entrada: Parameters<typeof normalizarEntrada>[0], contexto = contextoBase(), flujo: any = null) =>
  transicionarEstado(flujo, normalizarEntrada(entrada), contexto);

const tipos = (r: { acciones: any[] }) => r.acciones.map((a) => a.tipo);

describe('Bot solo con menús (decisión del dueño)', () => {
  it('el motor nuevo está activo', () => {
    expect(MODO_SOLO_MENUS).toBe(true);
  });

  describe('saludo', () => {
    it('muestra el menú de 5 opciones y agrega la línea de puntos y pedidos con el enlace a la carta', () => {
      const r = ejecutar({ texto: 'Hola' });
      expect(tipos(r)).toEqual(['enviarLista']);
      const accion: any = r.acciones[0];
      expect(accion.texto).toContain('Soy Capri');
      expect(accion.texto).toContain(`puedes pedir y ver o canjear tus puntos en nuestra carta virtual: ${URL_CARTA}`);
      expect(accion.texto.endsWith(URL_CARTA)).toBe(true);
      expect(accion.filas.map((f: any) => f.id)).toEqual(['horario', 'carta', 'mipedido', 'persona', 'preguntar']);
      expect(r.nuevoEstado).toBe('MENU');
    });

    it('no agrega ninguna línea de promoción mientras lineaPromoSaludo devuelva null', () => {
      expect(lineaPromoSaludo()).toBeNull();
    });

    it('el primer contacto (INICIO) con texto sin intención también saluda', () => {
      const r = ejecutar({ texto: 'buenas, qué tal' }, contextoBase(), { estado: 'INICIO', repreguntasFallidas: 0 });
      expect(tipos(r)).toEqual(['enviarLista']);
    });
  });

  describe('pedidos por chat fuera', () => {
    it('«quiero pedir» responde con el enlace a la carta web y no abre ningún flujo de pedido', () => {
      const r = ejecutar({ texto: 'quiero pedir' });
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect((r.acciones[0] as any).texto).toContain(URL_CARTA);
      expect(r.nuevoFlujo.pedido ?? null).toBeNull();
      expect(r.nuevoEstado).toBe('MENU');
    });

    it('el botón «Hacer un pedido» de un mensaje viejo también lleva a la carta', () => {
      const r = ejecutar({ buttonPayload: 'btn_pedido', texto: 'Hacer un pedido' });
      expect((r.acciones[0] as any).texto).toContain(URL_CARTA);
    });
  });

  describe('Ver la carta', () => {
    it('envía un carrusel con los productos más vendidos (sin agotados) y el enlace a la carta', () => {
      const r = ejecutar({ listRowId: 'carta' });
      expect(tipos(r)).toEqual(['enviarCarrusel']);
      const carga = (r.acciones[0] as any).carga;
      expect(carga.cuerpo).toContain(URL_CARTA);
      expect(carga.tarjetas.map((t: any) => t.nombre)).toEqual(['Frappe Fresa', 'Waffle Nutella', 'Frappe Maracuyá']);
      expect(carga.tarjetas.every((t: any) => t.boton.id.startsWith('carta_p_'))).toBe(true);
      expect(carga.botonComun.id).toBe('btn_menu');
    });

    it('con un solo producto disponible no hay carrusel: manda el texto con el enlace', () => {
      const r = ejecutar({ listRowId: 'carta' }, contextoBase({ categoriasCarta: [{ id: 'c1', nombre: 'X', productos: [producto('9', 'Solo')] }] }));
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect((r.acciones[0] as any).texto).toContain(URL_CARTA);
    });

    it('sin productos disponibles avisa con el enlace', () => {
      const r = ejecutar({ listRowId: 'carta' }, contextoBase({ categoriasCarta: [] }));
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect((r.acciones[0] as any).texto).toContain(URL_CARTA);
    });

    it('tocar un producto del carrusel da el enlace a la carta, sin entrar a un pedido', () => {
      const r = ejecutar({ buttonPayload: 'carta_p_2', texto: 'Ver en la carta' });
      expect(tipos(r)).toEqual(['enviarBotones']);
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('Frappe Fresa');
      expect(texto).toContain(URL_CARTA);
    });
  });

  describe('estado de mi pedido', () => {
    it('con pedido activo informa el estado y lleva a la carta web', () => {
      const r = ejecutar({ listRowId: 'mipedido' }, contextoBase({ pedidoActivo: { codigo: 'CP-0110', estado: 'COCINA', pago_estado: 'PAGADO' } }));
      expect(tipos(r)).toEqual(['enviarBotones']);
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('CP-0110');
      expect(texto).toContain('COCINA');
      expect(texto).toContain(URL_CARTA);
    });

    it('sin pedido activo lo dice y ofrece la carta', () => {
      const r = ejecutar({ listRowId: 'mipedido' }, contextoBase({ pedidoActivo: null }));
      expect((r.acciones[0] as any).texto).toContain('No encontramos un pedido activo');
    });
  });

  describe('horario, reservas, puntos, cambios y personas', () => {
    it('horario y ubicación con los datos del local', () => {
      const r = ejecutar({ listRowId: 'horario' });
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect((r.acciones[0] as any).texto).toContain('Av. Principal 123');
    });

    it('reservar mesa: llama al local o habla con una persona, sin reservar por chat', () => {
      const r = ejecutar({ texto: 'quiero reservar una mesa' });
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('999888777');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toContain('btn_persona');
      expect(tipos(r)).not.toContain('crearSolicitudReserva');
    });

    it('puntos: mensaje corto con el enlace a la carta en el panel de puntos', () => {
      const r = ejecutar({ texto: 'cuantos puntos tengo' });
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('canjear tus puntos en nuestra carta virtual');
      expect(texto).toContain(`${URL_CARTA}?puntos=1`);
    });

    it('cambiar la dirección pasa a una persona', () => {
      const r = ejecutar({ texto: 'quiero cambiar direccion del pedido' });
      expect(r.acciones[0]).toEqual(expect.objectContaining({ tipo: 'pasarAPersona', motivo: 'CAMBIO_DIRECCION' }));
      expect(r.nuevoEstado).toBe('ATENCION_PERSONA');
    });

    it('anular el pedido pasa a una persona', () => {
      const r = ejecutar({ texto: 'quiero anular mi pedido' });
      expect(r.acciones[0]).toEqual(expect.objectContaining({ tipo: 'pasarAPersona', motivo: 'CAMBIO_CANCELACION_PEDIDO' }));
    });

    it('«Hablar con una persona» pasa a una persona', () => {
      const r = ejecutar({ buttonPayload: 'persona', texto: 'Hablar con una persona' });
      expect(r.acciones[0]).toEqual(expect.objectContaining({ tipo: 'pasarAPersona', motivo: 'CLIENTE_SOLICITO_PERSONA' }));
    });

    it('una queja escrita sigue yendo urgente a una persona', () => {
      const r = ejecutar({ texto: 'quiero hacer un reclamo' });
      expect(r.acciones[0]).toEqual(expect.objectContaining({ tipo: 'pasarAPersona', motivo: 'QUEJA_ESCRITA_URGENTE' }));
    });
  });

  describe('preguntas frecuentes', () => {
    it('la lista de preguntas tiene las FAQ de siempre', () => {
      const r = ejecutar({ listRowId: 'preguntar' });
      const ids = (r.acciones[0] as any).filas.map((f: any) => f.id);
      expect(ids).toEqual(expect.arrayContaining(['faq_pagos', 'faq_delivery', 'faq_promos', 'faq_lactosa', 'faq_calientes', 'faq_postres']));
    });

    it('medios de pago, delivery y promociones responden desde el local', () => {
      const ctx = contextoBase({ datosLocalPublicos: { mediosPago: {}, pedidoMinimo: 15, envioGratisDesde: 60 } });
      expect(tipos(ejecutar({ listRowId: 'faq_pagos' }, ctx))).toEqual(['enviarBotones']);
      expect(tipos(ejecutar({ listRowId: 'faq_delivery' }, ctx))).toEqual(['enviarBotones']);
      expect(tipos(ejecutar({ listRowId: 'faq_promos' }, ctx))).toEqual(['enviarBotones']);
    });
  });

  describe('texto libre y la IA', () => {
    it('un texto que no es botón responde con el menú, un solo mensaje', () => {
      const r = ejecutar({ texto: 'asdfghjk' }, contextoBase(), { estado: 'MENU', repreguntasFallidas: 0 });
      expect(tipos(r)).toEqual(['enviarLista']);
      expect((r.acciones[0] as any).texto).toContain('Elige una opción del menú');
    });

    it('nunca pide a la IA, aunque esté disponible', () => {
      const r = ejecutar({ texto: 'que clima hace hoy en lima' }, contextoBase({ chatbotIaActivo: true }));
      expect(tipos(r)).not.toContain('consultarIa');
    });
  });

  describe('con una persona atendiendo (ATENCION_PERSONA)', () => {
    const enPersona = { estado: 'ATENCION_PERSONA', repreguntasFallidas: 0 };

    it('chat tomado por una persona: silencio total', () => {
      const r = ejecutar({ texto: 'hola' }, contextoBase({ chatTomado: true }), enPersona);
      expect(r.acciones).toEqual([]);
    });

    it('texto libre sin modo asistido: silencio', () => {
      const r = ejecutar({ texto: 'quiero pedir una torta' }, contextoBase({ modoAsistido: false }), enPersona);
      expect(r.acciones).toEqual([]);
    });

    it('con modo asistido, un botón responde (carta) y conserva el estado de persona', () => {
      const r = ejecutar({ listRowId: 'carta' }, contextoBase({ modoAsistido: true }), enPersona);
      expect(tipos(r)).toEqual(['enviarCarrusel']);
      expect(r.nuevoEstado).toBe('ATENCION_PERSONA');
    });

    it('un saludo sin modo asistido recibe el menú y conserva el estado de persona', () => {
      const r = ejecutar({ texto: 'hola' }, contextoBase({ modoAsistido: false }), enPersona);
      expect(tipos(r)).toEqual(['enviarLista']);
      expect(r.nuevoEstado).toBe('ATENCION_PERSONA');
    });
  });
});
