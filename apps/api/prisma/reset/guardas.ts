/** Guardas puras del saneamiento de clientes (sin E/S, para poder probarlas). */

export const FRASE_CONFIRMACION = 'SANEAR CLIENTES DNI';

export type Entorno = 'local' | 'demo';

export interface Opciones {
  confirmar?: string;
  ejecutar: boolean;
  respaldo?: string;
  sinRespaldo: boolean;
  maxComprobantesEmitidos: number;
  /** ISO: solo cuentan los comprobantes EMITIDO posteriores a esta fecha. */
  umbral?: string;
}

export function parsearArgs(argv: string[]): Opciones {
  const val = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const max = val('max-comprobantes-emitidos');
  return {
    confirmar: val('confirmar'),
    ejecutar: argv.includes('--ejecutar') && !argv.includes('--simulacro'),
    respaldo: val('respaldo'),
    sinRespaldo: argv.includes('--sin-respaldo'),
    maxComprobantesEmitidos: max === undefined ? 0 : Number(max),
    umbral: val('umbral'),
  };
}

export function exigirConfirmacion(o: Opciones): void {
  if (o.confirmar !== FRASE_CONFIRMACION) {
    throw new Error(`Falta --confirmar="${FRASE_CONFIRMACION}" (literal). No se hizo nada.`);
  }
}

export function leerEntorno(valor: string | undefined): Entorno {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'local' || v === 'demo') return v;
  throw new Error(
    `ENTORNO_DATOS debe ser "local" o "demo" (recibido: "${valor ?? ''}"). Producción y entornos sin declarar están prohibidos.`,
  );
}

interface Destino { host: string; puerto: number; base: string }

function destino(url: string, porDefecto: number): Destino {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('La URL de la base/redis no es válida.'); }
  return {
    host: u.hostname.toLowerCase(),
    puerto: u.port ? Number(u.port) : porDefecto,
    base: decodeURIComponent(u.pathname.replace(/^\//, '')).toLowerCase(),
  };
}

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Lista permitida de destinos de PRUEBA.
 *  local: Postgres en localhost:5442 (caprichos-pg-dev), Redis en localhost:6389.
 *  demo : dentro del stack de la demo, host "postgres"/"redis" y base cuyo nombre contenga "demo".
 * Cualquier nombre con "prod" se rechaza siempre.
 */
export function validarDestinos(entorno: Entorno, databaseUrl: string | undefined, redisUrl?: string): void {
  if (!databaseUrl) throw new Error('Falta DATABASE_URL.');
  const db = destino(databaseUrl, 5432);
  if (/prod/.test(`${db.host}/${db.base}`)) {
    throw new Error('El host o la base parecen de PRODUCCIÓN. Abortado.');
  }
  if (entorno === 'local') {
    if (!HOSTS_LOCALES.includes(db.host) || db.puerto !== 5442) {
      throw new Error(`ENTORNO_DATOS=local exige Postgres en localhost:5442 (recibido ${db.host}:${db.puerto}).`);
    }
  } else if (db.host !== 'postgres' || !db.base.includes('demo')) {
    throw new Error(`ENTORNO_DATOS=demo exige host "postgres" y base "*demo*" (recibido ${db.host}/${db.base}).`);
  }
  if (redisUrl) {
    const r = destino(redisUrl, 6379);
    const okRedis = entorno === 'local'
      ? HOSTS_LOCALES.includes(r.host) && r.puerto === 6389
      : r.host === 'redis';
    if (!okRedis) throw new Error(`Redis fuera de la lista permitida para ${entorno} (${r.host}:${r.puerto}).`);
  }
}

/** parametro.entorno guardado como JSON: "PRODUCCION" (con o sin comillas). */
export function esMarcaProduccion(valor: unknown): boolean {
  return String(valor ?? '').replace(/"/g, '').trim().toUpperCase() === 'PRODUCCION';
}
