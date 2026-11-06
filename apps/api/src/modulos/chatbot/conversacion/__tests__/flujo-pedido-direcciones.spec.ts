import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { AccionMensaje, ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { BOTON_VOLVER_MENU, BOTONES_PEDIDO_UBICACION, BOTONES_PEDIDO_UBICACION_FALLIDA, TEXTOS_BOT } from '../textos-bot';

/** Punto que el cliente mandó en el caso reportado (WhatsApp, «Enviar mi ubicación actual»). */
const UBICACION_REPORTADA = { latitud: -12.018591, longitud: -76.957939 };

const TEXTO_PEDIR_UBICACION =
  '¿Dónde te lo llevamos? 📍 Envíanos tu ubicación actual: toca el clip 📎 > Ubicación > Enviar mi ubicación actual.';

const COBERTURA = {
  resultadoEnvio: { cubierto: true, tarifa: 5, gratisDesde: 70, zona: { id: 3, nombre: 'San Juan' } },
  vistaPreviaPedido: { subtotal: 20, descuento: 0, descuentoNombre: null, envio: 5, envioGratis: false },
} as const;

describe('Flujo de Pedido: delivery pide solo la ubicación actual', () => {
  const categoriaHamburguesas = {
    id: 'cat_hamb',
    nombre: 'Hamburguesas',
    descripcion: 'Las mejores hamburguesas a la parrilla',
    productos: [
      {
        id: 'prod_clasica',
        nombre: 'Hamburguesa Clásica',
        precio: 20.0,
        disponible: true,
        oculto: false,
        no_suma_beneficios: false,
        categoria_id: 'cat_hamb',
        tamanos: [{ id: 'tam_simple', nombre: 'Simple', precio: 20.0 }],
        grupos: [
          {
            id: 'grp_salsas',
            nombre: 'Elige tus salsas',
            minimo: 1,
            maximo: 1,
            obligatorio: true,
            opciones: [
              { id: 'op_mayo', nombre: 'Mayonesa', precio_extra: 0.0, disponible: true },
              { id: 'op_tartara', nombre: 'Tártara', precio_extra: 0.0, disponible: true },
            ],
          },
        ],
      },
    ],
  };

  const contextoBase: ContextoConversacion = {
    nombreCliente: 'Ana',
    telefonoCliente: '987654321',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: '', telefono: '999888777' } as any,
    categoriasCarta: [categoriaHamburguesas],
    ofertas: [],
  };

  const ctxConCobertura: ContextoConversacion = { ...contextoBase, ...COBERTURA } as ContextoConversacion;
  const ubicacionEntrada = () => normalizarEntrada({ tipo: 'location', ubicacion: UBICACION_REPORTADA });

  /** Pedido recién iniciado: elige modalidad. */
  function alPedir(contexto: ContextoConversacion = contextoBase): FlujoConversacion {
    return transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), contexto).nuevoFlujo as FlujoConversacion;
  }

  /** Lleva el flujo hasta «¿Dónde te lo llevamos?» (modalidad delivery). */
  function llegarAlPasoDelivery(contexto: ContextoConversacion = contextoBase): FlujoConversacion {
    const r = transicionarEstado(alPedir(contexto), normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contexto);
    return r.nuevoFlujo as FlujoConversacion;
  }

  /** Suma los mensajes (acciones) de cada respuesta, desde el tap de Delivery hasta llegar a categorías. */
  function contarMensajes(pasos: Array<{ entrada: any; ctx: ContextoConversacion }>): number {
    let total = 0;
    let actual = alPedir();
    for (const paso of pasos) {
      const r = transicionarEstado(actual, normalizarEntrada(paso.entrada), paso.ctx);
      total += r.acciones.length;
      actual = r.nuevoFlujo as FlujoConversacion;
    }
    expect(actual.estado).toBe('PEDIDO_CATEGORIAS');
    return total;
  }

  it('pide la ubicación en un solo mensaje, con la instrucción del clip y solo el botón de menú', () => {
    const r = transicionarEstado(alPedir(), normalizarEntrada({ buttonPayload: 'ped_mod_delivery' }), contextoBase);

    expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
    expect(r.acciones).toEqual([{ tipo: 'enviarBotones', texto: TEXTO_PEDIR_UBICACION, botones: [BOTON_VOLVER_MENU] }]);
    expect(BOTONES_PEDIDO_UBICACION).toEqual([BOTON_VOLVER_MENU]);
  });

  it('texto libre repite la misma instrucción en un solo mensaje y no lo toma como dirección', () => {
    const r = transicionarEstado(llegarAlPasoDelivery(), normalizarEntrada({ texto: 'Av. Las Palmeras 123, San Juan' }), contextoBase);

    expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
    expect(r.acciones).toHaveLength(1);
    expect(r.acciones[0]).toEqual({ tipo: 'enviarBotones', texto: TEXTO_PEDIR_UBICACION, botones: [BOTON_VOLVER_MENU] });
    expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
  });

  it('un botón o una lista de versiones anteriores repite la instrucción, sin cargar nada', () => {
    for (const entrada of [
      { buttonPayload: 'ped_loc_escribir' },
      { buttonPayload: 'ped_loc_share' },
      { listRowId: 'ped_dir_7' },
      { listRowId: 'ped_dir_nueva' },
    ]) {
      const r = transicionarEstado(llegarAlPasoDelivery(), normalizarEntrada(entrada), contextoBase);
      expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
      expect(r.acciones).toEqual([{ tipo: 'enviarBotones', texto: TEXTO_PEDIR_UBICACION, botones: [BOTON_VOLVER_MENU] }]);
      expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
    }
  });

  it('ubicación en el paso de espera: zona, tarifa y categorías en un solo mensaje', () => {
    const r = transicionarEstado(llegarAlPasoDelivery(), ubicacionEntrada(), ctxConCobertura);

    expect(r.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
    expect(r.acciones).toHaveLength(1);
    expect(r.acciones[0]).toMatchObject({
      tipo: 'enviarLista',
      texto: '¡Listo, te encontramos! El envío a tu ubicación cuesta S/ 5.00. Elige una categoría:',
    });
    expect((r.nuevoFlujo as any).pedido.entrega).toMatchObject({
      modalidad: 'DELIVERY',
      lat: -12.018591,
      lng: -76.957939,
      origen: 'WHATSAPP',
      zonaId: '3',
      zonaNombre: 'San Juan',
      tarifaEnvio: 5,
    });
    expect((r.nuevoFlujo as any).pedido.entrega.referencia).toBeUndefined();
  });

  it('reproduce el caso reportado: la ubicación llega en el estado donde antes se atascó y avanza a categorías', () => {
    const atascado: FlujoConversacion = {
      ...llegarAlPasoDelivery(),
      estado: 'PEDIDO_DIRECCION_ELEGIR' as any,
      pedido: { ...llegarAlPasoDelivery().pedido, estadoInterno: 'PEDIDO_DIRECCION_ELEGIR' } as any,
    };

    const r = transicionarEstado(atascado, ubicacionEntrada(), ctxConCobertura);

    expect(r.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
    expect(r.acciones[0].tipo === 'enviarLista' && r.acciones[0].texto).toContain('Elige una categoría:');
    expect((r.nuevoFlujo as any).pedido.entrega).toMatchObject({ lat: -12.018591, lng: -76.957939, zonaId: '3' });
  });

  it('ubicación fuera de cobertura: avisa y ofrece recoger o enviar otra ubicación', () => {
    const ctxFuera = { ...contextoBase, resultadoEnvio: { cubierto: false, tarifa: null } } as ContextoConversacion;
    const r = transicionarEstado(llegarAlPasoDelivery(), ubicacionEntrada(), ctxFuera);

    expect(r.nuevoEstado).toBe('PEDIDO_UBICACION');
    expect(r.acciones[0]).toMatchObject({ tipo: 'enviarBotones', botones: BOTONES_PEDIDO_UBICACION_FALLIDA });
    expect(r.acciones[0].tipo === 'enviarBotones' && r.acciones[0].texto).toContain('fuera de nuestra zona de reparto');
    expect((r.nuevoFlujo as any).pedido.entrega).toBeUndefined();
  });

  it('el pedido creado lleva las coordenadas y la zona hasta el servidor', () => {
    const pasos: Array<{ entrada: any; ctx: ContextoConversacion }> = [
      { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx: contextoBase },
      { entrada: { tipo: 'location', ubicacion: UBICACION_REPORTADA }, ctx: ctxConCobertura },
      { entrada: { listRowId: 'ped_cat_cat_hamb' }, ctx: ctxConCobertura },
      { entrada: { listRowId: 'ped_prod_prod_clasica' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_tam_tam_simple' }, ctx: ctxConCobertura },
      { entrada: { listRowId: 'ped_op_op_tartara' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_cant_1' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_cart_continuar' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_nombre_si' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_tel_mismo' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_pago_efectivo' }, ctx: ctxConCobertura },
      { entrada: { texto: '50' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_comp_boleta' }, ctx: ctxConCobertura },
      { entrada: { texto: '12345678', textoOriginal: '12345678' }, ctx: ctxConCobertura },
      { entrada: { buttonPayload: 'ped_confirmar_si' }, ctx: ctxConCobertura },
    ];
    let flujo: FlujoConversacion = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), contextoBase).nuevoFlujo as FlujoConversacion;
    let ultima: ReturnType<typeof transicionarEstado> | null = null;
    for (const paso of pasos) {
      ultima = transicionarEstado(flujo, normalizarEntrada(paso.entrada), paso.ctx);
      flujo = ultima.nuevoFlujo as FlujoConversacion;
    }

    const crear = ultima!.acciones.find((a) => a.tipo === 'crearPedido');
    expect(crear).toBeDefined();
    expect(crear && crear.tipo === 'crearPedido' && crear.dto).toMatchObject({
      modalidad: 'DELIVERY',
      entrega: { lat: -12.018591, lng: -76.957939, origen: 'WHATSAPP' },
    });
  });

  describe('mensajes del bot desde «Delivery» hasta «Elige una categoría»', () => {
    it('antes: 4 mensajes (instrucción con dos botones, clip, «localizada» y referencia). Ahora: 2', () => {
      const ahora = contarMensajes([
        { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx: contextoBase }, // 1: pide la ubicación
        { entrada: { tipo: 'location', ubicacion: UBICACION_REPORTADA }, ctx: ctxConCobertura }, // 2: envío + categorías
      ]);
      expect(ahora).toBe(2);
    });

    it('texto libre antes de la ubicación repite la instrucción: 3 mensajes', () => {
      const total = contarMensajes([
        { entrada: { buttonPayload: 'ped_mod_delivery' }, ctx: contextoBase }, // 1: pide la ubicación
        { entrada: { texto: 'Chosica Km 35' }, ctx: contextoBase }, // 2: repite la instrucción
        { entrada: { tipo: 'location', ubicacion: UBICACION_REPORTADA }, ctx: ctxConCobertura }, // 3: categorías
      ]);
      expect(total).toBe(3);
    });
  });

  it('ninguna respuesta del paso de delivery menciona direcciones anteriores, «Otra dirección» ni «Escribir dirección»', () => {
    const respuestas: AccionMensaje[] = [];
    const flujoDelivery = llegarAlPasoDelivery();
    const pasos: Array<{ flujo: FlujoConversacion; entrada: any; ctx: ContextoConversacion }> = [
      { flujo: flujoDelivery, entrada: { buttonPayload: 'ped_mod_delivery' }, ctx: contextoBase },
      { flujo: flujoDelivery, entrada: { texto: 'hola' }, ctx: contextoBase },
      { flujo: flujoDelivery, entrada: { buttonPayload: 'ped_loc_escribir' }, ctx: contextoBase },
      { flujo: flujoDelivery, entrada: { tipo: 'location', ubicacion: UBICACION_REPORTADA }, ctx: ctxConCobertura },
      { flujo: flujoDelivery, entrada: { tipo: 'location', ubicacion: UBICACION_REPORTADA }, ctx: { ...contextoBase, resultadoEnvio: { cubierto: false, tarifa: null } } as ContextoConversacion },
    ];
    for (const p of pasos) {
      respuestas.push(...transicionarEstado(p.flujo, normalizarEntrada(p.entrada), p.ctx).acciones);
    }
    const textos = JSON.stringify(respuestas);
    expect(textos).not.toMatch(/dirección anterior|direcciones anteriores|Otra dirección|Escribir dirección|Elige una dirección/i);
    expect(textos).not.toMatch(/Punto marcado|zona \d|-\d+\.\d+/);
  });

  it('los textos de ubicación no mencionan direcciones anteriores ni escribir dirección', () => {
    const textos = [
      TEXTOS_BOT.pedidoPedirUbicacion(),
      TEXTOS_BOT.pedidoFueraDeCobertura(),
      TEXTOS_BOT.pedidoUbicacionExitosa(5, false),
      TEXTOS_BOT.pedidoUbicacionExitosa(null, false),
    ].join('\n');
    expect(textos).not.toMatch(/anterior|Otra dirección|Escribir dirección|referencia para el repartidor/i);
  });
});
