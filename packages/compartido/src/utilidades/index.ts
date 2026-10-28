export function redondearMonto(monto: number): number {
  return Math.round((monto + Number.EPSILON) * 100) / 100;
}

export interface OpcionParaPrecio {
  precioExtra?: number;
  precio_extra?: number;
}

export interface LineaParaPrecio {
  precioBase: number;
  opciones?: OpcionParaPrecio[];
  cantidad?: number;
}

export function calcularPrecioLinea(linea: LineaParaPrecio): {
  precioUnitario: number;
  subtotal: number;
} {
  const precioBase = Number(linea.precioBase) || 0;
  const sumaExtras = (linea.opciones || []).reduce((acc, op) => {
    const extra = op?.precioExtra ?? op?.precio_extra ?? 0;
    return acc + Number(extra);
  }, 0);
  const precioUnitario = redondearMonto(precioBase + sumaExtras);
  const cantidad = Math.max(1, Math.floor(Number(linea.cantidad) || 1));
  const subtotal = redondearMonto(precioUnitario * cantidad);
  return { precioUnitario, subtotal };
}

export function calcularSubtotalPedido(lineas: Array<{ subtotal: number }>): number {
  const sum = (lineas || []).reduce((acc, l) => acc + (Number(l?.subtotal) || 0), 0);
  return redondearMonto(sum);
}

export function calcularTotalPedido({
  subtotal,
  envio = 0,
}: {
  subtotal: number;
  envio?: number | null;
}): number {
  const envioNum = envio !== null && envio !== undefined ? Number(envio) : 0;
  return redondearMonto((Number(subtotal) || 0) + envioNum);
}

/** Monto por defecto del envío gratis cuando el parámetro no existe o no es válido. */
export const ENVIO_GRATIS_MONTO_POR_DEFECTO = 70;

/** «mas_de»: gratis solo si el subtotal supera el monto. «desde»: gratis desde el monto exacto. */
export type ModoEnvioGratis = 'desde' | 'mas_de';

export interface ReglaEnvioGratis {
  monto: number;
  modo: ModoEnvioGratis;
}

/** Normaliza los parámetros envio_gratis_monto (número o texto) y envio_gratis_modo. */
export function reglaEnvioGratis(montoRaw: unknown, modoRaw: unknown): ReglaEnvioGratis {
  let monto = Number.NaN;
  if (typeof montoRaw === 'number') monto = montoRaw;
  else if (typeof montoRaw === 'string' && montoRaw.trim() !== '') monto = Number(montoRaw);
  return {
    monto: Number.isFinite(monto) && monto >= 0 ? monto : ENVIO_GRATIS_MONTO_POR_DEFECTO,
    modo: modoRaw === 'desde' ? 'desde' : 'mas_de',
  };
}

/** Única regla de envío gratis por monto: la usan la API (consulta, pedido, ubicar) y la carta. */
export function aplicaEnvioGratis(subtotal: number, regla: ReglaEnvioGratis): boolean {
  const s = Number(subtotal) || 0;
  return regla.modo === 'desde' ? s >= regla.monto : s > regla.monto;
}

/** Envío que paga el cliente: 0 si aplica el envío gratis por monto, si no la tarifa de la zona. */
export function calcularEnvioFinal(subtotal: number, tarifaZona: number, regla: ReglaEnvioGratis): number {
  if (aplicaEnvioGratis(subtotal, regla)) return 0;
  return redondearMonto(Number(tarifaZona) || 0);
}
