import { BotonAccion } from '../../tipos-conversacion';

export const BOTONES_CAMBIO_CONFIRMAR_DIR: BotonAccion[] = [
  { id: 'c_dir_si', titulo: 'Confirmar cambio' },
  { id: 'c_dir_cambiar', titulo: 'Modificar' },
  { id: 'menu', titulo: 'Volver al menú' },
];

export const BOTONES_CAMBIO_CONFIRMAR_PED: BotonAccion[] = [
  { id: 'c_ped_si', titulo: 'Confirmar solicitud' },
  { id: 'c_ped_cambiar', titulo: 'Modificar' },
  { id: 'menu', titulo: 'Volver al menú' },
];

export const BOTONES_CAMBIO_NO_PERMITIDO: BotonAccion[] = [
  { id: 'persona', titulo: 'Hablar con persona' },
  { id: 'menu', titulo: 'Volver al menú' },
];

export const BOTONES_CAMBIO_UBICACION_FALLIDA: BotonAccion[] = [
  { id: 'c_dir_escribir', titulo: 'Escribir dirección' },
  { id: 'menu', titulo: 'Volver al menú' },
];

export const TEXTOS_CAMBIOS = {
  pedirNuevaUbicacion: (codigo: string): string =>
    `📍 Para cambiar la dirección de tu pedido ${codigo}, comparte tu ubicación con el clip 📎 de WhatsApp o escribe tu calle y número:`.slice(0, 1024),

  pedirReferencia: (): string =>
    '🏠 ¿Alguna referencia para el repartidor? (ejemplo: frente al parque, timbre 2B, o escribe "sin referencia"):'.slice(0, 1024),

  ubicacionFueraDeCobertura: (): string =>
    'Lo sentimos, la ubicación seleccionada está fuera de nuestra zona de cobertura para delivery. Puedes ingresar otra dirección dentro de la zona de reparto:'.slice(0, 1024),

  resumenCambioDireccion: (params: {
    codigo: string;
    direccion: string;
    referencia?: string;
    zonaNombre?: string;
    tarifaActual?: number;
    tarifaNueva?: number;
    recargo?: number;
  }): string => {
    const lineas: string[] = [
      '📋 *Resumen de cambio de dirección*',
      '',
      `📦 *Pedido:* ${params.codigo}`,
      `📍 *Nueva dirección:* ${params.direccion}`,
      `🏠 *Referencia:* ${params.referencia || 'Sin referencia'}`,
    ];

    if (params.zonaNombre) {
      lineas.push(`🛵 *Zona:* ${params.zonaNombre}`);
    }

    if (params.recargo !== undefined && params.recargo !== null) {
      if (params.recargo > 0) {
        lineas.push(`💵 *Recargo de envío:* +S/ ${params.recargo.toFixed(2)} (zona con tarifa distinta)`);
      } else if (params.recargo < 0) {
        lineas.push(`💵 *Ajuste de envío:* -S/ ${Math.abs(params.recargo).toFixed(2)}`);
      } else {
        lineas.push('💵 *Envío:* Misma tarifa de zona (S/ 0.00 adicional)');
      }
    }

    lineas.push('');
    lineas.push('Un asesor revisará la solicitud y te confirmará por este chat.');
    return lineas.join('\n').slice(0, 1024);
  },

  solicitudDireccionEnviada: (codigo: string, tieneRecargo: boolean): string => {
    if (tieneRecargo) {
      return `Tu pedido ${codigo} ya está en preparación. Ya avisé a un asesor para ver si se puede cambiar la dirección; si la nueva zona cuesta distinto, te confirma el nuevo envío.`.slice(0, 1024);
    }
    return `Tu pedido ${codigo} ya está en preparación. Ya avisé a un asesor para ver si se puede cambiar la dirección.`.slice(0, 1024);
  },

  pedirDetalleCambioPedido: (codigo: string): string =>
    `📝 Cuéntanos qué productos deseas modificar o si deseas cancelar tu pedido ${codigo}:`.slice(0, 1024),

  resumenCambioPedido: (codigo: string, detalle: string): string => {
    const lineas: string[] = [
      '📋 *Resumen de solicitud*',
      '',
      `📦 *Pedido:* ${codigo}`,
      `📝 *Detalle:* ${detalle}`,
      '',
      'Un asesor revisará tu solicitud y te responderá por este chat.',
    ];
    return lineas.join('\n').slice(0, 1024);
  },

  solicitudPedidoEnviada: (codigo: string): string =>
    `Tu pedido ${codigo} ya está en cocina y quitar productos no siempre se puede. Ya avisé a un asesor para revisarlo contigo ahora.`.slice(0, 1024),

  solicitudCancelacionEnviada: (codigo: string): string =>
    `Tu solicitud de cancelación para el pedido ${codigo} fue enviada a Caja. Un asesor la revisará y te responderá por aquí.`.slice(0, 1024),

  cambioNoPermitidoEstado: (codigo: string, estado: string, esEnRuta: boolean): string => {
    if (esEnRuta || estado === 'EN_CAMINO' || estado === 'RUTA') {
      return `Tu pedido ${codigo} ya salió con el repartidor y por seguridad no lo puedo cambiar desde aquí. Ya avisé a un asesor para que hable contigo y con el repartidor ahora mismo.`.slice(0, 1024);
    }
    if (estado === 'LISTO') {
      return `Tu pedido ${codigo} ya está listo y empaquetado esperando al repartidor. No es posible modificarlo automáticamente, pero puedo pasarte con un asesor.`.slice(0, 1024);
    }
    if (estado === 'ENTREGADO') {
      return `Tu pedido ${codigo} figura como entregado. Si hubo algún problema, ya avisé a una persona del equipo para que te escriba.`.slice(0, 1024);
    }
    return `Tu pedido ${codigo} ya no se encuentra en preparación y no puede modificarse. ¿Deseas hablar con una persona?`.slice(0, 1024);
  },

  cambioNoEsDelivery: (codigo: string): string =>
    `El pedido ${codigo} fue solicitado para recojo o en salón. El cambio de dirección solo aplica a pedidos con entrega por delivery.`.slice(0, 1024),

  limiteCambiosPorPedido: (codigo: string): string =>
    `El pedido ${codigo} ya cuenta con el máximo permitido de 2 solicitudes de cambio. Un asesor de nuestro equipo te atenderá directamente.`.slice(0, 1024),

  limiteSolicitudesAbiertasTelefono: (): string =>
    'Ya cuentas con 3 solicitudes de cambio pendientes de revisión. Por favor espera la respuesta de nuestro equipo antes de enviar otra.'.slice(0, 1024),

  fueraDeHorario: (horaAbre: string, horaCierra: string, horaAbreReal: string): string =>
    `Ahora estamos cerrados. Nuestro horario de atención es de ${horaAbre} a ${horaCierra}. Te escribiremos cuando abramos a las ${horaAbreReal} ☕. Dejamos tu consulta anotada para atenderte primero al abrir.`.slice(0, 1024),

  quejaUrgenteRecibida: (): string =>
    'Lamentamos mucho el inconveniente 😔. Hemos registrado tu reclamo con máxima prioridad (URGENTE) y un encargado de nuestro equipo te escribirá de inmediato.'.slice(0, 1024),

  botRetomaAtencion: (): string =>
    '¡Hola! Soy Capri de nuevo ☕. Ya retomé este chat para seguir ayudándote. Si deseas ver opciones, escribe "menú" o elige una opción 🧁.'.slice(0, 1024),

  cambioDireccionAplicadoCliente: (codigo: string, nuevaDireccion: string): string =>
    `Listo, cambiamos tu dirección para el pedido ${codigo} a: ${nuevaDireccion} ✅. Tu repartidor ya cuenta con los datos actualizados.`.slice(0, 1024),

  cambioPedidoAplicadoCliente: (codigo: string): string =>
    `Listo, cambiamos tu pedido ${codigo} según lo coordinado ✅. El equipo de cocina ya tiene las modificaciones.`.slice(0, 1024),

  cancelacionAplicadaCliente: (codigo: string): string =>
    `Tu pedido ${codigo} ha sido cancelado por un asesor ✅. Si realizaste un pago coordinado, nuestro equipo se comunicará por este chat para gestionar la devolución.`.slice(0, 1024),

  cambioRechazadoCliente: (codigo: string, motivo: string): string =>
    `No pudimos realizar el cambio en tu pedido ${codigo}. Motivo: ${motivo}. Si necesitas más información, un asesor te responderá por este chat.`.slice(0, 1024),
};
