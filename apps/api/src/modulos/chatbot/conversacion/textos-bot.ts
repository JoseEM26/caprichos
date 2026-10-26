import { BotonAccion } from '../puerto/whatsapp-mensajeria.puerto';
import { DatosHorarioLocal } from './tipos-conversacion';

/**
 * Catálogo centralizado de textos del bot de WhatsApp para Caprichos.
 *
 * Lineamientos:
 * - Español cercano, respetuoso y claro.
 * - Sin jerga ni diminutivos excesivos.
 * - Estrictamente SIN EMOJIS en los textos dirigidos a clientes.
 * - Preparado para parametrización o edición dinámica en la Ola 4.
 */

export const BOTONES_MENU_PRINCIPAL: BotonAccion[] = [
  { id: 'btn_pedido', titulo: 'Hacer un pedido' },
  { id: 'btn_horario_ubicacion', titulo: 'Horario y ubicacion' },
  { id: 'btn_persona', titulo: 'Hablar con una persona' },
];

export const BOTON_VOLVER_MENU: BotonAccion = {
  id: 'btn_menu',
  titulo: 'Menu principal',
};

export const TEXTOS_BOT = {
  /**
   * Saludo inicial al cliente en el menú de bienvenida.
   */
  saludoBienvenida: (nombre?: string | null): string => {
    const nombreLimpio = String(nombre || '').trim();
    if (nombreLimpio) {
      return `Hola ${nombreLimpio}, bienvenido/a a Caprichos. ¿En qué te podemos ayudar hoy?`;
    }
    return 'Hola, bienvenido/a a Caprichos. ¿En qué te podemos ayudar hoy?';
  },

  /**
   * Respuesta informativa cuando el cliente solicita hacer un pedido (Ola 1, previo a Ola 2).
   */
  pedidoProximamente: (cartaUrl?: string | null): string => {
    const urlLimpia = String(cartaUrl || '').trim();
    if (urlLimpia) {
      return `Muy pronto podras pedir por aqui. Mientras tanto haz tu pedido en nuestra carta: ${urlLimpia}`;
    }
    return 'Muy pronto podras pedir por aqui. Mientras tanto haz tu pedido en nuestra carta.';
  },

  /**
   * Respuesta con datos del local: estado de apertura, horario, dirección y enlace en Google Maps.
   */
  horarioYUbicacion: (datos?: DatosHorarioLocal): string => {
    const direccion = datos?.direccion?.trim() || 'Av. Principal 123';
    const enlaceMapa =
      datos?.enlaceMapa?.trim() ||
      'https://www.google.com/maps?q=-12.0196436,-76.963255';

    if (datos?.pausaAltaDemanda) {
      const motivo = datos.motivoPausa || 'alta demanda de pedidos';
      return [
        `Por el momento no estamos recibiendo pedidos (${motivo}).`,
        `Direccion: ${direccion}`,
        `Ubicacion en mapa: ${enlaceMapa}`,
      ].join('\n');
    }

    if (datos?.abierta && datos.abre && datos.cierra) {
      return [
        `Nuestro local esta abierto hoy de ${datos.abre} a ${datos.cierra}.`,
        `Direccion: ${direccion}`,
        `Ubicacion en mapa: ${enlaceMapa}`,
      ].join('\n');
    }

    if (!datos?.abierta && datos?.abre) {
      const cierreTexto = datos.cierra ? ` (hasta las ${datos.cierra})` : '';
      return [
        `Nuestro local esta cerrado en este momento. Abrimos hoy a las ${datos.abre}${cierreTexto}.`,
        `Direccion: ${direccion}`,
        `Ubicacion en mapa: ${enlaceMapa}`,
      ].join('\n');
    }

    return [
      'Nuestro local esta cerrado por hoy.',
      `Direccion: ${direccion}`,
      `Ubicacion en mapa: ${enlaceMapa}`,
    ].join('\n');
  },

  /**
   * Mensaje de confirmación de transferencia a atención por una persona del equipo.
   */
  pasarAPersona: (): string => {
    return 'Te pasamos con una persona del equipo, te escribira en breve.';
  },

  /**
   * Primera repregunta cuando el bot no entiende un mensaje libre o confuso.
   */
  noEntiendoRepregunta: (): string => {
    return 'Disculpa, no entendi tu mensaje. Por favor elige una de las siguientes opciones:';
  },

  /**
   * Derivación automática a una persona tras no entender por segunda vez consecutiva.
   */
  noEntiendoDerivacion: (): string => {
    return 'No pude entender tu mensaje. Te comunico con una persona del equipo para que te ayude.';
  },
};
