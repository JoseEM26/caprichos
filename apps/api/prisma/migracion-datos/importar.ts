/**
 * IMPORTAR un paquete de exportar.ts a la base destino.
 *  - Por defecto SIMULACRO: muestra qué crearía, actualizaría u omitiría por tabla, sin escribir.
 *  - Con --confirmar="IMPORTAR DATOS DE LA EMPRESA" escribe, en UNA transacción, en orden de dependencias.
 *  - Clave natural (no ids): lo que ya existe en destino y es igual se marca «igual»; si es distinto se
 *    omite («omitido, ya existe y es distinto») salvo con --sobrescribir. Nunca borra nada.
 *  - Idempotente: una segunda ejecución no crea ni duplica filas.
 *  - Personal: cuentas nuevas con clave aleatoria no mostrada, debe_cambiar=true.
 *  - Archivos públicos: se copian a uploads/publico/importados/<sha256><ext> (sin duplicar por sha256).
 *
 * Uso (desde apps/api, con DATABASE_URL y ENTORNO_DATOS en el entorno; nunca lee .env):
 *   pnpm datos:importar --paquete=<carpeta>                                  (simulacro)
 *   pnpm datos:importar --paquete=<carpeta> --confirmar="IMPORTAR DATOS DE LA EMPRESA" --respaldo=<ruta.dump>
 *   ... o --sin-respaldo si ya hizo la copia de seguridad por otro medio.
 *   Producción: ENTORNO_DATOS=prod IMPORTAR_PRODUCCION=SI ... (ver docs/operacion/migrar-datos-empresa.md)
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { MIGRAR } from './clasificacion';
import { ESPECIFICACION, JSON_FIELDS } from './especificacion';
import {
  Cliente, Contexto, Fila, claveDe, cargarFilas, construirDocs, delegado, etiquetaDe, esEstatica, extension,
  forma, leerPaquete, reescribirCadenas, shaDeArchivo, stableStringify, ultimaMigracion, camposEscalares,
} from './motor';
import {
  EntornoDatos, esEjecucionReal, exigirEsquemaCompatible, exigirRespaldo, leerEntornoDatos, parsearImportar,
  validarDestinoDatos,
} from './guardas';

export type Accion = 'crear' | 'actualizar' | 'igual' | 'omitido_distinto';

interface Entrada { id: unknown; shape: Fila; ruta?: string }
export interface Item { tabla: string; accion: Accion; etiqueta: string; shape: Fila; entrada: Entrada }

export interface OpcionesImportar {
  uploadsDir: string;
  entorno: EntornoDatos;
  ejecutar: boolean;
  sobrescribir: boolean;
  /** pg_dump de las tablas que se van a tocar (solo si ejecutar) */
  respaldo?: string;
  databaseUrl?: string;
  /** sustituible en pruebas */
  hashClave?: () => Promise<string>;
  log?: (s: string) => void;
}

export interface ResultadoImport {
  ejecutado: boolean;
  items: Item[];
  errores: string[];
  conteos: Record<string, Record<Accion, number>>;
  huella: string;
}

const RE_PLACEHOLDER = /archivo:\/\/([0-9a-f]{64})/g;

/** Prisma: campos escalares (no relaciones) de una tabla, con su tipo. */
function tiposCampo(tabla: string): Map<string, string> {
  const m = Prisma.dmmf.datamodel.models.find((x) => (x.dbName ?? x.name) === tabla);
  const out = new Map<string, string>();
  for (const f of m?.fields ?? []) if (f.kind === 'scalar' || f.kind === 'enum') out.set(f.name, f.type);
  return out;
}

