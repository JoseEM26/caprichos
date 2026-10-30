/**
 * Guardas puras de la migración de datos (sin E/S, para poder probarlas).
 * local y demo se validan con las mismas reglas que el saneamiento (reset/guardas.ts).
 * PRODUCCIÓN solo se importa con ENTORNO_DATOS=prod + IMPORTAR_PRODUCCION=SI + la frase de confirmación,
 * y nunca se exporta desde producción.
 */
import { validarDestinos } from '../reset/guardas';

export const FRASE_IMPORTAR = 'IMPORTAR DATOS DE LA EMPRESA';

export type EntornoDatos = 'local' | 'demo' | 'prod';

export function leerEntornoDatos(
  valor: string | undefined,
  operacion: 'exportar' | 'importar',
  env: NodeJS.ProcessEnv,
): EntornoDatos {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'local' || v === 'demo') return v;
  if (v === 'prod') {
    if (operacion === 'exportar') throw new Error('Exportar desde PRODUCCIÓN no está permitido.');
    if ((env.IMPORTAR_PRODUCCION ?? '') !== 'SI') {
      throw new Error('Importar en PRODUCCIÓN exige además IMPORTAR_PRODUCCION=SI (segunda confirmación explícita).');
    }
    return 'prod';
  }
  throw new Error(`ENTORNO_DATOS debe ser local, demo o prod (recibido "${valor ?? ''}").`);
}

/** Valida el destino de la base: local/demo con las reglas del saneamiento; prod: host postgres y base *prod*. */
export function validarDestinoDatos(entorno: EntornoDatos, databaseUrl: string | undefined): void {
  if (entorno !== 'prod') {
    validarDestinos(entorno, databaseUrl);
    return;
  }
  if (!databaseUrl) throw new Error('Falta DATABASE_URL.');
  let u: URL;
  try { u = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL no es válida.'); }
  const base = decodeURIComponent(u.pathname.replace(/^\//, '')).toLowerCase();
  if (u.hostname.toLowerCase() !== 'postgres' || !base.includes('prod')) {
    throw new Error(`ENTORNO_DATOS=prod exige host "postgres" y base "*prod*" (recibido ${u.hostname}/${base}).`);
  }
}

export interface OpcionesExportar { salida?: string; soloReporte: boolean }

export function parsearExportar(argv: string[]): OpcionesExportar {
  const val = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  return { salida: val('salida'), soloReporte: argv.includes('--solo-reporte') };
}

export interface OpcionesImportar {
  paquete?: string;
  confirmar?: string;
  sobrescribir: boolean;
  respaldo?: string;
  sinRespaldo: boolean;
}

export function parsearImportar(argv: string[]): OpcionesImportar {
  const val = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  return {
    paquete: val('paquete'),
    confirmar: val('confirmar'),
    sobrescribir: argv.includes('--sobrescribir'),
    respaldo: val('respaldo'),
    sinRespaldo: argv.includes('--sin-respaldo'),
  };
}

/** Sin --confirmar es simulacro. Con --confirmar debe ser la frase exacta (escribe). */
export function esEjecucionReal(o: OpcionesImportar): boolean {
  if (o.confirmar === undefined) return false;
  if (o.confirmar !== FRASE_IMPORTAR) {
    throw new Error(`--confirmar debe ser exactamente "${FRASE_IMPORTAR}". No se hizo nada.`);
  }
  return true;
}

export function exigirRespaldo(o: OpcionesImportar, pgDumpDisponible: boolean): void {
  if (o.respaldo && !pgDumpDisponible) {
    throw new Error('pg_dump no está disponible: haga el respaldo por otro medio y use --sin-respaldo explícito.');
  }
  if (!o.respaldo && !o.sinRespaldo) {
    throw new Error('Para importar de verdad indique --respaldo=<ruta.dump> o --sin-respaldo (si ya hizo el respaldo).');
  }
}

/** Compatibilidad de esquema: la base destino debe tener la misma última migración o una más reciente. */
export function exigirEsquemaCompatible(origen: string | null, destino: string | null): void {
  if (!origen) return;
  if (!destino || destino < origen) {
    throw new Error(`El esquema destino (${destino ?? 'sin migraciones'}) es anterior al del paquete (${origen}). Aplique las migraciones primero.`);
  }
}
