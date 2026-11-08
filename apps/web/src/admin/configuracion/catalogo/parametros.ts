import type { EntradaConfig, PeligroConfig } from './tipos';

/**
 * Pestaña «Parámetros de operación»: una entrada por clave de META_PARAMETROS (ParametrosOperacionTab).
 * Cada clave genera el id `parametros-<clave con guiones>` (el mismo data-cfg-id de la fila).
 * Los textos se verificaron contra el código de apps/api (dónde se lee cada clave y qué valor por defecto usa).
 */
export interface AyudaParametro {
  grupo: string;
  titulo: string;
  /** Qué cambia y a quién afecta (lenguaje de negocio). */
  descripcion: string;
  ejemplo: string;
  /** «Qué pasa si lo cambias». */
  efecto: string;
  porDefecto?: string;
  unidad?: string;
  rango?: string;
  palabras: string[];
  peligro?: PeligroConfig;
  /** Aviso de integridad: el parámetro no se lee en ningún lado o no se puede guardar. */
  nota?: string;
}

export interface GrupoParametros {
  id: string;
  titulo: string;
  claves: string[];
}

export const GRUPOS_PARAMETROS: GrupoParametros[] = [
  { id: 'entrega', titulo: 'Tiempo prometido de entrega', claves: ['tiempo_prometido_min', 'tiempo_max_min', 'eta_factor_urbano', 'eta_productos_desde', 'eta_extra_por_producto_min', 'eta_parada_min', 'eta_margen_min', 'eta_paso_min', 'eta_base_sin_zona_min'] },
  { id: 'envio', titulo: 'Envío gratis y pedido mínimo', claves: ['envio_gratis_monto', 'envio_gratis_modo', 'pedido_minimo'] },
  { id: 'caja', titulo: 'Caja', claves: ['caja_monto_inicial'] },
  { id: 'clientes', titulo: 'Puntos, personal y reservas', claves: ['puntos_porcentaje', 'descuento_personal_pct', 'reserva_tolerancia_min', 'reserva_recordatorio_min', 'reserva_web_activa', 'reserva_web_max_pendientes', 'reserva_web_dias_max', 'reserva_web_max_personas', 'carta_aviso_entrada', 'verificacion_celular_modo', 'verificacion_whatsapp_numero'] },
  { id: 'stock', titulo: 'Avisos de «se está acabando» (stock de productos)', claves: ['aviso_stock_quedan_desde', 'aviso_stock_ultimas_desde'] },
  { id: 'colores', titulo: 'Colores de espera en cocina y en el mapa de reparto', claves: ['rep_naranja_min', 'rep_rojo_min', 'reparto_retrasado_min', 'reparto_tarde_min', 'reparto_muy_tarde_min', 'reparto_velocidad_kmh', 'rep_max_pedidos', 'reparto_max_pedidos'] },
  { id: 'demanda', titulo: 'Alta demanda', claves: ['pausa_alta_demanda', 'alta_demanda_min_base'] },
  { id: 'puerta', titulo: 'Entrega fallida y reprogramación', claves: ['reparto_insistencia_min', 'reparto_espera_max_min', 'reprog_recargo_modo', 'reparto_recargo_reprogramacion', 'reprog_respuesta_min', 'reprog_max_intentos'] },
  { id: 'encuesta', titulo: 'Encuesta posventa', claves: ['encuesta_espera_min', 'encuesta_puntaje_queja', 'encuesta_ventana_dias'] },
  { id: 'avisos', titulo: 'Avisos automáticos por WhatsApp al cliente', claves: ['chatbot_activo', 'whatsapp_aviso_recibido_activo', 'whatsapp_aviso_pago_confirmado_activo', 'whatsapp_aviso_listo_activo', 'whatsapp_aviso_recojo_activo', 'whatsapp_aviso_asignado_activo', 'whatsapp_aviso_salida_activo', 'whatsapp_aviso_llegada_activo', 'whatsapp_aviso_espera_activo', 'whatsapp_aviso_entregado_activo', 'whatsapp_aviso_encuesta_activo', 'whatsapp_aviso_voucher_recordatorio_activo', 'whatsapp_plantilla_recibido_seguimiento_activa', 'whatsapp_plantilla_delivery_ubicacion_activa', 'whatsapp_aviso_bienvenida_puntos_activo', 'whatsapp_aviso_puntos_ganados_activo', 'whatsapp_aviso_cuenta_activo'] },
  { id: 'pago', titulo: 'Pagos digitales por el chat', claves: ['chatbot_pago_recordatorio_activo', 'chatbot_pago_recordatorio_min', 'chatbot_pago_expira_min'] },
  { id: 'ia', titulo: 'Inteligencia artificial', claves: ['chatbot_ia_activo', 'chatbot_modo_libre', 'chatbot_ia_tope_mensual_usd', 'chatbot_ia_max_por_hora_telefono', 'ayuda_ia_activo'] },
  { id: 'alertas', titulo: 'Alertas internas y modo asistido', claves: ['alerta_voucher_min_1', 'alerta_voucher_min_2', 'espera_cliente_aviso_min', 'chat_tomado_liberar_min', 'alerta_pedido_sin_confirmar_min', 'asistido_espera_min'] },
  { id: 'impresion', titulo: 'Etiquetas e impresión', claves: ['impresion_alerta_min', 'impresion_vence_min', 'impresion_etiqueta_bebida_ancho_mm', 'impresion_etiqueta_bebida_alto_mm', 'impresion_etiqueta_general_ancho_mm', 'impresion_etiqueta_general_alto_mm'] },
];

const SI_NO = 'Sí o No';
const aviso = (que: string, cuando: string, ejemplo: string, palabras: string[]): Omit<AyudaParametro, 'grupo' | 'titulo'> => ({
  descripcion: `Enciende o apaga el mensaje de WhatsApp que recibe el cliente ${cuando}. ${que}`,
  ejemplo,
  efecto: 'En «No» ese mensaje deja de enviarse; el pedido sigue su curso normal. Si el parámetro no existe, el aviso queda apagado. Aplica a los pedidos que avancen de estado desde que guardas.',
  porDefecto: 'No (apagado si no existe)',
  rango: SI_NO,
  palabras: ['whatsapp', 'aviso', 'mensaje al cliente', 'notificacion', ...palabras],
  peligro: 'medio',
});

