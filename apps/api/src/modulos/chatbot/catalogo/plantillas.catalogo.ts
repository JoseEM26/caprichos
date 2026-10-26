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
  REABRIR_CONVERSACION: {
    nombre: 'caprichos_reabrir_conversacion',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente'],
    texto: 'Hola {{1}}, nos comunicamos de Caprichos para dar seguimiento a tu consulta. ¿En que podemos ayudarte?',
    descripcion: 'Plantilla de utilidad para reabrir la conversación cuando la ventana de 24 horas está cerrada.',
  },
  RESERVA_CONFIRMADA: {
    nombre: 'caprichos_reserva_confirmada',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'fecha_hora', 'personas'],
    texto: 'Hola {{1}}, tu reserva para {{3}} personas el {{2}} esta confirmada. Te esperamos.',
    descripcion: 'Aviso al cliente cuando su solicitud de reserva es aprobada.',
  },
  RESERVA_RECORDATORIO: {
    nombre: 'caprichos_reserva_recordatorio',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'fecha_hora'],
    texto: 'Hola {{1}}, te recordamos tu reserva de mesa para hoy a las {{2}}. Te esperamos.',
    descripcion: 'Recordatorio opcional 2 horas antes de la reserva.',
  },
  RESERVA_ACTUALIZACION: {
    nombre: 'caprichos_reserva_actualizacion',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_cliente', 'mensaje'],
    texto: 'Hola {{1}}, te informamos sobre tu reserva: {{2}}.',
    descripcion: 'Aviso sobre cambio o estado de la reserva.',
  },
  EQUIPO_NUEVO_PEDIDO: {
    nombre: 'caprichos_equipo_nuevo_pedido',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['codigo_pedido', 'modalidad_cliente', 'monto_total'],
    texto: 'Aviso para el equipo de Caprichos: se ha registrado el nuevo pedido {{1}} ({{2}}) por un total de S/ {{3}}. Por favor revisarlo en el sistema.',
    descripcion: 'Aviso al personal del equipo fuera de la ventana de 24h ante un nuevo pedido.',
  },
  EQUIPO_ALERTA_ALMACEN: {
    nombre: 'caprichos_equipo_alerta_almacen',
    categoria: 'UTILITY',
    idioma: 'es',
    variables: ['nombre_insumo', 'tipo_alerta', 'stock_actual'],
    texto: 'Aviso de almacen de Caprichos: el insumo {{1}} se encuentra en estado {{2}} (Stock: {{3}}). Por favor coordinar su reposicion.',
    descripcion: 'Aviso al personal del equipo fuera de la ventana de 24h cuando un insumo esta agotado o por pedir.',
  },
};
