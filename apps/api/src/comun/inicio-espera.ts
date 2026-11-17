/**
 * Desde cuándo cuenta la espera de un pedido. Un programado no espera desde que se creó (puede ser de ayer):
 * espera desde su hora pactada, así no sale «tarde» ni cuenta antes de tiempo.
 * Sin programado_para se mantiene creado_en (pedidos normales sin cambios).
 */
export function inicioEspera(p: { creado_en: Date; programado_para?: Date | null }): Date {
  return p.programado_para ?? p.creado_en;
}

/**
 * Para promedios de preparación y entrega: un programado se mide desde que pasó a cocina,
 * no desde su creación (si no, el tiempo entre la creación y la hora pactada infla el promedio).
 */
export function inicioOperativo(p: { creado_en: Date; programado_para?: Date | null; pasa_cocina_en?: Date | null }): Date {
  return p.programado_para ? (p.pasa_cocina_en ?? p.creado_en) : p.creado_en;
}
