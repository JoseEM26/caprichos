/**
 * Textos de los avisos de WhatsApp al cliente en cada etapa de un pedido delivery.
 * Cada etapa tiene el texto libre (ventana de 24h abierta) y la plantilla (ventana cerrada).
 * Las variables de la plantilla deben coincidir, en orden, con `variables` de CATALOGO_PLANTILLAS.
 * Tono cálido y con emojis: esto se lee en WhatsApp, no en el admin.
 */
export type EtapaAvisoReparto =
  | 'ACEPTADO'
  | 'LISTO'
  | 'LISTO_RECOJO'
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

/** Resumen del pedido para el aviso «Recibimos tu pedido». Todo lo opcional se omite si falta. */
export interface ResumenRecibido {
  /** Una entrada por producto; un combo lleva sus partes en líneas siguientes con sangría. */
  lineas: string[];
  total: number;
  medioPago: string;
  /** Delivery sin punto en el mapa: el envío se calcula al recibir la ubicación y se le pide al cliente. */
  envioPorConfirmar: boolean;
  /** Delivery con envío ya calculado (soles) */
  envio?: number | null;
  /** Parte en efectivo que se cobra al recibir y con cuánto paga el cliente (para el vuelto). */
  efectivo?: { aPagar: number; pagaCon?: number | null };
  /** DELIVERY | RECOJO | LLEVAR | MESA | COMER_LOCAL */
  modalidad?: string | null;
  direccion?: string | null;
  referencia?: string | null;
  /** Dirección del local (recoger / para llevar) */
  localDireccion?: string | null;
  mesa?: string | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  subtotal?: number | null;
  descuento?: number | null;
  /** Nombre de la oferta o cupón que dio el descuento */
  descuentoNombre?: string | null;
  propina?: number | null;
  /** Parte del total que va al crédito del personal (delivery): solo el resto se paga al contado */
  aCredito?: number | null;
  /** Pago dividido: monto por medio (solo se muestra con 2 o más). */
  pagos?: { medio: string; monto: number }[];
  /** Hay parte (o todo) en tarjeta: se cobra con POS al recibir. */
  conTarjeta?: boolean;
  /** PAGADO | PENDIENTE (otros valores no se muestran) */
  pagoEstado?: string | null;
  comprobanteTipo?: string | null;
  comprobanteDoc?: string | null;
  comprobanteRazon?: string | null;
  /** Rango o minutos ya formateado, ej. «25 a 30» */
  tiempoEstimado?: string | null;
}

/** Contexto del aviso para armar el resumen completo. */
export interface ContextoResumenRecibido {
  nombre: string;
  codigo: string;
  /** Yape / Plin / transferencia cuando hay parte digital; null si no */
  medioDigital?: string | null;
  /** Bloque número/cuenta/titular/monto del medio digital */
  datosPago?: string | null;
  enlace?: string | null;
}

const soles = (n: number): string => `S/ ${n.toFixed(2)}`;
/** Margen bajo los 4096 de WhatsApp para lo que se anexa después (puntos de bienvenida). */
const LIMITE_TEXTO_RECIBIDO = 3700;

/** «Pagas en efectivo al recibir: S/ 31.75» + vuelto o «Sin vuelto»; vacío si no hay efectivo. */
const bloqueEfectivo = (r: ResumenRecibido): string[] => {
  const e = r.efectivo;
  if (!e || !(e.aPagar > 0)) return [];
  const base = `💵 Pagas en efectivo al recibir: ${soles(e.aPagar)}`;
  if (e.pagaCon != null && e.pagaCon > e.aPagar) {
    return [base, `🪙 Pagas con ${soles(e.pagaCon)} · vuelto ${soles(Math.round((e.pagaCon - e.aPagar) * 100) / 100)}`];
  }
  return [base, '🪙 Sin vuelto (pago exacto)'];
};

const TIPO_PEDIDO: Record<string, string> = {
  DELIVERY: '🛵 Delivery',
  RECOJO: '🏪 Recoger en el local',
  LLEVAR: '🥡 Para llevar',
  MESA: '🍽️ En mesa',
  COMER_LOCAL: '🍽️ Comer en el local',
};

const NOMBRE_MEDIO: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta' };

const sinVacios = (xs: (string | null | undefined | false)[]): string[] => xs.filter((x): x is string => !!x && x.trim() !== '');

/**
 * Texto completo de «Recibimos tu pedido» (datos ya leídos del pedido): función pura que devuelve las
 * secciones en orden; el aviso las une con una línea en blanco. Lo que falta se omite sin dejar huecos.
 */
