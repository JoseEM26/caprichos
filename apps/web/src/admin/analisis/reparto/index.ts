import type { PestanaAnalisis } from '../comun';
import { RepartoTab } from './RepartoTab';

export const pestanaReparto: PestanaAnalisis = {
  id: 'reparto',
  etiqueta: 'Reparto',
  filtros: ['canal', 'turno'],
  Componente: RepartoTab,
};
