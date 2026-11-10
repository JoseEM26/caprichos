/** Canje de puntos en Caja y mozo: mismas reglas que la carta (1 punto = S/ 1, enteros, tope = min(saldo, elegible)). */

/** Máximo canjeable: sin decimales, nunca más que el saldo ni que el monto elegible del pedido. */
export function topeCanjeLocal(saldo: number, canjeable: number | null): number {
  if (canjeable === null) return 0;
  return Math.max(0, Math.floor(Math.min(Number(saldo) || 0, Number(canjeable) || 0)));
}

/** Por qué no se puede canjear (null = se puede). El orden es el de las reglas del servidor. */
export function motivoSinCanje(p: { personal: boolean; cupon: boolean; tieneCuenta: boolean; saldo: number; canjeable: number | null }): string | null {
  if (p.personal) return 'El pedido del personal no canjea puntos.';
  if (p.cupon) return 'No se pueden usar puntos y un cupón en el mismo pedido. Quita el cupón para canjear.';
  if (!p.tieneCuenta) return 'Elige a un cliente con cuenta (por celular) para canjear sus puntos. Un invitado no tiene puntos.';
  if (p.saldo < 1) return 'El cliente no tiene puntos suficientes para canjear.';
  if (topeCanjeLocal(p.saldo, p.canjeable) < 1) return 'Los puntos solo se usan en productos sin descuento ni promoción.';
  return null;
}

/** Texto escrito -> puntos enteros (0 si vacío o inválido), recortado al tope. */
export function puntosDeTexto(texto: string, tope: number): number {
  const n = parseInt(texto.replace(/\D/g, ''), 10) || 0;
  return Math.min(Math.max(0, n), tope);
}
