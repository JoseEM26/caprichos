import type { PestanaAnalisis } from './comun';
import { pestanaTiempos } from './tiempos';

/**
 * Registro de pestañas de Análisis, en el orden en que se muestran.
 * Sumar una pestaña = crear su carpeta `<tema>/` con un `index.ts` que exporte su `PestanaAnalisis`
 * y agregar UNA línea aquí. Ver ./comun/README.md.
 */
export const PESTANAS_ANALISIS: readonly PestanaAnalisis[] = [pestanaTiempos];
