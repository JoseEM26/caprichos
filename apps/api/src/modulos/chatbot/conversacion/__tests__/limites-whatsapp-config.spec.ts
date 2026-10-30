import {
  BOTONES_FUNCION_PAUSADA,
  BOTON_AVISO_SPAM_MENU,
  LIMITE_BOTON_LISTA,
  LIMITE_CUERPO_TEXTO,
  LIMITE_DESCRIPCION_FILA,
  LIMITE_MAX_BOTONES,
  LIMITE_MAX_FILAS,
  LIMITE_TITULO_BOTON,
  LIMITE_TITULO_FILA,
  TEXTOS_ANTI_SPAM,
  TEXTOS_BOT_DEFECTO,
  TEXTOS_FUNCIONES_DESACTIVADAS,
} from '../../configuracion/chatbot-configuracion.tipos';
import { TEXTOS_BOT, FILAS_MENU_PRINCIPAL } from '../textos-bot';
import { transicionarEstado } from '../maquina-estados';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

describe('Límites estrictos de WhatsApp y Configuración del Bot (Ola 4, Agente I)', () => {
  describe('1. Verificación exhaustiva de límites de WhatsApp Cloud API (Meta)', () => {
    it('todos los títulos de botones de acción tienen <= 20 caracteres', () => {
      const botones = [...BOTONES_FUNCION_PAUSADA, BOTON_AVISO_SPAM_MENU];

      botones.forEach((boton) => {
        expect(boton.titulo.length).toBeGreaterThan(0);
        expect(boton.titulo.length).toBeLessThanOrEqual(LIMITE_TITULO_BOTON);
      });
    });

    it('los grupos de botones de respuesta rápida tienen como máximo 3 botones', () => {
      expect(BOTONES_FUNCION_PAUSADA.length).toBeLessThanOrEqual(LIMITE_MAX_BOTONES);
      expect([BOTON_AVISO_SPAM_MENU].length).toBeLessThanOrEqual(LIMITE_MAX_BOTONES);
    });

    it('las filas del menú principal cumplen con título <= 24 y descripción <= 72', () => {
      expect(FILAS_MENU_PRINCIPAL.length).toBeLessThanOrEqual(LIMITE_MAX_FILAS);

      FILAS_MENU_PRINCIPAL.forEach((fila) => {
        expect(fila.titulo.length).toBeGreaterThan(0);
        expect(fila.titulo.length).toBeLessThanOrEqual(LIMITE_TITULO_FILA);

        if (fila.descripcion) {
          expect(fila.descripcion.length).toBeLessThanOrEqual(LIMITE_DESCRIPCION_FILA);
        }
      });
    });

    it('todos los textos por defecto del bot cumplen con longitud <= 1024 caracteres en el cuerpo', () => {
      (Object.entries(TEXTOS_BOT_DEFECTO) as [string, string][]).forEach(([clave, texto]) => {
        expect(texto.length).toBeGreaterThan(0);
        expect(texto.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
      });
    });

    it('todos los textos de funciones desactivadas cumplen con longitud <= 1024 caracteres', () => {
      (Object.entries(TEXTOS_FUNCIONES_DESACTIVADAS) as [string, string][]).forEach(([funcion, texto]) => {
        expect(texto.length).toBeGreaterThan(0);
        expect(texto.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
      });
    });

    it('el mensaje de aviso anti-spam cumple con <= 1024 caracteres', () => {
      const aviso = TEXTOS_ANTI_SPAM.avisoExceso();
      expect(aviso.length).toBeGreaterThan(0);
      expect(aviso.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
    });

    it('el texto de despedida cumple con <= 1024 caracteres', () => {
      const despedida = TEXTOS_BOT.despedida();
      expect(despedida.length).toBeGreaterThan(0);
      expect(despedida.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
    });
  });

  describe('2. Conservación de emojis del mockup oficial Chatbot.dc.html', () => {
    it('los textos del bot conservan fielmente los emojis amigables del mockup', () => {
      // ☕ Café en bienvenida, anti-spam y despedida
      expect(TEXTOS_BOT_DEFECTO.chatbot_texto_bienvenida).toContain('☕');
      expect(TEXTOS_BOT_DEFECTO.chatbot_texto_despedida).toContain('☕');
      expect(TEXTOS_ANTI_SPAM.avisoExceso()).toContain('☕');

      // 🍓 Fresa en bienvenida
      expect(TEXTOS_BOT_DEFECTO.chatbot_texto_bienvenida).toContain('🍓');

      // 🧁 Cupcake / postre en bienvenida, despedida y pausas
      expect(TEXTOS_BOT_DEFECTO.chatbot_texto_bienvenida).toContain('🧁');
      expect(TEXTOS_BOT_DEFECTO.chatbot_texto_despedida).toContain('🧁');
      expect(TEXTOS_FUNCIONES_DESACTIVADAS.pedido).toContain('🧁');
      expect(TEXTOS_FUNCIONES_DESACTIVADAS.reservas).toContain('🧁');
      expect(TEXTOS_FUNCIONES_DESACTIVADAS.cambios).toContain('🧁');
    });
  });

  describe('3. Comportamiento de los interruptores de función en la máquina de estados', () => {
    const flujoBase: FlujoConversacion = {
      version: 2,
      estado: 'MENU',
      repreguntasFallidas: 0,
    };

    it('si la función pedido está desactivada, "pedir" devuelve aviso pausado y opciones de carta', () => {
      const contexto: ContextoConversacion = {
        funcionesActivas: {
          pedido: false,
          pago: true,
          reservas: true,
          cambios: true,
          ia: false,
          promociones: true,
        },
      };

      const resultado = transicionarEstado(
        flujoBase,
        { tipo: 'boton', texto: 'pedir', textoOriginal: 'pedir', id: 'pedir' },
        contexto,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      expect((resultado.acciones[0] as any).texto).toContain('temporalmente pausada');
      expect((resultado.acciones[0] as any).botones).toEqual(BOTONES_FUNCION_PAUSADA);
    });

    it('si la función reservas está desactivada, "reservar" devuelve aviso pausado y hablar con asesor', () => {
      const contexto: ContextoConversacion = {
        funcionesActivas: {
          pedido: true,
          pago: true,
          reservas: false,
          cambios: true,
          ia: false,
          promociones: true,
        },
      };

      const resultado = transicionarEstado(
        flujoBase,
        { tipo: 'boton', texto: 'reservar', textoOriginal: 'reservar', id: 'reservar' },
        contexto,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      expect((resultado.acciones[0] as any).texto).toContain('reservas de mesa por WhatsApp están temporalmente pausadas');
    });

    it('si la función cambios está desactivada, "c_dir" deriva a una persona con motivo CAMBIOS_PAUSADO', () => {
      const contexto: ContextoConversacion = {
        funcionesActivas: {
          pedido: true,
          pago: true,
          reservas: true,
          cambios: false,
          ia: false,
          promociones: true,
        },
      };

      const resultado = transicionarEstado(
        flujoBase,
        { tipo: 'boton', texto: 'c_dir', textoOriginal: 'c_dir', id: 'c_dir' },
        contexto,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones[0].tipo).toBe('pasarAPersona');
      expect((resultado.acciones[0] as any).motivo).toBe('CAMBIOS_PAUSADO');
      expect((resultado.acciones[1] as any).texto).toContain('gestión automática de cambios está temporalmente pausada');
    });

    it('si la función pago está desactivada, el paso de pago deriva a una persona de Caja', () => {
      const contexto: ContextoConversacion = {
        funcionesActivas: {
          pedido: true,
          pago: false,
          reservas: true,
          cambios: true,
          ia: false,
          promociones: true,
        },
      };

      const resultado = transicionarEstado(
        { ...flujoBase, estado: 'PAGO' as any },
        { tipo: 'boton', texto: 'pay', textoOriginal: 'pay', id: 'pay' },
        contexto,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones[0].tipo).toBe('pasarAPersona');
      expect((resultado.acciones[0] as any).motivo).toBe('PAGO_PAUSADO');
      expect((resultado.acciones[1] as any).texto).toContain('coordinación automática de pagos está en pausa');
    });

    it('si la función promociones está desactivada, "promos" indica que no hay promociones activas', () => {
      const contexto: ContextoConversacion = {
        funcionesActivas: {
          pedido: true,
          pago: true,
          reservas: true,
          cambios: true,
          ia: false,
          promociones: false,
        },
      };

      const resultado = transicionarEstado(
        flujoBase,
        { tipo: 'boton', texto: 'promos', textoOriginal: 'promos', id: 'promos' },
        contexto,
      );

      expect(resultado.nuevoEstado).toBe('CARTA_PROMOS');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      expect((resultado.acciones[0] as any).texto).toContain('no tenemos promociones activas');
    });
  });

  describe('4. Textos personalizados y despedida', () => {
    it('saludoBienvenida interpola {nombre} cuando se pasa texto personalizado', () => {
      const personalizado = '¡Bienvenido {nombre} a nuestra pastelería! 🍰☕';
      const saludo = TEXTOS_BOT.saludoBienvenida('Carlos', null, personalizado);
      expect(saludo).toBe('¡Bienvenido Carlos a nuestra pastelería! 🍰☕');
    });

    it('cuando el usuario dice "muchas gracias", el bot responde con mensaje de despedida', () => {
      const contexto: ContextoConversacion = {
        textosPersonalizados: {
          chatbot_texto_despedida: '¡Muchas gracias por tu visita! ☕ Vuelve pronto 🧁',
        },
      };

      const resultado = transicionarEstado(
        { version: 2, estado: 'MENU', repreguntasFallidas: 0 },
        { tipo: 'texto', texto: 'muchas gracias', textoOriginal: 'Muchas gracias' },
        contexto,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
      expect((resultado.acciones[0] as any).texto).toBe(
        '¡Muchas gracias por tu visita! ☕ Vuelve pronto 🧁',
      );
    });

    it('noEntiendoRepregunta y noEntiendoDerivacion usan los textos personalizados si están configurados', () => {
      expect(
        TEXTOS_BOT.noEntiendoRepregunta('Por favor escríbelo de otra forma.'),
      ).toBe('Por favor escríbelo de otra forma.');

      expect(
        TEXTOS_BOT.noEntiendoDerivacion('Te voy a pasar con alguien del equipo.'),
      ).toBe('Te voy a pasar con alguien del equipo.');
    });
  });
});
