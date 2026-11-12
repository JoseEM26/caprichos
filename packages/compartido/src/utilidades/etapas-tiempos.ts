/**
 * Etapas del «pipeline» del módulo Análisis › Tiempos: un solo catálogo que usan la API (cálculo y metas)
 * y el panel (nombres y orden). Cada etapa guarda su meta en el parámetro `clave` (minutos, solo ADMIN la cambia).
 */
export type CodigoEtapa =
  | 'aprobacion'
  | 'a_cocina'
  | 'cocina'
  | 'espera_despacho'
  | 'armado'
  | 'entrega_mesa'
  | 'recojo'
  | 'reparto_espera'
  | 'reparto_salida'
  | 'reparto_ruta'
  | 'reparto_entrega'
  | 'cobro'
  | 'cierre';

export interface EtapaPipeline {
  codigo: CodigoEtapa;
  /** Número del paso en el recorrido (el paso 1, «entra el pedido», es un hito sin duración). */
  paso: number;
  nombre: string;
  /** Qué mide, en una frase (se muestra bajo el nombre). */
  detalle: string;
  /** Modalidad a la que aplica; vacío = todas. */
  modalidades?: string[];
  /** Parámetro de Configuración con la meta en minutos. */
  clave: string;
  metaDefecto: number;
  /** false = no compite por «etapa más lenta» (el cierre de caja espera horas por diseño). */
  compite: boolean;
}

export const META_TIEMPO_MIN = 1;
export const META_TIEMPO_MAX = 1440;

export const ETAPAS_TIEMPOS: readonly EtapaPipeline[] = [
  { codigo: 'aprobacion', paso: 2, nombre: 'Espera de aprobación o pago', detalle: 'Desde que entra el pedido hasta que Caja aprueba el pago coordinado.', clave: 'meta_tiempo_aprobacion_min', metaDefecto: 5, compite: true },
  { codigo: 'a_cocina', paso: 3, nombre: 'Enviado a cocina', detalle: 'Desde que entra (o se aprueba) hasta que pasa a cocina.', clave: 'meta_tiempo_a_cocina_min', metaDefecto: 3, compite: true },
  { codigo: 'cocina', paso: 4, nombre: 'Cocina', detalle: 'Desde que pasa a cocina hasta que la última área marca Listo.', clave: 'meta_tiempo_cocina_min', metaDefecto: 15, compite: true },
  { codigo: 'espera_despacho', paso: 5, nombre: 'Espera de despacho', detalle: 'Todo listo en las áreas hasta que Despacho empieza a entregar.', clave: 'meta_tiempo_espera_despacho_min', metaDefecto: 3, compite: true },
  { codigo: 'armado', paso: 6, nombre: 'Despacho y armado', detalle: 'Desde la primera entrega de Despacho hasta dejar el pedido Listo.', clave: 'meta_tiempo_armado_min', metaDefecto: 3, compite: true },
  { codigo: 'entrega_mesa', paso: 7, nombre: 'Listo → en la mesa', detalle: 'Mesa: del Listo a que el mozo lo deja en la mesa.', modalidades: ['MESA', 'COMER_LOCAL'], clave: 'meta_tiempo_entrega_mesa_min', metaDefecto: 5, compite: true },
  { codigo: 'recojo', paso: 7, nombre: 'Listo → recogido', detalle: 'Para llevar (Recoger): del Listo a que el cliente lo recoge.', modalidades: ['RECOGER'], clave: 'meta_tiempo_recojo_min', metaDefecto: 10, compite: true },
  { codigo: 'reparto_espera', paso: 7, nombre: 'Delivery: espera repartidor', detalle: 'Del Listo a que un repartidor lo toma.', modalidades: ['DELIVERY'], clave: 'meta_tiempo_reparto_espera_min', metaDefecto: 10, compite: true },
  { codigo: 'reparto_salida', paso: 7, nombre: 'Delivery: asignado → en camino', detalle: 'Del repartidor asignado a que sale con el pedido.', modalidades: ['DELIVERY'], clave: 'meta_tiempo_reparto_salida_min', metaDefecto: 5, compite: true },
  { codigo: 'reparto_ruta', paso: 7, nombre: 'Delivery: en camino', detalle: 'De la salida a la llegada al cliente.', modalidades: ['DELIVERY'], clave: 'meta_tiempo_reparto_ruta_min', metaDefecto: 25, compite: true },
  { codigo: 'reparto_entrega', paso: 7, nombre: 'Delivery: entrega', detalle: 'De la llegada a que el cliente recibe.', modalidades: ['DELIVERY'], clave: 'meta_tiempo_reparto_entrega_min', metaDefecto: 5, compite: true },
  { codigo: 'cobro', paso: 8, nombre: 'Cobro', detalle: 'Desde Entregado hasta Pagado (0 si ya estaba pagado).', clave: 'meta_tiempo_cobro_min', metaDefecto: 10, compite: true },
  { codigo: 'cierre', paso: 9, nombre: 'Cierre de caja', detalle: 'Del cobro al cierre de la caja del día.', clave: 'meta_tiempo_cierre_min', metaDefecto: 720, compite: false },
];

export const CLAVES_METAS_TIEMPOS: readonly string[] = ETAPAS_TIEMPOS.map((e) => e.clave);

/** Rangos válidos de las metas (enteros), con el formato de RANGOS_NUMERICOS de Configuración. */
export const RANGOS_METAS_TIEMPOS: Record<string, [number, number, boolean, string]> = Object.fromEntries(
  ETAPAS_TIEMPOS.map((e): [string, [number, number, boolean, string]] => [
    e.clave,
    [META_TIEMPO_MIN, META_TIEMPO_MAX, true, `La meta «${e.nombre}» debe ser un entero entre ${META_TIEMPO_MIN} y ${META_TIEMPO_MAX} minutos`],
  ]),
);

export type SemaforoTiempo = 'verde' | 'ambar' | 'rojo' | 'sin_dato';

/** Semáforo contra la meta: verde hasta la meta, ámbar hasta 1,5 veces la meta, rojo más allá. */
export function semaforoContraMeta(minutos: number | null | undefined, meta: number): SemaforoTiempo {
  if (minutos == null || !Number.isFinite(minutos)) return 'sin_dato';
  if (minutos <= meta) return 'verde';
  return minutos <= meta * 1.5 ? 'ambar' : 'rojo';
}
