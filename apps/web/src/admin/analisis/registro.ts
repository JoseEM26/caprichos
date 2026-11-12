import type { PestanaAnalisis } from './comun';
import { pestanaTiempos } from './tiempos';
import { pestanaDemanda } from './demanda';
import { pestanaVentas } from './ventas';
import { pestanaClientes } from './clientes';
import { pestanaWhatsapp } from './whatsapp';
import { pestanaReparto } from './reparto';
import { pestanaEquipo } from './equipo';
import { pestanaAlmacen } from './almacen';

/**
 * Registro de pestañas de Análisis, en el orden en que se muestran.
 * Sumar una pestaña = crear su carpeta `<tema>/` con un `index.ts` que exporte su `PestanaAnalisis`
 * y agregar UNA línea aquí. Ver ./comun/README.md.
 */
export const PESTANAS_ANALISIS: readonly PestanaAnalisis[] = [
  pestanaTiempos,
  pestanaDemanda,
  pestanaVentas,
  pestanaClientes,
  pestanaWhatsapp,
  pestanaReparto,
  pestanaEquipo,
  pestanaAlmacen,
];
