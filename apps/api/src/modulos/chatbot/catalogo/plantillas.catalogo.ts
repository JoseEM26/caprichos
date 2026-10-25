export interface DefinicionPlantilla {
  nombre: string;
  categoria: 'UTILITY' | 'MARKETING';
  idioma: string;
  texto: string;
  variables: string[];
  descripcion: string;
}

export const CATALOGO_PLANTILLAS: Record<string, DefinicionPlantilla> = {
  DELIVERY_SALIDA: {
    nombre: 'caprichos_delivery_en_camino',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido', 'tiempo_estimado_min'],
    texto: 'Hola {{1}}, tu pedido {{2}} de Caprichos ya salio de nuestro local y va en camino. Tiempo estimado de entrega: {{3}} minutos.',
    descripcion: 'Aviso 1 al cliente cuando el repartidor sale con el pedido.',
  },
  DELIVERY_LLEGADA: {
    nombre: 'caprichos_delivery_llegado',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido'],
    texto: 'Hola {{1}}, nuestro repartidor ya llego con tu pedido {{2}} y esta en la puerta. Por favor sal a recibirlo.',
    descripcion: 'Aviso 2 al cliente informando que el repartidor llegó a su dirección.',
  },
  DELIVERY_INSISTENCIA: {
    nombre: 'caprichos_delivery_insistencia',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido', 'minutos_espera'],
    texto: 'Hola {{1}}, nuestro repartidor sigue esperando en la puerta con tu pedido {{2}} desde hace {{3}} minutos. Por favor sal o comunicate con nosotros.',
    descripcion: 'Aviso 3 de insistencia tras N minutos sin respuesta ni entrega en la puerta.',
  },
  DELIVERY_ESPERA_AGOTADA: {
    nombre: 'caprichos_delivery_reprogramacion',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido', 'monto_recargo'],
    texto: 'Hola {{1}}, se agoto el tiempo maximo de espera para tu pedido {{2}} y el repartidor debe retirarse. Puedes solicitar la reprogramacion del envio con un recargo adicional de {{3}}. Responde SI para reprogramar o NO si prefieres cancelarlo.',
    descripcion: 'Aviso cuando se agota la espera en puerta y se ofrece reprogramación.',
  },
  PAGO_CONFIRMADO: {
    nombre: 'caprichos_pago_confirmado',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido'],
    texto: 'Hola {{1}}, recibimos tu pago. Tu pedido {{2}} esta en preparacion.',
    descripcion: 'Aviso cuando una persona de Caja confirma el comprobante o pago del cliente.',
  },
  PEDIDO_LISTO_RECOJO: {
    nombre: 'caprichos_pedido_listo_recojo',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido'],
    texto: 'Hola {{1}}, tu pedido {{2}} ya esta listo para recoger en nuestro local. Te esperamos.',
    descripcion: 'Aviso cuando un pedido con modalidad recojo pasa a estado LISTO.',
  },
  ENCUESTA_POSVENTA: {
    nombre: 'caprichos_encuesta_posventa',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'codigo_pedido'],
    texto: 'Hola {{1}}, gracias por tu compra en Caprichos (pedido {{2}}). ¿Como calificarias tu atencion del 1 al 5?',
    descripcion: 'Plantilla de encuesta posventa enviada tras la entrega del pedido.',
  },
};
