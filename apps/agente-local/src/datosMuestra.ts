import type {
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
  TicketPagoDatos,
} from '@caprichos/compartido';

export const muestraEtiquetaGeneral: EtiquetaGeneralDatos = {
  codigo: 'PED-101',
  modalidad: 'SALON',
  modalidadPill: 'MESA 4',
  who: 'Juan Pérez',
  canal: 'Caja',
  hora: '15:30',
  fecha: '26/10/2026',
  cantidadProductos: 3,
  productos: [
    { cantidad: 1, nombre: 'Americano Clásico', tamano: '8oz' },
    { cantidad: 1, nombre: 'Croissant de Jamón y Queso' },
    { cantidad: 1, nombre: 'Jugo de Naranja Natural' },
  ],
  nota: 'Entregar caliente',
  printer: 'Etiquetera de caja',
};

export const muestraEtiquetaArea: EtiquetaAreaDatos = {
  areaNombre: 'COCINA',
  areaIndex: 1,
  totalAreas: 2,
  codigo: 'PED-101',
  modalidadPill: 'MESA 4',
  who: 'Juan Pérez',
  canal: 'Caja',
  hora: '15:30',
  fecha: '26/10/2026',
  lineas: [
    {
      cantidad: 1,
      nombre: 'Croissant de Jamón y Queso',
      opciones: ['Bien tostado'],
    },
    {
      cantidad: 2,
      nombre: 'Empanada de Carne',
      opciones: ['Con limón'],
    },
  ],
  esCompacta: true,
  nota: 'Mesa con niños',
  printer: 'Etiquetera de cocina',
};

export const muestraEtiquetaBebida: EtiquetaBebidaDatos = {
  bebidaIndex: 1,
  totalBebidas: 2,
  codigo: 'PED-101',
  persona: 'MARÍA ELENA',
  bebidaNombre: 'CAPPUCCINO VAINILLA',
  tamano: '12oz',
  opciones: ['Leche de avena', 'Sin azúcar', 'Extra canela'],
  contiene: 'Avena, canela, espresso doble',
  who: 'Para: Juan Pérez',
  hora: '15:30',
};

/** Ticket de prueba de la ticketera (asistente de vinculación por red). */
export const muestraTicketPago: TicketPagoDatos = {
  local: { nombre: 'CAPRICHOS' },
  codigo: 'PRUEBA',
  fecha: '05/11/2026',
  hora: '12:00',
  who: 'Prueba de impresión',
  modalidad: 'PRUEBA',
  lineas: [{ cantidad: 1, nombre: 'Página de prueba', subtotal: 0 }],
  total: 0,
  pagos: [{ medio: 'EFECTIVO', monto: 0 }],
};
