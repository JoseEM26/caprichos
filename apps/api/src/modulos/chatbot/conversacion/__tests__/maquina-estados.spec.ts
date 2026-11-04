import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import {
  ContextoConversacion,
  ESQUEMA_FLUJO_VERSION,
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
  BOTONES_MI_PEDIDO,
  FILAS_MENU_PRINCIPAL,
  FILAS_PREGUNTAS_FRECUENTES,
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
        expect(resultado.acciones[0].filas).toHaveLength(5);
        expect(resultado.acciones[0].filas.map((f) => f.id)).toEqual([
          'horario',
          'carta',
          'mipedido',
          'persona',
          'preguntar',
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

      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      const texto = (resultado.acciones[0] as any).texto as string;
      expect(texto).toContain('El pedido mínimo para delivery es s/ 14.50 en productos');
      expect(texto).toContain('para recoger en el local no hay mínimo');
      expect(texto).toContain('a partir de s/ 70.00');
    });

    it('sin pedido_minimo configurado no menciona ningún mínimo (ni 14.50 ni 15)', () => {
      const ctx = { ...contextoBase, datosLocalPublicos: { ...contextoBase.datosLocalPublicos!, pedidoMinimo: null } };
      const resultado = transicionarEstado(null, normalizarEntrada({ listRowId: 'faq_delivery' }), ctx);

      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      const texto = (resultado.acciones[0] as any).texto as string;
      expect(texto).not.toMatch(/mínimo/i);
      expect(texto).not.toContain('14.50');
      expect(texto).toContain('a partir de s/ 70.00');
      expect(texto).toContain('zonas de reparto');
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

  });
});
