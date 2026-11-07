import { causaPlantillaMeta, causaPorCodigoPlantilla } from '../../chatbot/utilidades/meta-errores.util';

/**
 * Mapeo de códigos de error de WhatsApp / Meta a mensajes en español accesibles y claros.
 * Regla: sin exponer detalles técnicos, contraseñas, tokens ni teléfonos completos. El detalle técnico
 * (código de Meta y texto original) se muestra aparte y solo a ADMIN.
 */
/** Códigos de Meta (numéricos) que la pantalla explica en español, con qué hacer. */
const MENSAJES_META: Record<string, string> = {
  '131049': 'Meta no entregó el mensaje para cuidar la calidad de la cuenta (el cliente recibió muchos mensajes de empresas). Reintentar más tarde o pedir que escriba primero.',
  '131056': 'Se enviaron demasiados mensajes al mismo número en poco tiempo. Se reintenta solo.',
  '131000': 'Meta tuvo un fallo pasajero. Se reintenta solo.',
  '131016': 'El servicio de Meta no estaba disponible. Se reintenta solo.',
  '131021': 'El destinatario es el mismo número del negocio.',
  '131031': 'La cuenta de WhatsApp Business está bloqueada o restringida por Meta. Hay que revisarla en Meta.',
  '131051': 'El tipo de mensaje no es compatible con WhatsApp.',
  '131052': 'Meta no pudo descargar la imagen o archivo del mensaje.',
  '131053': 'Meta no pudo cargar la imagen o archivo del mensaje.',
  '133010': 'El número de WhatsApp del negocio no está registrado en Meta. Hay que revisarlo en Meta.',
  '368': 'Meta bloqueó temporalmente la cuenta por incumplir sus políticas. Hay que revisarla en Meta.',
};

/** Meta cuenta las 24 h por numero de la cuenta: el cliente pudo escribirle a otro numero. */
export const TEXTO_VENTANA_24H =
  'El cliente no le ha escrito a este numero en las ultimas 24 horas: si escribio a otro numero de la cuenta, el bot responde desde ese. Usa «Reabrir con plantilla»';

/** Errores de ventana de 24 h: reintentar el mismo texto no sirve, hay que reabrir con plantilla. */
export const esErrorVentana24h = (codigo?: string | null, detalle?: string | null): boolean =>
  codigo === 'VENTANA_CERRADA' ||
  codigo === 'FUERA_DE_VENTANA_24H' ||
  /131047|24 hours|24-hour/i.test(detalle ?? '');

export function mapearErrorWhatsApp(codigo?: string | null, detalle?: string | null): string {
  const c = String(codigo || '').toUpperCase();
  const d = String(detalle || '').toLowerCase();

  // Parámetro inválido: un dato del mensaje (botón, lista, imagen) que Meta no aceptó
  if (c === 'PARAMETRO_INVALIDO') return 'Meta rechazó un dato del mensaje (por ejemplo un texto demasiado largo). Pide a un administrador revisar el detalle técnico.';

  // Código de Meta explicado: el de clasificación numérico o el prefijo «[131049]» del detalle
  const metaNumerico = /^\d{3,6}$/.test(c) ? c : d.match(/^\[(\d{3,6})\]/)?.[1];
  if (metaNumerico && MENSAJES_META[metaNumerico]) return MENSAJES_META[metaNumerico];

  // Plantillas de Meta: por código exacto (132000-132016), el código de clasificación o el numérico del webhook
  const causaPlantilla = causaPorCodigoPlantilla(c) ?? (/^\d{6}$/.test(c) ? causaPlantillaMeta(Number(c), d) : null);
  if (causaPlantilla) return causaPlantilla.mensaje;

  // Destinatario no verificado en número de prueba de Meta (sandbox)
  if (
    c === 'DESTINATARIO_NO_VERIFICADO' ||
    d.includes('allowed list') ||
    d.includes('not in allowed list') ||
    d.includes('recipient is not in') ||
    d.includes('131030')
  ) {
    return 'Este numero no esta autorizado en el numero de prueba de Meta';
  }

  // Token vencido o credenciales inválidas
  if (
    c === 'TOKEN_VENCIDO' ||
    d.includes('session has expired') ||
    d.includes('token expired') ||
    d.includes('invalid oauth') ||
    /\b190\b/.test(d)
  ) {
    return 'El acceso a WhatsApp vencio: avisa a quien administra la cuenta';
  }

  // Ventana de 24 horas cerrada
  if (
    c === 'VENTANA_CERRADA' ||
    c === 'FUERA_DE_VENTANA_24H' ||
    d.includes('24 hours') ||
    d.includes('24-hour') ||
    d.includes('131047')
  ) {
    return TEXTO_VENTANA_24H;
  }

  // BSUID o identificador no permitido o rechazado por Meta (100 / 131009 / formato / recipient)
  if (
    c === 'BSUID_NO_PERMITIDO' ||
    c === 'IDENTIFICADOR_NO_PERMITIDO' ||
    d.includes('por su identificador') ||
    d.includes('pidele su numero') ||
    ((c === 'NUMERO_INVALIDO' || c === 'ERROR_META' || /\b100\b/.test(d) || d.includes('131009') || d.includes('131026')) &&
      (d.includes('recipient') || d.includes('bsuid') || d.includes('identificador') || d.includes('format')))
  ) {
    return 'Meta no permite escribir a este contacto por su identificador. Pidele su numero de celular.';
  }

  // Número inválido o no registrado en WhatsApp
  if (
    c === 'NUMERO_INVALIDO' ||
    d.includes('undeliverable') ||
    d.includes('not a valid whatsapp') ||
    d.includes('131026') ||
    d.includes('131009')
  ) {
    return 'El numero de telefono no es valido o no tiene WhatsApp';
  }

  // Límite de envío / tasa excedida
  if (
    c === 'LIMITE_ENVIO' ||
    c === 'LIMITE_TASA_EXCEDIDO' ||
    d.includes('rate limit') ||
    d.includes('130429') ||
    d.includes('131048')
  ) {
    return 'Se alcanzo el limite de envio: espera un momento';
  }

  // Contacto sin identificador ni teléfono
  if (c === 'CONTACTO_SIN_IDENTIFICADOR' || c === 'CONTACTO_SIN_TELEFONO') {
    return 'Este contacto no tiene ningun identificador: no se puede responder';
  }

  // Límite por minuto por usuario
  if (c === 'LIMITE_MINUTO_EXCEDIDO') {
    return 'Superaste el limite de 20 mensajes por minuto. Espera un momento';
  }

  // Cliente que pidió no recibir mensajes, o aviso sin plantilla configurada
  if (c === 'CLIENTE_BAJA') return 'El cliente pidió no recibir mensajes (BAJA)';
  if (c === 'PLANTILLA_NO_CONFIGURADA') return 'No hay una plantilla configurada para este aviso';

  // Faltan credenciales
  if (c === 'SIN_CREDENCIALES_META') {
    return 'Faltan credenciales de Meta en el servidor';
  }

  // Fallo de red
  if (c === 'TIMEOUT_META' || c === 'ERROR_RED_META') {
    return 'No se pudo conectar con el servicio de WhatsApp. Intenta nuevamente';
  }

  // Meta rechazó el mensaje por un motivo sin causa conocida: el detalle técnico queda para ADMIN
  if (c === 'ERROR_META' || /^\d+$/.test(c)) return 'Meta rechazó el mensaje. Pide a un administrador revisar el detalle técnico.';
  return 'No se pudo enviar el mensaje';
}
