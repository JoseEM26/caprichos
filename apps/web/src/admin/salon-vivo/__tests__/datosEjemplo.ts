import type { SalonVivo } from '../salonVivoApi';

const el = (id: string, tipo: string, x: number, y: number, ancho: number, alto: number, extra: Record<string, unknown> = {}) => ({
  id, tipo, nombre: null, x, y, ancho, alto, numero: null, asientos: null, activo: true, ...extra,
});

export const pedido = (codigo: string, extra: Record<string, unknown> = {}) => ({
  id: codigo, codigo, modalidad: 'MESA', estado: 'COLA', cliente: 'Lucía', mesas: ['Mesa 1'], mesaIds: ['1'], minutos: 4, productos: 2,
  items: ['Capuccino', 'Carrot cake'], areas: [{ nombre: 'Bebidas', estado: 'PENDIENTE' as const }, { nombre: 'Postres', estado: 'LISTA' as const }], ...extra,
});

export const salonEjemplo = (): SalonVivo => ({
  generadoEn: '2026-11-21T20:00:00.000Z',
  cajaAbierta: true,
  pisos: [{
    id: '1', nombre: 'Piso 1', cuadriculaAncho: 20, cuadriculaAlto: 12,
    elementos: [
      el('1', 'MESA', 2, 9, 2, 2, { numero: 1, nombre: 'Mesa 1', asientos: 2 }),
      el('2', 'MESA', 8, 9, 2, 2, { numero: 2, nombre: 'Mesa 2', asientos: 4 }),
      el('3', 'COCINA', 1, 1, 8, 1, { nombre: 'BEBIDAS' }),
      el('4', 'COCINA', 9, 1, 4, 1, { nombre: 'POSTRES' }),
      el('5', 'COCINA', 1, 2, 1, 1, { nombre: 'DESPACHO' }),
      el('6', 'CAJA', 2, 3, 3, 1, { nombre: 'Caja' }),
      el('7', 'ENTRADA', 19, 6, 1, 3),
      el('8', 'PARED', 0, 0, 20, 1),
    ],
  }],
  mesas: [
    { id: '1', pisoId: '1', numero: 1, nombre: 'Mesa 1', asientos: 2, estado: 'ESPERANDO', pedido: { codigo: 'CP-W901', personas: 2, minutos: 4, areasPendientes: ['Bebidas'] }, reserva: null },
    { id: '2', pisoId: '1', numero: 2, nombre: 'Mesa 2', asientos: 4, estado: 'LIBRE', pedido: null, reserva: null },
  ],
  caja: [pedido('CP-W905', { modalidad: 'LLEVAR', mesas: [], mesaIds: [], cliente: 'Marco' })],
  cocina: [pedido('CP-W901'), pedido('CP-W902', { minutos: 18, cliente: 'Ana', mesas: ['Mesa 3'], mesaIds: ['3'] })],
  despacho: [pedido('CP-W903', { estado: 'LISTO', mesas: ['Mesa 2'], mesaIds: ['2'] })],
  enReparto: [pedido('CP-W904', { modalidad: 'DELIVERY', estado: 'EN_CAMINO', mesas: [], mesaIds: [] })],
  reservas: [{ hora: '21:00', nombre: 'Rosa', personas: 3, mesas: ['Mesa 2'] }],
  cargaCocina: [{ area: 'Bebidas', pendientes: 2 }],
  conteos: { pedidosHoy: 9, entregadosHoy: 4, deliveryEntregadosHoy: 1, mesasOcupadas: 1, mesasTotal: 2, personas: 2, minutosCocinaPromedio: 11 },
});