export const AYUDA_PARAMETROS: Record<string, AyudaParametro> = {
  tiempo_prometido_min: {
    grupo: 'entrega', titulo: 'Tiempo prometido de entrega (base)',
    descripcion: 'Minutos de espera que se le dicen al cliente como base, en la carta y en el chatbot. La alta demanda le suma sus minutos encima. También es el respaldo del aviso «tiempo estimado» cuando el pedido no tiene zona ni ubicación.',
    ejemplo: 'Si pones 30 y hay alta demanda de +15, la carta anuncia 45 minutos.',
    efecto: 'Cambia de inmediato lo que ven los clientes nuevos en la carta y el chatbot. Los pedidos que ya salieron conservan el tiempo que se les prometió.',
    porDefecto: '30', unidad: 'minutos', palabras: ['eta', 'tiempo de entrega', 'demora', 'cuanto demora', 'minutos', 'prometido', 'tiempo base'], peligro: 'medio',
  },
  tiempo_max_min: {
    grupo: 'entrega', titulo: 'Tiempo máximo de entrega',
    descripcion: 'Ninguna pantalla ni regla del sistema lo lee hoy. Se muestra solo para conservar el valor guardado.',
    ejemplo: 'Si pones 90, no cambia nada visible.',
    efecto: 'Ningún efecto actual: no se usa en cálculos ni mensajes.',
    unidad: 'minutos', palabras: ['tiempo maximo', 'limite de entrega', 'tope de tiempo'],
    nota: 'No tiene efecto actualmente.',
  },
  eta_factor_urbano: {
    grupo: 'entrega', titulo: 'Factor de calles en el tiempo estimado',
    descripcion: 'Cuánto más que la línea recta recorre el repartidor por las calles. Se usa para calcular el tiempo cuando el pedido no tiene zona, o cuando el repartidor lleva varios pedidos en la ruta.',
    ejemplo: 'Con 1.3 se asume 30 % más camino que la línea recta; con 1.5, 50 % más.',
    efecto: 'Subirlo alarga el tiempo estimado de los pedidos sin zona o en ruta compartida. Los pedidos con zona y una sola parada no cambian.',
    porDefecto: '1.3', rango: '1 a 3', palabras: ['calles', 'trafico', 'desvio', 'distancia por calles', 'tiempo estimado', 'factor'], peligro: 'bajo',
  },
  eta_productos_desde: {
    grupo: 'entrega', titulo: 'Empaque: desde cuántas unidades se suma tiempo',
    descripcion: 'Cantidad de productos del pedido a partir de la cual se suma tiempo de empaque al tiempo estimado.',
    ejemplo: 'Con 3: un pedido de 2 unidades no suma nada; uno de 3 suma el extra de 1 unidad; uno de 5, el de 3 unidades.',
    efecto: 'Bajarlo hace que más pedidos sumen empaque y suban unos minutos en el aviso al cliente.',
    porDefecto: '3', unidad: 'unidades', rango: 'entero de 1 a 50', palabras: ['empaque', 'unidades', 'cantidad de productos', 'tiempo estimado'], peligro: 'bajo',
  },
  eta_extra_por_producto_min: {
    grupo: 'entrega', titulo: 'Minutos de empaque por unidad',
    descripcion: 'Minutos que se suman al tiempo estimado por cada unidad desde la cantidad de empaque.',
    ejemplo: 'Con 1 minuto y un pedido de 5 unidades (empaque desde 3): suma 3 minutos.',
    efecto: 'Subirlo alarga el tiempo anunciado en pedidos grandes.',
    porDefecto: '1', unidad: 'minutos', rango: '0.5 a 30', palabras: ['empaque', 'minutos por producto', 'pedido grande'], peligro: 'bajo',
  },
  eta_parada_min: {
    grupo: 'entrega', titulo: 'Minutos por cada parada anterior de la ruta',
    descripcion: 'Minutos que se suman por cada pedido que el repartidor entrega antes en la misma ruta.',
    ejemplo: 'Con 3 minutos, el tercer pedido de la ruta suma 6 minutos por los dos anteriores.',
    efecto: 'Subirlo alarga el tiempo prometido a los pedidos que van detrás de otros en una ruta.',
    porDefecto: '3', unidad: 'minutos', rango: '0.5 a 30', palabras: ['parada', 'ruta', 'varios pedidos', 'repartidor', 'tiempo estimado'], peligro: 'bajo',
  },
  eta_margen_min: {
    grupo: 'entrega', titulo: 'Ancho mínimo del rango de tiempo',
    descripcion: 'El tiempo máximo que se anuncia nunca es menor que el mínimo más este margen.',
    ejemplo: 'Con 5: se anuncia «25 a 30», no «25 a 26».',
    efecto: 'Subirlo ensancha el rango que ve el cliente («25 a 35»).',
    porDefecto: '5', unidad: 'minutos', rango: 'entero de 1 a 60', palabras: ['rango', 'margen', 'de a', 'tiempo estimado'], peligro: 'bajo',
  },
  eta_paso_min: {
    grupo: 'entrega', titulo: 'Redondeo del tiempo estimado',
    descripcion: 'El tiempo estimado se redondea a múltiplos de este valor para que no salgan cifras raras.',
    ejemplo: 'Con 5: 23 minutos se anuncia como 25; con 10, como 20.',
    efecto: 'Subirlo hace los tiempos más redondos y menos precisos.',
    porDefecto: '5', unidad: 'minutos', rango: 'entero de 1 a 30', palabras: ['redondeo', 'multiplos', 'tiempo estimado'], peligro: 'bajo',
  },
  eta_base_sin_zona_min: {
    grupo: 'entrega', titulo: 'Minutos de puerta cuando no hay zona',
    descripcion: 'Minutos que se suman al recorrido cuando el pedido tiene ubicación en el mapa pero no cae en ninguna zona de reparto.',
    ejemplo: 'Con 5: un recorrido calculado de 12 minutos se anuncia con 17 antes de redondear.',
    efecto: 'Subirlo alarga el tiempo de los pedidos sin zona.',
    porDefecto: '5', unidad: 'minutos', rango: '0.5 a 60', palabras: ['sin zona', 'puerta', 'tiempo estimado'], peligro: 'bajo',
  },
  envio_gratis_monto: {
    grupo: 'envio', titulo: 'Monto de compra para envío gratis',
    descripcion: 'Total de productos desde el cual el delivery no cobra envío. Lo aplican la carta, el chatbot y el cálculo del pedido.',
    ejemplo: 'Con 70 en modo «mas_de»: una compra de S/ 71 no paga envío; una de S/ 70 exacto sí paga.',
    efecto: 'Bajarlo regala más envíos y reduce el ingreso por delivery; subirlo cobra envío a más clientes. Afecta a los pedidos nuevos al instante.',
    porDefecto: '70', unidad: 'soles (S/)', rango: '0 o más', palabras: ['delivery gratis', 'envio gratis', 'sin costo de envio', 'monto minimo para envio gratis', 'promocion de envio'], peligro: 'alto',
  },
  envio_gratis_modo: {
    grupo: 'envio', titulo: 'Cómo se compara el monto de envío gratis',
    descripcion: 'Escribe «desde» para que el monto exacto ya cuente (S/ 70 o más), o «mas_de» para exigir superar el monto (más de S/ 70).',
    ejemplo: 'Con monto 70: en «desde» una compra de 70 es gratis; en «mas_de» no.',
    efecto: 'Cualquier otro texto se trata como «mas_de». Cambia quién recibe el envío gratis justo en el monto límite.',
    porDefecto: 'mas_de', rango: 'desde o mas_de', palabras: ['desde', 'mas de', 'envio gratis', 'monto exacto', 'modo'], peligro: 'alto',
  },
  pedido_minimo: {
    grupo: 'envio', titulo: 'Pedido mínimo',
    descripcion: 'Monto mínimo de productos para que el sistema acepte un pedido nuevo. Si el cliente no llega, el pedido se rechaza con el aviso del monto mínimo.',
    ejemplo: 'Con 25: un pedido de S/ 20 en productos no se acepta; uno de S/ 25 sí.',
    efecto: 'Subirlo rechaza pedidos chicos y puede perder ventas; con 0 no hay mínimo. Se valida al crear cada pedido, antes de calcular el envío.',
    porDefecto: '0 (sin mínimo)', unidad: 'soles (S/)', rango: '0 o más', palabras: ['monto minimo', 'minimo de compra', 'pedido minimo', 'delivery minimo'], peligro: 'alto',
  },
  caja_monto_inicial: {
    grupo: 'caja', titulo: 'Monto inicial de la caja',
    descripcion: 'Dinero con el que se abre la gaveta cada día. Al abrir caja, el campo sale con este monto. Solo el administrador lo cambia aquí; quien abre la caja puede escribir otro monto y queda auditado que fue distinto del oficial.',
    ejemplo: 'Con 150: Caja abre con S/ 150.00; si el cajero escribe 200, abre con 200 y la auditoría lo marca como distinto del oficial.',
    efecto: 'Cambia la apertura de las cajas siguientes (la caja de hoy, si ya está abierta, no cambia). El esperado de efectivo del cierre parte del monto con el que realmente se abrió.',
    porDefecto: '0 (sin monto oficial)', unidad: 'soles (S/)', rango: '0 a 5000, máximo dos decimales', palabras: ['caja', 'apertura', 'monto inicial', 'fondo', 'gaveta', 'sencillo', 'abrir caja'], peligro: 'alto',
  },
  puntos_porcentaje: {
    grupo: 'clientes', titulo: 'Porcentaje de puntos para el cliente',
    descripcion: 'Qué porcentaje del consumo se convierte en puntos de fidelidad para el cliente con cuenta. Cuenta solo productos sin descuento ni promoción, sin envío y sin lo pagado con puntos.',
    ejemplo: 'Con 5 %: un pedido de S/ 40 elegible suma 2 puntos.',
    efecto: 'Subirlo regala más puntos (dinero que luego se canjea) en los pedidos nuevos; los puntos ya ganados no cambian.',
    porDefecto: '5', unidad: '%', rango: '0 o más', palabras: ['puntos', 'fidelidad', 'acumular', 'canje', 'cliente frecuente', 'porcentaje'], peligro: 'alto',
  },
  descuento_personal_pct: {
    grupo: 'clientes', titulo: 'Descuento para el personal a crédito',
    descripcion: 'Porcentaje de descuento que recibe el personal en los consumos que paga a crédito.',
    ejemplo: 'Con 25 %: un consumo de S/ 40 del personal queda en S/ 30.',
    efecto: 'Cambia el monto de los créditos nuevos del personal; los ya registrados no se recalculan.',
    porDefecto: '25', unidad: '%', rango: '0 o más', palabras: ['personal', 'trabajadores', 'empleados', 'credito', 'descuento personal', 'consumo del personal'], peligro: 'alto',
  },
  reserva_tolerancia_min: {
    grupo: 'clientes', titulo: 'Tolerancia de reservas',
    descripcion: 'Minutos de cortesía que se guarda la mesa reservada antes de liberarla si el cliente no llega.',
    ejemplo: 'Con 15: una reserva de las 8:00 se libera a las 8:15 si nadie llegó.',
    efecto: 'Subirlo da más tiempo al cliente pero mantiene la mesa ocupada más rato.',
    porDefecto: '15', unidad: 'minutos', rango: 'entero de 1 a 180', palabras: ['reserva', 'mesa', 'tolerancia', 'no llega', 'liberar mesa', 'cortesia'], peligro: 'medio',
  },
  reserva_recordatorio_min: {
    grupo: 'clientes', titulo: 'Recordatorio de reserva (minutos antes)',
    descripcion: 'Cuántos minutos antes de la hora se manda el único recordatorio por WhatsApp al cliente. Sólo sale si el recordatorio está encendido.',
    ejemplo: 'Con 30: la reserva de las 8:00 recibe el mensaje a las 7:30.',
    efecto: 'Un solo mensaje por reserva; no se repite aunque la tarea reinicie.',
    porDefecto: '30', unidad: 'minutos', rango: 'entero de 5 a 240', palabras: ['reserva', 'recordatorio', 'whatsapp', 'aviso', 'antes'], peligro: 'bajo',
  },
  reserva_web_activa: {
    grupo: 'clientes', titulo: 'Reservar mesa desde la carta encendido',
    descripcion: 'Muestra el botón «Reservar» en la carta virtual para que el cliente pida mesa. Cada pedido llega como solicitud pendiente que el local aprueba o rechaza en Reservas › Solicitudes.',
    ejemplo: 'En «No», la carta no muestra el botón de reservar y nadie puede enviar una solicitud desde ahí.',
    efecto: 'Apagarlo no cambia las reservas ya pedidas; solo quita el botón de la carta.',
    porDefecto: 'Sí (encendido si no existe)', rango: SI_NO, palabras: ['reservar', 'reserva', 'carta', 'mesa', 'solicitud', 'boton reservar', 'apagar reservas'], peligro: 'medio',
  },
  reserva_web_max_pendientes: {
    grupo: 'clientes', titulo: 'Reservas pendientes por celular desde la carta',
    descripcion: 'Cuántas solicitudes de reserva pedidas desde la carta puede tener esperando respuesta un mismo celular. Frena que una persona llene la lista de pendientes.',
    ejemplo: 'Con 2: si Ana ya tiene dos pedidos sin confirmar, la carta le pide esperar antes de un tercero.',
    efecto: 'Subirlo permite más pedidos en espera por celular; bajarlo a 1 exige que el cliente espere una respuesta antes de pedir otra.',
    porDefecto: '2', unidad: 'solicitudes', rango: 'entero de 1 a 10', palabras: ['reserva', 'pendientes', 'spam', 'limite', 'celular', 'solicitudes'], peligro: 'bajo',
  },
  reserva_web_dias_max: {
    grupo: 'clientes', titulo: 'Días de anticipación para reservar desde la carta',
    descripcion: 'Hasta cuántos días antes de la fecha puede pedir mesa el cliente desde la carta virtual.',
    ejemplo: 'Con 30: el cliente puede pedir mesa para hoy o hasta dentro de 30 días.',
    efecto: 'Subirlo deja reservar con más meses de anticipación; bajarlo acorta las fechas que se ofrecen en la carta.',
    porDefecto: '30', unidad: 'días', rango: 'entero de 1 a 365', palabras: ['reserva', 'anticipacion', 'dias', 'fecha', 'futuro'], peligro: 'bajo',
  },
  aviso_stock_quedan_desde: {
    grupo: 'stock', titulo: 'Avisar «Quedan N» desde (unidades)',
    descripcion: 'Desde cuántas unidades el cliente ve «Quedan N» en la carta, en el pedido por WhatsApp y en el salón, para los productos con stock controlado (donas, galletas, postres). 0 apaga el aviso.',
    ejemplo: 'Con 5, el cliente ve «Quedan 5» y «Quedan 4»; con 3 o menos ve la franja «¡Últimas!».',
    efecto: 'Se aplica en el acto a la carta y al bot. No puede ser menor que la franja «¡Últimas!».',
    porDefecto: '5', unidad: 'unidades', rango: 'entero de 0 a 20', palabras: ['stock', 'quedan', 'se acaba', 'ultimas', 'aviso', 'donas', 'galletas', 'agotando', 'poco stock'], peligro: 'bajo',
  },
  aviso_stock_ultimas_desde: {
    grupo: 'stock', titulo: 'Franja «¡Últimas!» desde (unidades)',
    descripcion: 'Desde cuántas unidades aparece la franja llamativa: «¡Última dona!» con 1, «¡Últimas 2!» con 2 y «¡Quedan solo N, ya se acaban!» con más. 0 apaga la franja. No puede ser mayor que el aviso «Quedan N».',
    ejemplo: 'Con 3, el cliente ve «¡Quedan solo 3, ya se acaban!» cuando quedan 3 donas.',
    efecto: 'Se aplica en el acto a la carta y al bot.',
    porDefecto: '3', unidad: 'unidades', rango: 'entero de 0 a 20 (igual o menor que «Quedan N»)', palabras: ['stock', 'ultimas', 'ultima', 'franja', 'ya se acaban', 'aviso', 'donas', 'galletas'], peligro: 'bajo',
  },
  reserva_web_max_personas: {
    grupo: 'clientes', titulo: 'Personas máximas por reserva desde la carta',
    descripcion: 'Tope de personas que acepta una reserva pedida desde la carta. Si está vacío, el tope es la suma de asientos de las mesas activas del salón.',
    ejemplo: 'Con 8: un pedido para 9 personas se rechaza en la carta y el cliente recibe la indicación de escribir o llamar al local.',
    efecto: 'Cambia solo las reservas que se pidan desde la carta a partir de ese momento; las ya pedidas no cambian.',
    porDefecto: 'suma de asientos de las mesas activas', unidad: 'personas', rango: 'entero de 1 a 200', palabras: ['reserva', 'personas', 'grupo', 'asientos', 'maximo', 'mesa'], peligro: 'bajo',
  },
  // Verificación del celular al crear cuenta o recuperar contraseña. Ver apps/api/src/modulos/clientes/verificacion-whatsapp.util.ts
  verificacion_celular_modo: {
    grupo: 'clientes', titulo: 'Cómo verifica el cliente su celular al crear cuenta o recuperar la contraseña',
    descripcion: 'WHATSAPP_ENTRANTE (recomendado mientras Meta no apruebe las plantillas de código): el cliente toca «Abrir WhatsApp y enviar mensaje» y escribe él primero al número del negocio; al llegar el mensaje, la carta avanza sola. CODIGO_PLANTILLA: el servidor envía un código de 6 dígitos por WhatsApp (plantilla de Meta) y el cliente lo escribe en la carta.',
    ejemplo: 'Con WHATSAPP_ENTRANTE, Ana toca el botón, envía el mensaje ya escrito y la carta le muestra «Celular verificado» sin que escriba ningún código.',
    efecto: 'Cambiarlo afecta solo a quien crea cuenta o recupera contraseña a partir de ese momento. Las cuentas ya creadas no cambian. Para CODIGO_PLANTILLA, las plantillas caprichos_codigo_cuenta y caprichos_codigo_recuperar deben estar APROBADAS en Meta; si no, nadie recibe el código.',
    porDefecto: 'WHATSAPP_ENTRANTE', rango: 'WHATSAPP_ENTRANTE o CODIGO_PLANTILLA',
    palabras: ['verificar', 'verificacion', 'celular', 'codigo', 'whatsapp', 'crear cuenta', 'contrasena', 'plantilla', 'meta'], peligro: 'medio',
  },
  verificacion_whatsapp_numero: {
    grupo: 'clientes', titulo: 'Número de WhatsApp que recibe la verificación',
    descripcion: 'Número del negocio al que el cliente escribe para verificar su celular, solo dígitos con código de país (por ejemplo 51914244077). Si se deja vacío se usa la variable del servidor VERIFICACION_WHATSAPP_NUMERO (la demo la usa para su número de prueba) o, si no existe, el WhatsApp de contacto del local (Configuración › Mi local › Contacto).',
    ejemplo: 'Con 51914244077, el botón abre WhatsApp con ese número y el mensaje «Hola Caprichos, quiero verificar mi celular. Mi código: …».',
    efecto: 'Si cambias el número, los enlaces nuevos van al número nuevo. Si no hay número (ni este ni el de contacto), el modo WHATSAPP_ENTRANTE muestra «verificación no disponible» en vez de fallar en silencio.',
    porDefecto: 'vacío (usa el WhatsApp de contacto del local)', rango: 'celular de 9 dígitos con +51 opcional',
    palabras: ['verificar', 'numero', 'whatsapp', 'celular del negocio', 'contacto', 'verificacion', 'codigo'], peligro: 'medio',
  },
  carta_aviso_entrada: {
    grupo: 'clientes', titulo: 'Aviso de promociones al entrar a la carta',
    descripcion: 'Muestra una ventana con la mejor promoción del día cuando el cliente abre la carta virtual (una vez al día por dispositivo).',
    ejemplo: 'En «Sí», quien abre la carta ve primero la promoción vigente.',
    efecto: 'En «No» la carta abre directo, sin ventana. No afecta precios ni pedidos.',
    porDefecto: 'No', rango: SI_NO, palabras: ['promocion', 'ventana emergente', 'modal', 'oferta del dia', 'carta', 'popup'], peligro: 'bajo',
  },
  rep_naranja_min: {
    grupo: 'colores', titulo: 'Pedido en naranja: minutos de espera (cocina y pedidos)',
    descripcion: 'Minutos desde que entró el pedido para pintarlo naranja en las comandas de cocina y en la lista de pedidos. No es el mapa de reparto: ese usa «Tarde».',
    ejemplo: 'Con 35: un pedido que lleva 36 minutos esperando se ve naranja.',
    efecto: 'Bajarlo hace que la cocina vea las alertas antes. Mantenlo por debajo del rojo.',
    porDefecto: '35', unidad: 'minutos', rango: '0 o más', palabras: ['naranja', 'retraso', 'alerta', 'color', 'cocina', 'tarde', 'espera del pedido'], peligro: 'medio',
  },
  rep_rojo_min: {
    grupo: 'colores', titulo: 'Pedido en rojo: minutos de espera (cocina y pedidos)',
    descripcion: 'Minutos desde que entró el pedido para pintarlo rojo (crítico) en las comandas de cocina y en la lista de pedidos.',
    ejemplo: 'Con 50: un pedido con 50 minutos de espera o más se ve rojo.',
    efecto: 'Bajarlo adelanta la alerta crítica para cocina y caja.',
    porDefecto: '50', unidad: 'minutos', rango: '0 o más', palabras: ['rojo', 'critico', 'urgente', 'alerta', 'color', 'cocina', 'muy tarde'], peligro: 'medio',
  },
  reparto_retrasado_min: {
    grupo: 'colores', titulo: 'Mapa de reparto: amarillo (Retrasado)',
    descripcion: 'Minutos de espera para marcar un pedido en amarillo (Retrasado) en el mapa y la lista de reparto.',
    ejemplo: 'Con 20: a los 20 minutos el punto pasa de verde a amarillo.',
    efecto: 'Debe ser menor que Tarde y Muy tarde; el sistema rechaza un orden incorrecto.',
    porDefecto: '20', unidad: 'minutos', rango: '1 a 180', palabras: ['amarillo', 'retrasado', 'mapa', 'reparto', 'color', 'alerta'], peligro: 'medio',
  },
  reparto_tarde_min: {
    grupo: 'colores', titulo: 'Mapa de reparto: naranja (Tarde)',
    descripcion: 'Minutos de espera para marcar un pedido en naranja (Tarde) en el mapa de reparto.',
    ejemplo: 'Con 30: a los 30 minutos el punto se ve naranja.',
    efecto: 'Debe quedar entre Retrasado y Muy tarde.',
    porDefecto: '30', unidad: 'minutos', rango: '2 a 240', palabras: ['naranja', 'tarde', 'mapa', 'reparto', 'color', 'alerta'], peligro: 'medio',
  },
  reparto_muy_tarde_min: {
    grupo: 'colores', titulo: 'Mapa de reparto: rojo palpitando (Muy tarde)',
    descripcion: 'Minutos de espera para marcar un pedido en rojo palpitando (crítico) en el mapa de reparto.',
    ejemplo: 'Con 45: a los 45 minutos el punto palpita en rojo.',
    efecto: 'Debe ser mayor que Tarde.',
    porDefecto: '45', unidad: 'minutos', rango: '3 a 360', palabras: ['rojo', 'muy tarde', 'palpitando', 'critico', 'mapa', 'reparto'], peligro: 'medio',
  },
  reparto_velocidad_kmh: {
    grupo: 'colores', titulo: 'Velocidad media del repartidor',
    descripcion: 'Velocidad promedio en moto que usa el sistema para estimar el tiempo de viaje por distancia, en el orden de la ruta y en el tiempo estimado al cliente.',
    ejemplo: 'Con 25 km/h, 5 km de recorrido se estiman en 12 minutos.',
    efecto: 'Subirla acorta los tiempos estimados; bajarla los alarga.',
    porDefecto: '25', unidad: 'km/h', rango: '5 a 100', palabras: ['velocidad', 'moto', 'km por hora', 'ruta', 'tiempo de viaje', 'repartidor'], peligro: 'medio',
  },
  rep_max_pedidos: {
    grupo: 'colores', titulo: 'Máximo de pedidos por repartidor',
    descripcion: 'Cuántos pedidos puede llevar a la vez un repartidor. Con el tope lleno no puede tomar otro hasta entregar alguno. Es el mismo ajuste que «Máximo de pedidos (reparto)»: la pestaña Reparto guarda los dos juntos.',
    ejemplo: 'Con 5: el repartidor con 5 pedidos activos ve el mensaje «entrega alguno antes de tomar otro».',
    efecto: 'Subirlo acelera el reparto pero enfría los pedidos de la ruta; bajarlo los reparte entre más motos.',
    porDefecto: '5', unidad: 'pedidos', rango: '1 a 20', palabras: ['repartidor', 'capacidad', 'pedidos por moto', 'maximo de pedidos', 'ruta'], peligro: 'medio',
    nota: 'Duplicado de reparto_max_pedidos: la API no deja guardarlo suelto aquí; se cambia en la pestaña Reparto.',
  },
  reparto_max_pedidos: {
    grupo: 'colores', titulo: 'Máximo de pedidos por repartidor (reparto)',
    descripcion: 'Mismo tope de pedidos simultáneos por repartidor, guardado junto con el anterior desde la pestaña Reparto.',
    ejemplo: 'Con 3: ningún repartidor puede tener más de 3 pedidos activos.',
    efecto: 'Ver «Máximo de pedidos por repartidor».',
    porDefecto: '5', unidad: 'pedidos', rango: '1 a 20', palabras: ['repartidor', 'capacidad', 'pedidos por moto', 'reparto'], peligro: 'medio',
  },
  pausa_alta_demanda: {
    grupo: 'demanda', titulo: 'Pausa de pedidos por alta demanda',
    descripcion: 'Estado de la pausa: con ella activa la carta aparece cerrada y el chatbot no toma pedidos nuevos. Solo se lee aquí; se activa en la pestaña Alta demanda.',
    ejemplo: 'Pausa activa: el cliente ve «Por ahora no estamos recibiendo pedidos».',
    efecto: 'No se edita aquí. Para cambiarla usa la pestaña Alta demanda.',
    rango: 'Activa o Desactivada', palabras: ['pausa', 'pausar pedidos', 'carta cerrada', 'saturado', 'alta demanda'], peligro: 'alto',
  },
  alta_demanda_min_base: {
    grupo: 'demanda', titulo: 'Minutos base por alta demanda',
    descripcion: 'Aparece como parámetro pero ninguna pantalla ni regla lo lee. Los minutos extra se eligen al activar la alta demanda, en su pestaña.',
    ejemplo: 'Si pones 20 aquí, la alta demanda no cambia.',
    efecto: 'Ningún efecto actual.',
    unidad: 'minutos', palabras: ['alta demanda', 'minutos extra', 'congestion'],
    nota: 'No tiene efecto actualmente.',
  },
  reparto_insistencia_min: {
    grupo: 'puerta', titulo: 'Minutos en la puerta antes del aviso de insistencia',
    descripcion: 'Minutos que espera el repartidor en la puerta antes de que el cliente reciba el aviso 3 («estoy afuera»). También es el tiempo de gracia extra tras la espera máxima antes de retirar la moto.',
    ejemplo: 'Con 3: a los 3 minutos de llegar el cliente recibe el aviso; con espera máxima 10, la moto se retira a los 13.',
    efecto: 'Bajarlo apura al cliente antes. Solo envía el aviso si «Aviso: repartidor en la puerta» está en Sí.',
    porDefecto: '3', unidad: 'minutos', rango: '0 o más', palabras: ['insistencia', 'en la puerta', 'cliente no sale', 'aviso 3', 'llegue'], peligro: 'medio',
  },
  reparto_espera_max_min: {
    grupo: 'puerta', titulo: 'Espera máxima en la puerta',
    descripcion: 'Minutos que espera el repartidor en la puerta antes de avisar al cliente que se retirará y ofrecer reprogramar. La moto se retira esa espera más los minutos de insistencia.',
    ejemplo: 'Con 10 y insistencia 3: aviso de espera agotada a los 10 minutos y retiro a los 13; el pedido vuelve a Listo con recargo.',
    efecto: 'Subirlo da más tiempo al cliente pero retiene al repartidor. Requiere «Aviso: espera agotada» en Sí.',
    porDefecto: '10', unidad: 'minutos', rango: 'mayor que 0', palabras: ['espera maxima', 'cliente no recibe', 'entrega fallida', 'retirar moto', 'puerta', 'reprogramar'], peligro: 'alto',
  },
  reprog_recargo_modo: {
    grupo: 'puerta', titulo: 'Costo de volver a enviar un pedido',
    descripcion: 'Cuánto paga el cliente por reenviar un pedido tras una entrega fallida: igual al envío, un monto fijo o sin costo. Se le dice antes de que responda SÍ o NO y se cobra al reenviar.',
    ejemplo: '«Igual al envío» con envío de S/ 6: reenviar cuesta S/ 6 más. «Monto fijo» cobra siempre el monto fijo.',
    efecto: 'Cambia lo que se cobra en las reprogramaciones nuevas; las ya preguntadas conservan el monto que vio el cliente.',
    porDefecto: 'Igual al envío', rango: 'Igual al envío, Monto fijo o Sin costo', palabras: ['reprogramar', 'recargo', 'reenvio', 'volver a enviar', 'entrega fallida', 'cobrar'], peligro: 'alto',
  },
  reparto_recargo_reprogramacion: {
    grupo: 'puerta', titulo: 'Monto fijo por reprogramar',
    descripcion: 'Monto que se cobra al reenviar un pedido cuando el costo de reprogramar está en «Monto fijo». Con los otros modos no se usa.',
    ejemplo: 'Con S/ 5 en modo fijo: todo reenvío cobra S/ 5, sin importar el pedido.',
    efecto: 'Solo cambia el cobro si el modo es «Monto fijo».',
    porDefecto: '0', unidad: 'soles (S/)', rango: '0 o más', palabras: ['recargo', 'monto fijo', 'reprogramar', 'reenvio', 'cobro'], peligro: 'alto',
  },
  reprog_respuesta_min: {
    grupo: 'puerta', titulo: 'Tiempo del cliente para responder si reprograma',
    descripcion: 'Minutos que tiene el cliente para contestar SÍ o NO a reprogramar tras el retiro del repartidor. Si no responde, el pedido se cancela por falta de respuesta.',
    ejemplo: 'Con 30: si a los 30 minutos no contestó, el pedido se cancela.',
    efecto: 'Bajarlo cancela antes los pedidos sin respuesta y libera el stock; subirlo da más margen.',
    porDefecto: '30', unidad: 'minutos', rango: '0 o más', palabras: ['responder', 'reprogramar', 'cancelar por falta de respuesta', 'si o no', 'cliente no contesta'], peligro: 'alto',
  },
  reprog_max_intentos: {
    grupo: 'puerta', titulo: 'Reprogramaciones máximas por pedido',
    descripcion: 'Cuántas veces se puede reprogramar el mismo pedido tras una espera agotada. Al llegar al tope ya no se pregunta y el pedido se cancela.',
    ejemplo: 'Con 1: la segunda entrega fallida cancela el pedido directo.',
    efecto: 'Subirlo da más oportunidades al cliente; bajarlo corta antes las entregas problemáticas.',
    porDefecto: '1', unidad: 'veces', rango: '0 o más', palabras: ['reprogramar', 'intentos', 'tope', 'entrega fallida', 'cancelar pedido'], peligro: 'alto',
  },
  encuesta_espera_min: {
    grupo: 'encuesta', titulo: 'Espera antes de enviar la encuesta',
    descripcion: 'Minutos después de la entrega (o del cobro en mesa) para enviar la encuesta de satisfacción por WhatsApp. Solo actúa si el aviso de encuesta está en Sí.',
    ejemplo: 'Con 30: un pedido entregado a las 8:00 recibe la encuesta a las 8:30.',
    efecto: 'Subirlo retrasa la encuesta; los pedidos sin teléfono real o sin consentimiento de WhatsApp no la reciben.',
    porDefecto: '30', unidad: 'minutos', rango: '0 o más', palabras: ['encuesta', 'posventa', 'calificacion', 'satisfaccion', 'opinion'], peligro: 'bajo',
  },
  encuesta_puntaje_queja: {
    grupo: 'encuesta', titulo: 'Calificación que cuenta como queja',
    descripcion: 'Una calificación igual o menor a este número se trata como queja: genera una alerta de «calificación baja» con enlace al chat del cliente.',
    ejemplo: 'Con 2: calificaciones de 1 y 2 estrellas disparan la alerta; 3 no.',
    efecto: 'Subirlo genera más alertas al equipo; bajarlo deja pasar calificaciones medias.',
    porDefecto: '2', unidad: 'puntos de 1 a 5', rango: '1 a 5', palabras: ['queja', 'calificacion baja', 'estrellas', 'encuesta', 'reclamo', 'insatisfecho'], peligro: 'medio',
  },
  encuesta_ventana_dias: {
    grupo: 'encuesta', titulo: 'Días que vale la respuesta de la encuesta',
    descripcion: 'Una calificación escrita por el cliente solo se acepta si la encuesta se le envió dentro de estos días.',
    ejemplo: 'Con 7: un «5» escrito a los 10 días ya no cuenta como respuesta de la encuesta.',
    efecto: 'Subirlo acepta respuestas más tardías; pasado el plazo el mensaje se trata como un mensaje normal del chat.',
    porDefecto: '7', unidad: 'días', rango: '0 o más', palabras: ['encuesta', 'plazo', 'dias', 'respuesta tardia'], peligro: 'bajo',
  },
  chatbot_activo: {
    grupo: 'avisos', titulo: 'Chatbot de WhatsApp encendido',
    descripcion: 'Interruptor general del chatbot: en «No» el bot deja de contestar mensajes de clientes. Si el parámetro no existe, queda apagado.',
    ejemplo: 'En «No», un cliente que escribe «hola» no recibe respuesta automática.',
    efecto: 'Apagarlo deja a los clientes sin atención automática; solo responde el equipo desde Mensajes.',
    porDefecto: 'No (apagado si no existe)', rango: SI_NO, palabras: ['chatbot', 'bot', 'whatsapp', 'apagar bot', 'encender bot', 'atencion automatica', 'interruptor general'], peligro: 'alto',
  },
  whatsapp_aviso_recibido_activo: {
    grupo: 'avisos', titulo: 'Aviso: pedido recibido desde la carta',
    ...aviso('Con Yape, Plin o transferencia, también avisa que un asesor gestiona el voucher por ese chat y lo recuerda si falta.', 'al enviar un pedido desde la carta virtual', 'En «Sí», quien pide por la carta recibe «Recibimos tu pedido».', ['pedido recibido', 'carta', 'confirmacion de pedido', 'voucher']),
  },
  whatsapp_aviso_voucher_recordatorio_activo: {
    grupo: 'avisos', titulo: 'Aviso: recordatorio del voucher',
    ...aviso('Si el pago digital de un pedido de la carta sigue sin voucher a los pocos minutos, se le recuerda por WhatsApp. Es independiente del aviso de pedido recibido.', 'si no envía el voucher de su pago digital', 'En «Sí», a los 3 minutos sin voucher el cliente recibe el recordatorio.', ['voucher', 'recordatorio', 'comprobante', 'yape', 'plin']),
  },
  whatsapp_plantilla_recibido_seguimiento_activa: {
    grupo: 'avisos', titulo: 'Usar la plantilla de pedido recibido con enlace',
    descripcion: 'Cuando el cliente no está en la ventana de 24 h, el aviso de pedido recibido en efectivo usa la plantilla con el enlace de seguimiento. Dejarlo en «No» usa la plantilla anterior, sin enlace. Ponerlo en «Sí» solo después de que Meta apruebe la plantilla «caprichos_pedido_recibido_seguimiento».',
    ejemplo: 'Con «No», un pedido en efectivo fuera de la ventana de 24 h recibe el mensaje de siempre.',
    efecto: 'Con la ventana abierta el enlace siempre sale en el texto. Este interruptor solo cambia el envío fuera de la ventana de 24 h.',
    porDefecto: 'No', rango: SI_NO, palabras: ['plantilla', 'enlace', 'seguimiento', 'pedido recibido', 'meta'], peligro: 'medio',
  },
  whatsapp_plantilla_delivery_ubicacion_activa: {
    grupo: 'avisos', titulo: 'Plantilla de delivery con ubicación',
    descripcion: 'Cuando alguien pide por la web con delivery, aún no tiene ubicación y no está en la ventana de 24 h, el aviso de pedido recibido usa la plantilla que también le pide su ubicación. Actívalo cuando Meta apruebe las plantillas caprichos_pedido_delivery_ubicacion_*. En «No» sale la plantilla anterior, sin pedir la ubicación.',
    ejemplo: 'Con «Sí», un cliente nuevo que pide delivery recibe «Envíanos tu ubicación: toca el clip».',
    efecto: 'Con la ventana abierta el texto libre ya pide la ubicación. Si Meta rechaza la plantilla, se envía la anterior una sola vez.',
    porDefecto: 'No', rango: SI_NO, palabras: ['plantilla', 'ubicación', 'delivery', 'pedido recibido', 'meta', 'clip'], peligro: 'medio',
  },
  whatsapp_aviso_bienvenida_puntos_activo: {
    grupo: 'avisos', titulo: 'Aviso: bienvenida a los puntos (primer pedido)',
    ...aviso('Solo la primera vez que un celular hace un pedido de la carta, el aviso de «pedido recibido» agrega que ya suma puntos y el enlace para verlos. Requiere la plantilla de Meta aprobada (ver docs/operacion/puntos-y-avisos-carta.md).', 'en el primer pedido de la carta de cada celular', 'En «Sí», ese primer aviso trae la línea de puntos y el enlace a la carta.', ['bienvenida', 'puntos', 'primer pedido', 'celular']),
  },
  whatsapp_aviso_puntos_ganados_activo: {
    grupo: 'avisos', titulo: 'Aviso: puntos ganados al entregar',
    ...aviso('Cuando un pedido que ya sumó puntos se entrega, el aviso de «entregado» dice cuántos puntos ganó y el total. Requiere la plantilla de Meta aprobada.', 'al entregar un pedido que sumó puntos', 'En «Sí», el aviso de entregado trae «Ganaste N puntos. Total: M».', ['puntos', 'ganaste', 'entregado', 'total']),
  },
  whatsapp_aviso_cuenta_activo: {
    grupo: 'avisos', titulo: 'Aviso: seguridad de la cuenta',
    ...aviso('Avisa por WhatsApp cuando se crea una cuenta de cliente o cambia su contraseña, con la indicación de escribir si no fue la persona. Requiere la plantilla de Meta aprobada.', 'al crear la cuenta o cambiar la contraseña', 'En «Sí», el cliente recibe el aviso de seguridad.', ['cuenta', 'contrasena', 'seguridad', 'clave']),
  },
  whatsapp_aviso_pago_confirmado_activo: {
    grupo: 'avisos', titulo: 'Aviso: pago confirmado',
    ...aviso('Se envía cuando Caja aprueba el comprobante y el pedido pasa a preparación.', 'cuando Caja confirma su pago', 'En «Sí», tras aprobar el voucher el cliente recibe «Pago confirmado».', ['pago confirmado', 'voucher aprobado', 'caja', 'comprobante']),
  },
  whatsapp_aviso_listo_activo: {
    grupo: 'avisos', titulo: 'Aviso: pedido de delivery listo',
    ...aviso('Se envía cuando cocina termina el pedido y queda listo para salir con el repartidor.', 'cuando su pedido de delivery está listo en cocina', 'En «Sí», el cliente sabe que su pedido ya salió de cocina.', ['pedido listo', 'delivery', 'cocina termino']),
  },
  whatsapp_aviso_recojo_activo: {
    grupo: 'avisos', titulo: 'Aviso: pedido para recoger listo',
    ...aviso('Aplica a pedidos para llevar o recojo que pasan a Listo.', 'cuando su pedido para llevar o recojo está listo', 'En «Sí», el cliente de recojo recibe «Tu pedido está listo» y va a la barra.', ['recojo', 'para llevar', 'listo para recoger', 'barra']),
  },
  whatsapp_aviso_asignado_activo: {
    grupo: 'avisos', titulo: 'Aviso: delivery asignado',
    ...aviso('Dice el nombre de pila del repartidor. También sale si Caja cambia el repartidor. Viene en «Sí».', 'cuando un repartidor toma su pedido', 'En «Sí», al tomar el pedido el cliente recibe «Ya asignamos a tu delivery Luis».', ['delivery asignado', 'repartidor tomo', 'reasignado', 'asignamos']),
  },
  whatsapp_aviso_salida_activo: {
    grupo: 'avisos', titulo: 'Aviso: repartidor en camino',
    ...aviso('Incluye el tiempo estimado de llegada.', 'cuando el repartidor sale con su pedido (En camino)', 'En «Sí», al pulsar «En camino» el cliente recibe el mensaje con el tiempo estimado.', ['en camino', 'sale el repartidor', 'tiempo estimado', 'delivery']),
  },
  whatsapp_aviso_llegada_activo: {
    grupo: 'avisos', titulo: 'Aviso: repartidor en la puerta',
    ...aviso('También habilita el aviso de insistencia a los minutos configurados.', 'cuando el repartidor llega a su dirección', 'En «Sí», al pulsar «He llegado» el cliente recibe el aviso y luego la insistencia.', ['he llegado', 'repartidor en la puerta', 'llego', 'insistencia']),
  },
  whatsapp_aviso_espera_activo: {
    grupo: 'avisos', titulo: 'Aviso: espera agotada y reprogramación',
    ...aviso('Cubre la espera agotada, el retiro del repartidor, los botones de reprogramar y los avisos de reenvío, cancelación y falta de respuesta. Sin él no se retira la moto ni se pregunta si reprograma.', 'cuando se agota la espera en la puerta', 'En «Sí», tras la espera máxima el cliente puede elegir reprogramar con los botones.', ['espera agotada', 'reprogramar', 'retiro', 'entrega fallida', 'no recibe']),
  },
  whatsapp_aviso_entregado_activo: {
    grupo: 'avisos', titulo: 'Aviso: pedido entregado',
    ...aviso('Es un agradecimiento breve.', 'cuando su pedido de delivery queda entregado', 'En «Sí», al marcar Entregado el cliente recibe un agradecimiento.', ['entregado', 'gracias', 'agradecimiento']),
  },
  whatsapp_aviso_encuesta_activo: {
    grupo: 'avisos', titulo: 'Aviso: encuesta de satisfacción',
    ...aviso('Pide una calificación del 1 al 5 con botones.', 'unos minutos después de recibir su pedido', 'En «Sí», 30 minutos tras la entrega el cliente recibe la encuesta.', ['encuesta', 'calificacion', 'posventa', 'satisfaccion', 'estrellas']),
    descripcion: 'Encendido: se envía una encuesta de satisfacción por plantilla a todo pedido con teléfono, 30 min después de entregado (según «Espera antes de enviar la encuesta»). Pide una calificación del 1 al 5 con 3 botones: 1 Malo, 3 Regular y 5 Excelente.',
    efecto: 'En «No» no se envía ninguna encuesta. Requiere que la plantilla caprichos_encuesta_posventa esté aprobada en Meta.',
  },
  chatbot_pago_recordatorio_activo: {
    grupo: 'pago', titulo: 'Recordatorio de comprobante de pago pendiente',
    descripcion: 'Envía un recordatorio amable al cliente que eligió pago digital y no ha mandado la captura del pago.',
    ejemplo: 'En «Sí», a los 10 minutos sin voucher el cliente recibe el recordatorio. Viene en «No».',
    efecto: 'En «No» el cliente no recibe recordatorios; Caja puede quedar con pedidos sin voucher sin que nadie lo empuje.',
    porDefecto: 'No', rango: SI_NO, palabras: ['recordatorio', 'voucher', 'comprobante', 'captura de pago', 'yape', 'plin', 'pago pendiente'], peligro: 'medio',
  },
  chatbot_pago_recordatorio_min: {
    grupo: 'pago', titulo: 'Minutos para el recordatorio de pago digital',
    descripcion: 'Minutos de espera antes de recordarle al cliente que mande la captura de su pago.',
    ejemplo: 'Con 10: el recordatorio sale a los 10 minutos de pedir sin enviar voucher.',
    efecto: 'Bajarlo insiste antes; subirlo es menos molesto. Con 0 o vacío usa 10.',
    porDefecto: '10', unidad: 'minutos', rango: 'mayor que 0', palabras: ['recordatorio', 'voucher', 'minutos', 'pago digital'], peligro: 'bajo',
  },
  chatbot_pago_expira_min: {
    grupo: 'pago', titulo: 'Minutos para alertar a Caja de un pago por vencer',
    descripcion: 'Si el cliente sigue sin enviar su pago pasado este tiempo, se alerta a la consola de Caja para que decida si contactarlo o anular el pedido. Con 0 se apaga esta alerta.',
    ejemplo: 'Con 30: a los 30 minutos sin voucher Caja recibe la alerta.',
    efecto: 'Bajarlo avisa antes a Caja; con 0 nadie recibe el aviso y los pedidos sin pago pueden quedar olvidados.',
    porDefecto: '30', unidad: 'minutos', rango: '0 (apagado) o más', palabras: ['pago por expirar', 'caja', 'anular pedido', 'voucher', 'alerta de pago'], peligro: 'medio',
  },
  chatbot_ia_activo: {
    grupo: 'ia', titulo: 'IA del chatbot para resolver dudas',
    descripcion: 'Permite que la IA (OpenAI) responda en WhatsApp dudas sobre la carta, promociones y horarios, en solo lectura. Además necesita la clave de OpenAI configurada, Redis disponible y no haber llegado al tope mensual.',
    ejemplo: 'En «Sí», un cliente que pregunta «¿qué postres tienen?» recibe respuesta de la IA.',
    efecto: 'En «No» el bot usa solo respuestas fijas y botones. Activarla genera gasto en dólares.',
    porDefecto: 'No', rango: SI_NO, palabras: ['ia', 'inteligencia artificial', 'openai', 'chatgpt', 'dudas', 'bot inteligente', 'gasto'], peligro: 'alto',
  },
  chatbot_modo_libre: {
    grupo: 'ia', titulo: 'Conversación libre con la IA',
    descripcion: 'Con la IA encendida, Capri conversa con más libertad: consulta la carta, el estado del pedido, promociones, horarios y datos de pago, y guía al cliente a pedir. Lo delicado (reclamos, devoluciones, descuentos, anulaciones, pagos dudosos) siempre pasa a una persona.',
    ejemplo: 'En «Sí», un cliente pregunta «¿qué me recomiendas para compartir?» y la IA sugiere con precios reales; si dice «quiero reclamar», pasa a una persona.',
    efecto: 'En «No» la IA solo responde dudas puntuales con respuestas cortas. Solo funciona si la IA del chatbot está en «Sí».',
    porDefecto: 'Sí', rango: SI_NO, palabras: ['ia', 'conversacion libre', 'bot', 'capri', 'modo libre', 'inteligencia artificial'], peligro: 'medio',
  },
  chatbot_ia_tope_mensual_usd: {
    grupo: 'ia', titulo: 'Tope mensual de gasto en IA',
    descripcion: 'Límite en dólares por mes calendario para el consumo de la IA. Al alcanzarlo la IA se apaga sola y se alerta a Caja.',
    ejemplo: 'Con 100: al llegar a USD 100 en el mes la IA deja de contestar hasta el mes siguiente.',
    efecto: 'Subirlo permite más gasto; bajarlo corta antes la IA. Un valor de 0 o inválido usa 100.',
    porDefecto: '100', unidad: 'dólares (USD)', rango: '1 a 500', palabras: ['tope', 'limite de gasto', 'dolares', 'presupuesto', 'ia', 'openai', 'costo'], peligro: 'alto',
  },
  chatbot_ia_max_por_hora_telefono: {
    grupo: 'ia', titulo: 'Consultas a la IA por hora y por teléfono',
    descripcion: 'Máximo de preguntas a la IA que un mismo teléfono puede hacer en una hora. Evita abusos y gasto de más.',
    ejemplo: 'Con 50: la consulta 51 de la misma hora ya no la contesta la IA.',
    efecto: 'Subirlo permite conversaciones más largas con la IA y más gasto; un valor de 0 o inválido usa 50.',
    porDefecto: '50', unidad: 'consultas por hora', rango: 'mayor que 0', palabras: ['limite por telefono', 'anti abuso', 'consultas', 'ia', 'por hora'], peligro: 'medio',
  },
  ayuda_ia_activo: {
    grupo: 'ia', titulo: 'Asistente de ayuda con IA (Capri)',
    descripcion: 'Habilita al asistente Capri, que orienta a los usuarios del panel de administración con IA. También depende de la clave de OpenAI y del tope mensual.',
    ejemplo: 'En «Sí», el asistente de ayuda del panel responde con IA.',
    efecto: 'En «No» el asistente no usa IA. Activarlo genera gasto en dólares.',
    porDefecto: 'No', rango: SI_NO, palabras: ['capri', 'asistente', 'ayuda', 'ia', 'panel', 'soporte'], peligro: 'medio',
    nota: 'También se activa en la pestaña Ayuda.',
  },
  alerta_voucher_min_1: {
    grupo: 'alertas', titulo: 'Primer aviso de voucher sin revisar',
    descripcion: 'Minutos después de recibir una captura de pago para avisar por primera vez a los administradores que nadie la revisó.',
    ejemplo: 'Con 5: a los 5 minutos de llegar el voucher sin revisión suena el primer aviso.',
    efecto: 'Bajarlo apura a Caja. Mantenlo menor que el segundo aviso.',
    porDefecto: '5', unidad: 'minutos', rango: '1 a 180', palabras: ['voucher', 'sin revisar', 'aviso', 'caja', 'administradores', 'comprobante'], peligro: 'medio',
  },
  alerta_voucher_min_2: {
    grupo: 'alertas', titulo: 'Segundo aviso de voucher (urgente)',
    descripcion: 'Minutos para el segundo aviso a los administradores y para marcar el chat como urgente.',
    ejemplo: 'Con 15: a los 15 minutos el chat del voucher pasa a urgente.',
    efecto: 'Bajarlo vuelve urgentes más chats. Mantenlo mayor que el primer aviso.',
    porDefecto: '15', unidad: 'minutos', rango: '1 a 180', palabras: ['voucher', 'urgente', 'segundo aviso', 'sin revisar', 'caja'], peligro: 'medio',
  },
  espera_cliente_aviso_min: {
    grupo: 'alertas', titulo: 'Aviso de espera al cliente por validación de pago',
    descripcion: 'Minutos tras los cuales el cliente recibe un mensaje de tranquilidad («seguimos validando tu pago») si su voucher aún no se revisa.',
    ejemplo: 'Con 10: a los 10 minutos de esperar, el cliente recibe el mensaje.',
    efecto: 'Bajarlo tranquiliza antes al cliente; subirlo evita mensajes si Caja suele responder rápido.',
    porDefecto: '10', unidad: 'minutos', rango: '1 a 180', palabras: ['espera', 'tranquilidad', 'validando pago', 'voucher', 'cliente esperando'], peligro: 'bajo',
  },
  chat_tomado_liberar_min: {
    grupo: 'alertas', titulo: 'Liberar un chat tomado y abandonado',
    descripcion: 'Minutos de silencio de la persona que tomó un chat antes de devolverlo al bot (no aplica a los chats de validar pago).',
    ejemplo: 'Con 10: si el asesor no escribe en 10 minutos, el chat vuelve al bot.',
    efecto: 'Subirlo deja el chat más tiempo bloqueado para el bot; bajarlo lo libera rápido y el bot puede interrumpir a una persona.',
    porDefecto: '10', unidad: 'minutos', rango: '1 a 180', palabras: ['chat tomado', 'liberar chat', 'asesor', 'abandonado', 'devolver al bot', 'mensajes'], peligro: 'medio',
  },
  alerta_pedido_sin_confirmar_min: {
    grupo: 'alertas', titulo: 'Aviso de pedido nuevo sin confirmar en Caja',
    descripcion: 'Minutos que puede esperar un pedido nuevo sin que Caja lo confirme antes de avisar a los administradores por WhatsApp.',
    ejemplo: 'Con 5: un pedido sin confirmar a los 5 minutos dispara el aviso.',
    efecto: 'Bajarlo da más avisos; subirlo permite pedidos olvidados más tiempo.',
    porDefecto: '5', unidad: 'minutos', rango: '1 a 180', palabras: ['pedido sin confirmar', 'caja', 'estancado', 'alerta', 'administradores'], peligro: 'medio',
  },
  asistido_espera_min: {
    grupo: 'alertas', titulo: 'Silencio del bot tras escribir una persona (modo asistido)',
    descripcion: 'Si una persona escribió al cliente hace menos de estos minutos, el bot se queda callado para no pisarla. Pasado ese tiempo, el bot vuelve a ayudar al cliente. Los botones directos del cliente (menú, carta, pedir) siempre se atienden.',
    ejemplo: 'Con 3: el asesor escribe a las 8:00; hasta las 8:03 el bot no interviene.',
    efecto: 'Subirlo da más tiempo al asesor; bajarlo hace que el bot retome antes.',
    porDefecto: '3', unidad: 'minutos', rango: '1 a 180', palabras: ['modo asistido', 'bot callado', 'asesor', 'persona escribio', 'silencio del bot'], peligro: 'medio',
  },
  impresion_alerta_min: {
    grupo: 'impresion', titulo: 'Aviso por WhatsApp de etiquetas sin imprimir',
    descripcion: 'Minutos con etiquetas en cola sin que la impresora de Caja las tome (PC apagada, sin sesión o sin conexión) antes de avisar a los administradores. Avisa una vez por tanda.',
    ejemplo: 'Con 5: si hay una etiqueta esperando 5 minutos, los administradores reciben el aviso.',
    efecto: 'Bajarlo avisa antes, pero puede avisar por cortes breves de la impresora.',
    porDefecto: '5', unidad: 'minutos', rango: 'mayor que 0', palabras: ['etiquetas', 'impresora', 'sin imprimir', 'cola de impresion', 'caja', 'aviso'], peligro: 'medio',
  },
  impresion_vence_min: {
    grupo: 'impresion', titulo: 'Vencimiento de etiquetas no impresas',
    descripcion: 'Minutos en cola a partir de los cuales una etiqueta automática ya no se imprime sola al reconectar la impresora: queda VENCIDA y se reimprime a mano. Los pedidos anulados también vencen. Una reimpresión manual sale igual.',
    ejemplo: 'Con 180: al reconectar tras 4 horas, las etiquetas viejas no salen solas.',
    efecto: 'Subirlo imprime etiquetas atrasadas al reconectar; bajarlo evita imprimir pedidos que ya salieron.',
    porDefecto: '180', unidad: 'minutos', rango: 'mayor que 0', palabras: ['etiquetas vencidas', 'impresora', 'reconectar', 'cola', 'reimprimir', 'imprimir solas'], peligro: 'medio',
  },
  impresion_etiqueta_bebida_ancho_mm: {
    grupo: 'impresion', titulo: 'Sticker de bebida: ancho',
    descripcion: 'Medida en milímetros del ancho del sticker que sale por cada vaso, tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200.',
    ejemplo: 'Con 76: es el 76 de «76 x 38».',
    efecto: 'Cambiarlo afecta a los stickers que se impriman desde que guardas, también a los que ya esperan en cola. Si la medida no coincide con el rollo, la etiqueta sale cortada o con espacio de sobra.',
    porDefecto: '76', unidad: 'milímetros', rango: 'entero de 30 a 200', palabras: ['etiqueta', 'sticker', 'tamano', 'medida', 'milimetros', 'etiquetera', 'rollo', 'bebida', 'general', 'ancho', 'alto'], peligro: 'medio',
  },
  impresion_etiqueta_bebida_alto_mm: {
    grupo: 'impresion', titulo: 'Sticker de bebida: alto',
    descripcion: 'Medida en milímetros del alto del sticker que sale por cada vaso, tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200.',
    ejemplo: 'Con 38: es el 38 de «76 x 38».',
    efecto: 'Cambiarlo afecta a los stickers que se impriman desde que guardas, también a los que ya esperan en cola. Si la medida no coincide con el rollo, la etiqueta sale cortada o con espacio de sobra.',
    porDefecto: '38', unidad: 'milímetros', rango: 'entero de 30 a 200', palabras: ['etiqueta', 'sticker', 'tamano', 'medida', 'milimetros', 'etiquetera', 'rollo', 'bebida', 'general', 'ancho', 'alto'], peligro: 'medio',
  },
  impresion_etiqueta_general_ancho_mm: {
    grupo: 'impresion', titulo: 'Sticker general: ancho',
    descripcion: 'Medida en milímetros del ancho del sticker general del pedido (bolsa o bandeja, solo para llevar, recoger y delivery), tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200.',
    ejemplo: 'Con 100: es el primer 100 de «100 x 100».',
    efecto: 'Cambiarlo afecta a los stickers que se impriman desde que guardas, también a los que ya esperan en cola. Si la medida no coincide con el rollo, la etiqueta sale cortada o con espacio de sobra.',
    porDefecto: '100', unidad: 'milímetros', rango: 'entero de 30 a 200', palabras: ['etiqueta', 'sticker', 'tamano', 'medida', 'milimetros', 'etiquetera', 'rollo', 'bebida', 'general', 'ancho', 'alto'], peligro: 'medio',
  },
  impresion_etiqueta_general_alto_mm: {
    grupo: 'impresion', titulo: 'Sticker general: alto',
    descripcion: 'Medida en milímetros del alto del sticker general del pedido (bolsa o bandeja, solo para llevar, recoger y delivery), tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200.',
    ejemplo: 'Con 100: es el segundo 100 de «100 x 100».',
    efecto: 'Cambiarlo afecta a los stickers que se impriman desde que guardas, también a los que ya esperan en cola. Si la medida no coincide con el rollo, la etiqueta sale cortada o con espacio de sobra.',
    porDefecto: '100', unidad: 'milímetros', rango: 'entero de 30 a 200', palabras: ['etiqueta', 'sticker', 'tamano', 'medida', 'milimetros', 'etiquetera', 'rollo', 'bebida', 'general', 'ancho', 'alto'], peligro: 'medio',
  },
};