export async function importar(db: Cliente, dir: string, o: OpcionesImportar): Promise<ResultadoImport> {
  const log = o.log ?? (() => undefined);
  const paquete = leerPaquete(dir);
  const errores: string[] = [];

  // Forma del paquete: solo tablas migrables y solo columnas permitidas
  const tablasPaquete = paquete.datos.tablas;
  for (const t of Object.keys(tablasPaquete)) {
    if (!MIGRAR.includes(t) || ESPECIFICACION[t].hook) { errores.push(`Tabla no permitida en el paquete: ${t}`); continue; }
    const permitidos = new Set([...camposEscalares(t), ...ESPECIFICACION[t].clave, ...Object.keys(ESPECIFICACION[t].refs ?? {}), ...Object.keys(ESPECIFICACION[t].listas ?? {})]);
    for (const fila of tablasPaquete[t]) {
      for (const p of Object.keys(fila)) if (!permitidos.has(p)) { errores.push(`${t}: columna no permitida "${p}"`); break; }
      if (t === 'parametro' && !/^[\w.:-]+$/.test(String(fila.clave))) errores.push(`parametro: clave inválida "${fila.clave}"`);
    }
  }

  const destinoMigracion = await ultimaMigracion(db);
  exigirEsquemaCompatible(paquete.manifiesto.ultima_migracion, destinoMigracion);

  // Estado actual del destino
  const filas = await cargarFilas(db, MIGRAR);
  const shaCache = new Map<string, string | null>();
  const archivoPorId = new Map<string, Fila>();
  for (const [id, a] of filas.archivo) archivoPorId.set(id, a);
  const sha = (id: string): string | null => {
    if (shaCache.has(id)) return shaCache.get(id)!;
    const a = archivoPorId.get(id);
    const s = a && !a.privado ? shaDeArchivo(String(a.ruta), path.join(o.uploadsDir, String(a.ruta))) : null;
    shaCache.set(id, s);
    return s;
  };
  const hoy = new Date();
  const ctx: Contexto = {
    filas, vigentes: new Set(), docs: construirDocs([...filas.party_identifier.values()]), sha,
    inicioHoy: hoy, ahora: hoy, ultimaPublicada: null,
  };

  // Índice de claves del destino: clave natural -> entrada
  const claves: Record<string, Map<string, Entrada>> = {};
  for (const t of MIGRAR) {
    if (ESPECIFICACION[t].hook && t !== 'archivo') continue;
    claves[t] = new Map();
    for (const [, row] of filas[t]) {
      let shape: Fila;
      try { shape = forma(t, row, ctx); } catch { continue; }
      const k = claveDe(t, shape);
      if (!claves[t].has(k)) claves[t].set(k, { id: row.id ?? null, shape, ruta: t === 'archivo' ? String(row.ruta) : undefined });
    }
  }

  const items: Item[] = [];
  const rutaDeSha = new Map<string, string>();

  // 1) Archivos (no dependen de nada)
  for (const a of paquete.manifiesto.archivos) {
    const clave = stableStringify({ sha256: a.sha256 });
    const previo = claves.archivo.get(clave);
    const etiqueta = `${a.sha256.slice(0, 12)}${a.ext}`;
    if (previo) {
      rutaDeSha.set(a.sha256, previo.ruta!);
      items.push({ tabla: 'archivo', accion: 'igual', etiqueta, shape: previo.shape, entrada: previo });
      continue;
    }
    const ruta = a.estatico ? String(a.ruta) : `publico/importados/${a.sha256}${a.ext}`;
    if (!a.estatico && !ruta.startsWith('publico/')) errores.push(`archivo con ruta no permitida: ${ruta}`);
    const shape = { sha256: a.sha256, tipo_mime: a.tipo_mime, bytes: a.bytes };
    const entrada: Entrada = { id: null, shape, ruta };
    claves.archivo.set(clave, entrada);
    rutaDeSha.set(a.sha256, ruta);
    items.push({ tabla: 'archivo', accion: 'crear', etiqueta, shape, entrada });
  }

  // 2) Tablas, en orden de dependencias
  for (const t of MIGRAR) {
    if (ESPECIFICACION[t].hook || t === 'archivo') continue;
    const e = ESPECIFICACION[t];
    for (const original of tablasPaquete[t] ?? []) {
      let shape: Fila = original;
      for (const campo of JSON_FIELDS[t] ?? []) {
        shape = {
          ...shape,
          [campo]: reescribirCadenas(shape[campo], (s) => s.replace(RE_PLACEHOLDER, (_m, sh: string) => {
            const ruta = rutaDeSha.get(sh);
            if (!ruta) errores.push(`${t}: imagen ${sh.slice(0, 12)} no está en el paquete`);
            return `/archivos/${ruta ?? ''}`;
          })),
        };
      }
      const etiqueta = etiquetaDe(t, shape);
      const faltan: string[] = [];
      for (const [p, r] of Object.entries(e.refs ?? {})) {
        if (shape[p] !== null && shape[p] !== undefined && !claves[r.tabla]?.has(stableStringify(shape[p]))) faltan.push(`${p}->${r.tabla}`);
      }
      for (const [p, l] of Object.entries(e.listas ?? {})) {
        for (const x of shape[p] ?? []) if (!claves[l.tabla]?.has(stableStringify(x))) faltan.push(`${p}->${l.tabla}`);
      }
      if (faltan.length) { errores.push(`${t} "${etiqueta}": referencia no encontrada (${faltan.join(', ')})`); continue; }

      const clave = claveDe(t, shape);
      const previo = claves[t].get(clave);
      if (!previo) {
        const entrada: Entrada = { id: null, shape };
        claves[t].set(clave, entrada);
        items.push({ tabla: t, accion: 'crear', etiqueta, shape, entrada });
        continue;
      }
      const distinto = Object.keys(shape).some((k) => stableStringify(shape[k]) !== stableStringify(previo.shape[k]));
      const accion: Accion = !distinto ? 'igual' : o.sobrescribir ? 'actualizar' : 'omitido_distinto';
      items.push({ tabla: t, accion, etiqueta, shape, entrada: previo });
    }
  }

  const conteos: Record<string, Record<Accion, number>> = {};
  for (const it of items) {
    conteos[it.tabla] ??= { crear: 0, actualizar: 0, igual: 0, omitido_distinto: 0 };
    conteos[it.tabla][it.accion]++;
  }
  const huella = paquete.manifiesto.huella;
  const resultado: ResultadoImport = { ejecutado: false, items, errores, conteos, huella };
  if (!o.ejecutar) return resultado;
  if (errores.length) throw new Error(`No se escribe nada: el paquete tiene ${errores.length} error(es). Primero corríjalos.`);

  // Respaldo previo de las tablas que se van a tocar
  if (o.respaldo) {
    if (!o.databaseUrl) throw new Error('Falta DATABASE_URL para el respaldo.');
    respaldarTablas(o.databaseUrl, o.respaldo);
    log(`Respaldo previo escrito en ${o.respaldo}`);
  }

  const hashClave = o.hashClave ?? (async () => argon2.hash(crypto.randomBytes(48).toString('base64'), { type: argon2.argon2id }));
  const escrituras = items.filter((i) => i.accion === 'crear' || i.accion === 'actualizar').length;

  await db.$transaction(async (tx: Cliente) => {
    for (const it of items) {
      if (it.accion === 'igual' || it.accion === 'omitido_distinto') continue;
      await escribir(tx, it, claves, dir, o.uploadsDir, hashClave);
    }
    if (escrituras > 0) {
      await tx.auditoria.create({
        data: {
          categoria: 'CAMBIO', modulo: 'sistema', accion: 'IMPORTAR_DATOS_EMPRESA', resultado: 'OK',
          motivo: 'Importación de datos de la empresa desde paquete',
          despues: { huella, origen: paquete.manifiesto.ambiente_origen, fecha_paquete: paquete.manifiesto.fecha, conteos },
        },
      });
    }
  }, { timeout: 600_000, maxWait: 60_000 });

  resultado.ejecutado = true;
  return resultado;
}