export function construirResumenRecibido(r: ResumenRecibido, c: ContextoResumenRecibido): string[] {
  const secciones: string[] = [];
  const digital = !!c.medioDigital;
  secciones.push(`¡Hola ${c.nombre}! 😊\nRecibimos tu pedido *${c.codigo}*, ¡muchas gracias! 🎉`);

  // Tipo de pedido y dónde se entrega
  const tipo = r.modalidad ? TIPO_PEDIDO[r.modalidad] : null;
  const entrega: string[] = [];
  if (r.modalidad === 'DELIVERY') {
    if (r.direccion) entrega.push(`📍 ${r.direccion}`);
    if (r.referencia) entrega.push(`🔖 Referencia: ${r.referencia}`);
  } else if (r.modalidad === 'RECOJO' || r.modalidad === 'LLEVAR') {
    if (r.localDireccion) entrega.push(`📍 Recoges en: ${r.localDireccion}`);
  } else if ((r.modalidad === 'MESA' || r.modalidad === 'COMER_LOCAL') && r.mesa) {
    entrega.push(`🪑 ${r.mesa}`);
  }
  const cabecera = sinVacios([tipo, ...entrega]);
  if (cabecera.length > 0) secciones.push(['*Tipo de pedido*', ...cabecera].join('\n'));
  if (r.envioPorConfirmar) {
    secciones.push('📍 *Falta tu ubicación*\nEnvíanos tu ubicación: toca el clip 📎 → Ubicación → Enviar tu ubicación actual. Con ella calculamos tu envío.');
  }

  // Cliente
  const cliente = sinVacios([r.clienteNombre, r.clienteTelefono ? `📱 ${r.clienteTelefono}` : null]);
  if (cliente.length > 0) secciones.push(`👤 ${cliente.join(' · ')}`);

  // Resumen de pago (el total y el pago nunca se recortan)
  const totales: string[] = ['*Resumen de pago*'];
  if (r.subtotal != null) totales.push(`Subtotal: ${soles(r.subtotal)}`);
  if (r.descuento != null && r.descuento > 0) totales.push(`Descuento${r.descuentoNombre ? ` (${r.descuentoNombre})` : ''}: -${soles(r.descuento)}`);
  if (r.envioPorConfirmar) totales.push('Envío: por confirmar');
  else if (r.envio != null) totales.push(`Envío: ${r.envio === 0 ? 'gratis' : soles(r.envio)}`);
  if (r.propina != null && r.propina > 0) totales.push(`Propina: ${soles(r.propina)} (aparte del total)`);
  totales.push(`*TOTAL: ${soles(r.total)}*${r.envioPorConfirmar ? ' + envío por confirmar' : ''}`);
  if (r.aCredito != null && r.aCredito > 0) {
    totales.push(`A tu crédito del personal: ${soles(r.aCredito)}`);
    totales.push(r.envioPorConfirmar ? '*Pagas ahora: el envío (por confirmar)*' : `*Pagas ahora: ${soles(Math.max(0, r.total - r.aCredito))}*`);
  }

  const dividido = (r.pagos?.length ?? 0) > 1;
  const pago: string[] = ['*Cómo pagas*'];
  if (dividido) r.pagos!.forEach((p) => pago.push(`• ${NOMBRE_MEDIO[String(p.medio).toUpperCase()] ?? p.medio}: ${soles(p.monto)}`));
  const ef = bloqueEfectivo(r);
  pago.push(...ef);
  if (r.conTarjeta) pago.push('💳 Pagas con tarjeta (POS) al recibir');
  if (digital && !dividido) pago.push(c.datosPago || `📲 Pagas por ${c.medioDigital}`);
  if (!digital && ef.length === 0 && !r.conTarjeta && !dividido) pago.push(`💳 ${r.medioPago.charAt(0).toUpperCase()}${r.medioPago.slice(1)}`);
  const estado = String(r.pagoEstado ?? '').toUpperCase();
  if (estado === 'PAGADO') pago.push('✅ Pago recibido');
  else if (digital && estado === 'PENDIENTE') pago.push('⏳ Pago pendiente');
  else if (!digital && estado === 'PENDIENTE' && (ef.length > 0 || r.conTarjeta)) pago.push('Se cobra al recibir');

  const comprobante = r.comprobanteTipo === 'BOLETA'
    ? '🧾 Comprobante: Boleta'
    : r.comprobanteTipo === 'FACTURA'
      ? `🧾 Comprobante: Factura${r.comprobanteDoc ? ` a RUC ${r.comprobanteDoc}` : ''}${r.comprobanteRazon ? ` (${r.comprobanteRazon})` : ''}`
      : null;

  const cola: string[] = [totales.join('\n'), pago.join('\n')];
  if (digital && dividido && c.datosPago) cola.push(`*Datos para tu pago por ${c.medioDigital}*\n${c.datosPago}`);
  if (digital) cola.push('📸 Envíanos la captura de tu pago por aquí cuando puedas (opcional). Un asesor la revisará. 🙏');
  if (comprobante) cola.push(comprobante);
  if (r.tiempoEstimado) cola.push(`⏱️ Tiempo estimado: ${r.tiempoEstimado} minutos`);
  if (c.enlace) cola.push(`Sigue tu pedido aquí: ${c.enlace}`);

  // Productos: si el pedido es enorme se recorta la lista, nunca el total ni el pago
  const armarProductos = (n: number): string => {
    const items = r.lineas.slice(0, n).map((l) => `• ${l}`);
    const resto = r.lineas.length - n;
    if (resto > 0) items.push(`• y ${resto} producto${resto === 1 ? '' : 's'} más`);
    return ['*Tu pedido*', ...items].join('\n');
  };
  const fijo = [...secciones, ...cola].join('\n\n').length;
  let n = r.lineas.length;
  while (n > 1 && fijo + 2 + armarProductos(n).length > LIMITE_TEXTO_RECIBIDO) n--;
  if (r.lineas.length > 0) secciones.push(armarProductos(n));
  return [...secciones, ...cola];
}

