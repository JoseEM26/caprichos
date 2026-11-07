/**
 * Textos de los avisos de WhatsApp al cliente en cada etapa de un pedido delivery.
 * Cada etapa tiene el texto libre (ventana de 24h abierta) y la plantilla (ventana cerrada).
 * Las variables de la plantilla deben coincidir, en orden, con `variables` de CATALOGO_PLANTILLAS.
 * Tono cálido y con emojis: esto se lee en WhatsApp, no en el admin.
 */
export type EtapaAvisoReparto =
  | 'ACEPTADO'
  | 'LISTO'
  | 'ASIGNADO'
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
  | 'RECIBIDO'
  | 'VOUCHER_RECORDATORIO';

export interface PayloadAvisoReparto {
  textoLibre: string;
  plantillaClave: string;
  variablesPlantilla: string[];
  botones?: { id: string; titulo: string }[];
  /** Plantilla vigente a la que se cae si Meta rechaza la principal (no aprobada). */
  plantillaRespaldo?: { plantillaClave: string; variablesPlantilla: string[] };
}

export const BOTONES_REPROGRAMACION = [
  { id: 'reprogramar_si', titulo: 'Sí, reprogramar' },
  { id: 'reprogramar_no', titulo: 'No, cancelar' },
];

/** Resumen del pedido para el aviso «Recibimos tu pedido» (productos, total y estado del envío). */
export interface ResumenRecibido {
  lineas: string[];
  total: number;
  medioPago: string;
  /** Delivery sin punto en el mapa: el envío se calcula al recibir la ubicación y se le pide al cliente. */
  envioPorConfirmar: boolean;
  /** Delivery con envío ya calculado (soles) */
  envio?: number | null;
}

const bloqueResumen = (r: ResumenRecibido): string =>
  `\n\n🧾 Tu pedido:\n${r.lineas.map((l) => `• ${l}`).join('\n')}\n💰 Total: S/ ${r.total.toFixed(2)}${r.envioPorConfirmar ? ' (sin envío)' : ''}`;

