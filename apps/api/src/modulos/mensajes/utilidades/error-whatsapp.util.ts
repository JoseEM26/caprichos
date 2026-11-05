import { causaPlantillaMeta, causaPorCodigoPlantilla } from '../../chatbot/utilidades/meta-errores.util';

/**
 * Mapeo de códigos de error de WhatsApp / Meta a mensajes en español accesibles y claros.
 * Regla: sin exponer detalles técnicos, contraseñas, tokens ni teléfonos completos. El detalle técnico
 * (código de Meta y texto original) se muestra aparte y solo a ADMIN.
 */
export function mapearErrorWhatsApp(codigo?: string | null, detalle?: string | null): string {
  const c = String(codigo || '').toUpperCase();
  const d = String(detalle || '').toLowerCase();

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
    d.includes('190')
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
    return 'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada';
  }

  // BSUID o identificador no permitido o rechazado por Meta (100 / 131009 / formato / recipient)
  if (
    c === 'BSUID_NO_PERMITIDO' ||
    c === 'IDENTIFICADOR_NO_PERMITIDO' ||
    d.includes('por su identificador') ||
    d.includes('pidele su numero') ||
    ((c === 'NUMERO_INVALIDO' || c === 'ERROR_META' || d.includes('100') || d.includes('131009') || d.includes('131026')) &&
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
