import {
  generarTicketEscPos as ticket,
  generarComandaSalonEscPos as comanda,
  generarCierreEscPos as cierre,
  bloqueQrEscPos as qr,
} from '@caprichos/compartido';

// Diseño de RESPALDO de los tickets (el principal viene del servidor): vive en @caprichos/compartido.
export { MODULO_QR_58MM, MODULO_QR_80MM } from '@caprichos/compartido';
export const generarTicketEscPos = (...a: Parameters<typeof ticket>): Buffer => Buffer.from(ticket(...a));
export const generarComandaSalonEscPos = (...a: Parameters<typeof comanda>): Buffer => Buffer.from(comanda(...a));
export const generarCierreEscPos = (...a: Parameters<typeof cierre>): Buffer => Buffer.from(cierre(...a));
export const bloqueQrEscPos = (...a: Parameters<typeof qr>): Buffer => Buffer.from(qr(...a));
