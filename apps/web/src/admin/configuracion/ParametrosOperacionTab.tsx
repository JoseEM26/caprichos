import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { TarjetaUmbralesAlertasEspera } from './TarjetaUmbralesAlertasEspera';
import { AyudaDetalle } from './AyudaDetalle';
import { AYUDA_PARAMETROS, GRUPOS_PARAMETROS, CLAVES_EN_TARJETA_UMBRALES, idParametro } from './catalogo/parametros';
import './configuracion-nav.css';

export interface ParametroItem {
  clave: string;
  valor: any;
}

interface MetaParametro {
  nombre: string;
  descripcion: string;
  tipo: 'numero' | 'texto' | 'sino' | 'solo_lectura' | 'objeto' | 'selector';
  sufijo?: string;
  /** Texto sobre la lista desplegable de un selector (por defecto «Cómo se cobra»). */
  etiquetaSelector?: string;
  opciones?: { valor: string; etiqueta: string; ayuda: string }[];
}

/** Modos del recargo por reprogramar (mismos valores que el servidor). */
const OPCIONES_VERIFICACION_CELULAR = [
  {
    valor: 'WHATSAPP_ENTRANTE',
    etiqueta: 'El cliente escribe al negocio (recomendado)',
    ayuda: 'No necesita plantilla de Meta. Sirve mientras las plantillas de código no estén aprobadas.',
  },
  {
    valor: 'CODIGO_PLANTILLA',
    etiqueta: 'Código de 6 dígitos por WhatsApp',
    ayuda: 'Requiere las plantillas caprichos_codigo_cuenta y caprichos_codigo_recuperar aprobadas en Meta.',
  },
];

const OPCIONES_RECARGO_REPROG = [
  {
    valor: 'IGUAL_ENVIO',
    etiqueta: 'Igual al envío',
    ayuda: 'Cobra al cliente lo mismo que el delivery (el costo de envío del pedido). Si el envío fue gratis, usa la tarifa de su zona.',
  },
  {
    valor: 'FIJO',
    etiqueta: 'Monto fijo',
    ayuda: 'Cobra siempre el monto que escribas abajo, sin importar el pedido.',
  },
  {
    valor: 'SIN_COSTO',
    etiqueta: 'Sin costo',
    ayuda: 'Volver a enviar el pedido no cobra nada adicional.',
  },
];

/** Claves que ya no se muestran: duplicado muerto (las reservas leen reserva_tolerancia_min). El valor sigue en el servidor. */
const CLAVES_OCULTAS = ['tolerancia_reserva_min'];
/** Tarifas de Culqi: pueden venir sin configurar (null). El fijo vacío se guarda como 0. */
const TARIFAS_CULQI = ['culqi_comision_tarjeta_pct', 'culqi_comision_tarjeta_fijo', 'culqi_comision_yape_pct', 'culqi_comision_yape_fijo'];

const OPCIONES_PROVEEDOR_WHATSAPP = [
  { valor: 'META', etiqueta: 'Meta (conexión oficial)', ayuda: 'Los avisos salen por la API oficial de WhatsApp. Es el valor seguro.' },
  { valor: 'EVOLUTION', etiqueta: 'Evolution (número único conectado por QR)', ayuda: 'Los avisos salen por el número del local conectado por QR, con topes anti-bloqueo. Solo el administrador lo cambia.' },
];

/** Claves que tienen su propia pantalla o endpoint: aquí solo se ven, no se editan (el servidor no las acepta por esta vía). */
const GESTIONADAS_APARTE = /^(facturacion_|wa_|aprendizaje_historico|notificaciones_por_rol|impresion_etiqueta_general_modalidades|contenido_|terminos_version|privacidad_version|evolution_estado)/;

const esValorSiNo = (v: unknown) =>
  typeof v === 'boolean' || (typeof v === 'string' && ['si', 'no', 'true', 'false'].includes(v.trim().toLowerCase()));
const valorEsSi = (v: unknown) => v === true || (typeof v === 'string' && ['si', 'true'].includes(v.trim().toLowerCase()));

/** Tipo de control de un parámetro: el del catálogo; si no está catalogado, se deduce del valor guardado (si/no = interruptor). */
function tipoParametro(clave: string, valor: unknown): MetaParametro['tipo'] {
  const t = META_PARAMETROS[clave]?.tipo;
  if (t) return t;
  if (esValorSiNo(valor)) return 'sino';
  return typeof valor === 'number' ? 'numero' : 'texto';
}

