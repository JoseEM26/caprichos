/**
 * Textos de los avisos de WhatsApp al cliente en cada etapa de un pedido delivery.
 * Cada etapa tiene el texto libre (ventana de 24h abierta) y la plantilla (ventana cerrada).
 * Las variables de la plantilla deben coincidir, en orden, con `variables` de CATALOGO_PLANTILLAS.
 * Tono cálido y con emojis: esto se lee en WhatsApp, no en el admin.
 */
export type EtapaAvisoReparto =
  | 'ACEPTADO'
  | 'LISTO'
  | 'SALIDA'
  | 'LLEGADA'
  | 'INSISTENCIA'
  | 'ESPERA_AGOTADA'
  | 'RETIRO'
  | 'REENVIADO'
  | 'REPROG_RECIBIDA'
  | 'REPROG_CANCELADA'
  | 'REPROG_SIN_RESPUESTA'
  | 'ENTREGADO'
  | 'RECIBIDO';

export interface PayloadAvisoReparto {
  textoLibre: string;
  plantillaClave: string;
  variablesPlantilla: string[];
  botones?: { id: string; titulo: string }[];
}

export const BOTONES_REPROGRAMACION = [
  { id: 'reprogramar_si', titulo: 'Sí, reprogramar' },
  { id: 'reprogramar_no', titulo: 'No, cancelar' },
];

export const TEXTOS_REPARTO = {
  aceptado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😊 Gracias por tu pedido ${codigo}. Ya lo estamos preparando con mucho cariño.`,
    plantillaClave: 'DELIVERY_ACEPTADO',
    variablesPlantilla: [nombre, codigo],
  }),

  listo: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🎉 Tu pedido ${codigo} ya está listo. Pronto sale con nuestro repartidor. 🛵`,
    plantillaClave: 'DELIVERY_LISTO',
    variablesPlantilla: [nombre, codigo],
  }),

  salida: (nombre: string, codigo: string, minutos: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🛵 Tu pedido ${codigo} ya salió de nuestro local y va en camino. Tiempo estimado: ${minutos} minutos. ¡Gracias por tu paciencia! 😊`,
    plantillaClave: 'DELIVERY_SALIDA',
    variablesPlantilla: [nombre, codigo, minutos],
  }),

  llegada: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🛵 Nuestro repartidor ya llegó con tu pedido ${codigo} y te espera en la puerta. ¿Podrías salir a recibirlo? 😊`,
    plantillaClave: 'DELIVERY_LLEGADA',
    variablesPlantilla: [nombre, codigo],
  }),

  insistencia: (nombre: string, codigo: string, minutos: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😊 Nuestro repartidor sigue en la puerta con tu pedido ${codigo} desde hace ${minutos} minutos. Cuando puedas, sal a recibirlo o escríbenos por aquí, con gusto te ayudamos. 🙏`,
    plantillaClave: 'DELIVERY_INSISTENCIA',
    variablesPlantilla: [nombre, codigo, minutos],
  }),

  /** Aviso de espera agotada: solo avisa; la pregunta de reprogramar llega cuando el repartidor se retira. */
  esperaAgotada: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😊 Ya llevamos un buen rato en la puerta con tu pedido ${codigo}. Si no logramos encontrarte, nuestro repartidor tendrá que retirarse en unos minutos. ¿Podrías salir a recibirlo? 🙏`,
    plantillaClave: 'DELIVERY_ESPERA_AGOTADA',
    variablesPlantilla: [nombre, codigo],
  }),

  /**
   * Pregunta tras el retiro: ¿reprogramar? `costoReprogramacion` es la frase con el monto exacto
   * ("Volver a enviarlo tiene un costo de S/ 7.00 ...") o "Volver a enviarlo no tiene costo adicional.".
   * Con ventana abierta lleva los botones; con ventana cerrada la plantilla se responde escribiendo SI o NO.
   */
  retiro: (nombre: string, codigo: string, costoReprogramacion: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😔 Nuestro repartidor tuvo que retirarse con tu pedido ${codigo} porque se agotó el tiempo de espera. ¿Te gustaría reprogramar la entrega? ${costoReprogramacion} Responde SÍ para reprogramar o NO si prefieres cancelarlo. 🙏`,
    plantillaClave: 'DELIVERY_RETIRO',
    variablesPlantilla: [nombre, codigo, costoReprogramacion],
    botones: BOTONES_REPROGRAMACION,
  }),

  /** Confirma al cliente que su SI quedó registrado; Caja/admin coordinan el reenvío. */
  reprogramacionRecibida: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Gracias, ${nombre}! 😊 Recibimos tu solicitud para reprogramar tu pedido ${codigo}. Te escribiremos por aquí para confirmarte la nueva entrega. 🛵`,
    plantillaClave: 'DELIVERY_REPROG_RECIBIDA',
    variablesPlantilla: [nombre, codigo],
  }),

  /** El pedido fue reenviado a reparto tras una reprogramación confirmada por el admin. */
  reenviado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Buenas noticias, ${nombre}! 🎉 Tu pedido ${codigo} fue reprogramado y ya lo volvemos a enviar. Te avisaremos cuando salga. 🛵`,
    plantillaClave: 'DELIVERY_REENVIADO',
    variablesPlantilla: [nombre, codigo],
  }),

  /** El cliente dijo NO a reprogramar: el pedido queda cancelado. */
  reprogramacionCancelada: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, entendemos. 💛 Tu pedido ${codigo} queda cancelado. Gracias por preferir Caprichos; cuando quieras pedir de nuevo, aquí estaremos. 😊`,
    plantillaClave: 'DELIVERY_REPROG_CANCELADA',
    variablesPlantilla: [nombre, codigo],
  }),

  /** No hubo respuesta a la pregunta a tiempo: el pedido queda cancelado por falta de respuesta. */
  reprogramacionSinRespuesta: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, no recibimos tu respuesta sobre el pedido ${codigo}, así que lo dejamos cancelado por ahora. 💛 Si quieres, escríbenos y con gusto te ayudamos a hacer uno nuevo. 😊`,
    plantillaClave: 'DELIVERY_REPROG_SIN_RESPUESTA',
    variablesPlantilla: [nombre, codigo],
  }),

  /** Pedido de la carta virtual con pago digital: el asesor gestiona el voucher por este chat. `medio` es Yape, Plin o transferencia. */
  recibidoDigital: (nombre: string, codigo: string, medio: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡gracias! En unos momentos un asesor te escribirá por este chat para revisar el voucher de tu pago por ${medio}. 🙏`,
    plantillaClave: 'CARTA_RECIBIDO_DIGITAL',
    variablesPlantilla: [nombre, codigo, medio],
  }),

  /** Pedido de la carta virtual pagado en efectivo u otro medio no digital. */
  recibidoEfectivo: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡gracias por tu compra! Ya está en proceso. 🙏`,
    plantillaClave: 'CARTA_RECIBIDO_EFECTIVO',
    variablesPlantilla: [nombre, codigo],
  }),

  entregado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🎉 Tu pedido ${codigo} fue entregado. ¡Gracias por preferir Caprichos, esperamos verte pronto! 💛`,
    plantillaClave: 'DELIVERY_ENTREGADO',
    variablesPlantilla: [nombre, codigo],
  }),
};