export const kebabParametro = (clave: string) => clave.replace(/_/g, '-');
export const idParametro = (clave: string) => `parametros-${kebabParametro(clave)}`;

/** Claves editables en la tarjeta «Umbrales de alertas y espera» (el id lo lleva la tarjeta, no la fila). */
export const CLAVES_EN_TARJETA_UMBRALES = [
  'alerta_voucher_min_1', 'alerta_voucher_min_2', 'espera_cliente_aviso_min',
  'chat_tomado_liberar_min', 'alerta_pedido_sin_confirmar_min', 'asistido_espera_min',
];

const titulosGrupo = new Map(GRUPOS_PARAMETROS.map((g) => [g.id, g.titulo]));

export const PARAMETROS: EntradaConfig[] = [
  {
    id: 'parametros-estado-whatsapp', tab: 'parametros', seccion: 'Estado de conexiones', titulo: 'Estado de la conexión de WhatsApp',
    descripcion: 'Indica si el bot está conectado a Meta y envía mensajes reales, o en modo simulado donde no sale ningún mensaje a los clientes. Solo informa; no se cambia aquí.',
    ejemplo: 'En «Simulado» los avisos se guardan pero ningún cliente los recibe.',
    palabras: ['whatsapp', 'meta', 'simulado', 'conectado', 'bot', 'conexion', 'no llegan mensajes'], peligro: 'alto',
  },
  {
    id: 'parametros-consumo-ia', tab: 'parametros', seccion: 'Estado de conexiones', titulo: 'Consumo de la IA este mes',
    descripcion: 'Muestra cuántas consultas, tokens y dólares gastó la IA en el mes frente al tope. Solo informa; el tope se cambia en «Tope mensual de gasto en IA».',
    ejemplo: 'USD 4.20 de USD 20 (21 % consumido).',
    palabras: ['consumo ia', 'gasto de ia', 'tokens', 'dolares', 'openai', 'cuanto llevo gastado'], peligro: 'bajo',
  },
  ...Object.entries(AYUDA_PARAMETROS).map(([clave, a]): EntradaConfig => ({
    id: idParametro(clave),
    tab: 'parametros',
    seccion: titulosGrupo.get(a.grupo) ?? 'Parámetros de operación',
    titulo: a.titulo,
    descripcion: a.descripcion,
    ejemplo: a.ejemplo,
    clave,
    palabras: [...a.palabras, clave.replace(/_/g, ' ')],
    peligro: a.peligro,
  })),
];
