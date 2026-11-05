import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

describe('Flujo de Pedido por WhatsApp (Ola 2, Agente C - FT-BOT-01)', () => {
  const categoriaHamburguesas = {
    id: 'cat_hamb',
    nombre: 'Hamburguesas',
    descripcion: 'Las mejores hamburguesas a la parrilla',
    productos: [
      {
        id: 'prod_clasica',
        nombre: 'Hamburguesa Clásica',
        descripcion: 'Carne 150g con lechuga y tomate',
        precio: 20.0,
        disponible: true,
        oculto: false,
        no_suma_beneficios: false,
        categoria_id: 'cat_hamb',
        tamanos: [
          { id: 'tam_simple', nombre: 'Simple', precio: 20.0 },
          { id: 'tam_doble', nombre: 'Doble', precio: 26.0 },
        ],
        grupos: [
          {
            id: 'grp_salsas',
            nombre: 'Elige tus salsas',
            minimo: 1,
            maximo: 2,
            obligatorio: true,
            opciones: [
              { id: 'op_mayo', nombre: 'Mayonesa', precio_extra: 0.0, disponible: true },
              { id: 'op_tartara', nombre: 'Tártara', precio_extra: 0.0, disponible: true },
            ],
          },
        ],
      },
      {
        id: 'prod_agotado',
        nombre: 'Hamburguesa Royal',
        descripcion: 'Con huevo y queso',
        precio: 25.0,
        disponible: false,
        oculto: false,
        categoria_id: 'cat_hamb',
      },
    ],
  };

  const categoriaVacia = {
    id: 'cat_vacia',
    nombre: 'Bebidas Calientes',
    descripcion: 'Cafetería de especialidad',
    productos: [
      {
        id: 'prod_cafe',
        nombre: 'Café Espresso',
        precio: 8.0,
        disponible: false,
      },
    ],
  };

  const categoriaCombos = {
    id: 'cat_combos',
    nombre: 'Arma tu Combo',
    descripcion: 'Combos para compartir',
    productos: [
      {
        id: 'prod_combo_duo',
        nombre: 'Combo Dúo',
        precio: 45.0,
        disponible: true,
        categoria_id: 'cat_combos',
        grupos: [
          {
            id: 'grp_combo_hamb',
            nombre: 'Elige tu Hamburguesa',
            minimo: 1,
            maximo: 1,
            obligatorio: true,
            opciones: [
              { id: 'op_hamb_a', nombre: 'Clásica', precio_extra: 0.0, disponible: true },
              { id: 'op_hamb_b', nombre: 'BBQ', precio_extra: 2.0, disponible: true },
            ],
          },
        ],
      },
    ],
  };

  const contextoBase: ContextoConversacion = {
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: {
      abierta: true,
      abre: '12:00',
      cierra: '23:00',
      direccion: 'Campoy, San Juan de Lurigancho',
      enlaceMapa: 'https://maps.google.com',
      telefono: '999888777',
      pausaAltaDemanda: false,
      altaDemandaMinutosExtra: 0,
    },
    datosLocalPublicos: {
      tiempo_base: 25,
      tiempo_maximo: 35,
      mediosPagoVisibles: {
        yape: { activo: true, numero: '999 888 777', titular: 'Caprichos' },
        pos: { activo: true },
        efectivo: { activo: true },
      },
    },
    categoriasCarta: [categoriaHamburguesas, categoriaVacia, categoriaCombos],
    ofertas: [],
  };

  describe('1. Recorrido feliz: Pedido para Recojo', () => {
    it('completa el flujo desde la selección de modalidad hasta el checkout con pago efectivo', () => {
      // 1. Iniciar pedido
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);
      expect(resultado.nuevoEstado).toBe('PEDIDO_MODALIDAD');

      // 2. Elegir modalidad Recojo
      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_recojer' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      expect(resultado.acciones.some((a) => a.tipo === 'enviarLista')).toBe(true);

      // 3. Elegir Categoría Hamburguesas
      entrada = normalizarEntrada({ listRowId: 'ped_cat_cat_hamb' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.nuevoEstado).toBe('PEDIDO_PRODUCTOS');

      // 4. Elegir Producto Clásica
      entrada = normalizarEntrada({ listRowId: 'ped_prod_prod_clasica' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      // El producto tiene tamaños: pregunta tamaño
      expect(resultado.nuevoEstado).toBe('PEDIDO_TAMANO');

      // 5. Elegir Tamaño Simple
      entrada = normalizarEntrada({ buttonPayload: 'ped_tam_tam_simple' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      // Pasa al primer grupo obligatorio: salsas
      expect(resultado.nuevoEstado).toBe('PEDIDO_GRUPO_OPCION');

      // 6. Elegir Salsa Tártara
      entrada = normalizarEntrada({ listRowId: 'ped_op_op_tartara' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 7. Pregunta cantidad
      expect(resultado.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      entrada = normalizarEntrada({ buttonPayload: 'ped_cant_2' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 8. Producto agregado -> Carrito
      expect(resultado.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
      expect(resultado.nuevoFlujo.pedido?.items?.length).toBe(1);
      expect(resultado.nuevoFlujo.pedido?.items[0].cantidad).toBe(2);

      // 9. Continuar al checkout
      entrada = normalizarEntrada({ buttonPayload: 'ped_cart_continuar' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 10. Sin pregunta de cupón: pasa directo a confirmar el nombre del cliente (sugerido por perfil)
      expect(resultado.nuevoEstado).toBe('PEDIDO_CONFIRMAR_NOMBRE');
      entrada = normalizarEntrada({ buttonPayload: 'ped_nombre_si' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 12. Teléfono del chat: se ofrece usarlo -> Elegir Medio de Pago
      expect(resultado.nuevoEstado).toBe('PEDIDO_INGRESAR_TELEFONO');
      entrada = normalizarEntrada({ buttonPayload: 'ped_tel_mismo' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.nuevoFlujo.pedido?.cliente?.telefono).toBe('987654321');
      expect(resultado.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
      entrada = normalizarEntrada({ buttonPayload: 'ped_pago_efectivo' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 13. Paga con efectivo -> monto
      expect(resultado.nuevoEstado).toBe('PEDIDO_MONTO_EFECTIVO');
      entrada = normalizarEntrada({ texto: '50' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 14. Comprobante
      expect(resultado.nuevoEstado).toBe('PEDIDO_COMPROBANTE_TIPO');
      entrada = normalizarEntrada({ buttonPayload: 'ped_comp_boleta' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.nuevoEstado).toBe('PEDIDO_COMPROBANTE_DNI');
      entrada = normalizarEntrada({ texto: '12345678', textoOriginal: '12345678' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // 15. Resumen final con botones Confirmar o Cambiar
      expect(resultado.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');

      // 16. Confirmar Pedido -> Despacha crearPedido transaccional
      entrada = normalizarEntrada({ buttonPayload: 'ped_confirmar_si' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.acciones.some((a) => a.tipo === 'crearPedido')).toBe(true);
      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.pedido).toBeNull();
    });
  });

  describe('2. Recorrido feliz: Pedido para Delivery con ubicación WhatsApp', () => {
    it('procesa el flujo de delivery con coordenadas y calcula tarifa de envío', () => {
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);

      // 1. Elegir Delivery
      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_delivery' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.nuevoEstado).toBe('PEDIDO_UBICACION');

      // 2. Cliente comparte ubicación por WhatsApp
      // La vista previa del servidor (zona + promo de envío con casilla BOT) fija el envío: 5.00 sin promo
      const contextoConEnvio: ContextoConversacion = {
        ...contextoBase,
        resultadoEnvio: {
          cubierto: true,
          tarifa: 5.0,
          gratisDesde: 70.0,
        },
        vistaPreviaPedido: { subtotal: 40, descuento: 0, descuentoNombre: null, envio: 5.0, envioGratis: false },
      };

      entrada = normalizarEntrada({
        tipo: 'location',
        ubicacion: {
          latitud: -12.0196,
          longitud: -76.9632,
          nombre: 'Mi Casa',
          direccion: 'Av. Gran Chimú 500',
        },
      });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoConEnvio);

      // La ubicación pasa directo a categorías (sin paso de referencia)
      expect(resultado.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      expect(resultado.nuevoFlujo.pedido?.entrega?.modalidad).toBe('DELIVERY');
      expect(resultado.nuevoFlujo.pedido?.entrega?.tarifaEnvio).toBe(5.0);
    });
  });

  describe('3. Producto agotado y alternativas', () => {
    it('si el producto está agotado, avisa y ofrece volver a la categoría con alternativas', () => {
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);

      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_recojer' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ listRowId: 'ped_cat_cat_hamb' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // Elegir producto agotado
      entrada = normalizarEntrada({ listRowId: 'ped_prod_prod_agotado' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // Vuelve a listar productos o muestra mensaje de agotado con alternativas
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Por ahora no hay stock');
      }
    });
  });

  describe('4. Categoría sin disponibles', () => {
    it('si una categoría no tiene productos disponibles, avisa y ofrece ver otras categorías', () => {
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);

      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_recojer' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ listRowId: 'ped_cat_cat_vacia' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('no tenemos productos disponibles');
      }
    });
  });

  describe('5. Combo con grupos y selección paso a paso', () => {
    it('navega ordenadamente por los grupos obligatorios de un combo (Arma tu combo)', () => {
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);

      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_recojer' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ listRowId: 'ped_cat_cat_combos' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ listRowId: 'ped_prod_prod_combo_duo' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // Primer grupo del combo
      expect(resultado.nuevoEstado).toBe('PEDIDO_GRUPO_OPCION');
      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].texto).toContain('Elige tu Hamburguesa');
      }
    });
  });

  describe('6. Opción obligatoria faltante', () => {
    it('si el cliente intenta omitir una opción obligatoria, le recuerda la regla', () => {
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);

      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_recojer' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ listRowId: 'ped_cat_cat_hamb' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ listRowId: 'ped_prod_prod_clasica' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      entrada = normalizarEntrada({ buttonPayload: 'ped_tam_tam_simple' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      // Intenta enviar 'ninguno' a un grupo obligatorio
      entrada = normalizarEntrada({ buttonPayload: 'ped_op_ninguno' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_GRUPO_OPCION');
      expect(resultado.acciones[0].tipo).toBe('enviarTexto');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('es obligatorio');
      }
    });
  });

  describe('8. Zona fuera de cobertura y opción de recoger', () => {
    it('notifica con claridad si la ubicación está fuera de cobertura y ofrece recoger en local', () => {
      let entrada = normalizarEntrada({ listRowId: 'pedir' });
      let resultado = transicionarEstado(null, entrada, contextoBase);

      // Elegir Delivery
      entrada = normalizarEntrada({ buttonPayload: 'ped_mod_delivery' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);
      expect(resultado.nuevoEstado).toBe('PEDIDO_UBICACION');

      // Ubicación fuera de rango (solo la ubicación actual cuenta; el texto libre repite la instrucción)
      const contextoFueraCobertura: ContextoConversacion = {
        ...contextoBase,
        resultadoEnvio: { cubierto: false, tarifa: null },
      };
      entrada = normalizarEntrada({ tipo: 'location', ubicacion: { latitud: -11.9, longitud: -76.7 } });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoFueraCobertura);

      expect(resultado.nuevoEstado).toBe('PEDIDO_UBICACION');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('fuera de nuestra zona de reparto');
        expect(resultado.acciones[0].botones.some((b) => b.id === 'ped_mod_recojer')).toBe(true);
      }
    });
  });

  describe('9. Local cerrado y pausa por alta demanda', () => {
    it('si el local está cerrado, no permite pedir y muestra mensaje informativo con próximo horario', () => {
      const contextoCerrado: ContextoConversacion = {
        ...contextoBase,
        datosLocal: {
          ...contextoBase.datosLocal!,
          abierta: false,
          abre: '18:00',
        },
      };

      const entrada = normalizarEntrada({ listRowId: 'pedir' });
      const resultado = transicionarEstado(null, entrada, contextoCerrado);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('cerrados');
      }
    });

    it('si el local está en pausa por alta demanda, notifica el tiempo extra y el motivo', () => {
      const contextoPausa: ContextoConversacion = {
        ...contextoBase,
        datosLocal: {
          ...contextoBase.datosLocal!,
          pausaAltaDemanda: true,
          motivoPausa: 'Muchos pedidos en cola',
          altaDemandaMinutosExtra: 20,
        },
      };

      const entrada = normalizarEntrada({ listRowId: 'pedir' });
      const resultado = transicionarEstado(null, entrada, contextoPausa);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('pausa');
      }
    });
  });

  describe('10. Contacto sin teléfono (BSUID) y validación de 9 dígitos', () => {
    const flujoEsperandoTelefono: FlujoConversacion = {
      version: 1,
      estado: 'PEDIDO_INGRESAR_TELEFONO',
      repreguntasFallidas: 0,
      pedido: {
        estadoInterno: 'PEDIDO_INGRESAR_TELEFONO',
        modalidad: 'RECOGER',
        cliente: { nombre: 'Cliente Meta' },
        items: [
          {
            lineaId: 'lin_1',
            productoId: 'prod_clasica',
            productoNombre: 'Hamburguesa Clásica',
            categoriaId: 'cat_hamb',
            categoriaNombre: 'Hamburguesas',
            cantidad: 1,
            precioUnitario: 20.0,
            subtotal: 20.0,
            opciones: [],
            noSumaBeneficios: false,
          },
        ],
      },
    };

    it('si el cliente ingresa un número inválido, repregunta amablemente sin avanzar', () => {
      const entrada = normalizarEntrada({ texto: '12345' });
      const resultado = transicionarEstado(flujoEsperandoTelefono, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_INGRESAR_TELEFONO');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('9 dígitos');
      }
    });

    it('si el cliente ingresa un número de 9 dígitos que empieza con 9, lo acepta y avanza a medio de pago', () => {
      const entrada = normalizarEntrada({ texto: '912345678' });
      const resultado = transicionarEstado(flujoEsperandoTelefono, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
      expect(resultado.nuevoFlujo.pedido?.cliente?.telefono).toBe('912345678');
    });
  });

  describe('11. Cancelar pedido en cualquier punto', () => {
    it('pregunta confirmación con botones Sí/No y si confirma descarta el carrito', () => {
      const flujoActivo: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_CATEGORIAS',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_CATEGORIAS',
          modalidad: 'DELIVERY',
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 20.0,
              subtotal: 20.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      // Solicita cancelar
      let entrada = normalizarEntrada({ buttonPayload: 'ped_cancelar' });
      let resultado = transicionarEstado(flujoActivo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_CANCELAR_CONFIRMAR');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('cancelar tu pedido');
      }

      // Confirma Sí
      entrada = normalizarEntrada({ buttonPayload: 'ped_cancelar_si' });
      resultado = transicionarEstado(resultado.nuevoFlujo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.pedido).toBeNull();
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('cancelado y el carrito fue descartado');
      }
    });

    it('si elige No en la confirmación de cancelación, regresa al estado previo sin perder nada', () => {
      const flujoActivo: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_CANCELAR_CONFIRMAR',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_CANCELAR_CONFIRMAR',
          estadoPrevioCancelacion: 'PEDIDO_CATEGORIAS',
          modalidad: 'DELIVERY',
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 20.0,
              subtotal: 20.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const entrada = normalizarEntrada({ buttonPayload: 'ped_cancelar_no' });
      const resultado = transicionarEstado(flujoActivo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_CATEGORIAS');
      expect(resultado.nuevoFlujo.pedido?.items?.length).toBe(1);
    });
  });

  describe('12. Expiración por inactividad (30 minutos)', () => {
    it('al volver a escribir tras 30 minutos sin respuesta, descarta el carrito y avisa al cliente', () => {
      const flujoInactivo: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_CATEGORIAS',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_CATEGORIAS',
          modalidad: 'DELIVERY',
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 20.0,
              subtotal: 20.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const contextoExpirado: ContextoConversacion = {
        ...contextoBase,
        minutosInactividad: 35,
        inactividadExpirada: true,
      };

      const entrada = normalizarEntrada({ texto: 'hola' });
      const resultado = transicionarEstado(flujoInactivo, entrada, contextoExpirado);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.pedido).toBeNull();
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('expiró por inactividad');
      }
    });
  });

  describe('13. Seguridad: Id de botón manipulado o desfasado', () => {
    it('si recibe un id interactivo que no corresponde al estado actual, no modifica el carrito', () => {
      const flujoEnCategorias: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_CATEGORIAS',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_CATEGORIAS',
          modalidad: 'RECOGER',
          items: [],
        },
      };

      // Cliente envía un botón de confirmar checkout cuando aún está en categorías
      const entrada = normalizarEntrada({ buttonPayload: 'ped_confirmar_si' });
      const resultado = transicionarEstado(flujoEnCategorias, entrada, contextoBase);

      // No debe despachar crearPedido
      expect(resultado.acciones.some((a) => a.tipo === 'crearPedido')).toBe(false);
    });
  });

  describe('14. Falla de servicio y pase a persona honesto', () => {
    it('si hay un error de base de datos o servicio, pasa a atención persona preservando el carrito', () => {
      const flujoEnProgreso: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_CATEGORIAS',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_CATEGORIAS',
          modalidad: 'DELIVERY',
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 20.0,
              subtotal: 20.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const contextoConFallo: ContextoConversacion = {
        ...contextoBase,
        errorServicio: true,
      };

      const entrada = normalizarEntrada({ texto: 'quiero continuar' });
      const resultado = transicionarEstado(flujoEnProgreso, entrada, contextoConFallo);

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones.some((a) => a.tipo === 'pasarAPersona')).toBe(true);
      // El carrito no se destruye
      expect(resultado.nuevoFlujo.pedido?.items?.length).toBe(1);
    });
  });

  describe('15. Validación de pedido mínimo para Delivery', () => {
    it('si el subtotal no alcanza el pedido mínimo configurado, solicita agregar más productos u optar por recojo', () => {
      const flujoBajoMinimo: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_ACCION_CARRITO',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_ACCION_CARRITO',
          modalidad: 'DELIVERY',
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 10.0,
              subtotal: 10.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const contextoMinimo: ContextoConversacion = {
        ...contextoBase,
        datosLocalPublicos: {
          ...contextoBase.datosLocalPublicos,
          pedidoMinimo: 20.0,
        },
      };

      const entrada = normalizarEntrada({ buttonPayload: 'ped_cart_continuar' });
      const resultado = transicionarEstado(flujoBajoMinimo, entrada, contextoMinimo);

      expect(resultado.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('pedido mínimo');
        expect(resultado.acciones[0].texto).toContain('20.00');
        expect(resultado.acciones[0].botones.some((b) => b.id === 'ped_mod_recojer')).toBe(true);
      }
    });
  });

  describe('16. Sin promociones ni descuentos en el bot', () => {
    it('con una oferta configurada, continuar el carrito va directo a confirmar el nombre y no la menciona', () => {
      const contextoConOferta: ContextoConversacion = {
        ...contextoBase,
        ofertas: [
          {
            id: 'of_2x1',
            nombre: '2x1 en Hamburguesas',
            tipo: 'LLEVA_PAGA',
            lleva: 2,
            paga: 1,
            alcanceProductoId: 'prod_clasica',
            activo: true,
          },
        ],
      };

      const flujoCon2Hamburguesas: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_ACCION_CARRITO',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_ACCION_CARRITO',
          modalidad: 'RECOGER',
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa Clásica',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 2,
              precioUnitario: 20.0,
              subtotal: 40.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const entrada = normalizarEntrada({ buttonPayload: 'ped_cart_continuar' });
      const resultado = transicionarEstado(flujoCon2Hamburguesas, entrada, contextoConOferta);

      expect(resultado.nuevoEstado).toBe('PEDIDO_CONFIRMAR_NOMBRE');
      const textos = resultado.acciones
        .map((a: any) => `${a.texto ?? ''} ${a.botones?.map((b: any) => b.titulo).join(' ') ?? ''}`)
        .join(' ');
      // La línea de puntos (solo acumular, con el celular de quien escribe) sí va en este mensaje; las promos no
      expect(textos).not.toMatch(/promo|oferta|descuento|cup[oó]n|ahorr/i);
    });
  });

  describe('17. Idempotencia y canal WHATSAPP', () => {
    it('genera una clave de idempotencia consistente por paso de pedido', () => {
      const flujoResumen: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_RESUMEN_CONFIRMAR',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR',
          modalidad: 'RECOGER',
          idempotenciaPaso: 'step_test_123',
          cliente: { nombre: 'Carlos Test', telefono: '987654321' },
          pago: { metodo: 'EFECTIVO', pagaCon: 50 },
          comprobante: { tipo: 'NINGUNO' },
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 20.0,
              subtotal: 20.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const entrada = normalizarEntrada({ buttonPayload: 'ped_confirmar_si' });

      // Primera ejecución
      const res1 = transicionarEstado(flujoResumen, entrada, contextoBase);
      const accionCrear1 = res1.acciones.find((a) => a.tipo === 'crearPedido') as any;
      expect(accionCrear1).toBeDefined();
      expect(accionCrear1.claveIdempotencia).toContain('step_test_123');

      // Segunda ejecución idéntica (ej: reenvío de Meta con mismo payload y estado)
      const res2 = transicionarEstado(flujoResumen, entrada, contextoBase);
      const accionCrear2 = res2.acciones.find((a) => a.tipo === 'crearPedido') as any;
      expect(accionCrear2).toBeDefined();
      expect(accionCrear2.claveIdempotencia).toBe(accionCrear1.claveIdempotencia);
    });

    it('el DTO generado para PedidosService contiene los datos obligatorios con canal WHATSAPP', () => {
      const flujoResumen: FlujoConversacion = {
        version: 1,
        estado: 'PEDIDO_RESUMEN_CONFIRMAR',
        repreguntasFallidas: 0,
        pedido: {
          estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR',
          modalidad: 'RECOGER',
          cliente: { nombre: 'Carlos Test', telefono: '987654321' },
          pago: { metodo: 'EFECTIVO', pagaCon: 50 },
          comprobante: { tipo: 'NINGUNO' },
          items: [
            {
              lineaId: 'lin_1',
              productoId: 'prod_clasica',
              productoNombre: 'Hamburguesa',
              categoriaId: 'cat_hamb',
              categoriaNombre: 'Hamburguesas',
              cantidad: 1,
              precioUnitario: 20.0,
              subtotal: 20.0,
              opciones: [],
              noSumaBeneficios: false,
            },
          ],
        },
      };

      const entrada = normalizarEntrada({ buttonPayload: 'ped_confirmar_si' });
      const res = transicionarEstado(flujoResumen, entrada, contextoBase);
      const accionCrear = res.acciones.find((a) => a.tipo === 'crearPedido') as any;

      expect(accionCrear).toBeDefined();
      expect(accionCrear.dto.modalidad).toBe('RECOGER');
      expect(accionCrear.dto.cliente.nombre).toBe('Carlos Test');
      expect(accionCrear.dto.cliente.telefono).toBe('987654321');
      expect(accionCrear.dto.lineas[0].productoId).toBe('prod_clasica');
    });
  });

  describe('11. Productos que controlan stock: no se ofrece más de lo que queda', () => {
    it('la pregunta de cantidad solo ofrece 1 unidad si quedan 1, y pedir 2 repreguntan con el saldo', () => {
      const contextoQuedan: ContextoConversacion = {
        ...contextoBase,
        categoriasCarta: [
          {
            ...categoriaHamburguesas,
            productos: categoriaHamburguesas.productos.map((p) => (p.id === 'prod_clasica' ? { ...p, quedan: 1 } : p)),
          },
        ],
      };
      let resultado = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), contextoQuedan);
      resultado = transicionarEstado(resultado.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_mod_recojer' }), contextoQuedan);
      resultado = transicionarEstado(resultado.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_cat_cat_hamb' }), contextoQuedan);
      resultado = transicionarEstado(resultado.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_prod_prod_clasica' }), contextoQuedan);
      resultado = transicionarEstado(resultado.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_tam_tam_simple' }), contextoQuedan);
      resultado = transicionarEstado(resultado.nuevoFlujo, normalizarEntrada({ listRowId: 'ped_op_op_tartara' }), contextoQuedan);

      expect(resultado.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      const botones = (resultado.acciones[0] as any).botones.map((b: any) => b.id);
      expect(botones).toEqual(['ped_cant_1']);

      resultado = transicionarEstado(resultado.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_cant_2' }), contextoQuedan);
      expect(resultado.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect((resultado.acciones[0] as any).texto).toBe('Solo quedan 1 de Hamburguesa Clásica 😅 ¿Cuántas quieres?');
      expect(resultado.nuevoFlujo.pedido?.items?.length ?? 0).toBe(0);
    });
  });
});
