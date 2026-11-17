import { Prisma } from '@prisma/client';

/**
 * Pedido de «Tarjeta / Yape en línea» que todavía espera el pago del cliente: no va a cocina ni se cobra a mano.
 * El camino legítimo (aprobación de Culqi) escribe con prisma directo; estas reglas frenan a Caja, al ADMIN y a los cambios de estado.
 */
export const CODIGO_PAGO_ONLINE_PENDIENTE = 'PAGO_ONLINE_PENDIENTE';
export const MENSAJE_PAGO_ONLINE_PENDIENTE = 'Este pedido espera el pago en línea del cliente. Pasa a cocina solo cuando pague.';
export const CODIGO_PAGO_ONLINE_NUNCA_PAGADO = 'PAGO_ONLINE_NUNCA_PAGADO';
export const MENSAJE_PAGO_ONLINE_NUNCA_PAGADO = 'Este pedido de pago en línea venció sin pagar. Pide al cliente que haga uno nuevo.';

export function esPendienteDePagoOnline(p: { estado?: string | null; pago_estado?: string | null }): boolean {
  if (p.estado === 'ANULADO') return false;
  return p.estado === 'POR_PAGAR' || p.pago_estado === 'PENDIENTE_ONLINE';
}

/**
 * Pago en línea que el cliente nunca completó: esperando el pago (POR_PAGAR) o vencido sin pago (ANULADO por tiempo).
 * Un pedido en línea que sí se pagó (intento APROBADO o DEVUELTO) no entra aquí, aunque luego se anulara.
 */
export const WHERE_ABANDONADO_EN_LINEA: Prisma.PedidoWhereInput = {
  OR: [
    { estado: 'POR_PAGAR' },
    {
      estado: 'ANULADO',
      OR: [{ pago_estado: 'PENDIENTE_ONLINE' }, { motivo_anulacion: { startsWith: 'Sin pago en línea' } }],
      cobros: { none: { anulado_en: null } },
      pagosOnline: { none: { estado: { in: ['APROBADO', 'DEVUELTO'] } } },
    },
  ],
};

/** Filtro por defecto de Caja, cocina, cierre y contadores: deja fuera los pagos en línea que nunca se pagaron. */
export const SIN_ABANDONADOS_EN_LINEA: Prisma.PedidoWhereInput = { NOT: WHERE_ABANDONADO_EN_LINEA };
