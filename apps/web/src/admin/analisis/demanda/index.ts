import type { PestanaAnalisis } from '../comun';
import { DemandaTab } from './DemandaTab';

export const pestanaDemanda: PestanaAnalisis = {
  id: 'demanda',
  etiqueta: 'Demanda',
  filtros: ['modalidad', 'canal', 'turno'],
  Componente: DemandaTab,
};
