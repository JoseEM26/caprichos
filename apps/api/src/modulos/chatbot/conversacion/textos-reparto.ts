/**
 * Textos de los avisos de WhatsApp al cliente en cada etapa de un pedido delivery.
 * Cada etapa tiene el texto libre (ventana de 24h abierta) y la plantilla aprobada (ventana cerrada).
 * Las variables de la plantilla deben coincidir, en orden, con `variables` de CATALOGO_PLANTILLAS.
 */
export type EtapaAvisoReparto =
  | 'ACEPTADO'
  | 'LISTO'
  | 'SALIDA'
  | 'LLEGADA'
  | 'INSISTENCIA'
  | 'ESPERA_AGOTADA'
  | 'RETIRO'
  | 'ENTREGADO';

export interface PayloadAvisoReparto {
  textoLibre: string;
  plantillaClave: string;
  variablesPlantilla: string[];
  botones?: { id: string; titulo: string }[];
}

export const TEXTOS_REPARTO = {
  aceptado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, recibimos tu pedido ${codigo} de Caprichos. Ya lo estamos preparando.`,
    plantillaClave: 'DELIVERY_ACEPTADO',
    variablesPlantilla: [nombre, codigo],
  }),

  listo: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, tu pedido ${codigo} ya esta listo. Pronto sale con nuestro repartidor. 🛵`,
    plantillaClave: 'DELIVERY_LISTO',
    variablesPlantilla: [nombre, codigo],
  }),

  salida: (nombre: string, codigo: string, minutos: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, tu pedido ${codigo} ya salio de nuestro local y va en camino. Tiempo estimado: ${minutos} minutos.`,
    plantillaClave: 'DELIVERY_SALIDA',
    variablesPlantilla: [nombre, codigo, minutos],
  }),

  llegada: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, nuestro repartidor ya llego con tu pedido ${codigo} y esta en la puerta. Por favor sal a recibirlo.`,
    plantillaClave: 'DELIVERY_LLEGADA',
    variablesPlantilla: [nombre, codigo],
  }),

  insistencia: (nombre: string, codigo: string, minutos: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, nuestro repartidor sigue esperando en la puerta con tu pedido ${codigo} desde hace ${minutos} minutos. Por favor sal o comunicate con nosotros.`,
    plantillaClave: 'DELIVERY_INSISTENCIA',
    variablesPlantilla: [nombre, codigo, minutos],
  }),

  esperaAgotada: (nombre: string, codigo: string, montoRecargo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, se agoto el tiempo de espera en la puerta para tu pedido ${codigo} y el repartidor debe retirarse. Puedes solicitar la reprogramacion con un recargo de ${montoRecargo}. ¿Deseas reprogramar la entrega?`,
    plantillaClave: 'DELIVERY_ESPERA_AGOTADA',
    variablesPlantilla: [nombre, codigo, montoRecargo],
    botones: [
      { id: 'reprogramar_si', titulo: 'Si reprogramar' },
      { id: 'reprogramar_no', titulo: 'No gracias' },
    ],
  }),

  /** `condicionRecargo` es "con un recargo de S/ 5.00" o "sin recargo". */
  retiro: (nombre: string, codigo: string, condicionRecargo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, el repartidor se retiro de la puerta con tu pedido ${codigo} porque se agoto el tiempo de espera. Tu pedido queda reprogramado ${condicionRecargo}. Te contactaremos para coordinar la nueva entrega.`,
    plantillaClave: 'DELIVERY_RETIRO',
    variablesPlantilla: [nombre, codigo, condicionRecargo],
  }),

  entregado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `Hola ${nombre}, tu pedido ${codigo} fue entregado. Gracias por preferir Caprichos.`,
    plantillaClave: 'DELIVERY_ENTREGADO',
    variablesPlantilla: [nombre, codigo],
  }),
};
