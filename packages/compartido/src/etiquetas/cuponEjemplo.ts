import type { TicketPagoDatos } from '../tipos/etiquetas.js';

/** Lo mínimo de un cupón para dibujar su voucher de ejemplo. */
export interface CuponParaEjemplo {
  modo: 'UNICO_COMPROBANTE' | 'COMPARTIDO' | string;
  codigoBase: string;
  descuentoTipo: 'PORCENTAJE' | 'MONTO' | 'ENVIO_GRATIS' | string;
  descuentoValor: number;
  descripcion?: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Ticket de pago de ejemplo con el descuento de ESTE cupón (no es un pedido real; nombres inventados).
 * Lleva los mismos datos que el pedido real guarda (`descuento_detalle` tipo CUPON), así que
 * `lineasTicketPago` lo imprime igual que el ticket de verdad. UNICO_COMPROBANTE añade el bloque del cupón al pie.
 */
export function ticketPagoEjemploCupon(c: CuponParaEjemplo): TicketPagoDatos {
  const lineas = [
    { cantidad: 2, nombre: 'Café latte', tamano: 'Grande', precioUnit: 11, subtotal: 22 },
    { cantidad: 1, nombre: 'Torta de chocolate', subtotal: 14.5 },
    { cantidad: 2, nombre: 'Dona glaseada', precioUnit: 6, subtotal: 12 },
    { cantidad: 1, nombre: 'Galleta de avena', subtotal: 4 },
  ];
  const subtotal = r2(lineas.reduce((a, l) => a + l.subtotal, 0));
  const envioGratis = c.descuentoTipo === 'ENVIO_GRATIS';
  const descuento = envioGratis
    ? 0
    : Math.min(subtotal, r2(c.descuentoTipo === 'PORCENTAJE' ? (subtotal * c.descuentoValor) / 100 : c.descuentoValor));
  const total = r2(subtotal - descuento);
  const base: TicketPagoDatos = {
    local: { nombre: 'Caprichos' },
    codigo: 'CP-0000',
    fecha: '01/01/2027',
    hora: '15:30',
    who: 'Lucía Ejemplo',
    modalidad: envioGratis ? 'Delivery' : 'Para llevar',
    entrega: envioGratis ? 'Av. Ejemplo 123' : null,
    lineas,
    subtotal,
    descuentos: [{ tipo: 'CUPON', nombre: `Cupón ${c.codigoBase}`, monto: descuento, ...(envioGratis ? { envioGratis: true } : {}) }],
    envio: 0,
    total,
    pagos: [{ medio: 'YAPE', monto: total }],
    documento: { tipo: 'SIMPLE' },
  };
  return c.modo === 'UNICO_COMPROBANTE'
    ? { ...base, cuponSiguiente: { codigo: `${c.codigoBase}-A1B2C3`, descripcion: c.descripcion ?? null, vence: '15/01/2027' } }
    : base;
}
