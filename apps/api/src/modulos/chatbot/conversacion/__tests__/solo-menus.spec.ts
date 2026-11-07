import { generarTokenSeguimiento } from '../../../pedidos/seguimiento.tokens';
import { MODO_SOLO_MENUS, transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
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

describe('Bot con menú (decisión del dueño)', () => {
  it('el motor nuevo está activo', () => {
    expect(MODO_SOLO_MENUS).toBe(true);
  });

  describe('saludo y menú', () => {
    it('el menú tiene 5 opciones: hacer pedido, carta, estado, preguntas frecuentes y persona', () => {
      const r = ejecutar({ texto: 'Hola' });
      expect(tipos(r)).toEqual(['enviarLista']);
      const accion: any = r.acciones[0];
      expect(accion.filas.map((f: any) => f.id)).toEqual(['pedir', 'carta', 'mipedido', 'preguntar', 'persona']);
      expect(accion.filas.map((f: any) => f.titulo)).toEqual([
        'Hacer pedido',
        'Ver la carta',
        'Estado de mi pedido',
        'Preguntas frecuentes',
        'Hablar con una persona',
      ]);
      expect(accion.filas.every((f: any) => f.titulo.length <= 24)).toBe(true);
      expect(r.nuevoEstado).toBe('MENU');
    });

    it('el saludo es corto: una línea que invita a la carta virtual, sin promociones ni puntos', () => {
      const texto: string = (ejecutar({ texto: 'Hola' }).acciones[0] as any).texto;
      expect(texto).toContain('Soy Capri');
      expect(texto.endsWith(`💛 Mira nuestra carta virtual: ${URL_CARTA}`)).toBe(true);
      expect(texto).not.toMatch(/CAPRICHOS DEL MES|promo|puntos|descuento|🎁/i);
    });

    it('el primer contacto (INICIO) con texto sin intención también saluda', () => {
      const r = ejecutar({ texto: 'buenas, qué tal' }, contextoBase(), { estado: 'INICIO', repreguntasFallidas: 0 });
      expect(tipos(r)).toEqual(['enviarLista']);
    });

    it('un texto que no es botón responde con el menú, en un solo mensaje', () => {
      const r = ejecutar({ texto: 'asdfghjk' }, contextoBase(), { estado: 'MENU', repreguntasFallidas: 0 });
      expect(tipos(r)).toEqual(['enviarLista']);
      expect((r.acciones[0] as any).texto).toContain('Elige una opción del menú');
    });
  });

  describe('hacer pedido por chat (flujo de pedido del motor anterior)', () => {
    it('«Hacer pedido» abre el pedido: primero la modalidad, en un solo mensaje', () => {
      const r = ejecutar({ listRowId: 'pedir' });
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect(r.nuevoEstado).toBe('PEDIDO_MODALIDAD');
      expect(r.nuevoFlujo.pedido?.estadoInterno).toBe('PEDIDO_MODALIDAD');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toEqual(['ped_mod_delivery', 'ped_mod_recojer']);
    });

    it('el texto «quiero pedir» también abre el pedido', () => {
      const r = ejecutar({ texto: 'quiero pedir' });
      expect(r.nuevoEstado).toBe('PEDIDO_MODALIDAD');
    });

    it('a mitad de un pedido, la respuesta sigue en el pedido y no vuelve al menú', () => {
      const flujo: any = {
        estado: 'PEDIDO_MODALIDAD',
        repreguntasFallidas: 0,
        pedido: { estadoInterno: 'PEDIDO_MODALIDAD', items: [] },
      };
      const r = ejecutar({ buttonPayload: 'ped_mod_recojer' }, contextoBase(), flujo);
      expect(r.nuevoEstado).not.toBe('MENU');
      expect(r.nuevoEstado.startsWith('PEDIDO_')).toBe(true);
    });

    it('«Pedir este» de la carta abre el pedido de ese producto', () => {
      const r = ejecutar({ buttonPayload: 'ped_prod_2', texto: 'Pedir este' });
      expect(r.nuevoEstado.startsWith('PEDIDO_')).toBe(true);
      expect(JSON.stringify(r.acciones)).not.toMatch(/crearPedido/);
    });

    it('un pedido en curso no se convierte en la carta ni en el menú por texto de preguntas', () => {
      const flujo: any = { estado: 'PEDIDO_CATEGORIAS', repreguntasFallidas: 0, pedido: { estadoInterno: 'PEDIDO_CATEGORIAS', items: [] } };
      const r = ejecutar({ texto: 'ver la carta' }, contextoBase(), flujo);
      expect(r.nuevoEstado.startsWith('PEDIDO_')).toBe(true);
    });

    it('nunca menciona promociones, descuentos, cupones ni puntos en el flujo de pedido', () => {
      const r = ejecutar({ listRowId: 'pedir' }, contextoBase({ ofertas: [{ id: 'o1', nombre: '2x1', tipo: 'LLEVA_PAGA', lleva: 2, paga: 1, activo: true } as any] }));
      expect(JSON.stringify(r.acciones)).not.toMatch(/promo|descuento|cup[oó]n|ahorr|puntos|oferta/i);
    });
  });

  describe('Ver la carta', () => {
    it('envía un carrusel con los productos más vendidos (sin agotados), con «Pedir este» en cada tarjeta', () => {
      const r = ejecutar({ listRowId: 'carta' });
      expect(tipos(r)).toEqual(['enviarCarrusel']);
      const carga = (r.acciones[0] as any).carga;
      expect(carga.cuerpo).toContain(URL_CARTA);
      expect(carga.tarjetas.map((t: any) => t.nombre)).toEqual(['Frappe Fresa', 'Waffle Nutella', 'Frappe Maracuyá']);
      expect(carga.tarjetas.every((t: any) => t.boton.id.startsWith('ped_prod_') && t.boton.titulo === 'Pedir este')).toBe(true);
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
  });

  describe('estado de mi pedido', () => {
    it('con pedido activo informa el estado con el enlace de seguimiento firmado de ese pedido', () => {
      const r = ejecutar({ listRowId: 'mipedido' }, contextoBase({ pedidoActivo: { id: 7n, codigo: 'CP-0110', estado: 'COCINA', pago_estado: 'PAGADO' } }));
      expect(tipos(r)).toEqual(['enviarBotones']);
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('CP-0110');
      expect(texto).toContain('COCINA');
      expect(texto).toContain(`${URL_CARTA}/?seguimiento=CP-0110&t=${generarTokenSeguimiento(7n)}`);
    });

    it('sin pedido activo lo dice y ofrece hacer pedido', () => {
      const r = ejecutar({ listRowId: 'mipedido' }, contextoBase({ pedidoActivo: null }));
      expect((r.acciones[0] as any).texto).toContain('No tienes un pedido activo');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toContain('pedir');
    });
  });

  describe('preguntas frecuentes', () => {
    it('la lista tiene una sola fila de horario y ubicación, sin promociones', () => {
      const r = ejecutar({ listRowId: 'preguntar' });
      const ids = (r.acciones[0] as any).filas.map((f: any) => f.id);
      expect(ids.filter((id: string) => id === 'faq_horario')).toHaveLength(1);
      expect(ids).not.toEqual(expect.arrayContaining(['faq_ubicacion', 'faq_promos']));
      expect(ids).toEqual(expect.arrayContaining(['faq_pagos', 'faq_delivery', 'faq_lactosa', 'faq_calientes', 'faq_postres']));
      expect((r.acciones[0] as any).filas.every((f: any) => f.titulo.length <= 24)).toBe(true);
    });

    it('horario y ubicación se responden juntos desde la FAQ unificada', () => {
      const r = ejecutar({ listRowId: 'faq_horario' });
      expect(tipos(r)).toEqual(['enviarBotones']);
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('Av. Principal 123');
      expect(texto).toContain('https://maps.test');
    });

    it('preguntar por el horario por texto da la misma respuesta', () => {
      const r = ejecutar({ texto: 'a qué hora abren' });
      expect((r.acciones[0] as any).texto).toContain('Av. Principal 123');
    });

    it('medios de pago y delivery responden desde el local', () => {
      const ctx = contextoBase({ datosLocalPublicos: { mediosPago: {}, pedidoMinimo: 15, envioGratisDesde: 60 } });
      expect(tipos(ejecutar({ listRowId: 'faq_pagos' }, ctx))).toEqual(['enviarBotones']);
      expect(tipos(ejecutar({ listRowId: 'faq_delivery' }, ctx))).toEqual(['enviarBotones']);
    });

    it('«promociones» por texto responde con las promociones por canal (pedido del dueño 07/11)', () => {
      const r = ejecutar({ texto: 'hay promociones hoy' });
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect(JSON.stringify(r.acciones)).toContain('no tenemos promociones activas');
    });
  });

  describe('reservas, cambios y personas', () => {
    it('reservar mesa: llama al local o habla con una persona, sin reservar por chat', () => {
      const r = ejecutar({ texto: 'quiero reservar una mesa' });
      const texto = (r.acciones[0] as any).texto as string;
      expect(texto).toContain('999888777');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toContain('btn_persona');
      expect(tipos(r)).not.toContain('crearSolicitudReserva');
    });

    it('puntos no se atienden en el bot: cae al menú, sin enlace de puntos', () => {
      const r = ejecutar({ texto: 'cuantos puntos tengo' });
      expect(tipos(r)).toEqual(['enviarLista']);
      expect(JSON.stringify(r.acciones)).not.toContain('puntos=1');
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

  describe('IA', () => {
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

  describe('mensajes cortos', () => {
    it('ninguna respuesta del menú repite el enlace de la carta en cada mensaje', () => {
      const respuestas = [
        ejecutar({ listRowId: 'mipedido' }, contextoBase({ pedidoActivo: null })),
        ejecutar({ listRowId: 'preguntar' }),
        ejecutar({ texto: 'asdfghjk' }, contextoBase(), { estado: 'MENU', repreguntasFallidas: 0 }),
      ];
      for (const r of respuestas) {
        const veces = JSON.stringify(r.acciones).split(URL_CARTA).length - 1;
        expect(veces).toBeLessThanOrEqual(1);
      }
    });
  });
});
