import type { PestanaAnalisis } from '../comun';
import { VentasTab } from './VentasTab';

export const pestanaVentas: PestanaAnalisis = {
  id: 'ventas',
  etiqueta: 'Ventas',
  filtros: ['modalidad', 'canal', 'turno'],
  Componente: VentasTab,
};
