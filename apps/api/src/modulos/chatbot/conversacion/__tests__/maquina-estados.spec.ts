import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import {
  ContextoConversacion,
  ESQUEMA_FLUJO_VERSION,
  FlujoConversacion,
} from '../tipos-conversacion';
import {
  BOTON_HABLAR_PERSONA,
  BOTON_LISTA_CATEGORIAS,
  BOTON_LISTA_MENU,
  BOTON_LISTA_PREGUNTAS,
  BOTON_LISTA_PRODUCTOS,
  BOTON_OTRAS_PREGUNTAS,
  BOTON_VER_CARTA,
  BOTON_VOLVER_CATEGORIAS,
  BOTON_VOLVER_MENU,
  BOTONES_MENU_PRINCIPAL,
  BOTONES_MI_PEDIDO,
  FILAS_MENU_PRINCIPAL,
  FILAS_PREGUNTAS_FRECUENTES,
  TEXTOS_BOT,
  TITULO_SECCION_CATEGORIAS,
  TITULO_SECCION_MENU,
  TITULO_SECCION_PREGUNTAS,
} from '../textos-bot';

describe('Máquina de Estados del Bot Conversacional (transicionarEstado)', () => {
  const contextoBase: ContextoConversacion = {
    nombreCliente: 'Carlos',
    telefonoCliente: '51987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: {
      abierta: true,
      abre: '17:00',
      cierra: '23:00',
      textoEstado: 'Lunes a Domingo de 17:00 a 23:00',
      direccion: 'Av. Las Flores 456',
      referencia: 'Frente al parque',
      enlaceMapa: 'https://maps.google.com/?q=-12.0196,-76.9632',
      telefono: '987 654 321',
    },
    datosLocalPublicos: {
      direccion: 'Av. Las Flores 456',
      telefono: '987 654 321',
      pedidoMinimo: 14.5,
      envioGratisDesde: 70,
      mediosPago: {
        yape: { nombre: 'Yape', activo: true },
        plin: { nombre: 'Plin', activo: true },
        efectivo: { nombre: 'Efectivo', activo: true },
      },
    },
    categoriasCarta: [
      {
        id: '1',
        nombre: 'Frappes',
        descripcion: 'Bebidas heladas',
        productos: [
          {
            id: 'p1',
            nombre: 'Frappe Oreo',
            precio: 14.5,
            disponible: true,
            tamanos: [
              { nombre: 'Regular 12 oz', precio: 14.5 },
              { nombre: 'Grande 16 oz', precio: 16.5 },
            ],
            grupos: [
              {
                nombre: 'Tipo de leche',
                obligatorio: true,
                opciones: [
                  { nombre: 'Leche entera', precioExtra: 0, disponible: true },
                  { nombre: 'Leche sin lactosa', precioExtra: 0, disponible: true },
                  { nombre: 'Bebida de almendra', precioExtra: 2.5, disponible: true },
                ],
              },
            ],
          },
          {
            id: 'p2',
            nombre: 'Frappe Fresa',
            precio: 15.0,
            disponible: false,
            agotadoHasta: '22:00',
          },
        ],
      },
      {
        id: '2',
        nombre: 'Calientes',
        descripcion: 'Cafés y chocolates',
        productos: [
          {
            id: 'p3',
            nombre: 'Mocaccino',
            precio: 12.0,
            disponible: true,
          },
          {
            id: 'p4',
            nombre: 'Capuccino',
            precio: 11.0,
            disponible: true,
          },
        ],
      },
      {
        id: '3',
        nombre: 'Waffles',
        descripcion: 'Waffles dulces',
        productos: [
          {
            id: 'p5',
            nombre: 'Waffle Frutos',
            precio: 18.0,
            disponible: true,
          },
        ],
      },
    ],
    ofertas: [
      {
        nombre: '2x1 Frappe Oreo',
        descripcion: 'Paga 1 y lleva 2',
        vigenteAhora: true,
        compraMinima: 14.5,
      },
      {
        nombre: 'Domingos de Waffles',
        descripcion: '10% de descuento',
        vigenteAhora: false,
        diasTexto: 'Domingos',
      },
    ],
  };

  describe('0. Validación estricta de límites de WhatsApp en el catálogo de textos', () => {
    it('todos los botones de lista tienen máximo 20 caracteres', () => {
      [BOTON_LISTA_MENU, BOTON_LISTA_CATEGORIAS, BOTON_LISTA_PRODUCTOS, BOTON_LISTA_PREGUNTAS].forEach(
        (btn) => {
          expect(btn.length).toBeLessThanOrEqual(20);
        },
      );
    });

    it('todos los títulos de sección de lista tienen máximo 24 caracteres', () => {
      [TITULO_SECCION_MENU, TITULO_SECCION_CATEGORIAS, TITULO_SECCION_PREGUNTAS].forEach((t) => {
        expect(t.length).toBeLessThanOrEqual(24);
      });
    });

    it('todas las filas del menú principal cumplen título <= 24 y descripción <= 72', () => {
      expect(FILAS_MENU_PRINCIPAL.length).toBeLessThanOrEqual(10);
      FILAS_MENU_PRINCIPAL.forEach((fila) => {
        expect(fila.titulo.length).toBeLessThanOrEqual(24);
        if (fila.descripcion) {
          expect(fila.descripcion.length).toBeLessThanOrEqual(72);
        }
      });
    });

    it('todas las filas de preguntas frecuentes cumplen título <= 24 y descripción <= 72', () => {
      expect(FILAS_PREGUNTAS_FRECUENTES.length).toBeLessThanOrEqual(10);
      FILAS_PREGUNTAS_FRECUENTES.forEach((fila) => {
        expect(fila.titulo.length).toBeLessThanOrEqual(24);
        if (fila.descripcion) {
          expect(fila.descripcion.length).toBeLessThanOrEqual(72);
        }
      });
    });

    it('todos los botones de respuesta rápida cumplen título <= 20 caracteres', () => {
      const botones = [
        BOTON_VOLVER_MENU,
        BOTON_VOLVER_CATEGORIAS,
        BOTON_VER_CARTA,
        BOTON_OTRAS_PREGUNTAS,
        BOTON_HABLAR_PERSONA,
        ...BOTONES_MI_PEDIDO,
      ];
      botones.forEach((btn) => {
        expect(btn.titulo.length).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('1. Saludo inicial y Menú Principal como lista interactiva', () => {
    it('responde saludo con nombre del contacto y lista interactiva con botón "Ver opciones"', () => {
      const entrada = normalizarEntrada({ texto: 'Hola' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.version).toBe(ESQUEMA_FLUJO_VERSION);
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(0);
      expect(resultado.acciones).toHaveLength(1);
      expect(resultado.acciones[0].tipo).toBe('enviarLista');

      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].texto).toContain('Carlos');
        expect(resultado.acciones[0].texto).toContain('Soy Capri');
        expect(resultado.acciones[0].botonTexto).toBe('Ver opciones');
        expect(resultado.acciones[0].tituloSeccion).toBe('Menú');
        expect(resultado.acciones[0].filas).toHaveLength(6);
        expect(resultado.acciones[0].filas.map((f) => f.id)).toEqual([
          'pedir',
          'reservar',
          'carta',
          'mipedido',
          'preguntar',
          'persona',
        ]);
      }
    });

    it('responde saludo sin nombre cuando el cliente no tiene nombre', () => {
      const entrada = normalizarEntrada({ texto: 'Hola' });
      const contextoSinNombre = { ...contextoBase, nombreCliente: null };
      const resultado = transicionarEstado(null, entrada, contextoSinNombre);

      expect(resultado.nuevoEstado).toBe('MENU');
      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].texto).toContain('¡Hola! ☕ Soy Capri');
        expect(resultado.acciones[0].texto).not.toContain('Carlos');
      }
    });

    it('informa si el local está cerrado en el saludo inicial', () => {
      const entrada = normalizarEntrada({ texto: 'Hola' });
      const contextoCerrado = {
        ...contextoBase,
        datosLocal: {
          ...contextoBase.datosLocal!,
          abierta: false,
          abre: '17:00',
        },
      };
      const resultado = transicionarEstado(null, entrada, contextoCerrado);

      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].texto).toContain('Ahora estamos cerrados. Abrimos hoy a las 17:00');
      }
    });

    it('informa si los pedidos están pausados por alta demanda en el saludo inicial', () => {
      const entrada = normalizarEntrada({ texto: 'Hola' });
      const contextoPausa = {
        ...contextoBase,
        datosLocal: {
          ...contextoBase.datosLocal!,
          pausaAltaDemanda: true,
          motivoPausa: 'mucha demanda en cocina',
        },
      };
      const resultado = transicionarEstado(null, entrada, contextoPausa);

      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].texto).toContain(
          'Por el momento no estamos recibiendo pedidos (mucha demanda en cocina)',
        );
      }
    });

    it.each([
      'buenas',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
      'menu',
      'inicio',
      'comenzar',
      'opciones',
    ])('reconoce "%s" como saludo y abre el menú principal en formato lista', (palabra) => {
      const entrada = normalizarEntrada({ texto: palabra });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 1 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(0);
      expect(resultado.acciones[0].tipo).toBe('enviarLista');
    });

    it('personaliza la fila de Mi pedido si ya se conoce un código de pedido activo', () => {
      const entrada = normalizarEntrada({ texto: 'menu' });
      const flujoConPedido: FlujoConversacion = {
        version: 1,
        estado: 'MENU',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0110',
      };
      const resultado = transicionarEstado(flujoConPedido, entrada, contextoBase);

      if (resultado.acciones[0].tipo === 'enviarLista') {
        const filaPedido = resultado.acciones[0].filas.find((f) => f.id === 'mipedido');
        expect(filaPedido?.titulo).toBe('📦 Mi pedido CP-0110');
      }
    });
  });

  describe('2. Flujo de Pedidos (Ola 2) y Reservar mesa honesta (Ola 3)', () => {
    it('al pulsar "pedir" inicia el flujo real de pedido preguntando la modalidad', () => {
      const entrada = normalizarEntrada({ listRowId: 'pedir' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PEDIDO_MODALIDAD');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Perfecto. ¿Cómo lo quieres?');
        expect(resultado.acciones[0].botones).toHaveLength(2);
        expect(resultado.acciones[0].botones.map((b) => b.id)).toEqual([
          'ped_mod_delivery',
          'ped_mod_recojer',
        ]);
      }
    });

    it('al pulsar "reservar" inicia el flujo de reservas y pide cantidad de personas (Ola 3)', () => {
      const entrada = normalizarEntrada({ listRowId: 'reservar' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('RESERVA_PERSONAS');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('¿Para cuántas personas');
      }
    });
  });

  describe('3. Ver la carta navegable dentro del chat (requisitos a, b, c)', () => {
    it('al seleccionar "carta" muestra la lista interactiva de categorías reales', () => {
      const entrada = normalizarEntrada({ listRowId: 'carta' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('CARTA_CATEGORIAS');
      expect(resultado.acciones[0].tipo).toBe('enviarLista');
      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].botonTexto).toBe('Ver categorías');
        expect(resultado.acciones[0].tituloSeccion).toBe('Categorías');
        expect(resultado.acciones[0].filas).toHaveLength(3);
        expect(resultado.acciones[0].filas[0].id).toBe('cat_1');
        expect(resultado.acciones[0].filas[0].titulo).toBe('Frappes');
      }
    });

    it('paginación de categorías: cuando hay más de 9 categorías, añade fila "Ver más categorías"', () => {
      const muchasCategorias = Array.from({ length: 15 }, (_, i) => ({
        id: String(i + 1),
        nombre: `Categoría ${i + 1}`,
        productos: [{ id: `prod_${i}`, nombre: `P ${i}`, precio: 10, disponible: true }],
      }));

      const contextoMuchas = { ...contextoBase, categoriasCarta: muchasCategorias };
      const entrada = normalizarEntrada({ listRowId: 'carta' });
      const resultado = transicionarEstado(null, entrada, contextoMuchas);

      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].filas).toHaveLength(10);
        expect(resultado.acciones[0].filas[9].id).toBe('cat_mas_1');
        expect(resultado.acciones[0].filas[9].titulo).toBe('Ver más categorías');
      }

      // Al pulsar "Ver más categorías" muestra la página siguiente
      const entradaMas = normalizarEntrada({ listRowId: 'cat_mas_1' });
      const resPag2 = transicionarEstado(resultado.nuevoFlujo, entradaMas, contextoMuchas);
      if (resPag2.acciones[0].tipo === 'enviarLista') {
        expect(resPag2.acciones[0].filas[0].titulo).toBe('Categoría 10');
      }
    });

    it('al elegir una categoría muestra sus productos reales con precio en la descripción', () => {
      const entrada = normalizarEntrada({ listRowId: 'cat_1' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('CARTA_PRODUCTOS');
      expect(resultado.acciones[0].tipo).toBe('enviarLista');
      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].botonTexto).toBe('Ver productos');
        expect(resultado.acciones[0].tituloSeccion).toBe('Frappes');
        expect(resultado.acciones[0].filas).toHaveLength(2);
        expect(resultado.acciones[0].filas[0].titulo).toBe('Frappe Oreo');
        expect(resultado.acciones[0].filas[0].descripcion).toContain('Desde s/ 14.50');
        // Producto agotado en la descripción de la lista (requisito b)
        expect(resultado.acciones[0].filas[1].titulo).toBe('Frappe Fresa');
        expect(resultado.acciones[0].filas[1].descripcion).toBe('Por ahora no está disponible');
      }
    });

    it('si toda una categoría está agotada, responde avisándolo con botones para volver (requisito b)', () => {
      const categoriaAgotada = [
        {
          id: '10',
          nombre: 'Donas',
          productos: [
            { id: 'd1', nombre: 'Dona Manjar', precio: 6, disponible: false },
            { id: 'd2', nombre: 'Dona Oreo', precio: 7, disponible: false },
          ],
        },
      ];
      const contextoAgotada = { ...contextoBase, categoriasCarta: categoriaAgotada };
      const entrada = normalizarEntrada({ listRowId: 'cat_10' });
      const resultado = transicionarEstado(null, entrada, contextoAgotada);

      expect(resultado.nuevoEstado).toBe('CARTA_PRODUCTOS');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain(
          'Todos los productos de la categoría Donas están agotados por el momento',
        );
        expect(resultado.acciones[0].botones).toEqual([BOTON_VOLVER_CATEGORIAS, BOTON_VOLVER_MENU]);
      }
    });

    it('al elegir un producto muestra descripción, presentaciones, opciones y enlace web (requisito a)', () => {
      const entrada = normalizarEntrada({ listRowId: 'prod_p1' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('CARTA_PRODUCTO_DETALLE');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('FRAPPE OREO');
        expect(resultado.acciones[0].texto).toContain('Regular 12 oz: s/ 14.50');
        expect(resultado.acciones[0].texto).toContain('Grande 16 oz: s/ 16.50');
        expect(resultado.acciones[0].texto).toContain('Leche sin lactosa');
        expect(resultado.acciones[0].texto).toContain('Pídelo en nuestra carta virtual');
        expect(resultado.acciones[0].botones).toEqual([
          { id: 'ped_prod_p1', titulo: 'Pedir este producto' },
          BOTON_VOLVER_MENU,
          { id: 'btn_persona', titulo: 'Hablar con persona' },
        ]);
      }
    });

    it('producto agotado muestra aviso claro y hora de regreso si está programada (requisito b)', () => {
      const entrada = normalizarEntrada({ listRowId: 'prod_p2' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Por ahora no está disponible');
        expect(resultado.acciones[0].texto).toContain('regresa aprox. 22:00');
      }
    });

    it('promociones de hoy muestra vigentes con condición y no vigentes con "Hoy no aplica" (requisito c)', () => {
      const entrada = normalizarEntrada({ listRowId: 'promos' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('CARTA_PROMOS');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Vigentes hoy:');
        expect(resultado.acciones[0].texto).toContain('2x1 Frappe Oreo');
        expect(resultado.acciones[0].texto).toContain('Paga 1 y lleva 2');
        expect(resultado.acciones[0].texto).toContain('Hoy no aplica (Aplica: Domingos)');
        expect(resultado.acciones[0].botones).toEqual([BOTON_VER_CARTA, BOTON_VOLVER_MENU]);
      }
    });
  });

  describe('4. Mi pedido y ¿Cuánto falta? (requisito d, mockup líneas 268-285)', () => {
    it('al seleccionar Mi pedido sin código activo solicita el código CP-xxxx', () => {
      const entrada = normalizarEntrada({ listRowId: 'mipedido' });
      const resultado = transicionarEstado(null, entrada, { ...contextoBase, pedidoActivo: null });

      expect(resultado.nuevoEstado).toBe('MI_PEDIDO');
      expect(resultado.acciones[0].tipo).toBe('enviarTexto');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('Por favor escribe el código de tu pedido (ejemplo: CP-0110)');
      }
    });

    it('cuando el usuario escribe su código válido muestra opciones ¿Cuánto falta?, Cambiar dirección y Asesor', () => {
      const entrada = normalizarEntrada({ texto: 'CP-0110' });
      const contextoConPedido: ContextoConversacion = {
        ...contextoBase,
        pedidoActivo: {
          codigo: 'CP-0110',
          estado: 'PREPARANDO',
          creado_en: new Date(),
        },
      };
      const resultado = transicionarEstado(null, entrada, contextoConPedido);

      expect(resultado.nuevoEstado).toBe('MI_PEDIDO_DETALLE');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('¿Qué necesitas de tu pedido CP-0110?');
        expect(resultado.acciones[0].botones).toEqual(BOTONES_MI_PEDIDO);
      }
    });

    it('rechaza pedido ajeno o inexistente con el mensaje del mockup (seguridad)', () => {
      const entrada = normalizarEntrada({ texto: 'CP-9999' });
      const contextoPedidoInvalido: ContextoConversacion = {
        ...contextoBase,
        pedidoActivo: null, // Rechazado por ejecutor por no pertenecer al teléfono
      };
      const resultado = transicionarEstado(null, entrada, contextoPedidoInvalido);

      expect(resultado.nuevoEstado).toBe('MENU');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toBe(
          'No encuentro un pedido activo con tu número. ¿Quieres hacer uno ahora?',
        );
      }
    });

    it('responde "¿Cuánto falta?" cuando el pedido está en cocina con tiempo estimado', () => {
      const entrada = normalizarEntrada({ buttonPayload: 'c_eta' });
      const contextoPedidoCocina: ContextoConversacion = {
        ...contextoBase,
        pedidoActivo: {
          codigo: 'CP-0110',
          estado: 'PREPARANDO',
          creado_en: new Date(Date.now() - 5 * 60000), // Hace 5 minutos
        },
      };
      const resultado = transicionarEstado(
        { version: 1, estado: 'MI_PEDIDO_DETALLE', codigoPedido: 'CP-0110', repreguntasFallidas: 0 },
        entrada,
        contextoPedidoCocina,
      );

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Tu pedido CP-0110 está en cocina');
        expect(resultado.acciones[0].texto).toContain('minutos');
      }
    });

    it('responde "¿Cuánto falta?" cuando el pedido ya está en camino con repartidor', () => {
      const entrada = normalizarEntrada({ texto: 'cuanto falta para que llegue?' });
      const contextoEnCamino: ContextoConversacion = {
        ...contextoBase,
        pedidoActivo: {
          codigo: 'CP-0110',
          estado: 'EN_CAMINO',
          creado_en: new Date(Date.now() - 20 * 60000),
        },
      };
      const resultado = transicionarEstado(
        { version: 1, estado: 'MI_PEDIDO_DETALLE', codigoPedido: 'CP-0110', repreguntasFallidas: 0 },
        entrada,
        contextoEnCamino,
      );

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('ya está en camino con el repartidor 🛵');
      }
    });

    it('si el pedido superó el tiempo prometido, avisa la demora y transfiere automáticamente a persona', () => {
      const entrada = normalizarEntrada({ buttonPayload: 'c_eta' });
      const contextoTarde: ContextoConversacion = {
        ...contextoBase,
        pedidoActivo: {
          codigo: 'CP-0110',
          estado: 'PREPARANDO',
          creado_en: new Date(Date.now() - 50 * 60000), // 50 minutos (superó los 35 max)
        },
      };
      const resultado = transicionarEstado(
        { version: 1, estado: 'MI_PEDIDO_DETALLE', codigoPedido: 'CP-0110', repreguntasFallidas: 0 },
        entrada,
        contextoTarde,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones.some((a) => a.tipo === 'pasarAPersona')).toBe(true);
      const accionTexto = resultado.acciones.find((a) => a.tipo === 'enviarTexto');
      expect(accionTexto?.tipo === 'enviarTexto' && accionTexto.texto).toContain(
        'Disculpa la demora: ya avisé al equipo para apurarlo y una persona te escribe',
      );
    });

    it('cambio de dirección: en preparación deriva normal; en camino deriva urgente', () => {
      // 1. En preparación
      const entradaDirPrep = normalizarEntrada({ buttonPayload: 'c_dir' });
      const resPrep = transicionarEstado(
        { version: 1, estado: 'MI_PEDIDO_DETALLE', codigoPedido: 'CP-0110', repreguntasFallidas: 0 },
        entradaDirPrep,
        {
          ...contextoBase,
          pedidoActivo: { codigo: 'CP-0110', estado: 'PREPARANDO' },
        },
      );
      expect(resPrep.nuevoEstado).toBe('ATENCION_PERSONA');
      const txtPrep = resPrep.acciones.find((a) => a.tipo === 'enviarTexto');
      expect(txtPrep?.tipo === 'enviarTexto' && txtPrep.texto).toContain(
        'Tu pedido ya está en preparación. Ya avisé a un asesor para ver si se puede cambiar la dirección',
      );

      // 2. En camino (urgente)
      const resRuta = transicionarEstado(
        { version: 1, estado: 'MI_PEDIDO_DETALLE', codigoPedido: 'CP-0110', repreguntasFallidas: 0 },
        entradaDirPrep,
        {
          ...contextoBase,
          pedidoActivo: { codigo: 'CP-0110', estado: 'EN_CAMINO' },
        },
      );
      const accPaso = resRuta.acciones.find((a) => a.tipo === 'pasarAPersona');
      expect(accPaso?.tipo === 'pasarAPersona' && accPaso.motivo).toBe('CAMBIO_DIRECCION_URGENTE');
    });

    it('bloquea si el cliente excede 5 consultas por minuto', () => {
      const entrada = normalizarEntrada({ listRowId: 'mipedido' });
      const contextoBloqueado = {
        ...contextoBase,
        limiteConsultasExcedido: true,
      };
      const resultado = transicionarEstado(null, entrada, contextoBloqueado);

      expect(resultado.nuevoEstado).toBe('MENU');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain(
          'Has consultado tu pedido varias veces en poco tiempo. Por favor espera un momento',
        );
      }
    });
  });

  describe('5. Preguntas frecuentes con datos de base de datos (requisito e)', () => {
    it('muestra el menú de lista interactiva de preguntas frecuentes', () => {
      const entrada = normalizarEntrada({ listRowId: 'preguntar' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('PREGUNTAS');
      expect(resultado.acciones[0].tipo).toBe('enviarLista');
      if (resultado.acciones[0].tipo === 'enviarLista') {
        expect(resultado.acciones[0].texto).toContain('Hola, soy Capri. Dime tu consulta y te ayudo.');
        expect(resultado.acciones[0].botonTexto).toBe('Ver preguntas');
        expect(resultado.acciones[0].filas).toEqual(FILAS_PREGUNTAS_FRECUENTES);
      }
    });

    it('responde sobre intolerancia a la lactosa con las leches reales de la BD', () => {
      const entrada = normalizarEntrada({ listRowId: 'faq_lactosa' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Leche sin lactosa');
        expect(resultado.acciones[0].texto).toContain('Bebida de almendra (+ s/ 2.50)');
        expect(resultado.acciones[0].botones).toEqual([BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU]);
      }
    });

    it('responde sobre bebidas calientes con productos de la BD', () => {
      const entrada = normalizarEntrada({ listRowId: 'faq_calientes' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Mocaccino, Capuccino');
      }
    });

    it('responde sobre medios de pago con la configuración real de LocalService', () => {
      const entrada = normalizarEntrada({ listRowId: 'faq_pagos' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Yape, Plin, Efectivo');
      }
    });

    it('responde sobre delivery con el pedido mínimo y envío gratis de LocalService', () => {
      const entrada = normalizarEntrada({ listRowId: 'faq_delivery' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('s/ 14.50');
        expect(resultado.acciones[0].texto).toContain('a partir de s/ 70.00');
      }
    });
  });

  describe('6. Pase a persona y manejo de fallos (requisitos e y f)', () => {
    it('al pulsar "persona" pasa inmediatamente a persona con notificación', () => {
      const entrada = normalizarEntrada({ listRowId: 'persona' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones[0].tipo).toBe('pasarAPersona');
      expect(resultado.acciones[1].tipo).toBe('enviarTexto');
      if (resultado.acciones[1].tipo === 'enviarTexto') {
        expect(resultado.acciones[1].texto).toContain(
          'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número',
        );
      }
    });

    it('en ATENCION_PERSONA el bot se mantiene en silencio y no emite acciones', () => {
      const entrada = normalizarEntrada({ texto: '¿Hay alguien ahí?' });
      const resultado = transicionarEstado(
        { version: 1, estado: 'ATENCION_PERSONA', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones).toHaveLength(0);
    });

    it('si falla una consulta de base de datos o servicio, responde con el mensaje honesto y pasa a persona (requisito f)', () => {
      const entrada = normalizarEntrada({ texto: 'Hola' });
      const contextoConFallo: ContextoConversacion = {
        ...contextoBase,
        errorServicio: true,
      };
      const resultado = transicionarEstado(null, entrada, contextoConFallo);

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones[0].tipo).toBe('pasarAPersona');
      const accTexto = resultado.acciones[1];
      expect(accTexto.tipo === 'enviarTexto' && accTexto.texto).toBe(
        'Estoy teniendo un problema para ver eso, te paso con una persona.',
      );
    });

    it('repregunta una vez ante mensaje confuso y a la segunda deriva a persona', () => {
      const entradaConfusa = normalizarEntrada({ texto: 'xyz123 no entiendo nada' });

      // 1er intento confuso
      const res1 = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entradaConfusa,
        contextoBase,
      );
      expect(res1.nuevoFlujo.repreguntasFallidas).toBe(1);
      expect(res1.acciones[0].tipo).toBe('enviarLista');

      // 2do intento confuso consecutivo
      const res2 = transicionarEstado(res1.nuevoFlujo, entradaConfusa, contextoBase);
      expect(res2.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res2.acciones[0].tipo).toBe('pasarAPersona');
      expect(res2.acciones[1].tipo === 'enviarTexto' && res2.acciones[1].texto).toContain(
        'No logro entender bien tu mensaje, mejor te paso con una persona del equipo para ayudarte',
      );
    });
  });
});