/** Escribe una entrada. Los ids de las filas nuevas quedan en la entrada para resolver referencias. */
async function escribir(
  tx: Cliente, it: Item, claves: Record<string, Map<string, Entrada>>, dirPaquete: string, uploadsDir: string,
  hashClave: () => Promise<string>,
): Promise<void> {
  const t = it.tabla;
  const e = ESPECIFICACION[t];
  const campos = tiposCampo(t);
  const data: Fila = {};
  for (const [p, v] of Object.entries(it.shape)) {
    if (e.refs?.[p]) {
      const r = e.refs[p];
      data[r.col] = v === null ? null : claves[r.tabla].get(stableStringify(v))?.id ?? null;
    } else if (e.listas?.[p]) {
      const l = e.listas[p];
      data[l.col] = (v as unknown[]).map((x) => claves[l.tabla].get(stableStringify(x))?.id);
    } else if (campos.has(p)) {
      data[p] = v === null && campos.get(p) === 'Json' ? Prisma.JsonNull : v;
    }
  }

  if (t === 'archivo') {
    const ruta = String(it.entrada.ruta);
    if (!esEstatica(ruta)) {
      const destino = path.join(uploadsDir, ruta);
      if (!fs.existsSync(destino)) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.copyFileSync(path.join(dirPaquete, 'archivos', `${it.shape.sha256}${extension(ruta)}`), destino);
      }
    }
    const r = await tx.archivo.create({ data: { ruta, tipo_mime: it.shape.tipo_mime, bytes: it.shape.bytes, privado: false } });
    it.entrada.id = r.id;
    return;
  }
  if (t === 'party') {
    const doc = String(it.shape.documento ?? '');
    if (it.accion === 'crear') {
      const [tipoDoc, numero] = doc.split(':');
      const p = await tx.party.create({ data: { tipo: it.shape.tipo, estado: it.shape.estado } });
      await tx.partyIdentifier.create({ data: { party_id: p.id, tipo: tipoDoc, numero } });
      it.entrada.id = p.id;
    } else {
      await tx.party.update({ where: { id: it.entrada.id }, data: { tipo: it.shape.tipo, estado: it.shape.estado } });
    }
    return;
  }
  if (t === 'user_account' && it.accion === 'crear') {
    data.hash = await hashClave();
    data.debe_cambiar = true;
  }
  if (it.accion === 'crear') {
    const r = await tx[delegado(t)].create({ data });
    it.entrada.id = r.id ?? null;
    return;
  }
  // actualizar: por id si la tabla lo tiene; si no, por las columnas de su clave natural
  const where = it.entrada.id !== null && it.entrada.id !== undefined
    ? { id: it.entrada.id }
    : whereClave(t, it.shape, claves);
  if (!Object.keys(where).length) throw new Error(`Sin condición para actualizar ${t}: se aborta para no tocar otras filas.`);
  await tx[delegado(t)].updateMany({ where, data });
}