export const META_PARAMETROS: Record<string, MetaParametro> = {
  // Verificación del celular al crear cuenta o recuperar contraseña (ver verificacion-whatsapp.util.ts en la API)
  verificacion_celular_modo: {
    nombre: 'Cómo verifica el cliente su celular',
    descripcion:
      'WHATSAPP_ENTRANTE: el cliente escribe primero al WhatsApp del negocio con un mensaje ya escrito (no hace falta plantilla de Meta). CODIGO_PLANTILLA: se envía un código de 6 dígitos por plantilla de Meta; úsalo cuando las plantillas caprichos_codigo_cuenta y caprichos_codigo_recuperar estén aprobadas.',
    tipo: 'selector',
    opciones: OPCIONES_VERIFICACION_CELULAR,
  },
  verificacion_whatsapp_numero: {
    nombre: 'Número que recibe la verificación',
    descripcion: 'Celular del negocio con código de país (p. ej. 51914244077). Vacío = usa la variable del servidor VERIFICACION_WHATSAPP_NUMERO o, si no existe, el WhatsApp de contacto del local.',
    tipo: 'texto',
  },
  reprog_recargo_modo: {
    nombre: 'Costo de volver a enviar un pedido',
    descripcion:
      'Cuánto paga el cliente al reprogramar una entrega tras la espera agotada. Se le dice antes de que responda SÍ o NO y se cobra al reenviar el pedido.',
    tipo: 'selector',
    opciones: OPCIONES_RECARGO_REPROG,
  },
  tiempo_prometido_min: {
    nombre: 'Tiempo prometido de entrega (base)',
    descripcion: 'Minutos base de entrega que se anuncian al cliente en la carta y chatbot.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  eta_factor_urbano: {
    nombre: 'Factor de calles (tiempo estimado)',
    descripcion: 'Cuánto más que la línea recta recorre el repartidor por calles. 1.3 = 30 % más. Solo aplica sin zona o con ruta de varios pedidos.',
    tipo: 'numero',
  },
  eta_productos_desde: {
    nombre: 'Empaque desde cuántas unidades',
    descripcion: 'A partir de esta cantidad de productos en el pedido se suma tiempo de empaque al estimado.',
    tipo: 'numero',
    sufijo: 'unidades',
  },
  eta_extra_por_producto_min: {
    nombre: 'Minutos de empaque por unidad',
    descripcion: 'Minutos que se suman por cada unidad a partir de la cantidad anterior.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  eta_parada_min: {
    nombre: 'Minutos por parada previa',
    descripcion: 'Minutos que se suman por cada pedido anterior que el repartidor lleva en la misma ruta.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  eta_margen_min: {
    nombre: 'Ancho mínimo del rango de tiempo',
    descripcion: 'El tiempo máximo que se anuncia es el mínimo más este margen, por ejemplo «25 a 30».',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  eta_paso_min: {
    nombre: 'Redondeo del tiempo estimado',
    descripcion: 'El tiempo estimado se redondea a múltiplos de este valor.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  eta_base_sin_zona_min: {
    nombre: 'Minutos de puerta sin zona',
    descripcion: 'Minutos que se suman al recorrido cuando el pedido tiene coordenadas pero no zona.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  tiempo_max_min: {
    nombre: 'Tiempo máximo de entrega',
    descripcion: 'Límite superior del tiempo estimado de entrega para el cliente.',
    tipo: 'solo_lectura',
    sufijo: 'minutos',
  },
  envio_gratis_monto: {
    nombre: 'Monto de envío gratis',
    descripcion: 'Monto total de productos requerido para que el despacho a domicilio no tenga costo.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  envio_gratis_modo: {
    nombre: 'Modo de envío gratis',
    descripcion: 'Aplica desde el monto exacto ("desde") o solo si supera el monto ("mas_de").',
    tipo: 'texto',
  },
  caja_monto_inicial: {
    nombre: 'Monto inicial de la caja',
    descripcion: 'Dinero con el que se abre la caja cada día. Solo el administrador lo cambia; abrir con otro monto queda auditado.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  pedido_minimo: {
    nombre: 'Pedido mínimo para delivery',
    descripcion: 'Monto mínimo en compras requerido para poder solicitar envío a domicilio.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  pedidos_programados_fuera_horario: {
    nombre: 'Clientes pueden programar con el local cerrado',
    descripcion: 'En «Sí», con el local cerrado la carta y el bot reciben pedidos para llevar o delivery programados dentro del horario. En «No» (por defecto) siguen cerradas.',
    tipo: 'sino',
  },
  programado_dias_max: {
    nombre: 'Días máximos para programar un pedido',
    descripcion: 'Hasta cuántos días adelante pueden programar un pedido Caja y mozo (la carta virtual y el bot no programan).',
    tipo: 'numero',
    sufijo: 'días',
  },
  programado_aviso_min: {
    nombre: 'Aviso antes de la hora pactada (pedido programado)',
    descripcion: 'Minutos antes de la hora pactada en que el pedido programado pasa solo a cocina o a la cola de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reserva_tolerancia_min: {
    nombre: 'Tolerancia de reserva',
    descripcion: 'Minutos de espera de cortesía antes de liberar una mesa reservada.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reserva_recordatorio_min: {
    nombre: 'Recordatorio de reserva',
    descripcion: 'Minutos antes de la hora en que se envía el único recordatorio por WhatsApp (si el recordatorio está encendido).',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reserva_web_activa: {
    nombre: 'Reservar mesa desde la carta',
    descripcion: 'Muestra el botón «Reservar» en la carta virtual. En «No» el cliente no puede pedir reserva desde la carta.',
    tipo: 'sino',
  },
  reserva_web_max_pendientes: {
    nombre: 'Solicitudes pendientes por celular',
    descripcion: 'Cuántas reservas pedidas desde la carta puede tener esperando respuesta un mismo celular.',
    tipo: 'numero',
    sufijo: 'solicitudes',
  },
  reserva_web_dias_max: {
    nombre: 'Días de anticipación para reservar desde la carta',
    descripcion: 'Hasta cuántos días antes puede pedir reserva el cliente desde la carta.',
    tipo: 'numero',
    sufijo: 'días',
  },
  reserva_web_max_personas: {
    nombre: 'Personas máximas por reserva desde la carta',
    descripcion: 'Tope de personas que acepta la carta. Si lo dejas vacío, el tope es la suma de asientos de las mesas activas.',
    tipo: 'numero',
    sufijo: 'personas',
  },
  stock_alerta_porcentaje: {
    nombre: 'Aviso de stock bajo de insumos (% del máximo)',
    descripcion: 'Un insumo queda «por pedir» cuando su saldo total baja a este porcentaje de su máximo (o a su mínimo, si es mayor). Se avisa al equipo una vez por cruce.',
    tipo: 'numero',
    sufijo: '%',
  },
  aviso_stock_quedan_desde: {
    nombre: 'Avisar «Quedan N» desde (unidades)',
    descripcion: 'Desde cuántas unidades el cliente ve «Quedan N» en un producto con stock controlado. 0 = sin aviso.',
    tipo: 'numero',
    sufijo: 'unidades',
  },
  aviso_stock_ultimas_desde: {
    nombre: 'Franja «¡Últimas!» desde (unidades)',
    descripcion: 'Desde cuántas unidades aparece la franja «¡Última dona!», «¡Últimas 2!» o «¡Quedan solo 3, ya se acaban!». No puede pasar del aviso «Quedan N». 0 = sin franja.',
    tipo: 'numero',
    sufijo: 'unidades',
  },
  puntos_combos_suman: {
    nombre: 'Los combos suman puntos',
    descripcion: 'En «Sí», lo cobrado por un combo suma puntos con el mismo porcentaje. En «No» (por defecto) los combos no suman.',
    tipo: 'sino',
  },
  puntos_ofertas_suman: {
    nombre: 'Las ofertas suman puntos',
    descripcion: 'En «Sí», lo cobrado por una oferta (que no es combo) suma puntos con el mismo porcentaje. En «No» (por defecto) no suman.',
    tipo: 'sino',
  },
  puntos_porcentaje: {
    nombre: 'Porcentaje de puntos',
    descripcion: 'Porcentaje del monto consumido que el cliente acumula en puntos fidelidad.',
    tipo: 'numero',
    sufijo: '%',
  },
  descuento_personal_pct: {
    nombre: 'Descuento para el personal',
    descripcion: 'Porcentaje de descuento para consumos de los colaboradores a crédito.',
    tipo: 'numero',
    sufijo: '%',
  },
  rep_naranja_min: {
    nombre: 'Alerta naranja de reparto (retraso)',
    descripcion: 'Minutos transcurridos para marcar pedidos en alerta naranja en el mapa y en cocina.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  rep_rojo_min: {
    nombre: 'Alerta roja de reparto (crítico)',
    descripcion: 'Minutos transcurridos para marcar pedidos en estado crítico (rojo) en el mapa y en cocina.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  rep_max_pedidos: {
    nombre: 'Máximo de pedidos por repartidor',
    descripcion: 'Cantidad límite de órdenes simultáneas que puede trasladar un repartidor.',
    tipo: 'numero',
    sufijo: 'pedidos',
  },
  reparto_retrasado_min: {
    nombre: 'Alerta Retrasado de reparto (amarillo)',
    descripcion: 'Minutos para marcar pedidos en alerta amarilla (Retrasado) en el mapa de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_tarde_min: {
    nombre: 'Alerta Tarde de reparto (naranja)',
    descripcion: 'Minutos para marcar pedidos en alerta naranja (Tarde) en el mapa de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_muy_tarde_min: {
    nombre: 'Alerta Muy tarde de reparto (rojo palpitando)',
    descripcion: 'Minutos para marcar pedidos en estado crítico (rojo palpitando) en el mapa de reparto.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_velocidad_kmh: {
    nombre: 'Velocidad media de reparto',
    descripcion: 'Velocidad promedio estimada en moto (km/h) para cálculo de distancias y tiempos de entrega.',
    tipo: 'numero',
    sufijo: 'km/h',
  },
  reparto_max_pedidos: {
    nombre: 'Máximo de pedidos por repartidor (reparto)',
    descripcion: 'Cantidad límite de órdenes simultáneas por repartidor en el módulo de reparto.',
    tipo: 'numero',
    sufijo: 'pedidos',
  },
  pausa_alta_demanda: {
    nombre: 'Pausa por alta demanda',
    descripcion: 'Detiene temporalmente el ingreso de nuevos pedidos. Solo lectura: la gestiona cocina.',
    tipo: 'solo_lectura',
  },
  alta_demanda_min_base: {
    nombre: 'Minutos base por alta demanda',
    descripcion: 'Tiempo adicional que se suma a las órdenes cuando alta demanda está encendida.',
    tipo: 'solo_lectura',
    sufijo: 'minutos',
  },
  carta_aviso_entrada: {
    nombre: 'Aviso de promociones al entrar',
    descripcion: 'Muestra una ventana modal con la mejor promoción del día al ingresar a la carta virtual (máximo una vez al día por dispositivo).',
    tipo: 'sino',
  },
  reparto_insistencia_min: {
    nombre: 'Tiempo para insistencia en la puerta',
    descripcion: 'Minutos de espera tras la llegada del repartidor antes de enviar el aviso 3 de insistencia al cliente.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_espera_max_min: {
    nombre: 'Tiempo máximo de espera en la puerta',
    descripcion: 'Minutos de tolerancia máxima en la puerta antes de considerar la entrega como fallida y ofrecer reprogramación.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reparto_recargo_reprogramacion: {
    nombre: 'Monto fijo por reprogramar (si el costo es Monto fijo)',
    descripcion: 'Solo aplica cuando el costo de volver a enviar un pedido es "Monto fijo". Con "Igual al envío" o "Sin costo" no se usa.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  reprog_respuesta_min: {
    nombre: 'Tiempo para responder si reprograma',
    descripcion: 'Minutos que tiene el cliente para responder SÍ o NO a reprogramar tras el retiro del repartidor. Si no responde, el pedido se cancela por falta de respuesta.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reprog_max_intentos: {
    nombre: 'Reprogramaciones máximas por pedido',
    descripcion: 'Cuántas veces se puede reprogramar un mismo pedido tras la espera agotada. Al llegar al tope no se vuelve a preguntar y el pedido se cancela.',
    tipo: 'numero',
    sufijo: 'veces',
  },
  encuesta_espera_min: {
    nombre: 'Espera para encuesta posventa',
    descripcion: 'Minutos transcurridos tras la entrega del pedido antes de enviar automáticamente la encuesta de satisfacción por WhatsApp.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  encuesta_tope_dias: {
    nombre: 'Días entre encuestas por celular',
    descripcion: 'Una misma persona recibe como máximo una encuesta de calificación cada tantos días.',
    tipo: 'numero',
    sufijo: 'días',
  },
  encuesta_hora_desde: {
    nombre: 'Encuesta: hora desde la que se envía',
    descripcion: 'Hora (Lima, 0 a 23) desde la que se puede enviar la encuesta.',
    tipo: 'numero',
    sufijo: 'h',
  },
  encuesta_hora_hasta: {
    nombre: 'Encuesta: hora hasta la que se envía',
    descripcion: 'Hora (Lima, 1 a 24) desde la que ya no se envía hasta el día siguiente.',
    tipo: 'numero',
    sufijo: 'h',
  },
  encuesta_puntaje_queja: {
    nombre: 'Umbral de queja en encuesta',
    descripcion: 'Puntajes iguales o menores a este valor (1 a 5) son derivados automáticamente como quejas al módulo de Reclamos, avisan en la campana y por WhatsApp a los administradores.',
    tipo: 'numero',
  },
  encuesta_ventana_dias: {
    nombre: 'Días para calificar la encuesta',
    descripcion: 'Días después del envío durante los que el cliente puede responder la encuesta posventa por WhatsApp. Pasado ese plazo, su respuesta vuelve al bot.',
    tipo: 'numero',
    sufijo: 'días',
  },
  chatbot_activo: {
    nombre: 'Chatbot de WhatsApp activo',
    descripcion: 'Habilita el motor conversacional automático en WhatsApp para responder saludos, menú, horarios y derivaciones a personas.',
    tipo: 'sino',
  },
  whatsapp_aviso_asignado_activo: {
    nombre: 'Aviso WhatsApp: Delivery asignado',
    descripcion: 'Envía aviso automático al cliente con el nombre del repartidor cuando toma su pedido o Caja lo reasigna.',
    tipo: 'sino',
  },
  whatsapp_aviso_salida_activo: {
    nombre: 'Aviso WhatsApp: Delivery en camino',
    descripcion: 'Envía aviso automático al cliente con tiempo estimado cuando el repartidor sale con el pedido.',
    tipo: 'sino',
  },
  whatsapp_aviso_llegada_activo: {
    nombre: 'Aviso WhatsApp: Repartidor en la puerta',
    descripcion: 'Envía aviso automático al cliente indicando que el repartidor llegó a su dirección y la insistencia posterior.',
    tipo: 'sino',
  },
  whatsapp_aviso_espera_activo: {
    nombre: 'Aviso WhatsApp: Espera agotada y reprogramación',
    descripcion: 'Notifica al cliente el retiro del repartidor por tiempo agotado y ofrece botones para reprogramar el envío.',
    tipo: 'sino',
  },
  whatsapp_aviso_recojo_activo: {
    nombre: 'Aviso WhatsApp: Pedido listo para recoger',
    descripcion: 'Envía aviso automático al cliente cuando su pedido para llevar o recojo pasa a estado listo.',
    tipo: 'sino',
  },
  whatsapp_aviso_pago_confirmado_activo: {
    nombre: 'Aviso WhatsApp: Pago confirmado',
    descripcion: 'Notifica al cliente que Caja confirmó su comprobante de pago y que el pedido está en preparación.',
    tipo: 'sino',
  },
  whatsapp_aviso_listo_activo: {
    nombre: 'Aviso WhatsApp: Pedido delivery listo',
    descripcion: 'Avisa al cliente cuando cocina termina su pedido delivery y queda listo para salir con el repartidor.',
    tipo: 'sino',
  },
  whatsapp_aviso_bienvenida_puntos_activo: {
    nombre: 'Aviso WhatsApp: Bienvenida a los puntos (primer pedido)',
    descripcion: 'En el primer pedido de la carta de cada celular, el aviso de pedido recibido dice que ya suma puntos y da el enlace para verlos. Requiere la plantilla aprobada en Meta.',
    tipo: 'sino',
  },
  whatsapp_aviso_puntos_ganados_activo: {
    nombre: 'Aviso WhatsApp: Puntos ganados al entregar',
    descripcion: 'Al entregar un pedido que sumó puntos, el aviso dice cuántos puntos ganó y su total. Requiere la plantilla aprobada en Meta.',
    tipo: 'sino',
  },
  whatsapp_aviso_cuenta_activo: {
    nombre: 'Aviso WhatsApp: Seguridad de la cuenta',
    descripcion: 'Avisa al cliente cuando se crea su cuenta o cambia su contraseña. Requiere la plantilla aprobada en Meta.',
    tipo: 'sino',
  },
  whatsapp_aviso_voucher_recordatorio_activo: {
    nombre: 'Aviso WhatsApp: Recordatorio del voucher',
    descripcion: 'Recuerda al cliente con pago digital que envíe el voucher si pasan unos minutos sin recibirlo. Es independiente del aviso de pedido recibido.',
    tipo: 'sino',
  },
  whatsapp_plantilla_recibido_seguimiento_activa: {
    nombre: 'Aviso WhatsApp: Pedido recibido con enlace (plantilla)',
    descripcion: 'Usa la plantilla con el enlace de seguimiento fuera de la ventana de 24 h. Solo en «Sí» cuando Meta apruebe la plantilla.',
    tipo: 'sino',
  },
  whatsapp_plantilla_delivery_ubicacion_activa: {
    nombre: 'Aviso WhatsApp: Delivery con ubicación (plantilla)',
    descripcion: 'Usa las plantillas que piden la ubicación fuera de la ventana de 24 h. Solo en «Sí» cuando Meta apruebe las plantillas.',
    tipo: 'sino',
  },
  whatsapp_aviso_recibido_activo: {
    nombre: 'Aviso WhatsApp: Pedido recibido desde la carta',
    descripcion: 'Avisa al cliente que recibimos su pedido de la carta virtual. Con Yape, Plin o transferencia, avisa que un asesor gestiona el voucher por este chat.',
    tipo: 'sino',
  },
  whatsapp_aviso_todos_pedidos_activo: {
    nombre: 'Aviso WhatsApp: también en Caja, mozo y recojo',
    descripcion: 'Avisa pago confirmado y entregado en los pedidos de Caja, mozo, recojo y mesa, si tienen celular.',
    tipo: 'sino',
  },
  whatsapp_aviso_entregado_activo: {
    nombre: 'Aviso WhatsApp: Pedido delivery entregado',
    descripcion: 'Envía al cliente un agradecimiento cuando su pedido delivery queda entregado.',
    tipo: 'sino',
  },
  whatsapp_aviso_encuesta_activo: {
    nombre: 'Aviso WhatsApp: Encuesta de satisfacción posventa',
    descripcion: 'Encendido: tras la compra (pedido entregado o cobrado, de la carta, WhatsApp, Caja o mozo) se pide la calificación por WhatsApp con la plantilla caprichos_encuesta_posventa, después de «Espera antes de enviar la encuesta», entre las horas configuradas y una vez por celular cada N días. No se envía a pedidos del personal, anulados, números bloqueados ni sin celular. Requiere la plantilla aprobada en Meta; las últimas encuestas y sus motivos se ven en Reclamos > WhatsApp.',
    tipo: 'sino',
  },
  chatbot_pago_recordatorio_activo: {
    nombre: 'Recordatorio WhatsApp: Comprobante de pago pendiente',
    descripcion: 'Envía un recordatorio automático cordial al cliente si pasan los minutos configurados sin enviar la captura del pago digital. Viene apagado.',
    tipo: 'sino',
  },
  chatbot_pago_recordatorio_min: {
    nombre: 'Minutos para recordatorio de pago digital',
    descripcion: 'Tiempo de espera antes de enviar el recordatorio cordial al cliente solicitando su captura de pago.',
    tipo: 'numero',
    sufijo: 'min',
  },
  chatbot_pago_expira_min: {
    nombre: 'Minutos para alerta de pago por expirar a Caja',
    descripcion: 'Tiempo de espera antes de emitir alerta a la consola de Caja para decidir si contactar o anular (0 para apagar).',
    tipo: 'numero',
    sufijo: 'min',
  },
  chatbot_ia_activo: {
    nombre: 'Chatbot: Inteligencia Artificial para dudas (OpenAI)',
    descripcion: 'Habilita la IA (OpenAI) para resolver dudas de la carta, promociones, horarios y recomendaciones en WhatsApp con solo lectura.',
    tipo: 'sino',
  },
  chatbot_modo_libre: {
    nombre: 'Chatbot: conversación libre con la IA',
    descripcion: 'Capri conversa con más libertad (carta, pedido, promos, pagos) y pasa a una persona lo delicado. Requiere la IA encendida.',
    tipo: 'sino',
  },
  chatbot_ia_tope_mensual_usd: {
    nombre: 'Chatbot: Tope mensual de gasto en IA (USD)',
    descripcion: 'Límite máximo en dólares por mes calendario para consumo de OpenAI. Al alcanzarse, la IA se apaga y alerta a Caja.',
    tipo: 'numero',
    sufijo: 'USD',
  },
  chatbot_ia_max_por_hora_telefono: {
    nombre: 'Chatbot: Límite de consultas a la IA por hora y teléfono',
    descripcion: 'Máximo número de preguntas a la IA que un mismo teléfono puede realizar en el lapso de una hora (anti-abuso).',
    tipo: 'numero',
    sufijo: 'consultas/h',
  },
  ayuda_ia_activo: {
    nombre: 'Asistente de ayuda con IA (Capri)',
    descripcion: 'Habilita al asistente virtual Capri con IA para orientar a los usuarios en el panel de administración.',
    tipo: 'sino',
  },
  alerta_voucher_min_1: {
    nombre: 'Primer aviso de voucher sin revisar',
    descripcion: 'Minutos de espera tras recibir una captura de pago antes de enviar el primer aviso a los administradores.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  alerta_voucher_min_2: {
    nombre: 'Segundo aviso de voucher sin revisar (urgente)',
    descripcion: 'Minutos de espera antes del segundo aviso a los administradores y marcar el chat como urgente.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  espera_cliente_aviso_min: {
    nombre: 'Aviso de espera al cliente por validación de pago',
    descripcion: 'Minutos transcurridos antes de enviar al cliente el mensaje interactivo de tranquilidad.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  alerta_pedido_sin_confirmar_min: {
    nombre: 'Alerta de pedido nuevo sin confirmar en Caja',
    descripcion: 'Minutos sin confirmación en Caja antes de alertar a los administradores por WhatsApp.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  bot_reanuda_min: {
    nombre: 'El bot retoma el chat tras (minutos)',
    descripcion: 'Minutos sin que el equipo escriba en un chat atendido para que el bot vuelva a responder. También es la espera antes de que el bot retome un chat donde el cliente pidió una persona y nadie contestó.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  impresion_alerta_min: {
    nombre: 'Aviso de etiquetas sin imprimir (WhatsApp)',
    descripcion: 'Minutos con etiquetas en cola y sin la impresora de Caja (PC apagada, sin sesión o sin conexión) antes de avisar por WhatsApp a los administradores.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  impresion_vence_min: {
    nombre: 'Vencimiento de etiquetas no impresas',
    descripcion: 'Minutos en cola a partir de los cuales una etiqueta ya no se imprime sola al reconectar la impresora; queda VENCIDA y se puede reimprimir a mano. Los pedidos anulados también vencen.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  impresion_etiqueta_bebida_ancho_mm: {
    nombre: 'Sticker de bebida: ancho (mm)',
    descripcion: 'Medida en milímetros del ancho del sticker que sale por cada vaso. Número entero de 30 a 200; debe coincidir con el rollo de la etiquetera.',
    tipo: 'numero',
    sufijo: 'mm',
  },
  impresion_etiqueta_bebida_alto_mm: {
    nombre: 'Sticker de bebida: alto (mm)',
    descripcion: 'Medida en milímetros del alto del sticker que sale por cada vaso. Número entero de 30 a 200; debe coincidir con el rollo de la etiquetera.',
    tipo: 'numero',
    sufijo: 'mm',
  },
  impresion_etiqueta_general_ancho_mm: {
    nombre: 'Sticker general: ancho (mm)',
    descripcion: 'Medida en milímetros del ancho del sticker general del pedido (bolsa o bandeja, solo para llevar, recoger y delivery). Número entero de 30 a 200; debe coincidir con el rollo de la etiquetera.',
    tipo: 'numero',
    sufijo: 'mm',
  },
  impresion_etiqueta_general_alto_mm: {
    nombre: 'Sticker general: alto (mm)',
    descripcion: 'Medida en milímetros del alto del sticker general del pedido (bolsa o bandeja, solo para llevar, recoger y delivery). Número entero de 30 a 200; debe coincidir con el rollo de la etiquetera.',
    tipo: 'numero',
    sufijo: 'mm',
  },
  pago_online_espera_min: {
    nombre: 'Minutos para completar el pago en línea',
    descripcion: 'Tiempo que tiene el cliente para pagar en la pantalla de Culqi antes de que el pedido quede sin pagar y se libere.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  culqi_comision_tarjeta_pct: {
    nombre: 'Comisión de Culqi por tarjeta: porcentaje (IGV incluido)',
    descripcion: 'Porcentaje que Culqi cobra por cada pago con tarjeta, con IGV incluido. Solo estima la comisión cuando Culqi no la informa; la asume el local, el cliente no la ve. De 0 a 20.',
    tipo: 'numero',
    sufijo: '%',
  },
  culqi_comision_tarjeta_fijo: {
    nombre: 'Comisión de Culqi por tarjeta: monto fijo (IGV incluido)',
    descripcion: 'Monto fijo en soles por cada pago con tarjeta, sin IGV. Vacío = 0 si el porcentaje está. De 0 a 10.',
    tipo: 'numero',
    sufijo: 'soles',
  },
  culqi_comision_yape_pct: {
    nombre: 'Comisión de Culqi por Yape: porcentaje (IGV incluido)',
    descripcion: 'Porcentaje que Culqi cobra por cada pago con Yape en línea, con IGV incluido. Solo estima la comisión cuando Culqi no la informa. De 0 a 20.',
    tipo: 'numero',
    sufijo: '%',
  },
  culqi_comision_yape_fijo: {
    nombre: 'Comisión de Culqi por Yape: monto fijo (IGV incluido)',
    descripcion: 'Monto fijo en soles por cada pago con Yape en línea, con IGV incluido. Vacío = 0 si el porcentaje está. De 0 a 10.',
    tipo: 'numero',
    sufijo: 'soles',
  },
  whatsapp_proveedor: {
    nombre: 'Por dónde sale WhatsApp (Meta o Evolution)',
    descripcion: 'Elige el número que envía los avisos al cliente: META es la conexión oficial; EVOLUTION usa el número único del local conectado por QR. Solo el administrador lo cambia.',
    tipo: 'selector',
    etiquetaSelector: 'Número que envía',
    opciones: OPCIONES_PROVEEDOR_WHATSAPP,
  },
  evolution_pausado: {
    nombre: 'Pausar los envíos por Evolution',
    descripcion: 'Detiene de inmediato todo envío por el número de Evolution (por ejemplo ante un riesgo de bloqueo). Los mensajes quedan en cola. Solo el administrador lo cambia.',
    tipo: 'sino',
  },
  evolution_limite_minuto: {
    nombre: 'Evolution: tope de mensajes por minuto',
    descripcion: 'Máximo de mensajes que salen por minuto por el número de Evolution, para no parecer un envío masivo. 0 = sin tope.',
    tipo: 'numero',
    sufijo: 'mensajes',
  },
  evolution_limite_hora: {
    nombre: 'Evolution: tope de mensajes por hora',
    descripcion: 'Máximo de mensajes por hora por el número de Evolution. 0 = sin tope.',
    tipo: 'numero',
    sufijo: 'mensajes',
  },
  evolution_limite_dia: {
    nombre: 'Evolution: tope de mensajes por día',
    descripcion: 'Máximo de mensajes por día por el número de Evolution. 0 = sin tope.',
    tipo: 'numero',
    sufijo: 'mensajes',
  },
  evolution_pausa_min_seg: {
    nombre: 'Evolution: pausa mínima entre mensajes',
    descripcion: 'Segundos mínimos que se espera entre un mensaje y el siguiente. La pausa real es al azar entre este valor y el máximo.',
    tipo: 'numero',
    sufijo: 'segundos',
  },
  evolution_pausa_max_seg: {
    nombre: 'Evolution: pausa máxima entre mensajes',
    descripcion: 'Segundos máximos que se espera entre un mensaje y el siguiente.',
    tipo: 'numero',
    sufijo: 'segundos',
  },
  evolution_escribiendo_ms_por_caracter: {
    nombre: 'Evolution: tiempo de «escribiendo…» por letra',
    descripcion: 'Milisegundos de «escribiendo…» que se muestran por cada letra del mensaje antes de enviarlo, para que parezca escrito por una persona.',
    tipo: 'numero',
    sufijo: 'milisegundos',
  },
  evolution_horario_desde: {
    nombre: 'Evolution: hora desde la que envía',
    descripcion: 'Hora del día (Lima) desde la que Evolution envía mensajes. Fuera de horario los mensajes esperan a que abra.',
    tipo: 'numero',
    sufijo: 'hora',
  },
  evolution_horario_hasta: {
    nombre: 'Evolution: hora hasta la que envía',
    descripcion: 'Hora del día (Lima) hasta la que Evolution envía mensajes. 24 = hasta medianoche.',
    tipo: 'numero',
    sufijo: 'hora',
  },
  evolution_meta_respaldo: {
    nombre: 'Usar Meta como respaldo',
    descripcion: 'Apagado: con Evolution nunca se escribe por Meta. Encendido: Meta solo recoge lo que Evolution no pudo entregar por estar caído o en pausa.',
    tipo: 'sino',
  },
  evolution_exigir_contacto_previo: {
    nombre: 'Evolution: solo a quien ya escribió antes',
    descripcion: 'Solo envía por Evolution a clientes que ya tienen una conversación con el local. Reduce el riesgo de que reporten el número como spam.',
    tipo: 'sino',
  },
  evolution_resumen_contacto_dias: {
    nombre: 'Evolution: días de contacto para enviar el resumen',
    descripcion: 'El resumen del pedido sale solo si el cliente escribió en los últimos N días. Los demás avisos siguen pidiendo 24 h. 0 = solo 24 h.',
    tipo: 'numero',
    sufijo: 'días',
  },
  evolution_max_enlaces: {
    nombre: 'Evolution: enlaces por mensaje',
    descripcion: 'Cuántos enlaces como máximo lleva cada mensaje; el resto se quita. Los mensajes con muchos enlaces parecen spam.',
    tipo: 'numero',
    sufijo: 'enlaces',
  },
  evolution_max_texto_identico: {
    nombre: 'Evolution: veces seguidas el mismo texto',
    descripcion: 'Cuántas veces seguidas puede salir exactamente el mismo texto; luego se varía un poco la redacción para no parecer un envío masivo.',
    tipo: 'numero',
    sufijo: 'veces',
  },
  evolution_origenes_permitidos: {
    nombre: 'Evolution: qué mensajes pueden salir por ese número',
    descripcion: 'Lista de tipos de mensaje que se envían por Evolution, separados por coma. Lo que no esté en la lista no sale por ese número.',
    tipo: 'texto',
  },
  voucher_recordatorio_min: {
    nombre: 'Minutos para recordar el voucher',
    descripcion: 'Minutos después del aviso «pedido recibido» a los que se recuerda al cliente que falta enviar el voucher del pago digital (si el recordatorio de voucher está encendido).',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  voucher_mozo_obligatorio: {
    nombre: 'Mozo obligatorio con voucher',
    descripcion: 'Valor guardado para exigir mozo en los pedidos con voucher. Hoy la regla del voucher siempre se aplica y este parámetro no se lee.',
    tipo: 'sino',
  },
  ayuda_ia_max_por_minuto_usuario: {
    nombre: 'Ayuda con IA: consultas por minuto por persona',
    descripcion: 'Cuántas preguntas por minuto puede hacer cada persona del equipo al asistente de ayuda (Capri).',
    tipo: 'numero',
    sufijo: 'consultas',
  },
  ayuda_ia_max_por_hora_usuario: {
    nombre: 'Ayuda con IA: consultas por hora por persona',
    descripcion: 'Cuántas preguntas por hora puede hacer cada persona del equipo al asistente de ayuda (Capri).',
    tipo: 'numero',
    sufijo: 'consultas',
  },
  outbox_alerta_fallidos: {
    nombre: 'Avisar cuando un WhatsApp no se pudo enviar',
    descripcion: 'Muestra en la campanita de Caja y Administración cada mensaje de WhatsApp que se agotó sin poder enviarse.',
    tipo: 'sino',
  },
  outbox_max_intentos: {
    nombre: 'Intentos de envío de cada WhatsApp',
    descripcion: 'Cuántas veces se intenta enviar un mensaje de WhatsApp antes de darlo por fallido.',
    tipo: 'numero',
    sufijo: 'intentos',
  },
  outbox_retencion_dias: {
    nombre: 'Días que se guardan los WhatsApp enviados',
    descripcion: 'Días que se conservan los mensajes ya enviados en la cola antes de limpiarlos.',
    tipo: 'numero',
    sufijo: 'días',
  },
  outbox_retencion_fallidos_dias: {
    nombre: 'Días que se guardan los WhatsApp fallidos o descartados',
    descripcion: 'Días que se conservan los mensajes fallidos o descartados antes de limpiarlos.',
    tipo: 'numero',
    sufijo: 'días',
  },
  outbox_lag_alerta_min: {
    nombre: 'Minutos de atraso para avisar de la cola',
    descripcion: 'Si hay mensajes de WhatsApp esperando más de estos minutos sin salir, se avisa a la administración.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  pantalla_local_mostrar_nombre: {
    nombre: 'Mostrar nombre del cliente en la pantalla',
    descripcion: 'En la pantalla de TV del local se muestra el nombre de pila del cliente junto al código de su pedido (nunca apellidos, teléfono ni documento).',
    tipo: 'sino',
  },
  aprendizaje_activo: {
    nombre: 'Aprendizaje nocturno del bot encendido',
    descripcion: 'Cada noche la IA lee los chats del día anterior y propone preguntas frecuentes nuevas para el bot; una persona las aprueba o descarta.',
    tipo: 'sino',
  },
  aprendizaje_hora: {
    nombre: 'Hora del aprendizaje nocturno',
    descripcion: 'Hora del día (Lima) a la que corre el aprendizaje de la noche.',
    tipo: 'numero',
    sufijo: 'hora',
  },
  aprendizaje_min_repeticiones: {
    nombre: 'Repeticiones mínimas para proponer una pregunta',
    descripcion: 'Cuántas veces debe aparecer una duda en los chats para que se proponga como pregunta frecuente.',
    tipo: 'numero',
    sufijo: 'veces',
  },
  aprendizaje_tope_usd_noche: {
    nombre: 'Tope de gasto de IA por noche (aprendizaje)',
    descripcion: 'Dólares máximos que puede gastar la IA en una corrida nocturna.',
    tipo: 'numero',
    sufijo: 'USD',
  },
  aprendizaje_tope_usd_historico: {
    nombre: 'Tope de gasto de IA del análisis histórico',
    descripcion: 'Dólares máximos que puede gastar la IA al analizar todo el historial de chats.',
    tipo: 'numero',
    sufijo: 'USD',
  },
  aprendizaje_usd_por_millon_entrada: {
    nombre: 'Precio de la IA por millón de tokens leídos',
    descripcion: 'Dólares por millón de tokens de lectura, usado para estimar el gasto del aprendizaje.',
    tipo: 'numero',
    sufijo: 'USD por millón',
  },
  aprendizaje_usd_por_millon_salida: {
    nombre: 'Precio de la IA por millón de tokens escritos',
    descripcion: 'Dólares por millón de tokens de respuesta, usado para estimar el gasto del aprendizaje.',
    tipo: 'numero',
    sufijo: 'USD por millón',
  },
};

interface ParametrosOperacionTabProps {
  puedeVer: boolean;
  puedeEditar: boolean;
}

export function ParametrosOperacionTab({
  puedeVer,
  puedeEditar,
}: ParametrosOperacionTabProps) {
  const [parametros, setParametros] = useState<ParametroItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Parámetro en edición modal
  const [parametroEditando, setParametroEditando] = useState<ParametroItem | null>(null);
  const [nuevoValorInput, setNuevoValorInput] = useState<string>('');
  // Solo para el selector del costo de reprogramar: monto fijo (se usa si el modo es FIJO)
  const [montoFijoInput, setMontoFijoInput] = useState<string>('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Interruptor Sí/No pendiente de confirmar (parámetros de riesgo medio o alto)
  const [cambioSino, setCambioSino] = useState<{ item: ParametroItem; nuevo: boolean } | null>(null);

  // Confirmación Sí/No antes de guardar
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);

  // Estado del conector de WhatsApp (solo lectura, sin secretos)
  const [estadoWhatsApp, setEstadoWhatsApp] = useState<{
    conectado: boolean;
    modo: 'meta' | 'simulado' | 'evolution';
  } | null>(null);

  // Estado del consumo de IA del mes actual (solo lectura, Ola 3 Agente G)
  const [consumoIa, setConsumoIa] = useState<{
    periodo: string;
    llamadasTotal: number;
    tokensEntrada: number;
    tokensSalida: number;
    tokensTotal: number;
    costoUsdEstimado: number;
    topeMensualUsd: number;
    porcentajeConsumido: number;
    topeAlcanzado: boolean;
    iaActiva: boolean;
  } | null>(null);

  const cargarParametros = async () => {
    if (!puedeVer) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<ParametroItem[]>('/admin/configuracion');
      // Filtramos datos del local y pagos que tienen su propia pestaña dedicada
      const filtrados = res.filter(
        (p) => p.clave !== 'local_datos' && p.clave !== 'local_pagos',
      );
      setParametros(filtrados);

      try {
        const infoWa = await api.get<{ conectado: boolean; modo: 'meta' | 'simulado' | 'evolution' }>(
          '/admin/reclamos/whatsapp/estado-conexion',
        );
        setEstadoWhatsApp(infoWa);
      } catch {
        setEstadoWhatsApp({ conectado: false, modo: 'simulado' });
      }

      try {
        const infoIa = await api.get<{
          periodo: string;
          llamadasTotal: number;
          tokensEntrada: number;
          tokensSalida: number;
          tokensTotal: number;
          costoUsdEstimado: number;
          topeMensualUsd: number;
          porcentajeConsumido: number;
          topeAlcanzado: boolean;
          iaActiva: boolean;
        }>('/admin/configuracion/ia-consumo');
        if (infoIa && typeof (infoIa as any).tokensTotal === 'number') {
          setConsumoIa(infoIa);
        } else {
          setConsumoIa(null);
        }
      } catch {
        setConsumoIa(null);
      }
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar los parámetros de operación';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarParametros();
  }, [puedeVer]);

  if (!puedeVer) {
    return (
      <div
        role="status"
        style={{
          background: 'var(--cp-sand)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--cp-soft)',
        }}
      >
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)', marginBottom: '6px' }}>
          Sin permiso de acceso
        </div>
        <div>No tienes el permiso <b>configuracion/ver</b> para consultar los parámetros de operación.</div>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando parámetros de operación..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar parámetros"
        mensaje={errorCarga}
        alReintentar={cargarParametros}
      />
    );
  }

  const iniciarEdicion = (item: ParametroItem) => {
    setParametroEditando(item);
    setErrorValidacion(null);
    setErrorServidor(null);
    if (item.clave === 'reprog_recargo_modo') {
      const fijo = parametros.find((p) => p.clave === 'reparto_recargo_reprogramacion');
      setMontoFijoInput(String(fijo?.valor ?? 0));
      setNuevoValorInput(String(item.valor || 'IGUAL_ENVIO'));
    } else if (typeof item.valor === 'boolean') {
      setNuevoValorInput(item.valor ? 'true' : 'false');
    } else if (typeof item.valor === 'string' && (item.valor.toLowerCase() === 'si' || item.valor.toLowerCase() === 'no')) {
      setNuevoValorInput(item.valor.toLowerCase() === 'si' ? 'true' : 'false');
    } else if (typeof item.valor === 'number') {
      setNuevoValorInput(String(item.valor));
    } else if (typeof item.valor === 'string') {
      setNuevoValorInput(item.valor);
    } else if (item.valor === null || item.valor === undefined) {
      setNuevoValorInput('');
    } else {
      setNuevoValorInput(JSON.stringify(item.valor));
    }
  };

  const prepararGuardado = () => {
    if (!parametroEditando) return;
    const tipo = tipoParametro(parametroEditando.clave, parametroEditando.valor);

    if (tipo === 'numero') {
      const crudo = nuevoValorInput.trim();
      if (crudo === '' && TARIFAS_CULQI.includes(parametroEditando.clave) && !parametroEditando.clave.endsWith('_fijo')) {
        setErrorValidacion('Escribe el porcentaje (de 0 a 20)');
        return;
      }
      const num = Number(crudo);
      if (isNaN(num) || num < 0) {
        setErrorValidacion('El valor debe ser un número mayor o igual a 0');
        return;
      }
    } else if (tipo === 'texto') {
      if (!nuevoValorInput.trim()) {
        setErrorValidacion('El texto no puede estar vacío');
        return;
      }
    } else if (tipo === 'selector' && nuevoValorInput === 'FIJO') {
      const monto = Number(montoFijoInput.trim());
      if (montoFijoInput.trim() === '' || isNaN(monto) || monto < 0) {
        setErrorValidacion('El monto fijo debe ser un número mayor o igual a 0');
        return;
      }
    }

    setErrorValidacion(null);
    setConfirmarAbierto(true);
  };

  const handleGuardarParametro = async () => {
    if (!parametroEditando || !puedeEditar) return;
    const clave = parametroEditando.clave;
    const tipo = tipoParametro(parametroEditando.clave, parametroEditando.valor);

    let valorFinal: any = nuevoValorInput.trim();
    if (tipo === 'numero') {
      valorFinal = Number(nuevoValorInput.trim());
    } else if (tipo === 'sino') {
      valorFinal = nuevoValorInput === 'true' || nuevoValorInput === 'si' ? 'si' : 'no';
    }

    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ParametroItem>(`/admin/configuracion/${clave}`, {
        valor: valorFinal,
      });
      const cambios: ParametroItem[] = [{ clave, valor: res.valor }];

      // Modo "Monto fijo": el monto va en su propio parámetro; se guarda solo si cambió
      if (tipo === 'selector' && valorFinal === 'FIJO') {
        const monto = Number(montoFijoInput.trim());
        const actual = parametros.find((p) => p.clave === 'reparto_recargo_reprogramacion');
        if (Number(actual?.valor ?? 0) !== monto) {
          const resMonto = await api.put<ParametroItem>('/admin/configuracion/reparto_recargo_reprogramacion', {
            valor: monto,
          });
          cambios.push({ clave: 'reparto_recargo_reprogramacion', valor: resMonto.valor });
        }
      }

      setParametros((prev) =>
        prev.map((p) => cambios.find((c) => c.clave === p.clave) ?? p),
      );

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
      setParametroEditando(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar el parámetro en el servidor';
      setErrorServidor(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  /** Guarda un interruptor Sí/No de un toque (el servidor guarda «si» o «no»). */
  const guardarSino = async (item: ParametroItem, nuevo: boolean) => {
    if (!puedeEditar) return;
    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ParametroItem>(`/admin/configuracion/${item.clave}`, { valor: nuevo ? 'si' : 'no' });
      setParametros((prev) => prev.map((p) => (p.clave === item.clave ? { clave: item.clave, valor: res.valor } : p)));
      setMensajeGuardado(`Guardado a las ${new Date().toLocaleTimeString('es-PE', { hour12: false })}`);
    } catch (err) {
      setErrorServidor(err instanceof ErrorApi ? err.message : 'Error al actualizar el parámetro en el servidor');
    } finally {
      setGuardando(false);
      setCambioSino(null);
    }
  };

  /** Un toque cambia el interruptor; pide confirmación Sí/No salvo en parámetros de riesgo bajo. */
  const alternarSino = (item: ParametroItem) => {
    const nuevo = !valorEsSi(item.valor);
    if (AYUDA_PARAMETROS[item.clave]?.peligro === 'bajo') void guardarSino(item, nuevo);
    else setCambioSino({ item, nuevo });
  };

  const formatearValorVisual = (clave: string, valor: any) => {
    if (valor === null || valor === undefined) return 'Sin configurar';
    if (clave === 'pausa_alta_demanda') {
      const activa = typeof valor === 'boolean' ? valor : Boolean(valor?.activa);
      return activa ? 'Activa (cocina pausada)' : 'Desactivada (operando)';
    }
    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }
    if (typeof valor === 'string' && (valor.toLowerCase() === 'si' || valor.toLowerCase() === 'no')) {
      return valor.toLowerCase() === 'si' ? 'Sí' : 'No';
    }
    if (typeof valor === 'object' && valor !== null) {
      return JSON.stringify(valor);
    }
    const meta = META_PARAMETROS[clave];
    if (meta?.tipo === 'selector') {
      const opcion = meta.opciones?.find((o) => o.valor === String(valor));
      return opcion ? opcion.etiqueta : String(valor ?? '');
    }
    if (meta?.sufijo) {
      return `${valor} ${meta.sufijo}`;
    }
    return String(valor ?? '');
  };

  const etiquetaNuevoValor = () => {
    const meta = parametroEditando ? META_PARAMETROS[parametroEditando.clave] : undefined;
    if (meta?.tipo === 'selector') {
      return meta.opciones?.find((o) => o.valor === nuevoValorInput)?.etiqueta ?? nuevoValorInput;
    }
    return nuevoValorInput;
  };

  // Secciones plegables: las claves conocidas por grupo; el resto cae en «Otros parámetros»
  const conocidas = new Set([...GRUPOS_PARAMETROS.flatMap((g) => g.claves), ...CLAVES_OCULTAS]);
  const gruposVisibles = [
    ...GRUPOS_PARAMETROS.map((g) => ({
      id: g.id,
      titulo: g.titulo,
      items: g.claves.map((c) => parametros.find((p) => p.clave === c)).filter((p): p is ParametroItem => !!p),
    })),
    { id: 'otros', titulo: 'Otros parámetros', items: parametros.filter((p) => !conocidas.has(p.clave)) },
  ].filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            Parámetros de operación
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Tiempos de entrega, umbrales de reparto, tolerancias y beneficios de clientes.
          </p>
        </div>

        {mensajeGuardado && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--cp-green)',
            }}
          >
            {mensajeGuardado}
          </span>
        )}
      </div>

      {/* Indicador solo-lectura de estado de conexión con WhatsApp (sin exponer secretos) */}
      <div
        data-cfg-id="parametros-estado-whatsapp"
        tabIndex={-1}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          background:
            estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
              ? '#EBF7EE'
              : 'var(--cp-sand)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background:
                estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
                  ? 'var(--cp-green)'
                  : 'var(--cp-soft)',
            }}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            >
              WhatsApp:{' '}
              {estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
                ? 'conectado con Meta'
                : 'modo simulado (no se envia nada)'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              {estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado
                ? 'Conexión activa con WhatsApp Cloud API de Meta. Los mensajes saldrán a teléfonos reales.'
                : 'Modo seguro por defecto sin credenciales externas. Los mensajes se guardan en la base de datos con estado SIMULADO.'}
            </div>
          </div>
        </div>

        <Insignia
          variante={
            estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado ? 'exito' : 'neutro'
          }
        >
          {estadoWhatsApp?.modo === 'meta' && estadoWhatsApp?.conectado ? 'Meta' : 'Simulado'}
        </Insignia>
      </div>

      {consumoIa && typeof (consumoIa as any).tokensTotal === 'number' && (
        <div
          data-testid="tarjeta-consumo-ia"
          data-cfg-id="parametros-consumo-ia"
          tabIndex={-1}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '14px 18px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800 }}>IA</span>
            <div>
              <div
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              >
                Consumo de la IA este mes ({consumoIa.periodo})
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                {consumoIa.llamadasTotal} consultas · {consumoIa.tokensTotal.toLocaleString()} tokens · Costo estimado: ${consumoIa.costoUsdEstimado.toFixed(4)} USD / Tope: ${consumoIa.topeMensualUsd.toFixed(2)} USD ({consumoIa.porcentajeConsumido}% consumido)
              </div>
            </div>
          </div>

          <Insignia
            variante={
              consumoIa.topeAlcanzado
                ? 'peligro'
                : consumoIa.iaActiva
                ? 'exito'
                : 'neutro'
            }
          >
            {consumoIa.topeAlcanzado
              ? 'Tope alcanzado'
              : consumoIa.iaActiva
              ? 'IA activa'
              : 'IA inactiva'}
          </Insignia>
        </div>
      )}

      {/* Tarjeta pequeña de umbrales de alertas y espera (solo ADMIN) */}
      <TarjetaUmbralesAlertasEspera esAdmin={puedeEditar} alGuardar={cargarParametros} />

      {!puedeEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-soft)',
          }}
        >
          Modo sólo lectura. No tienes el permiso <b>configuracion/editar</b> para modificar parámetros.
        </div>
      )}

      {!parametroEditando && errorServidor && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorServidor}
        </div>
      )}

      {parametros.length === 0 ? (
        <EstadoVacio
          titulo="Sin parámetros de operación"
          descripcion="No se encontraron parámetros registrados en la base de datos."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {gruposVisibles.map((g, idx) => (
          <details key={g.id} open={idx === 0} data-testid={`grupo-parametros-${g.id}`} style={{ border: '1px solid var(--cp-line)', borderRadius: '14px', background: 'var(--cp-cream)' }}>
            <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 18px', cursor: 'pointer', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
              {g.titulo} ({g.items.length})
            </summary>
            {g.id === 'pantalla_local' && (
              <p style={{ margin: '0 18px 10px', fontSize: '14px' }}>
                <a href="/pantalla-local" target="_blank" rel="noreferrer" data-testid="abrir-pantalla-local">Abrir pantalla del local</a>
                {' '}(se abre en otra pestaña; ponla en la TV en pantalla completa)
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 12px 12px' }}>
          {g.items.map((p) => {
            const meta = META_PARAMETROS[p.clave] || {
              nombre: p.clave.replace(/_/g, ' '),
              descripcion: `Parámetro de configuración del sistema (${p.clave}).`,
              tipo: tipoParametro(p.clave, p.valor),
            };
            const aparte = !META_PARAMETROS[p.clave] && GESTIONADAS_APARTE.test(p.clave);
            const esSoloLectura = meta.tipo === 'solo_lectura' || p.clave === 'pausa_alta_demanda' || aparte;
            const esInterruptor = meta.tipo === 'sino' && !esSoloLectura;

            return (
              <div
                key={p.clave}
                data-cfg-id={puedeEditar && CLAVES_EN_TARJETA_UMBRALES.includes(p.clave) ? undefined : idParametro(p.clave)}
                tabIndex={-1}
                className="cfg-campo"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '14px 18px',
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '14px',
                  gap: '12px',
                }}
              >
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '15px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {meta.nombre}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: 'var(--cp-sand)',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      {p.clave}
                    </span>
                    {esSoloLectura && (
                      <Insignia variante="aviso">{p.clave === 'pausa_alta_demanda' ? 'Solo lectura (Cocina)' : aparte ? 'Se cambia en su propia pantalla' : 'Solo lectura'}</Insignia>
                    )}
                  </div>
                  {AYUDA_PARAMETROS[p.clave] ? (
                    <AyudaDetalle
                      id={`ayuda-${idParametro(p.clave)}`}
                      etiqueta={meta.nombre}
                      ayuda={AYUDA_PARAMETROS[p.clave].descripcion}
                      unidad={AYUDA_PARAMETROS[p.clave].unidad}
                      rango={AYUDA_PARAMETROS[p.clave].rango}
                      porDefecto={AYUDA_PARAMETROS[p.clave].porDefecto}
                      efecto={AYUDA_PARAMETROS[p.clave].efecto}
                      ejemplo={AYUDA_PARAMETROS[p.clave].ejemplo}
                      nota={AYUDA_PARAMETROS[p.clave].nota}
                      nombreBoton={p.clave}
                    />
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
                      {meta.descripcion}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {esInterruptor && puedeEditar && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', cursor: guardando ? 'wait' : 'pointer', fontWeight: 800, color: 'var(--cp-navy)' }}>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={meta.nombre}
                        checked={valorEsSi(p.valor)}
                        disabled={guardando}
                        onChange={() => alternarSino(p)}
                        style={{ width: '44px', height: '24px', accentColor: 'var(--cp-navy)' }}
                      />
                      {valorEsSi(p.valor) ? 'Sí' : 'No'}
                    </label>
                  )}
                  {!(esInterruptor && puedeEditar) && (
                  <div
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                      background: 'var(--cp-sand)',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      minWidth: '80px',
                      textAlign: 'center',
                    }}
                  >
                    {formatearValorVisual(p.clave, p.valor)}
                  </div>
                  )}

                  {!esSoloLectura && !esInterruptor && puedeEditar && (
                    <Boton
                      type="button"
                      variante="secundario"
                      tamano="pequeno"
                      onClick={() => iniciarEdicion(p)}
                    >
                      Editar
                    </Boton>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </details>
          ))}
        </div>
      )}

      {/* Modal / Diálogo de edición de parámetro */}
      {parametroEditando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !guardando && setParametroEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-parametro-titulo"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                id="editar-parametro-titulo"
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '17px',
                  color: 'var(--cp-navy)',
                }}
              >
                {META_PARAMETROS[parametroEditando.clave]?.nombre || parametroEditando.clave}
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                  margin: '4px 0 0 0',
                }}
              >
                {META_PARAMETROS[parametroEditando.clave]?.descripcion}
              </p>
            </div>

            {errorValidacion && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorValidacion}
              </div>
            )}

            {errorServidor && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorServidor}
              </div>
            )}

            {(() => {
              const meta = META_PARAMETROS[parametroEditando.clave];
              const tipo = tipoParametro(parametroEditando.clave, parametroEditando.valor);

              if (tipo === 'selector') {
                const opcionActual = meta?.opciones?.find((o) => o.valor === nuevoValorInput);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
                      {meta?.etiquetaSelector ?? 'Cómo se cobra'}
                      <select
                        value={nuevoValorInput}
                        onChange={(e) => {
                          setNuevoValorInput(e.target.value);
                          setErrorValidacion(null);
                          setErrorServidor(null);
                        }}
                        style={{ minHeight: '44px', borderRadius: '10px', border: '1px solid var(--cp-line)', padding: '0 10px', fontSize: '14px' }}
                      >
                        {meta?.opciones?.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                    {opcionActual && (
                      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>{opcionActual.ayuda}</div>
                    )}
                    {nuevoValorInput === 'FIJO' && (
                      <Campo
                        etiqueta="Monto fijo (S/)"
                        type="number"
                        value={montoFijoInput}
                        onChange={(e) => {
                          setMontoFijoInput(e.target.value);
                          setErrorValidacion(null);
                          setErrorServidor(null);
                        }}
                      />
                    )}
                  </div>
                );
              }

              const ayudaEdicion = AYUDA_PARAMETROS[parametroEditando.clave];
              return (
                <>
                <Campo
                  etiqueta={`Nuevo valor ${meta?.sufijo ? `(${meta.sufijo})` : ''}`}
                  type={tipo === 'numero' ? 'number' : 'text'}
                  value={nuevoValorInput}
                  onChange={(e) => {
                    setNuevoValorInput(e.target.value);
                    setErrorValidacion(null);
                    setErrorServidor(null);
                  }}
                  aria-describedby={ayudaEdicion ? 'ayuda-edicion-parametro-ayuda' : undefined}
                  autoFocus
                />
                {ayudaEdicion && (
                  <AyudaDetalle
                    id="ayuda-edicion-parametro"
                    etiqueta={meta?.nombre || parametroEditando.clave}
                    nombreBoton={parametroEditando.clave}
                    ayuda={ayudaEdicion.ejemplo}
                    unidad={ayudaEdicion.unidad}
                    rango={ayudaEdicion.rango}
                    porDefecto={ayudaEdicion.porDefecto}
                    efecto={ayudaEdicion.efecto}
                  />
                )}
                </>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Boton
                type="button"
                variante="secundario"
                disabled={guardando}
                onClick={() => setParametroEditando(null)}
              >
                Cancelar
              </Boton>
              <Boton
                type="button"
                variante="primario"
                disabled={guardando}
                onClick={prepararGuardado}
              >
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación Sí/No del interruptor de un toque */}
      <Confirmar
        abierto={cambioSino !== null}
        titulo={cambioSino?.nuevo ? '¿Activar este parámetro?' : '¿Desactivar este parámetro?'}
        mensaje={`¿Confirmas poner "${cambioSino ? META_PARAMETROS[cambioSino.item.clave]?.nombre || cambioSino.item.clave : ''}" en "${cambioSino?.nuevo ? 'Sí' : 'No'}"? El cambio rige desde que guardas.`}
        textoSi="Sí, cambiar"
        textoNo="No, dejarlo"
        cargando={guardando}
        alConfirmar={() => { if (cambioSino) return guardarSino(cambioSino.item, cambioSino.nuevo); }}
        alCancelar={() => setCambioSino(null)}
      />

      {/* Modal Confirmar Sí/No obligatorio antes de guardar un parámetro */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar parámetro de operación?"
        mensaje={`¿Confirmas cambiar el valor de "${
          parametroEditando ? META_PARAMETROS[parametroEditando.clave]?.nombre || parametroEditando.clave : ''
        }" a "${etiquetaNuevoValor()}"? El cambio afectará los cálculos operativos del sistema.`}
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleGuardarParametro}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}
