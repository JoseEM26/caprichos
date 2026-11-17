import type { TicketPagoDatos } from '../tipos/etiquetas.js';
import { textoValorCupon } from './cuponCine.js';

/** Lo mínimo de un cupón para dibujar su voucher de ejemplo. */
export interface CuponParaEjemplo {
  modo: 'UNICO_COMPROBANTE' | 'COMPARTIDO' | 'ASIGNADO_PERSONAL' | string;
  codigoBase: string;
  descuentoTipo: 'PORCENTAJE' | 'MONTO' | 'ENVIO_GRATIS' | string;
  descuentoValor: number;
  descripcion?: string | null;
  /** Alcance real: «Toda la carta», o el nombre del producto o la categoría */
  alcance?: string | null;
  /** Vencimiento real ya formateado dd/mm/aaaa */
  vence?: string | null;
  /** Dados hasta hoy y tope (solo ASIGNADO_PERSONAL): «Dados 2 de 200» */
  dados?: number | null;
  tope?: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Ticket de pago de ejemplo con el descuento de ESTE cupón (no es un pedido real; nombres inventados).
 * Lleva los mismos datos que el pedido real guarda (`descuento_detalle` tipo CUPON), así que
 * `lineasTicketPago` lo imprime igual que el ticket de verdad. UNICO_COMPROBANTE y ASIGNADO_PERSONAL añaden el cupón
 * de colección al pie (la misma plantilla que el ticket real).
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
  // UNICO_COMPROBANTE (sorteado) y ASIGNADO_PERSONAL (lo da el personal) salen impresos al pie; COMPARTIDO nunca
  if (c.modo !== 'UNICO_COMPROBANTE' && c.modo !== 'ASIGNADO_PERSONAL') return base;
  const dadosHoy = c.dados ?? null;
  return {
    ...base,
    cuponSiguiente: {
      codigo: `${c.codigoBase}-A1B2C3`,
      valor: textoValorCupon(c.descuentoTipo, c.descuentoValor),
      alcance: c.alcance?.trim() || 'Toda la carta',
      vence: c.vence ?? '15/01/2027',
      // La vista previa dibuja el siguiente cupón que se daría: N.º dados + 1 de tope
      numero: dadosHoy != null ? dadosHoy + 1 : null,
      tope: c.tope ?? null,
    },
  };
}
