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
