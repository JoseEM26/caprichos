import type { CodigoEtapa } from '@caprichos/compartido';

/**
 * Cuando una etapa sale «Sin dato»: por qué y qué faltaría guardar. Nada se inventa; si la hora no existe, se dice.
 */
export const FALTANTES: Record<CodigoEtapa, string> = {
  aprobacion:
    'Solo existe en pedidos de pago coordinado que Caja aprobó antes de pasar a cocina (se guarda al aprobar). Los pedidos que no esperan aprobación no tienen esta etapa.',
  a_cocina: 'Falta la hora en que el pedido pasó a cocina, que se guarda cuando Caja lo acepta.',
  cocina:
    'Falta que todas las áreas marquen Listo. Ojo: el sistema no guarda cuándo cada área empezó a preparar; el inicio es el pase a cocina.',
  espera_despacho: 'Necesita que todas las áreas estén listas. Si el pedido se puso en Listo a mano, solo se sabe el tramo hasta Listo.',
  armado: 'Falta la hora en que Despacho entregó la primera línea. Un pedido puesto en Listo a mano no la guarda.',
  entrega_mesa: 'Falta la hora en que el mozo lo dejó en la mesa (solo mesa y comer en local).',
  recojo: 'Falta la hora de entrega del pedido para llevar.',
  reparto_espera: 'Falta la hora en que un repartidor tomó el pedido.',
  reparto_salida: 'Faltan la hora de asignación del repartidor y la de salida.',
  reparto_ruta: 'Faltan la hora de salida y la de llegada al cliente.',
  reparto_entrega: 'Falta la hora de llegada al cliente o la de entrega.',
  cobro: 'Falta el cobro registrado en Caja (los pagos coordinados sin cobro en Caja no tienen hora de pago).',
  cierre: 'La caja del cobro aún no se cerró, o el pedido no tiene cobro registrado.',
};

/** Lo que el sistema todavía no guarda y haría el análisis más fino. */
export const NO_SE_GUARDA: readonly string[] = [
  'La hora en que cada área de cocina empieza a preparar (hoy el inicio es el pase a cocina).',
  'La hora en que el pedido queda listo en cada línea para entregar, separada de la entrega de Despacho.',
  'Cuándo se pidió el pago (por ejemplo, el mensaje de cobro al cliente): la espera de aprobación se mide desde que entra el pedido.',
];
