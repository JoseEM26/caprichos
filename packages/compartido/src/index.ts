export {
  ROLES_SISTEMA,
  DIMENSIONES_ETIQUETA,
  TIPOS_ETIQUETA,
  ESTADOS_PRINT_JOB,
  ESTADOS_IMPRESORA,
} from './constantes/index.js';
export type { RolSistema } from './constantes/index.js';
export * from './tipos/index.js';
export {
  redondearMonto,
  calcularPrecioLinea,
  calcularSubtotalPedido,
  calcularTotalPedido,
  ENVIO_GRATIS_MONTO_POR_DEFECTO,
  reglaEnvioGratis,
  aplicaEnvioGratis,
  calcularEnvioFinal,
} from './utilidades/index.js';
export type {
  OpcionParaPrecio,
  LineaParaPrecio,
  ModoEnvioGratis,
  ReglaEnvioGratis,
} from './utilidades/index.js';
export {
  SNAP_M_DEFECTO,
  ajustarAVecinas,
  areaM2,
  areaSolapeM2,
  solapeEntre,
  recortarSolape,
  separacionM,
  autoIntersecta,
  resumenAjusteTexto,
  insertarVertice,
  ladoMasLargo,
  quitarVerticeDe,
} from './utilidades/geometria-zonas.js';
export type { Punto, ResumenAjuste, ResultadoAjuste, SolapeZonas } from './utilidades/geometria-zonas.js';
