import {
  SubFlujoConversacion,
  RegistroSubFlujos,
} from '../registro-flujos';
import {
  ContextoConversacion,
  EntradaNormalizada,
  FlujoConversacion,
  ResultadoTransicion,
} from '../../tipos-conversacion';
import {
  TEXTOS_IA,
  BOTONES_IA_ESTANDAR,
} from '../../textos-ia';

export class FlujoIaSubFlujo implements SubFlujoConversacion {
  readonly nombre = 'IA_DUDAS';

  /**
   * Determina si este subflujo debe atender la interacción:
   * 1. La conversación se encuentra explícitamente en el estado DUDA_IA.
   * 2. El cliente pulsa "Preguntar algo" y la IA está activa.
   * 3. El cliente pulsa FAQs dinámicas (lactosa, bebidas calientes, postres) y la IA está activa.
   * 4. El cliente se encuentra en PREGUNTAS y escribe texto libre.
   */
  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): boolean {
    // Si la entrada es un comando global para volver al menú o pedir una persona, dejar a la máquina principal
    if (
      entrada.id === 'btn_menu' ||
      entrada.id === 'menu' ||
      entrada.id === 'btn_persona' ||
      entrada.id === 'persona' ||
      entrada.id === 'pedir' ||
      entrada.id === 'reservar' ||
      entrada.id === 'mipedido'
    ) {
      return false;
    }

    if (flujo.estado === 'DUDA_IA') {
      return true;
    }

    if (contexto.chatbotIaActivo) {
      if (
        entrada.id === 'preguntar' ||
        entrada.id === 'btn_preguntas' ||
        entrada.id === 'faq_lactosa' ||
        entrada.id === 'faq_calientes' ||
        entrada.id === 'faq_postres'
      ) {
        return true;
      }

      if (flujo.estado === 'PREGUNTAS' && entrada.texto && entrada.texto.length > 0) {
        return true;
      }
    }

    return false;
  }

  transicionar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    const idInteractivo = entrada.id;
    const texto = (entrada.textoOriginal || entrada.texto || '').trim();

    // 1. Si toca "Preguntar algo" sin texto adicional
    if (
      (idInteractivo === 'preguntar' || idInteractivo === 'btn_preguntas') &&
      (!texto || texto.toLowerCase() === 'preguntar' || texto.toLowerCase() === 'preguntar algo')
    ) {
      return {
        nuevoEstado: 'DUDA_IA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_IA.invitacionPreguntar(),
            botones: BOTONES_IA_ESTANDAR,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'DUDA_IA',
          repreguntasFallidas: 0,
        },
      };
    }

    // 2. Mapeo de preguntas de ejemplo del mockup
    let preguntaFinal = texto;
    if (idInteractivo === 'faq_lactosa') {
      preguntaFinal = 'Soy intolerante a la lactosa, ¿qué opciones tienen en la carta?';
    } else if (idInteractivo === 'faq_calientes') {
      preguntaFinal = '¿Qué bebidas calientes tienen disponibles hoy?';
    } else if (idInteractivo === 'faq_postres') {
      preguntaFinal = '¿Qué postres tienen disponibles hoy?';
    }

    if (!preguntaFinal) {
      preguntaFinal = '¿Qué me recomiendas de la carta?';
    }

    // 3. Emitir acción consultarIa hacia el ejecutor
    return {
      nuevoEstado: 'DUDA_IA',
      acciones: [
        {
          tipo: 'consultarIa',
          pregunta: preguntaFinal,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'DUDA_IA',
        repreguntasFallidas: 0,
      },
    };
  }
}

// Registro automático del subflujo en el registro central
export const flujoIa = new FlujoIaSubFlujo();
RegistroSubFlujos.registrar(flujoIa);
