import type { TicketCierreDatos } from '@caprichos/compartido';

/** Ticket de cierre de ejemplo (cierre del 21/10 con efectivo desglosado y una diferencia de efectivo). */
export const ticketEjemplo = (extra: Partial<TicketCierreDatos> = {}): TicketCierreDatos => ({
  tipo: 'TICKET_CIERRE',
  local: { nombre: 'Caprichos' },
  codigo: 'CZ-0005',
  fecha: '21/10/2026',
  cerradoEn: '16:00',
  abiertoPor: 'Ana Cajera',
  cerradoPor: 'Luis Cajero',
  apertura: 100,
  resultado: 'NO_CUADRA',
  diferencia: -4,
  aprobadoPor: 'Rosa Supervisora',
  nota: 'Faltante de 4 soles',
  efectivo: {
    desglose: [
      { valor: 100, cantidad: 3, subtotal: 300 },
      { valor: 50, cantidad: 1, subtotal: 50 },
      { valor: 1, cantidad: 1, subtotal: 1 },
    ],
    contado: 351,
    esperado: 355,
    diferencia: -4,
  },
  intentos: [],
  medios: [
    { medio: 'EFECTIVO', sistema: 355, visto: 351, diferencia: -4 },
    { medio: 'YAPE', sistema: 200, visto: 200, diferencia: 0 },
  ],
  movimientos: [{ tipo: 'EGRESO', monto: 20, motivo: 'Compra de hielo', anulado: false }],
  correcciones: [],
  liquidaciones: [{ repartidor: 'Carlos Repartidor', esperado: 80, entregado: 80, hora: '15:10' }],
  anulaciones: [{ pedido: 'CP-0042', total: 25, hora: '14:00', por: 'Ana Cajera' }],
  ...extra,
});
