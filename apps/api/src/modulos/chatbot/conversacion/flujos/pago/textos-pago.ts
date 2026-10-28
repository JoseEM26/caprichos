import { BotonAccion } from '../../tipos-conversacion';

/**
 * Botones fijos para el flujo de pago y validación de comprobante (FT-BOT-02)
 * Todos respetan estrictamente el límite de <= 20 caracteres de WhatsApp.
 */
export const BOTON_PAGO_REENVIAR: BotonAccion = {
  id: 'pago_reenviar_voucher',
  titulo: 'Reenviar captura', // 16 chars <= 20
};

export const BOTON_PAGO_CAMBIAR_MEDIO: BotonAccion = {
  id: 'pago_cambiar_medio',
  titulo: 'Cambiar medio pago', // 18 chars <= 20
};

export const BOTON_PAGO_HABLAR_PERSONA: BotonAccion = {
  id: 'persona',
  titulo: 'Hablar con persona', // 18 chars <= 20
};

export const BOTON_PAGO_VOLVER_MENU: BotonAccion = {
  id: 'btn_menu',
  titulo: 'Volver al menú', // 14 chars <= 20
};

export const BOTONES_PAGO_RECHAZADO: BotonAccion[] = [
  BOTON_PAGO_REENVIAR,
  BOTON_PAGO_CAMBIAR_MEDIO,
  BOTON_PAGO_HABLAR_PERSONA,
];

export const BOTON_PAGO_MEDIO_EFECTIVO: BotonAccion = {
  id: 'pago_medio_efectivo',
  titulo: 'Efectivo', // 8 chars <= 20
};

export const BOTON_PAGO_MEDIO_YAPE_PLIN: BotonAccion = {
  id: 'pago_medio_yape_plin',
  titulo: 'Yape o Plin', // 11 chars <= 20
};

export const BOTON_PAGO_MEDIO_TARJETA: BotonAccion = {
  id: 'pago_medio_tarjeta',
  titulo: 'Tarjeta POS', // 11 chars <= 20
};

export const BOTONES_PAGO_MEDIOS_CAMBIO: BotonAccion[] = [
  BOTON_PAGO_MEDIO_EFECTIVO,
  BOTON_PAGO_MEDIO_YAPE_PLIN,
  BOTON_PAGO_MEDIO_TARJETA,
];

export interface InfoDatosPago {
  codigo: string;
  total: number;
  metodo: string;
  datosLocalPagos?: any;
}

export interface InfoSeguimientoPago {
  codigo: string;
  estado: string; // esperando_pago | validando_pago | en_preparacion | listo | en_camino | entregado | anulado
  medio?: string;
  tiempoEstimadoMin?: number;
  repartidorNombre?: string;
  altaDemanda?: boolean;
}

/**
 * Catálogo de textos del flujo de Pago (FT-BOT-02, HU-CAP-130, 131, 132, 139, 030).
 * Todos los textos respetan <= 1024 caracteres y replican fielmente el guión del mockup Chatbot.dc.html.
 */
