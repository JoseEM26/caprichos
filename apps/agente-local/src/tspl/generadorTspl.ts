import { generarBytesTrabajo as bytesTrabajo, generarBytesDeScript as bytesDeScript } from '@caprichos/compartido';

// El diseño de las etiquetas vive en @caprichos/compartido (el servidor lo usa para mandar los comandos ya armados).
// Aquí queda como DISEÑO DE RESPALDO: se usa solo si un trabajo llega sin `comandos` o con comandos que no sirven.
export {
  generarEtiquetaGeneral,
  generarEtiquetaArea,
  generarEtiquetaBebida,
  generarTsplTrabajo,
} from '@caprichos/compartido';
export type { OpcionesGeneradorTspl } from '@caprichos/compartido';

export const generarBytesTrabajo = (...a: Parameters<typeof bytesTrabajo>): Buffer => Buffer.from(bytesTrabajo(...a));
export const generarBytesDeScript = (script: string): Buffer => Buffer.from(bytesDeScript(script));