const bloqueEnvio = (r: ResumenRecibido): string => {
  if (r.envioPorConfirmar) {
    return '\n\n🛵 Envío por confirmar: se calcula al recibir tu ubicación.\n📍 Envíanos tu ubicación: toca el clip 📎 → Ubicación → Enviar tu ubicación actual.';
  }
  return r.envio != null ? `\n\n🛵 Envío: ${r.envio === 0 ? 'gratis' : `S/ ${r.envio.toFixed(2)}`}.` : '';
};

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

  /** Un repartidor tomó el pedido (o se reasignó a otro). `repartidor` es solo su nombre de pila. */
  asignado: (nombre: string, codigo: string, repartidor: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🛵 Para tu pedido ${codigo} ya asignamos a tu delivery ${repartidor}. Te avisaremos cuando salga hacia tu dirección. 😊`,
    plantillaClave: 'DELIVERY_ASIGNADO',
    variablesPlantilla: [nombre, codigo, repartidor],
  }),

  /** `minutos` es el rango ya formateado: «25 a 30» (o un número si cae al respaldo). */
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

  /**
   * Pedido de la carta virtual con pago digital: el asesor gestiona el voucher por este chat. `medio` es Yape, Plin o transferencia.
   * El enlace de seguimiento va en el texto libre (ventana abierta). La plantilla no cambia: no tiene la variable.
   */
  recibidoDigital: (nombre: string, codigo: string, medio: string, enlace?: string | null, resumen?: ResumenRecibido | null): PayloadAvisoReparto => ({
    textoLibre: resumen
      ? `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡muchas gracias! 🎉${bloqueResumen(resumen)}\n\n💳 Pago por ${medio}: envíanos por aquí mismo la captura (foto) de tu pago 📸 y un asesor la revisará para confirmar tu pedido. 🙏${bloqueEnvio(resumen)}${enlace ? `\n\nSigue tu pedido aquí: ${enlace}` : ''}`
      : `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡muchas gracias! 🎉 En unos momentos un asesor te escribirá por este chat para revisar el voucher de tu pago por ${medio}. Mientras tanto, por favor envíanos la foto de tu voucher por aquí mismo 📸 🙏${enlace ? ` Sigue tu pedido aquí: ${enlace}` : ''}`,
    plantillaClave: 'CARTA_RECIBIDO_DIGITAL',
    variablesPlantilla: [nombre, codigo, medio],
  }),

  /**
   * Pedido de la carta virtual pagado en efectivo u otro medio no digital, con el enlace de seguimiento.
   * Ventana cerrada: la plantilla nueva solo si `plantillaSeguimiento` (Meta ya la aprobó); si no, la vigente sin enlace.
   */
  recibidoEfectivo: (nombre: string, codigo: string, enlace?: string | null, plantillaSeguimiento = false, resumen?: ResumenRecibido | null): PayloadAvisoReparto => {
    if (resumen) {
      const plantilla = enlace && plantillaSeguimiento
        ? { plantillaClave: 'CARTA_RECIBIDO_SEGUIMIENTO', variablesPlantilla: [nombre, codigo, enlace] }
        : { plantillaClave: 'CARTA_RECIBIDO_EFECTIVO', variablesPlantilla: [nombre, codigo] };
      return {
        textoLibre: `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡gracias por tu compra! Ya está en proceso.${bloqueResumen(resumen)}\n\n💵 Pago: ${resumen.medioPago}.${bloqueEnvio(resumen)}${enlace ? `\n\nSigue tu pedido aquí: ${enlace}` : ''}`,
        ...plantilla,
      };
    }
    if (enlace && plantillaSeguimiento) {
      return {
        textoLibre: `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡gracias por tu compra! Ya está en proceso. Sigue tu pedido aquí: ${enlace}. ¡Gracias por preferir Caprichos! 💛`,
        plantillaClave: 'CARTA_RECIBIDO_SEGUIMIENTO',
        variablesPlantilla: [nombre, codigo, enlace],
      };
    }
    return {
      textoLibre: `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡gracias por tu compra! Ya está en proceso. 🙏${enlace ? ` Sigue tu pedido aquí: ${enlace}` : ''}`,
      plantillaClave: 'CARTA_RECIBIDO_EFECTIVO',
      variablesPlantilla: [nombre, codigo],
    };
  },

  /** Recordatorio a los pocos minutos si el pedido digital sigue sin voucher (una sola vez por pedido). */
  voucherRecordatorio: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🙏 Seguimos en la espera de tu voucher del pedido ${codigo}. En cuanto lo recibamos, nuestro equipo lo revisa enseguida. Mientras tanto puedes ver la carta o escribir *asesor* si necesitas ayuda. 😊`,
    plantillaClave: 'CARTA_VOUCHER_RECORDATORIO',
    variablesPlantilla: [nombre, codigo],
  }),

  entregado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🎉 Tu pedido ${codigo} fue entregado. ¡Gracias por preferir Caprichos, esperamos verte pronto! 💛`,
    plantillaClave: 'DELIVERY_ENTREGADO',
    variablesPlantilla: [nombre, codigo],
  }),
};

/** Puntos con dos decimales como mucho y sin ceros de más («12», «12.5», «12.75»). */
export const formatearPuntos = (n: number): string => String(Math.round(Number(n) * 100) / 100);

/**
 * Primer pedido de un celular: se anexa la línea «ya sumas puntos» al aviso RECIBIDO (un solo mensaje).
 * Con efectivo la plantilla trae el enlace como variable; con digital la línea viaja solo en texto libre
 * (dentro de la ventana de 24 h), porque su plantilla no tiene la variable.
 */
export function conBienvenidaPuntos(
  base: PayloadAvisoReparto,
  nombre: string,
  codigo: string,
  enlace: string,
  efectivo: boolean,
): PayloadAvisoReparto {
  const textoLibre = `${base.textoLibre} Ya sumas puntos con este número. Ve tus puntos aquí: ${enlace}`;
  if (efectivo) {
    return { textoLibre, plantillaClave: 'CARTA_RECIBIDO_BIENVENIDA_PUNTOS', variablesPlantilla: [nombre, codigo, enlace] };
  }
  return { ...base, textoLibre };
}

/** Aviso ENTREGADO de un pedido que suma puntos: «Ganaste N puntos. Total: M». */
export function conPuntosEntregado(base: PayloadAvisoReparto, nombre: string, codigo: string, ganados: number, total: number): PayloadAvisoReparto {
  const g = formatearPuntos(ganados);
  const t = formatearPuntos(total);
  return {
    textoLibre: `${base.textoLibre} Ganaste ${g} puntos. Total: ${t}.`,
    plantillaClave: 'DELIVERY_ENTREGADO_PUNTOS',
    variablesPlantilla: [nombre, codigo, g, t],
  };
}

/**
 * Delivery sin ubicación y sin ventana de 24 h: plantilla que pide la ubicación (el texto libre, con ventana
 * abierta, ya la pide). Si Meta la rechaza, cae a la plantilla que traía el payload. `medio` null = efectivo.
 */
export function conPlantillaUbicacion(base: PayloadAvisoReparto, nombre: string, codigo: string, medio: string | null): PayloadAvisoReparto {
  return {
    ...base,
    plantillaClave: medio ? 'CARTA_DELIVERY_UBICACION_DIGITAL' : 'CARTA_DELIVERY_UBICACION_EFECTIVO',
    variablesPlantilla: medio ? [nombre, codigo, medio] : [nombre, codigo],
    plantillaRespaldo: { plantillaClave: base.plantillaClave, variablesPlantilla: base.variablesPlantilla },
  };
}
