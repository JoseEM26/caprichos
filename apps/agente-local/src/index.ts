export {
  obtenerConfiguracion,
  VERSION_AGENTE,
} from './config';
export type { ConfiguracionAgente } from './config';

export {
  generarEtiquetaGeneral,
  generarEtiquetaArea,
  generarEtiquetaBebida,
  generarTsplTrabajo,
  generarBytesTrabajo,
} from './tspl/generadorTspl';
export type { OpcionesGeneradorTspl } from './tspl/generadorTspl';

export { aWindows1252, limpiarParaTspl } from './tspl/codepage1252';
export {
  medirAnchoTexto,
  calcularCentroX,
  truncar,
  ajustarLineas,
  generarComandoTexto,
} from './tspl/tipografia';
export { generarSeparadorRombos } from './tspl/rombos';

export {
  ErrorImpresora,
} from './impresora/dispositivo.interface';
export type {
  IDispositivoImpresora,
  EstadoDispositivo,
} from './impresora/dispositivo.interface';
export { ImpresoraUsb } from './impresora/impresoraUsb';
export { ImpresoraMemoria } from './impresora/impresoraMemoria';

export {
  ClienteApiImpresion,
  ErrorRedApi,
  ErrorRespuestaApi,
} from './api/clienteApi';
export type { IClienteApiImpresion } from './api/clienteApi';

export { AgenteLocalServicio } from './agente/bucle';
export type { OpcionesAgenteLocalServicio } from './agente/bucle';

export {
  muestraEtiquetaGeneral,
  muestraEtiquetaArea,
  muestraEtiquetaBebida,
} from './datosMuestra';

export {
  ejecutarComandoProbar,
  ejecutarComandoVolcar,
} from './cli';

// Si se ejecuta directamente dist/index.js, corre el agente
if (require.main === module) {
  const { main } = require('./cli');
  main().catch((err: any) => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
}
