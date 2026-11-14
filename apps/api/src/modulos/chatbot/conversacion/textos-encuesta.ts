import type { PayloadMensajeNegocio } from '../servicios/ventana-24h.service';
import { MOTIVOS_ENCUESTA } from '../servicios/encuesta-motivo.util';

/** Pregunta del porqué cuando calificó 1, 2 o 3: primero esta pregunta, el agradecimiento va después de la respuesta. */
export function textoPreguntaMotivo(nombre: string, codigo: string): PayloadMensajeNegocio {
  return {
    textoLibre: `Gracias por calificarnos, ${nombre} 🙏 Nos importa tu opinión sobre el pedido ${codigo}. ¿Qué fue lo que no salió bien?`,
    lista: { boton: 'Elegir motivo', filas: MOTIVOS_ENCUESTA.map((m) => ({
        id: `motivo:${m.codigo}`,
        // WhatsApp corta el título de la fila a 24 caracteres: el texto completo va de descripción
        titulo: 'corto' in m ? m.corto : m.titulo,
        ...('corto' in m ? { descripcion: m.titulo } : {}),
      })) },
  };
}

export const TEXTO_PIDE_MOTIVO_LIBRE = 'Cuéntanos en pocas palabras qué ocurrió y lo leerá nuestro equipo.';

/**
 * Agradecimiento al cliente después de calificar la encuesta posventa. Un texto por nivel:
 * baja (≤ encuesta_puntaje_queja), media (3) y alta (4-5). Solo WhatsApp: lleva emojis.
 * La plantilla ENCUESTA_GRACIAS es el respaldo si la ventana de 24 h ya estuviera cerrada al enviar.
 */
export function textoGraciasEncuesta(
  puntaje: number,
  umbralQueja: number,
  nombre: string,
  codigo: string,
): PayloadMensajeNegocio {
  const plantillaClave = 'ENCUESTA_GRACIAS' as const;
  const variablesPlantilla = [nombre, codigo];

  if (puntaje <= umbralQueja) {
    return {
      textoLibre: `Gracias por contarnos, ${nombre} 💛 Lamentamos mucho que tu experiencia con el pedido ${codigo} no haya sido la que esperabas. Ya avisamos a nuestro equipo y una persona te escribirá por este chat para entender qué pasó y ayudarte a resolverlo.`,
      plantillaClave,
      variablesPlantilla,
    };
  }

  if (puntaje < 4) {
    return {
      textoLibre: `¡Gracias por tu calificación, ${nombre}! 😊 Tu opinión sobre el pedido ${codigo} nos ayuda a mejorar. 🙏`,
      plantillaClave,
      variablesPlantilla,
    };
  }

  return {
    textoLibre: `¡Muchas gracias por calificarnos, ${nombre}! 🥰 Nos encanta saber que tu pedido ${codigo} estuvo a la altura. Cuando se te antoje, aquí estaremos para tu próximo pedido. 😊`,
    plantillaClave,
    variablesPlantilla,
  };
}
