export { aWindows1252, limpiarParaTspl } from './codepage1252.js';
export { resolverFormato, formatoDesdeConfig, comandosInicio, comandoLogo, aBytesTspl, MM_A_DOTS } from './formato.js';
export type { FormatoEtiqueta } from './formato.js';
export {
  generarEtiquetaGeneral,
  generarEtiquetaArea,
  generarEtiquetaBebida,
  generarTsplTrabajo,
  generarBytesTrabajo,
  generarBytesDeScript,
} from './generadorTspl.js';
export type { OpcionesGeneradorTspl } from './generadorTspl.js';
export {
  generarTicketEscPos,
  generarComandaSalonEscPos,
  generarCierreEscPos,
  bloqueQrEscPos,
  MODULO_QR_58MM,
  MODULO_QR_80MM,
} from './generadorTicket.js';
export { generarPruebaTicket, generarPruebaEtiqueta } from './prueba.js';
export { generarSeparadorRombos } from './rombos.js';
export { latin1ABytes, concatBytes, bytesABase64 } from './bytes.js';
export { generarComandosTrabajo, comandosDeTrabajo, validarComandos, LIMITE_COMANDOS_BYTES, FORMATOS_COMANDOS } from './comandos.js';
export type { CapacidadesAgente, ComandosTrabajo, FormatoComandos, OpcionesComandos } from './comandos.js';
export { calcularCentroX, generarComandoTexto } from './tipografia.js';
