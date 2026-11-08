import type { ArchivoConfiguracion } from './config';

export const MENSAJE_NO_VINCULADO =
  'Este equipo ya no está vinculado: descarga el programa de nuevo desde Caprichos › Configuración › Impresión';

/** Tras avisar (o tras un N), no se vuelve a avisar ni a preguntar antes de este tiempo. */
const SILENCIO_MS = 10 * 60 * 1000;

export interface DepsReenlace {
  /** Config guardada (y la que viene junto al .exe): si trae una llave distinta, se usa sin preguntar. */
  leer: () => ArchivoConfiguracion;
  /** true solo en una ventana interactiva (consola con TTY); servicio/autoarranque = false. */
  interactivo: boolean;
  preguntar: (texto: string) => Promise<string>;
  /** Canjea el código de un solo uso de Caprichos (CODIGO o CODIGO@host). */
  canjear: (codigo: string) => Promise<{ apiUrl: string; llave: string }>;
  guardar: (apiUrl: string, llave: string) => void;
  log: (m: string) => void;
  ahora?: () => number;
}

/**
 * Qué hacer cuando el servidor responde 401: releer el vínculo; si no cambió, avisar una vez y,
 * si hay consola interactiva, ofrecer vincular de nuevo con un código nuevo sin cerrar el programa.
 */
export function crearReenlace(d: DepsReenlace, llaveActual: string) {
  const ahora = d.ahora ?? Date.now;
  let llave = llaveActual;
  let silencioHasta = 0;
  return async (): Promise<{ apiUrl?: string; agenteKey: string } | undefined> => {
    const a = d.leer();
    if (a.agenteKey && a.agenteKey !== llave) {
      llave = a.agenteKey;
      return { apiUrl: a.apiUrl, agenteKey: a.agenteKey };
    }
    if (ahora() < silencioHasta) return undefined;
    silencioHasta = ahora() + SILENCIO_MS;
    d.log(`✖ ${MENSAJE_NO_VINCULADO}. Sigo reintentando con espera.`);
    if (!d.interactivo) return undefined;

    const r = (await d.preguntar('Este equipo ya no está vinculado. ¿Quieres vincularlo de nuevo ahora? (S/N) ')).trim().toUpperCase();
    if (r !== 'S' && r !== 'SI' && r !== 'SÍ') return undefined;
    for (let vacios = 0, fallos = 0; vacios < 3 && fallos < 5; ) {
      const codigo = (await d.preguntar('Pega el código de Caprichos › Configuración › Impresión (clic derecho pega) y pulsa Enter: ')).trim();
      if (!codigo) {
        vacios++;
        continue;
      }
      try {
        const v = await d.canjear(codigo);
        d.guardar(v.apiUrl, v.llave);
        llave = v.llave;
        silencioHasta = 0;
        d.log('Vinculado de nuevo correctamente.');
        return { apiUrl: v.apiUrl, agenteKey: v.llave };
      } catch (err: any) {
        fallos++;
        d.log(`✖ No se pudo vincular: ${err?.message || err}. Revisa el código completo (incluye lo que va después de @).`);
      }
    }
    return undefined;
  };
}
