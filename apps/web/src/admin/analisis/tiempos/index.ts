import type { PestanaAnalisis } from '../comun';
import { TiemposTab } from './TiemposTab';

export const pestanaTiempos: PestanaAnalisis = {
  id: 'tiempos',
  etiqueta: 'Tiempos',
  filtros: ['modalidad', 'canal', 'turno'],
  Componente: TiemposTab,
};
