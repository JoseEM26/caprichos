import type { PestanaAnalisis } from '../comun';
import { PagosTab } from './PagosTab';

export const pestanaPagos: PestanaAnalisis = {
  id: 'pagos',
  etiqueta: 'Medios de pago',
  filtros: ['modalidad', 'canal'],
  Componente: PagosTab,
};
