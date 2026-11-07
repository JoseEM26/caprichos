/**
 * Configuración de impresión: UN solo lugar con las claves de la tabla `parametro` (prefijo impresion_)
 * y sus valores por defecto. Sin configurar, todo sale como antes, salvo el sticker general (solo
 * llevar/recoger/delivery, decisión del dueño).
 */
export const CLAVES_CONFIG_IMPRESION = {
  /** Modalidades en las que sale el sticker general (resumen con total). */
  ETIQUETA_GENERAL_MODALIDADES: 'impresion_etiqueta_general_modalidades',
  /** Modalidades en las que sale el sticker por área (decisión del dueño 07/11: llevar, recoger y delivery). */
  ETIQUETA_AREA_MODALIDADES: 'impresion_etiqueta_area_modalidades',
  /** Modalidades en las que sale el sticker por vaso (la PC de bebidas imprime solo delivery y recojo). */
  ETIQUETA_BEBIDA_MODALIDADES: 'impresion_etiqueta_bebida_modalidades',
  /** Sticker por vaso de bebida: todos los pedidos con bebidas (salón, llevar, delivery). */
  ETIQUETA_BEBIDA_ACTIVO: 'impresion_etiqueta_bebida_activo',
  /** Sticker por área: uno por cada área con productos, salvo Bebidas (ya sale uno por vaso). Apagado por defecto hasta que el dueño lo confirme. */
  ETIQUETA_AREA_ACTIVO: 'impresion_etiqueta_area_activo',
  /** Comanda completa de salón para la ticketera de Caja al aceptar el pedido. */
  TICKET_COMANDA_SALON_ACTIVO: 'impresion_ticket_comanda_salon_activo',
  /** Una hoja por área (su cocina) para la ticketera de esa área, o de Caja si no tiene. Apagada hasta que se encienda. */
  TICKET_COMANDA_AREA_ACTIVO: 'impresion_ticket_comanda_area_activo',
  /** Minutos tras los que un trabajo automático pendiente pasa a VENCIDO (ya existía). */
  VENCE_MIN: 'impresion_vence_min',
} as const;

/** Modalidades reales del pedido: DELIVERY, RECOGER y MESA las escribe la API; LLEVAR existe en datos antiguos; LOCAL es el valor de respaldo de informes. */
export const MODALIDADES_PEDIDO = ['MESA', 'LOCAL', 'LLEVAR', 'RECOGER', 'DELIVERY'] as const;

/** Modalidades de salón (pedido en mesa o en el local): reciben la comanda de salón. */
export const MODALIDADES_SALON = ['MESA', 'LOCAL'] as const;

export interface ReglasImpresion {
  generalModalidades: string[];
  /** Modalidades del sticker por área. */
  areaModalidades: string[];
  /** Modalidades del sticker por vaso. */
  bebidaModalidades: string[];
  bebidaActivo: boolean;
  areaActivo: boolean;
  comandaSalonActivo: boolean;
  comandaAreaActivo: boolean;
}

export const REGLAS_IMPRESION_DEFECTO: ReglasImpresion = {
  generalModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'],
  areaModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'],
  bebidaModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'],
  bebidaActivo: true,
  areaActivo: true,
  comandaSalonActivo: true,
  comandaAreaActivo: false,
};
