/**
 * Ofertas por tipo de pedido en la carta. El cliente elige «Comer aquí / Recoger / Delivery» en el checkout, así que
 * antes de elegir la oferta se muestra con su etiqueta («Solo delivery») y al elegir se valida contra la modalidad.
 * Misma regla que el servidor (ofertaIncluyeModalidad): vacío = todas; llevar y recoger valen entre sí.
 */
export type ModalidadCarta = 'DELIVERY' | 'RECOGER' | 'COMER_LOCAL';

export function aplicaModalidad(modalidades: string[] | null | undefined, modalidad: ModalidadCarta): boolean {
  const n = (modalidades ?? []).map((m) => m.toUpperCase());
  if (n.length === 0) return true;
  if (modalidad === 'RECOGER') return n.includes('LLEVAR') || n.includes('RECOGER');
  return n.includes(modalidad);
}

/** «Solo delivery», «Solo para llevar», «Solo comer en el local»…; null si no tiene restricción. */
export function etiquetaModalidades(modalidades: string[] | null | undefined): string | null {
  const n = (modalidades ?? []).map((m) => m.toUpperCase());
  if (n.length === 0) return null;
  const partes: string[] = [];
  if (n.includes('COMER_LOCAL')) partes.push('comer en el local');
  if (n.includes('LLEVAR') || n.includes('RECOGER')) partes.push('para llevar');
  if (n.includes('DELIVERY')) partes.push('delivery');
  if (partes.length === 3) return null;
  return `Solo ${partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0]}`;
}

export const NOMBRE_MODALIDAD: Record<ModalidadCarta, string> = {
  DELIVERY: 'delivery',
  RECOGER: 'recoger en el local',
  COMER_LOCAL: 'comer en el local',
};
