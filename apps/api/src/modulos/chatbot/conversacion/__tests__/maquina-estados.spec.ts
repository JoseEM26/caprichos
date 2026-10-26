import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import {
  ContextoConversacion,
  ESQUEMA_FLUJO_VERSION,
  FlujoConversacion,
} from '../tipos-conversacion';
import { BOTONES_MENU_PRINCIPAL, TEXTOS_BOT } from '../textos-bot';

describe('Máquina de Estados del Bot Conversacional (transicionarEstado)', () => {
  const contextoBase: ContextoConversacion = {
    nombreCliente: 'Carlos',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: {
      abierta: true,
      abre: '17:00',
      cierra: '23:00',
      direccion: 'Av. Las Flores 456',
      enlaceMapa: 'https://maps.google.com/?q=-12.0196,-76.9632',
    },
  };

  describe('1. Saludo inicial y bienvenida', () => {
    it('responde saludo con nombre y 3 botones desde estado inicial o nulo', () => {
      const entrada = normalizarEntrada({ texto: 'Hola' });
      const resultado = transicionarEstado(null, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.version).toBe(ESQUEMA_FLUJO_VERSION);
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(0);
      expect(resultado.acciones).toHaveLength(1);
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Hola Carlos');
        expect(resultado.acciones[0].botones).toEqual(BOTONES_MENU_PRINCIPAL);
        expect(resultado.acciones[0].botones).toHaveLength(3);
      }
    });

    it('responde saludo genérico sin nombre cuando el contacto no tiene nombre registrado', () => {
      const entrada = normalizarEntrada({ texto: 'Buenas tardes' });
      const contextoSinNombre: ContextoConversacion = {
        ...contextoBase,
        nombreCliente: null,
      };

      const resultado = transicionarEstado(null, entrada, contextoSinNombre);

      expect(resultado.nuevoEstado).toBe('MENU');
      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Hola, bienvenido/a a Caprichos');
        expect(resultado.acciones[0].texto).not.toContain('Carlos');
      }
    });

    it.each([
      'buenas',
      'buenos dias',
      'buenas noches',
      'menu',
      'inicio',
      'comenzar',
      'opciones',
    ])('reconoce "%s" como saludo y abre el menú principal', (palabra) => {
      const entrada = normalizarEntrada({ texto: palabra });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 1 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(0);
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
    });

    it('responde al botón interactivo "btn_menu" devolviendo al menú principal', () => {
      const entrada = normalizarEntrada({
        tipo: 'interactive',
        buttonPayload: 'btn_menu',
      });
      const resultado = transicionarEstado(
        { version: 1, estado: 'HORARIO', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');
    });
  });

  describe('2. Intención: Hacer un pedido (Ola 1 informativa)', () => {
    it('responde al botón "btn_pedido" con el mensaje informativo y URL de carta', () => {
      const entrada = normalizarEntrada({
        tipo: 'interactive',
        buttonPayload: 'btn_pedido',
      });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.acciones).toHaveLength(1);
      expect(resultado.acciones[0].tipo).toBe('enviarTexto');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('Muy pronto podras pedir por aqui');
        expect(resultado.acciones[0].texto).toContain('https://carta.caprichos.pe');
      }
    });

    it('omite la URL cuando la configuración CARTA_URL_PUBLICA está vacía', () => {
      const entrada = normalizarEntrada({ texto: 'quiero pedir algo de la carta' });
      const contextoSinCarta: ContextoConversacion = {
        ...contextoBase,
        cartaUrlPublica: '',
      };
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoSinCarta,
      );

      expect(resultado.nuevoEstado).toBe('MENU');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toBe(
          'Muy pronto podras pedir por aqui. Mientras tanto haz tu pedido en nuestra carta.',
        );
      }
    });

    it.each([
      'hacer un pedido',
      'quiero ordenar',
      'comprar',
      'ver la carta',
    ])('reconoce el texto "%s" como intención de pedido', (texto) => {
      const entrada = normalizarEntrada({ texto });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.acciones[0].tipo).toBe('enviarTexto');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('Muy pronto podras pedir por aqui');
      }
    });
  });

  describe('3. Intención: Horario y ubicación', () => {
    it('muestra horario cuando el local está abierto hoy', () => {
      const entrada = normalizarEntrada({
        tipo: 'interactive',
        buttonPayload: 'btn_horario_ubicacion',
      });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('HORARIO');
      expect(resultado.acciones[0].tipo).toBe('enviarTexto');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('Nuestro local esta abierto hoy de 17:00 a 23:00');
        expect(resultado.acciones[0].texto).toContain('Direccion: Av. Las Flores 456');
        expect(resultado.acciones[0].texto).toContain('https://maps.google.com/?q=-12.0196,-76.9632');
      }
    });

    it('indica que el local está cerrado y cuándo abre si aún no es la hora de apertura', () => {
      const entrada = normalizarEntrada({ texto: 'a que hora abren?' });
      const contextoCerradoAbreHoy: ContextoConversacion = {
        ...contextoBase,
        datosLocal: {
          abierta: false,
          abre: '18:00',
          cierra: '23:30',
          direccion: 'Av. Las Flores 456',
          enlaceMapa: 'https://maps.google.com',
        },
      };

      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoCerradoAbreHoy,
      );

      expect(resultado.nuevoEstado).toBe('HORARIO');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain(
          'Nuestro local esta cerrado en este momento. Abrimos hoy a las 18:00 (hasta las 23:30).',
        );
      }
    });

    it('indica que el local está cerrado por hoy si no abre hoy o ya cerró', () => {
      const entrada = normalizarEntrada({ texto: 'donde estan ubicados' });
      const contextoCerradoPorHoy: ContextoConversacion = {
        ...contextoBase,
        datosLocal: {
          abierta: false,
          abre: null,
          cierra: null,
          direccion: 'Av. Las Flores 456',
          enlaceMapa: 'https://maps.google.com',
        },
      };

      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoCerradoPorHoy,
      );

      expect(resultado.nuevoEstado).toBe('HORARIO');
      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('Nuestro local esta cerrado por hoy.');
      }
    });

    it('informa si el local está en pausa por alta demanda', () => {
      const entrada = normalizarEntrada({ texto: 'horario' });
      const contextoPausa: ContextoConversacion = {
        ...contextoBase,
        datosLocal: {
          abierta: false,
          pausaAltaDemanda: true,
          motivoPausa: 'Muchos pedidos en cocina',
          direccion: 'Av. Las Flores 456',
          enlaceMapa: 'https://maps.google.com',
        },
      };

      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoPausa,
      );

      if (resultado.acciones[0].tipo === 'enviarTexto') {
        expect(resultado.acciones[0].texto).toContain('Por el momento no estamos recibiendo pedidos (Muchos pedidos en cocina)');
      }
    });
  });

  describe('4. Intención: Hablar con una persona', () => {
    it('deriva a persona y responde mensaje de pase mediante botón "btn_persona"', () => {
      const entrada = normalizarEntrada({
        tipo: 'interactive',
        buttonPayload: 'btn_persona',
      });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones).toHaveLength(2);
      expect(resultado.acciones[0]).toEqual({
        tipo: 'pasarAPersona',
        motivo: 'SOLICITUD_CLIENTE',
        mensajeCliente: '',
      });
      expect(resultado.acciones[1]).toEqual({
        tipo: 'enviarTexto',
        texto: TEXTOS_BOT.pasarAPersona(),
      });
    });

    it.each([
      'quiero hablar con una persona',
      'asesor',
      'humano por favor',
      'necesito ayuda',
    ])('reconoce el texto "%s" para derivar a una persona', (texto) => {
      const entrada = normalizarEntrada({ texto });
      const resultado = transicionarEstado(
        { version: 1, estado: 'MENU', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones[0].tipo).toBe('pasarAPersona');
    });

    it('mantiene al bot en silencio si el estado ya es ATENCION_PERSONA', () => {
      const entrada = normalizarEntrada({ texto: 'hola hay alguien?' });
      const resultado = transicionarEstado(
        { version: 1, estado: 'ATENCION_PERSONA', repreguntasFallidas: 0 },
        entrada,
        contextoBase,
      );

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.acciones).toHaveLength(0);
    });
  });

  describe('5. Mensaje no entendido: repregunta y derivación humana', () => {
    it('primera vez no entendida: repregunta una vez mostrando botones y sube contador', () => {
      const entrada = normalizarEntrada({ texto: 'venden zapatos voladores?' });
      const flujoInicial: FlujoConversacion = {
        version: 1,
        estado: 'MENU',
        repreguntasFallidas: 0,
      };

      const resultado = transicionarEstado(flujoInicial, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('MENU');
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(1);
      expect(resultado.acciones).toHaveLength(1);
      expect(resultado.acciones[0].tipo).toBe('enviarBotones');

      if (resultado.acciones[0].tipo === 'enviarBotones') {
        expect(resultado.acciones[0].texto).toContain('Disculpa, no entendi tu mensaje');
        expect(resultado.acciones[0].botones).toEqual(BOTONES_MENU_PRINCIPAL);
      }
    });

    it('segunda vez consecutiva no entendida: deriva a persona y envía aviso (RQ-BOT-01-08 / RQ-ATN-02-06)', () => {
      const entrada = normalizarEntrada({ texto: 'sigo sin entender' });
      const flujoConFallo: FlujoConversacion = {
        version: 1,
        estado: 'MENU',
        repreguntasFallidas: 1,
      };

      const resultado = transicionarEstado(flujoConFallo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(2);
      expect(resultado.acciones).toHaveLength(2);
      expect(resultado.acciones[0]).toEqual({
        tipo: 'pasarAPersona',
        motivo: 'MENSAJE_NO_ENTENDIDO',
        mensajeCliente: 'sigo sin entender',
      });
      expect(resultado.acciones[1]).toEqual({
        tipo: 'enviarTexto',
        texto: TEXTOS_BOT.noEntiendoDerivacion(),
      });
    });

    it('si tras una repregunta fallida el usuario envía una opción válida, se restablece el contador', () => {
      const entrada = normalizarEntrada({
        tipo: 'interactive',
        buttonPayload: 'btn_horario_ubicacion',
      });
      const flujoConFallo: FlujoConversacion = {
        version: 1,
        estado: 'MENU',
        repreguntasFallidas: 1,
      };

      const resultado = transicionarEstado(flujoConFallo, entrada, contextoBase);

      expect(resultado.nuevoEstado).toBe('HORARIO');
      expect(resultado.nuevoFlujo.repreguntasFallidas).toBe(0);
      expect(resultado.acciones[0].tipo).toBe('enviarTexto');
    });
  });

  describe('6. Preservación de esquema y metadatos preexistentes', () => {
    it('preserva nombre_perfil_wa y otros atributos previos en el flujo devuelto', () => {
      const entrada = normalizarEntrada({ texto: 'hola' });
      const flujoConPerfil: FlujoConversacion = {
        version: 1,
        estado: 'INICIO',
        repreguntasFallidas: 0,
        nombre_perfil_wa: 'Maria WA',
        metadato_personalizado: 123,
      };

      const resultado = transicionarEstado(flujoConPerfil, entrada, contextoBase);

      expect(resultado.nuevoFlujo.nombre_perfil_wa).toBe('Maria WA');
      expect(resultado.nuevoFlujo.metadato_personalizado).toBe(123);
      expect(resultado.nuevoFlujo.version).toBe(ESQUEMA_FLUJO_VERSION);
    });
  });
});