export const TEXTOS_PAGO = {
  datosPagoMensaje: (info: InfoDatosPago): string => {
    const cod = info.codigo;
    const tot = Number(info.total).toFixed(2);
    const med = (info.metodo || 'YAPE').toUpperCase();
    const pagos = info.datosLocalPagos || {};

    let detalle = '';
    if (med === 'YAPE') {
      const y = pagos.yape || {};
      const num = y.numero || '9XX XXX XXX';
      const tit = y.titular ? `\n• Titular: ${y.titular}` : '';
      detalle = `📲 Yape:\n• Número: ${num}${tit}`;
    } else if (med === 'PLIN') {
      const p = pagos.plin || {};
      const num = p.numero || '9XX XXX XXX';
      const tit = p.titular ? `\n• Titular: ${p.titular}` : '';
      detalle = `📲 Plin:\n• Número: ${num}${tit}`;
    } else if (med === 'TRANSFERENCIA') {
      const t = pagos.transferencia || {};
      const bco = t.banco ? ` (${t.banco})` : '';
      const cta = t.cuenta || 'Consultar en caja';
      const tit = t.titular ? `\n• Titular: ${t.titular}` : '';
      const cci = t.cci ? `\n• CCI: ${t.cci}` : '';
      detalle = `🏦 Transferencia bancaria${bco}:\n• Cuenta: ${cta}${cci}${tit}`;
    } else {
      detalle = `📲 Pago digital:\n• Monto: S/ ${tot}`;
    }

    return `Listo. Recibimos tu pedido ${cod}; pasa a cocina apenas validemos tu pago.\nTotal a pagar: S/ ${tot}\nMétodo de pago: ${med}\n\n${detalle}\n\nPor favor envíanos la captura de tu comprobante por aquí 📎 para verificar tu pago.`;
  },

  voucherRecibido: (): string => {
    return 'Recibimos tu captura, una persona de Caja la está revisando 👩‍💻. En breve te confirmamos.';
  },

  recordarEnviarImagen: (): string => {
    return 'Para verificar tu pago, por favor envíanos la captura o foto de tu comprobante (puedes adjuntarla tocando el clip 📎 o la cámara).';
  },

  voucherLimiteSuperado: (): string => {
    return 'Llegaste al límite de 5 capturas para este pedido. Te comunico con un asesor de nuestro equipo para ayudarte.';
  },

  /** `minPrometido`: minutos, o el rango ya formateado («15 a 20») del tiempo estimado de la zona. */
  pagoAprobadoCliente: (codigo: string, minPrometido?: number | string): string => {
    const tiempo = minPrometido ? ` y llega en unos ${minPrometido} minutos` : '';
    return `Pago verificado. Recibimos tu pago, tu pedido ${codigo} está en preparación 👩‍🍳${tiempo}. Te avisaremos cuando salga a reparto.`;
  },

  pagoRechazadoCliente: (motivo?: string): string => {
    const detalle = motivo ? `: ${motivo}` : '';
    return `No pudimos verificar tu pago con esa captura${detalle}. ¿Puedes enviarnos otra captura o prefieres cambiar de medio de pago?`;
  },

  pagoRechazadoLimiteSuperado: (): string => {
    return 'Superaste los 3 intentos para validar tu comprobante. Te comunico con una persona del equipo para ayudarte con tu pago.';
  },

  pagoRecordatorioCliente: (
    nombre: string,
    codigo: string,
    total: number,
    medio: string,
  ): string => {
    const tot = Number(total).toFixed(2);
    return `Hola ${nombre}, te recordamos que tenemos pendiente la captura de tu pago de S/ ${tot} por ${medio} para tu pedido ${codigo}. Si ya lo hiciste, envíanos la captura por aquí 📎.`;
  },

  confirmarEfectivo: (total: number, pagaCon?: number, modalidad?: string): string => {
    const tot = Number(total).toFixed(2);
    const vuelto =
      pagaCon && pagaCon > total ? ` y llevamos tu vuelto para S/ ${Number(pagaCon).toFixed(2)}` : '';
    if (modalidad === 'DELIVERY') {
      return `Anotado: Pago en efectivo. Cobramos S/ ${tot} al momento de la entrega${vuelto}.`;
    }
    return `Anotado: Pago en efectivo. Cobramos S/ ${tot} al recoger en el local${vuelto}.`;
  },

  confirmarTarjeta: (total: number, modalidad?: string): string => {
    const tot = Number(total).toFixed(2);
    if (modalidad === 'DELIVERY') {
      return `Anotado: Pago con tarjeta. El repartidor lleva el POS inalámbrico al momento de la entrega para cobrar S/ ${tot}.`;
    }
    return `Anotado: Pago con tarjeta. Se cobra en caja física con tarjeta al recoger tu pedido (S/ ${tot}).`;
  },

  elegirNuevoMedio: (): string => {
    return 'Elige el nuevo medio de pago para tu pedido:';
  },

  seguimientoEstadoPago: (info: InfoSeguimientoPago): string => {
    const code = info.codigo;
    const st = (info.estado || '').toLowerCase();
    const medio = info.medio || 'digital';
    const min = info.tiempoEstimadoMin || 25;
    const rep = info.repartidorNombre || 'asignado';

    if (st === 'esperando_pago') {
      return `Tu pedido ${code} está registrado y esperando la captura de tu pago (${medio}) 📲.`;
    }
    if (st === 'validando_pago') {
      return `Tu pedido ${code} tiene su captura en revisión por Caja 👩‍💻. En unos momentos te confirmamos.`;
    }
    if (st === 'en_preparacion' || st === 'prep' || st === 'cocina') {
      return `Tu pedido ${code} está en preparación en cocina 👩‍🍳. Te llega en unos ${min} minutos.`;
    }
    if (st === 'listo') {
      return `Tu pedido ${code} ya está listo y esperando al repartidor 🛵.`;
    }
    if (st === 'en_camino' || st === 'ruta') {
      return `Tu pedido ${code} ya está en camino con el repartidor ${rep} 🛵. Tiempo estimado: unos ${min} minutos.`;
    }
    if (st === 'entregado') {
      return `Tu pedido ${code} figura como entregado. ¡Buen provecho! 🧁`;
    }
    if (st === 'anulado') {
      return `Tu pedido ${code} figura como anulado. Si tienes dudas, puedes hablar con un asesor.`;
    }

    return `Tu pedido ${code} se encuentra en estado: ${info.estado}.`;
  },
};
