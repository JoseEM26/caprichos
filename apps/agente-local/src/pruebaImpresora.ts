import { generarPruebaTicket as ticket, generarPruebaEtiqueta as etiqueta } from '@caprichos/compartido';

// Hojas de prueba de RESPALDO (las de siempre vienen del servidor): el diseño vive en @caprichos/compartido.
export const generarPruebaTicket = (...a: Parameters<typeof ticket>): Buffer => Buffer.from(ticket(...a));
export const generarPruebaEtiqueta = (...a: Parameters<typeof etiqueta>): Buffer => Buffer.from(etiqueta(...a));
