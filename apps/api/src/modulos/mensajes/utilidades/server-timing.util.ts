import { Logger } from '@nestjs/common';

const logger = new Logger('BandejaTiempos');
const UMBRAL_LENTO_MS = 400;

/**
 * Mide lo que tarda el servidor en una ruta de la bandeja y lo deja en la cabecera `Server-Timing`
 * (se ve en el navegador: pestaña Red › Tiempos). Si pasa de 400 ms también lo anota en el log, SIN datos personales:
 * solo ruta, milisegundos y conteo. Así se separa lo que tarda el servidor de lo que tarda la red / Meta.
 */
export async function conServerTiming<T>(res: any, ruta: string, fn: () => Promise<T>, conteo?: (r: T) => number): Promise<T> {
  const t0 = process.hrtime.bigint();
  const marcar = (r?: T) => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    try {
      res?.setHeader?.('Server-Timing', `app;dur=${ms.toFixed(1)}`);
    } catch {
      /* cabecera ya enviada: no importa */
    }
    if (ms >= UMBRAL_LENTO_MS) {
      logger.warn(JSON.stringify({ evento: 'bandeja_lenta', ruta, ms: Math.round(ms), filas: r !== undefined && conteo ? conteo(r) : undefined }));
    }
  };
  try {
    const r = await fn();
    marcar(r);
    return r;
  } catch (e) {
    marcar();
    throw e;
  }
}
