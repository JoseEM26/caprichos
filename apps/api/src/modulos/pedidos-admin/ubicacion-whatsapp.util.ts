/** Un pedido delivery activo se asocia a una ubicación de WhatsApp solo si se creó hace menos de estas horas. */
export const HORAS_PEDIDO_RECIENTE = 12;

/** Estados en que el pedido todavía no salió: por confirmar, confirmado, preparando o listo. */
export const ESTADOS_ASIGNABLES = ['COLA', 'PREPARANDO', 'LISTO'];

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Mensaje al cliente cuando su ubicación quedó asignada al pedido. */
export function textoUbicacionAsignada(p: {
  codigo: string;
  envioNuevo: number;
  totalNuevo: number;
  /** Parte a crédito del personal (delivery): los productos no se pagan, solo el envío */
  montoCredito?: number;
  ajuste: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null;
  otros: string[];
}): string {
  let t = `📍 ¡Recibimos tu ubicación para el pedido ${p.codigo}! Tu envío es ${p.envioNuevo === 0 ? 'gratis' : soles(p.envioNuevo)} ${p.montoCredito && p.montoCredito > 0 ? `; el envío lo pagas al contado y tus productos (${soles(p.montoCredito)}) van a tu crédito del personal.` : ` y el total de tu pedido es ${soles(p.totalNuevo)}.`}`;
  if (p.ajuste?.tipo === 'SALDO') t += ` Como ya pagaste, se ajusta ${soles(p.ajuste.monto)} que Caja te indicará cómo completar.`;
  if (p.ajuste?.tipo === 'DEVOLUCION') t += ` Como ya pagaste, se ajusta a tu favor ${soles(p.ajuste.monto)}: Caja te lo devolverá.`;
  if (p.otros.length > 0) {
    t += ` Tienes otros pedidos sin ubicación (${p.otros.join(', ')}): si esta era para otro, avísanos por aquí.`;
  }
  return t;
}

export function textoUbicacionFueraDeZona(codigo: string): string {
  return `Recibimos tu ubicación para el pedido ${codigo}, pero está fuera de nuestra zona de cobertura para delivery. Una persona de Caja te escribirá por aquí para ayudarte; también puedes enviarnos otra ubicación dentro de la zona de reparto.`;
}

export function textoUbicacionPropuesta(codigo: string): string {
  return `Recibimos tu nueva ubicación para el pedido ${codigo}. Caja la revisará y te avisamos si cambia el costo del envío. 💛`;
}

export function textoUbicacionIgual(codigo: string): string {
  return `Recibimos tu ubicación, ¡es la misma que ya teníamos para el pedido ${codigo}! 😊`;
}

/** Pedido de ubicación (botón «Pedir ubicación por WhatsApp» de Caja y mensaje de pedido recibido). */
export function textoPedirUbicacion(codigo: string): string {
  return `📍 Para calcular tu envío del pedido ${codigo} necesitamos tu ubicación. Envíanosla así: toca el clip 📎 → Ubicación → Enviar tu ubicación actual.`;
}
