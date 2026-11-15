import type { ComponentType } from 'react';
import type { PresetFecha } from './fechas';
import type { FiltroExtra, FiltrosActivos } from './useFiltrosAnalisis';

/** Lo que recibe el componente de cada pestaña: los filtros ya resueltos y validados. */
export interface PropsPestanaAnalisis {
  filtros: FiltrosActivos;
  /** true si el usuario es ADMIN (las pestañas muestran lo que solo el ADMIN puede cambiar, como las metas). */
  esAdmin: boolean;
  /** Cambia el período (para los botones «Ver ayer» / «Ver últimos 7 días» de los estados vacíos). */
  alCambiarPeriodo?: (preset: PresetFecha) => void;
}

/** Definición de una pestaña de Análisis: se agrega en `registro.ts`. */
export interface PestanaAnalisis {
  id: string;
  etiqueta: string;
  /** Filtros extra que aplican a esta pestaña, además de las fechas. */
  filtros: readonly FiltroExtra[];
  Componente: ComponentType<PropsPestanaAnalisis>;
}
