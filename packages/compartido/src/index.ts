export {
  ROLES_SISTEMA,
  DIMENSIONES_ETIQUETA,
  TIPOS_ETIQUETA,
  ESTADOS_PRINT_JOB,
  ESTADOS_IMPRESORA,
  CLAVES_CONFIG_IMPRESION,
  MODALIDADES_PEDIDO,
  MODALIDADES_SALON,
  REGLAS_IMPRESION_DEFECTO,
  ROLES_COCINA_AREA,
  AREA_BEBIDAS,
  esAreaBebidas,
  CLAVES_TAMANO_ETIQUETA,
  TAMANO_BEBIDA_DEFECTO,
  TAMANO_GENERAL_DEFECTO,
  TAMANOS_ETIQUETA_DEFECTO,
  TAMANO_ETIQUETA_MIN_MM,
  TAMANO_ETIQUETA_MAX_MM,
  medidaEtiquetaValida,
  tamanosDesdeValores,
  PRESETS_TAMANO_ETIQUETA,
  MARGEN_ETIQUETA_MAX_MM,
  tamanoPcValido,
  aplicarOrientacion,
  tamanoEfectivo,
} from './constantes/index.js';
export { MODULOS_ROL, coincideMinimo, moduloRolVisible, permisosAConceder } from './constantes/index.js';
export type { ModuloRolCatalogo } from './constantes/index.js';
export type { TamanoMm, TamanosEtiqueta, TamanoEtiquetaPc, OrientacionEtiqueta } from './constantes/index.js';
export type { ReglasImpresion } from './constantes/index.js';
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
export {
  FUENTES_TSPL,
  MM_A_DOTS,
  MEDIDAS_ROLLO_MM,
  medirAnchoTexto,
  truncar,
  ajustarLineas,
  maquetarArea,
} from './etiquetas/maquetaEtiquetas.js';
export { maquetarGeneral, maquetarBebida, maquetarEtiqueta, lineasDeDatos } from './etiquetas/maquetaStickers.js';
export type { FuenteTspl, Primitiva, Maqueta, FormatoMaqueta } from './etiquetas/maquetaEtiquetas.js';
export { calcularPagoPedido } from './etiquetas/pagoPedido.js';
export { PAGOS_EJEMPLO } from './etiquetas/pagosEjemplo.js';
export type { EntradaPagoPedido } from './etiquetas/pagoPedido.js';
export { lineasTicketPago } from './etiquetas/ticketPago.js';
export { detalleLinea, entradaDeLineaPedido, descuentosDePedido, resumenAntesDelTotal, solesTexto } from './etiquetas/detalleLinea.js';
export type { LineaDetalleEntrada, DetalleLinea, DescuentoTicket } from './etiquetas/detalleLinea.js';
export { lineasTicketComandaSalon } from './etiquetas/ticketComanda.js';
export type { LineaComanda } from './etiquetas/ticketComanda.js';
export type { LineaTicket } from './etiquetas/ticketPago.js';
export { lineasTicketCierre, desglosarConteo, DENOMINACIONES_CIERRE } from './etiquetas/ticketCierre.js';
export type { TicketCierreDatos, RenglonDesglose } from './etiquetas/ticketCierre.js';
export { LOGO_BASE64, LOGO_BASE64_90, LOGO_BASE64_270, LOGO_LADO } from './etiquetas/logoBitmap.js';
export {
  UMBRALES_AVISO_STOCK_DEFECTO,
  AVISO_STOCK_MAX,
  umbralesAvisoStock,
  unidadNatural,
  avisoStock,
  avisoSabor,
} from './utilidades/avisos-stock.js';
export type { UmbralesAvisoStock, AvisoStock } from './utilidades/avisos-stock.js';
export {
  codificarPlusCode,
  decodificarPlusCode,
  recuperarPlusCode,
  plusCodeCorto,
  plusCodeParaMostrar,
  plusCodeDesdeTexto,
  esPlusCodeValido,
  esPlusCodeCompleto,
  esPlusCodeCorto,
} from './utilidades/plus-code.js';
export type { AreaPlusCode } from './utilidades/plus-code.js';

export {
  CATEGORIAS_PLANTILLA,
  ETIQUETA_CATEGORIA_PLANTILLA,
  VARIABLES_PLANTILLA,
  resolverPlantilla,
  marcadoresPendientes,
} from './utilidades/plantillas-respuesta.js';
export type { CategoriaPlantilla } from './utilidades/plantillas-respuesta.js';
