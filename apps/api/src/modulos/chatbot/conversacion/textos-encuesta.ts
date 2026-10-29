import type { PayloadMensajeNegocio } from '../servicios/ventana-24h.service';

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
      textoLibre: `Gracias por contarnos, ${nombre} 💛 Lamentamos mucho que tu experiencia con el pedido ${codigo} no haya sido la que esperabas. Ya avisamos a nuestro equipo y una persona te escribirá por este chat para entender qué pasó y ayudarte a resolverlo. Si quieres, ya puedes contarnos aquí qué ocurrió.`,
      plantillaClave,
      variablesPlantilla,
    };
  }

  if (puntaje < 4) {
    return {
      textoLibre: `¡Gracias por tu calificación, ${nombre}! 😊 Tu opinión sobre el pedido ${codigo} nos ayuda a mejorar. Si algo podemos hacer mejor, cuéntanoslo por aquí, te leemos con gusto. 🙏`,
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
