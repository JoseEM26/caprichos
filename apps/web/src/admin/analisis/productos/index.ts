import type { PestanaAnalisis } from '../comun';
import { ProductosTab } from './ProductosTab';

export const pestanaProductos: PestanaAnalisis = {
  id: 'productos',
  etiqueta: 'Productos',
  filtros: ['modalidad', 'canal', 'turno'],
  Componente: ProductosTab,
};
