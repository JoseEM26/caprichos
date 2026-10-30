/**
 * Saneamiento de CLIENTES / DNI (prevención de fuga de datos). IRREVERSIBLE salvo respaldo.
 * Borra las cuentas de clientes y lo que cuelga de ellas, anonimiza los DNI que quedan en tablas que
 * se conservan y desvincula los pedidos/conversaciones del cliente borrado. Conserva todo lo demás.
 * Solo LOCAL y DEMO. Nunca producción.
 *
 * Simulacro (por defecto, no escribe nada), desde apps/api:
 *   ENTORNO_DATOS=local pnpm sanear:clientes-dni --confirmar="SANEAR CLIENTES DNI"
 * Real:
 *   ENTORNO_DATOS=local pnpm sanear:clientes-dni --confirmar="SANEAR CLIENTES DNI" \
 *     --ejecutar --respaldo=/ruta/respaldo.dump        (o --sin-respaldo)
 *
 * Opciones: --max-comprobantes-emitidos=N (defecto 0), --umbral=ISO.
 * Detalle: clasificacion-tablas.ts y docs/operacion/sanear-clientes-dni.md.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  ANONIMIZAR, BORRAR_CUENTAS, CONSERVAR, PREFIJOS_REDIS, sqlDonde,
} from './clasificacion-tablas';
import {
  Entorno, Opciones, esMarcaProduccion, exigirConfirmacion, leerEntorno, parsearArgs, validarDestinos,
} from './guardas';

export interface Tx {
  $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...params: unknown[]): Promise<number>;
}
export interface Db extends Tx {
  $transaction<T>(fn: (tx: Tx) => Promise<T>, opts?: { timeout?: number; maxWait?: number }): Promise<T>;
  $disconnect(): Promise<void>;
}
export interface RedisLike {
  scan(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
  unlink(...keys: string[]): Promise<number>;
  quit(): Promise<unknown>;
}

const q = (t: string) => `"${t}"`;
const num = (r: unknown) => Number((r as Array<{ n: number | bigint }>)[0]?.n ?? 0);

/** Capa (c): marca de producción y comprobantes emitidos a SUNAT. Lanza si hay motivo para abortar. */
export async function verificarBase(tx: Tx, o: Opciones): Promise<void> {
  const marca = await tx.$queryRawUnsafe<Array<{ valor: unknown }>>(`SELECT "valor" FROM "parametro" WHERE "clave" = 'entorno'`);
  if (marca.length && esMarcaProduccion(marca[0].valor)) {
    throw new Error('parametro.entorno = PRODUCCION: la base está marcada como producción. Abortado.');
  }
  const emitidos = num(await tx.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "comprobante" WHERE "emision" = 'EMITIDO' AND COALESCE("emitido_en", "creado_en") > $1::timestamptz`,
    o.umbral ?? '1970-01-01',
  ));
  if (emitidos > o.maxComprobantesEmitidos) {
    throw new Error(`Hay ${emitidos} comprobante(s) EMITIDO (a SUNAT) posteriores al umbral; el máximo permitido es ${o.maxComprobantesEmitidos}. Abortado.`);
  }
}

export interface Conteos {
  borrar: Record<string, number>;
  anonimizar: Record<string, number>;
  conservar: Record<string, number>;
  hallazgos_dni_por_revisar: Record<string, number>;
}

/** Solo lectura: filas a borrar, columnas a anonimizar, tablas conservadas y DNI sueltos. */
export async function contar(tx: Tx): Promise<Conteos> {
  const c: Conteos = { borrar: {}, anonimizar: {}, conservar: {}, hallazgos_dni_por_revisar: {} };
  for (const t of BORRAR_CUENTAS) {
    c.borrar[t] = num(await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(t)} WHERE ${sqlDonde(t)}`));
  }
  const cubiertas = new Set<string>();
  for (const [t, reglas] of Object.entries(ANONIMIZAR)) {
    for (const r of reglas) {
      for (const [col, val] of Object.entries(r.columnas)) {
        cubiertas.add(`${t}.${col}`);
        c.anonimizar[`${t}.${col}`] = num(await tx.$queryRawUnsafe(
          `SELECT count(*)::int AS n FROM ${q(t)} WHERE (${r.donde}) AND ${q(col)} IS DISTINCT FROM ${val}`,
        ));
      }
    }
  }
  for (const t of CONSERVAR) c.conservar[t] = num(await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(t)}`));
  // Búsqueda por contenido: columnas de texto con valor exacto de 8 dígitos que no están cubiertas
  const cols = await tx.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'character')`,
  );
  for (const { table_name: t, column_name: col } of cols) {
    if (BORRAR_CUENTAS.includes(t) || t === 'auditoria' || t.startsWith('_') || cubiertas.has(`${t}.${col}`)) continue;
    const n = num(await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(t)} WHERE ${q(col)} ~ '^[0-9]{8}$'`));
    if (n > 0) c.hallazgos_dni_por_revisar[`${t}.${col}`] = n;
  }
  return c;
}

/** Escritura real, en orden: anonimizar/desvincular primero, luego borrar cuentas (hijas antes que party). */
export async function sanear(tx: Tx, resumen: Record<string, unknown>): Promise<void> {
  for (const [t, reglas] of Object.entries(ANONIMIZAR)) {
    for (const r of reglas) {
      const set = Object.entries(r.columnas).map(([c, v]) => `${q(c)} = ${v}`).join(', ');
      await tx.$executeRawUnsafe(`UPDATE ${q(t)} SET ${set} WHERE ${r.donde}`);
    }
  }
  for (const t of BORRAR_CUENTAS) await tx.$executeRawUnsafe(`DELETE FROM ${q(t)} WHERE ${sqlDonde(t)}`);
  await tx.$executeRawUnsafe(
    `INSERT INTO "auditoria" ("categoria", "modulo", "accion", "resultado", "motivo", "despues") VALUES ('CAMBIO', 'sistema', 'SANEAMIENTO_CLIENTES_DNI', 'OK', $1, $2::jsonb)`,
    'Saneamiento de clientes y DNI',
    JSON.stringify(resumen),
  );
}

/** Respaldo de las tablas que se borran o se modifican. */
function respaldar(url: string, ruta: string): void {
  const u = new URL(url);
  const tablas = [...BORRAR_CUENTAS, ...Object.keys(ANONIMIZAR)].flatMap((t) => ['-t', `public.${t}`]);
  const r = spawnSync(
    'pg_dump',
    ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1), '-Fc', '-f', ruta, ...tablas],
    { env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) }, encoding: 'utf8' },
  );
  if (r.error || r.status !== 0) throw new Error(`pg_dump falló: ${r.error?.message ?? r.stderr}`);
  fs.chmodSync(ruta, 0o600);
}

function hayPgDump(): boolean {
  return !spawnSync('pg_dump', ['--version']).error;
}

/** Cuenta (y borra si `borrarClaves`) claves de cuentas de cliente con SCAN; nunca KEYS. */
export async function limpiarRedis(
  redis: RedisLike, borrarClaves: boolean, prefijos: string[] = PREFIJOS_REDIS,
): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const patron of prefijos) {
    let cursor = '0';
    let n = 0;
    do {
      const [sig, claves] = await redis.scan(cursor, 'MATCH', patron, 'COUNT', 500);
      cursor = sig;
      n += claves.length;
      if (borrarClaves && claves.length) await redis.unlink(...claves);
    } while (cursor !== '0');
    r[patron] = n;
  }
  return r;
}

export interface Deps { db?: Db; redis?: RedisLike | null; log?: (s: string) => void }

export async function main(argv: string[], env: NodeJS.ProcessEnv, deps: Deps = {}): Promise<Record<string, unknown>> {
  const log = deps.log ?? ((s: string) => console.log(s));
  // Capas (a) y (c-entorno): antes de abrir ninguna conexión
  const o = parsearArgs(argv);
  exigirConfirmacion(o);
  const entorno: Entorno = leerEntorno(env.ENTORNO_DATOS);
  const redisUrl = env.REDIS_URL ?? (env.REDIS_HOST ? `redis://${env.REDIS_HOST}:${env.REDIS_PORT ?? 6379}` : undefined);
  validarDestinos(entorno, env.DATABASE_URL, redisUrl);

  if (o.ejecutar && !o.respaldo && !o.sinRespaldo) throw new Error('Con --ejecutar indique --respaldo=<ruta> o --sin-respaldo.');
  if (o.ejecutar && o.respaldo && !hayPgDump()) {
    throw new Error('pg_dump no está disponible: haga el respaldo por otro medio y use --sin-respaldo explícito.');
  }

  let db = deps.db;
  if (!db) {
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient() as unknown as Db;
  }
  let redis = deps.redis;
  if (redis === undefined && redisUrl && PREFIJOS_REDIS.length) {
    const { default: Redis } = await import('ioredis');
    const cliente = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
    try { await cliente.connect(); redis = cliente as unknown as RedisLike; }
    catch { if (o.ejecutar) throw new Error('Redis no responde; aborto antes de tocar la base.'); log('AVISO: Redis no responde; se omite en el simulacro.'); redis = null; }
  }

  try {
    const modo = o.ejecutar ? 'EJECUCION' : 'SIMULACRO';
    log(`== Saneamiento de clientes/DNI [${entorno}] modo ${modo} ==`);
    const antes = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await verificarBase(tx, o);
      return contar(tx);
    });
    log('-- Filas que se BORRARIAN (cuentas de clientes)');
    for (const [t, n] of Object.entries(antes.borrar)) log(`  ${t.padEnd(32)} ${n}`);
    log('-- Columnas que se ANONIMIZARIAN / desvincularian (filas afectadas)');
    for (const [t, n] of Object.entries(antes.anonimizar)) log(`  ${t.padEnd(40)} ${n}`);
    log('-- Se CONSERVA (filas por tabla)');
    for (const [t, n] of Object.entries(antes.conservar)) log(`  ${t.padEnd(32)} ${n}`);
    log(`-- Posibles DNI en otras columnas (revisar a mano): ${JSON.stringify(antes.hallazgos_dni_por_revisar)}`);
    const redisAntes = redis ? await limpiarRedis(redis, false) : {};
    log(`-- Redis (claves de cuentas de cliente): ${JSON.stringify(redisAntes)}`);

    const resumen: Record<string, unknown> = {
      entorno, modo, borrar: antes.borrar, anonimizar: antes.anonimizar, redis: redisAntes, en: new Date().toISOString(),
    };
    if (!o.ejecutar) {
      log('Simulacro: no se escribió nada. Use --ejecutar para sanear.');
      return { ...resumen, conservar: antes.conservar, hallazgos: antes.hallazgos_dni_por_revisar };
    }

    if (o.respaldo) { respaldar(env.DATABASE_URL as string, o.respaldo); log(`Respaldo escrito en ${o.respaldo}`); }
    await db.$transaction(async (tx) => {
      await verificarBase(tx, o); // se re-comprueba dentro de la transacción de escritura
      await sanear(tx, resumen);
    }, { timeout: 300_000, maxWait: 30_000 });
    if (redis) resumen.redis_borradas = await limpiarRedis(redis, true);

    const despues = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return contar(tx);
    });
    resumen.conservar = despues.conservar;
    resumen.usuarios_sistema = num(await db.$queryRawUnsafe('SELECT count(*)::int AS n FROM "user_account"'));
    resumen.pendientes_borrar = despues.borrar;
    resumen.hallazgos = despues.hallazgos_dni_por_revisar;
    log(`Resumen JSON: ${JSON.stringify(resumen)}`);
    log(`Usuarios del sistema intactos: ${resumen.usuarios_sistema}`);
    return resumen;
  } finally {
    if (redis) await redis.quit().catch(() => undefined);
    await db.$disconnect();
  }
}

if (require.main === module) {
  // Igual que las semillas: toma apps/api/.env si existe; las variables ya definidas mandan.
  try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch { /* sin dotenv */ }
  main(process.argv.slice(2), process.env).catch((e) => {
    console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
