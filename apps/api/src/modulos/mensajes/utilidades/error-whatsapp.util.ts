/**
 * Mapeo de códigos de error de WhatsApp / Meta a mensajes en español accesibles y claros.
 * Regla: sin exponer detalles técnicos, contraseñas, tokens ni teléfonos completos.
 */
export function mapearErrorWhatsApp(codigo?: string | null, detalle?: string | null): string {
  const c = String(codigo || '').toUpperCase();
  const d = String(detalle || '').toLowerCase();

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

  // Plantilla no aprobada
  if (
    c === 'PLANTILLA_NO_APROBADA' ||
    d.includes('template') ||
    d.includes('does not exist') ||
    d.includes('132000') ||
    d.includes('132001')
  ) {
    return 'La plantilla no esta aprobada por Meta';
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

  // Contacto sin teléfono
  if (c === 'CONTACTO_SIN_TELEFONO') {
    return 'Este contacto no comparte su numero: no se puede responder desde aqui todavia';
  }

  // Límite por minuto por usuario
  if (c === 'LIMITE_MINUTO_EXCEDIDO') {
    return 'Superaste el limite de 20 mensajes por minuto. Espera un momento';
  }

  // Faltan credenciales
  if (c === 'SIN_CREDENCIALES_META') {
    return 'Faltan credenciales de Meta en el servidor';
  }

  // Fallo de red
  if (c === 'TIMEOUT_META' || c === 'ERROR_RED_META') {
    return 'No se pudo conectar con el servicio de WhatsApp. Intenta nuevamente';
  }

  return detalle ? String(detalle) : 'No se pudo enviar el mensaje';
}
