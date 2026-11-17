import { aWindows1252 as aBytes1252 } from '@caprichos/compartido';

export { limpiarParaTspl } from '@caprichos/compartido';
/** El diseño vive en @caprichos/compartido (lo usa también el servidor); aquí solo se entrega como Buffer. */
export const aWindows1252 = (cadena: string): Buffer => Buffer.from(aBytes1252(cadena));
