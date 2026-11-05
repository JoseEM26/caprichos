/** Día corto en hora de Lima para títulos de aviso: «jue 7 nov». */
export function diaCortoLima(fechaHora: Date): string {
  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Lima' })
    .format(fechaHora)
    .replace(/\./g, '');
}

/**
 * Texto de la campana RESERVA_NUEVA que ven Caja y Salón (ADMIN, CAJA, MOZO).
 * Lo usan el chat de WhatsApp y la carta web: un solo lugar para el texto.
 */
export function textosNotificacionSolicitud(datos: {
  personas: number;
  fechaHora: Date;
  fechaTexto: string;
  hora: string;
  nombre: string;
  telefono: string;
  nota?: string | null;
}): { titulo: string; mensaje: string } {
  return {
    titulo: `Reserva nueva para ${datos.personas} personas, ${diaCortoLima(datos.fechaHora)} ${datos.hora}`,
    mensaje: `${datos.nombre}. Solicitud para ${datos.personas} personas el ${datos.fechaTexto} a las ${datos.hora}. Tel: ${datos.telefono}${datos.nota ? ' · Nota: ' + datos.nota : ''}`,
  };
}