export const textoResumenRecibido = (r: ResumenRecibido, c: ContextoResumenRecibido): string => construirResumenRecibido(r, c).join('\n\n');

export const TEXTOS_REPARTO = {
  aceptado: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 😊 Gracias por tu pedido ${codigo}. Ya lo estamos preparando con mucho cariño.`,
    plantillaClave: 'DELIVERY_ACEPTADO',
    variablesPlantilla: [nombre, codigo],
  }),

  /** Pedido de recojo, local o mesa con el pago confirmado (plantilla caprichos_pago_confirmado). */
  // `simple`: mesa o pedido ya entregado, sin «en preparación» (la plantilla de Meta no cambia: conviene una genérica)
  pagoConfirmado: (nombre: string, codigo: string, simple = false): PayloadAvisoReparto => ({
    textoLibre: simple
      ? `Hola ${nombre}, recibimos tu pago del pedido ${codigo}. ¡Gracias!`
      : `Hola ${nombre}, recibimos tu pago. Tu pedido ${codigo} esta en preparacion.`,
    plantillaClave: 'PAGO_CONFIRMADO',
    variablesPlantilla: [nombre, codigo],
  }),

  listo: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🎉 Tu pedido ${codigo} ya está listo. Pronto sale con nuestro repartidor. 🛵`,
    plantillaClave: 'DELIVERY_LISTO',
    variablesPlantilla: [nombre, codigo],
  }),

  /** Despacho confirmó el pedido de recojo o para llevar: el cliente ya puede pasar (plantilla caprichos_pedido_listo_recojo). */
  listoRecojo: (nombre: string, codigo: string): PayloadAvisoReparto => ({
    textoLibre: `¡Hola ${nombre}! 🥳 Tu pedido ${codigo} ya está listo para recoger en nuestro local. ¡Te esperamos con gusto! 😊`,
    plantillaClave: 'PEDIDO_LISTO_RECOJO',
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
   * Pedido de la carta virtual con pago digital: el pedido va a cocina sin esperar el voucher (opcional). `medio` es Yape, Plin o transferencia.
   * El enlace de seguimiento va en el texto libre (ventana abierta). La plantilla no cambia: no tiene la variable.
   */
  recibidoDigital: (nombre: string, codigo: string, medio: string, enlace?: string | null, resumen?: ResumenRecibido | null, datosPago?: string | null): PayloadAvisoReparto => ({
    textoLibre: resumen
      ? textoResumenRecibido(resumen, { nombre, codigo, medioDigital: medio, datosPago, enlace })
      : `¡Hola ${nombre}! 😊 Recibimos tu pedido ${codigo}, ¡muchas gracias! 🎉 Tu pedido ya está en marcha. Cuando puedas, envíanos por aquí mismo la foto de tu pago por ${medio} 📸 (opcional) 🙏${enlace ? ` Sigue tu pedido aquí: ${enlace}` : ''}`,
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
        textoLibre: textoResumenRecibido(resumen, { nombre, codigo, enlace }),
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
    textoLibre: `¡Hola ${nombre}! 🙏 Tu pedido ${codigo} sigue en marcha. Si ya pagaste, mándanos la captura de tu voucher cuando puedas (es opcional; no frena tu pedido). Escribe *asesor* si necesitas ayuda. 😊`,
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
  const sep = base.textoLibre.includes('\n\n') ? '\n\n' : ' ';
  const textoLibre = `${base.textoLibre}${sep}Ya sumas puntos con este número. Ve tus puntos aquí: ${enlace}`;
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