/** Condición de una fila por su clave natural (para tablas sin id). */
function whereClave(t: string, shape: Fila, claves: Record<string, Map<string, Entrada>>): Fila {
  const e = ESPECIFICACION[t];
  const w: Fila = {};
  for (const p of e.clave) {
    const r = e.refs?.[p];
    if (r) w[r.col] = claves[r.tabla].get(stableStringify(shape[p]))?.id ?? null;
    else if (!e.listas?.[p]) w[p] = shape[p];
  }
  return w;
}

/** pg_dump de las tablas que se van a tocar (en formato custom, permisos 0600). */
function respaldarTablas(databaseUrl: string, ruta: string): void {
  const u = new URL(databaseUrl);
  const tablas = MIGRAR.filter((t) => !ESPECIFICACION[t].hook).flatMap((t) => ['-t', `public.${t}`]);
  const r = spawnSync('pg_dump', [
    '-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username),
    '-d', u.pathname.slice(1), '-Fc', '-f', ruta, ...tablas,
  ], { env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) }, encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`pg_dump falló: ${r.error?.message ?? r.stderr}`);
  fs.chmodSync(ruta, 0o600);
}

function hayPgDump(): boolean {
  return !spawnSync('pg_dump', ['--version']).error;
}

export function resumenTexto(r: ResultadoImport, detalle = 25): string {
  const L: string[] = [r.ejecutado ? 'IMPORTACIÓN REAL (escrito en la base).' : 'SIMULACRO: no se escribió nada.'];
  L.push(`Huella del paquete: ${r.huella}`, '', '| Tabla | Crear | Actualizar | Igual | Omitido (distinto) |', '|---|---:|---:|---:|---:|');
  for (const t of Object.keys(r.conteos)) {
    const c = r.conteos[t];
    L.push(`| ${t} | ${c.crear} | ${c.actualizar} | ${c.igual} | ${c.omitido_distinto} |`);
  }
  for (const accion of ['crear', 'omitido_distinto'] as Accion[]) {
    const lista = r.items.filter((i) => i.accion === accion);
    if (!lista.length) continue;
    L.push('', `Detalle «${accion}» (${lista.length}):`);
    for (const i of lista.slice(0, detalle)) L.push(`- ${i.tabla}: ${i.etiqueta}`);
    if (lista.length > detalle) L.push(`- ... y ${lista.length - detalle} más`);
  }
  if (r.errores.length) L.push('', 'ERRORES (no se escribe nada):', ...r.errores.map((e) => `- ${e}`));
  return L.join('\n');
}

async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const o = parsearImportar(argv);
  if (!o.paquete) throw new Error('Falta --paquete=<carpeta del paquete>.');
  const ejecutar = esEjecucionReal(o);
  const entorno = leerEntornoDatos(env.ENTORNO_DATOS, 'importar', env);
  validarDestinoDatos(entorno, env.DATABASE_URL);
  if (ejecutar) exigirRespaldo(o, hayPgDump());
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    const r = await importar(db, path.resolve(o.paquete), {
      uploadsDir: path.resolve(env.UPLOADS_DIR ?? './data/uploads'),
      entorno,
      ejecutar,
      sobrescribir: o.sobrescribir,
      respaldo: o.respaldo,
      databaseUrl: env.DATABASE_URL,
      log: console.log,
    });
    console.log(resumenTexto(r));
    if (!ejecutar) console.log(`\nPara importar de verdad: --confirmar="IMPORTAR DATOS DE LA EMPRESA" (con --respaldo o --sin-respaldo).`);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main(process.argv.slice(2), process.env).catch((e) => {
    console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
