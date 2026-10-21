export function redondearMonto(monto: number): number {
  return Math.round((monto + Number.EPSILON) * 100) / 100;
}
