/**
 * Motor compartido de la migración de datos: claves naturales, forma de exportación de una fila,
 * carga de contexto desde una base, hashes y lectura/verificación del paquete.
 * Sin efectos sobre la base: exportar.ts e importar.ts lo usan.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { COLUMNAS_SECRETAS, MIGRAR } from './clasificacion';
import { ESPECIFICACION, Espec } from './especificacion';

export type Fila = Record<string, any>;
/** Cliente de Prisma (o de prueba): se usa por nombre de delegado (party, userAccount...). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cliente = any;

export const FORMATO_PAQUETE = 1;
export const PREFIJO_ARCHIVO = 'archivo://';
const RE_RUTA_ARCHIVO = /\/archivos\/((?:publico|privado)\/[^\s"'<>)]+)/g;

export interface Contexto {
  /** filas por tabla, clave String(id) (o `#n` si la tabla no tiene id) */
  filas: Record<string, Map<string, Fila>>;
  /** parties que salen en el paquete (personal activo y proveedores activos) */
  vigentes: Set<string>;
  /** party id -> documento "DNI:12345678" / "RUC:2012..." */
  docs: Map<string, string>;
  /** archivo id -> sha256 del archivo en disco (null si no existe o es privado) */
  sha: (archivoId: string) => string | null;
  inicioHoy: Date;
  ahora: Date;
  /** id de la versión de carta PUBLICADA más reciente */
  ultimaPublicada: string | null;
}

const modelos = () => Prisma.dmmf.datamodel.models;

export function delegado(tabla: string): string {
  const m = modelos().find((x) => (x.dbName ?? x.name) === tabla);
  if (!m) throw new Error(`Tabla desconocida: ${tabla}`);
  return m.name.charAt(0).toLowerCase() + m.name.slice(1);
}

/** true si la columna es una lista escalar (Prisma: nunca null). */
export function esLista(tabla: string, campo: string): boolean {
  const m = modelos().find((x) => (x.dbName ?? x.name) === tabla);
  return !!m?.fields.some((f) => f.name === campo && f.isList);
}

/** Columnas escalares que viajan en el paquete (sin id, sin FK, sin omitidas ni secretas). */
export function camposEscalares(tabla: string): string[] {
  const m = modelos().find((x) => (x.dbName ?? x.name) === tabla);
  if (!m) throw new Error(`Tabla desconocida: ${tabla}`);
  const e: Espec = ESPECIFICACION[tabla];
  const fuera = new Set<string>([
    ...(e.omitir ?? []),
    ...COLUMNAS_SECRETAS,
    ...Object.values(e.refs ?? {}).map((r) => r.col),
    ...Object.values(e.listas ?? {}).map((r) => r.col),
  ]);
  return m.fields
    .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
    .filter((f) => !(f.isId && !e.clave.includes(f.name)))
    .map((f) => f.name)
    .filter((n) => !fuera.has(n));
}

export function normalizarValor(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toString();
  return v;
}

/** JSON estable (claves ordenadas): base de todas las comparaciones y de los hashes. */
export function stableStringify(v: unknown): string {
  if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Fila;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export function pick(o: Fila, claves: string[]): Fila {
  const out: Fila = {};
  for (const c of claves) out[c] = o[c] ?? null;
  return out;
}

const ORDEN_DOC = ['DNI', 'RUC', 'CE'];

/** Documento principal de cada party (DNI antes que RUC antes que CE). */
export function construirDocs(identificadores: Fila[]): Map<string, string> {
  const elegido = new Map<string, { rango: number; doc: string }>();
  for (const i of identificadores) {
    const tipo = String(i.tipo);
    const rango = ORDEN_DOC.indexOf(tipo) === -1 ? 9 : ORDEN_DOC.indexOf(tipo);
    const k = String(i.party_id);
    const previo = elegido.get(k);
    if (!previo || rango < previo.rango) elegido.set(k, { rango, doc: `${tipo}:${i.numero}` });
  }
  return new Map([...elegido].map(([k, v]) => [k, v.doc]));
}

function filaDe(ctx: Contexto, tabla: string, id: string): Fila {
  const f = ctx.filas[tabla]?.get(id);
  if (!f) throw new Error(`Referencia rota: ${tabla} #${id} no está cargada`);
  return f;
}

/** Clave natural de la fila `id` de `tabla`, anidando las referencias. null si la fila no existe en el contexto. */
export function naturalDe(tabla: string, id: unknown, ctx: Contexto): Fila | null {
  if (id === null || id === undefined) return null;
  const k = String(id);
  if (tabla === 'party') return { documento: ctx.docs.get(k) ?? null };
  if (tabla === 'archivo') return { sha256: ctx.sha(k) };
  const e = ESPECIFICACION[tabla];
  const row = filaDe(ctx, tabla, k);
  const out: Fila = {};
  for (const p of e.clave) {
    const r = e.refs?.[p];
    const l = e.listas?.[p];
    if (r) out[p] = naturalDe(r.tabla, row[r.col], ctx);
    else if (l) out[p] = (row[l.col] ?? []).map((x: unknown) => naturalDe(l.tabla, x, ctx));
    else out[p] = normalizarValor(row[p]);
  }
  return out;
}

/** Forma de una fila en el paquete: escalares + referencias anidadas como clave natural. */
export function forma(tabla: string, row: Fila, ctx: Contexto): Fila {
  if (tabla === 'party') {
    return { documento: ctx.docs.get(String(row.id)) ?? null, tipo: row.tipo, estado: row.estado };
  }
  if (tabla === 'archivo') {
    return { sha256: ctx.sha(String(row.id)), tipo_mime: row.tipo_mime, bytes: row.bytes };
  }
  const e = ESPECIFICACION[tabla];
  const out: Fila = {};
  for (const c of camposEscalares(tabla)) {
    // Una lista escalar nula equivale a vacía en la aplicación (p. ej. oferta.dias): Prisma no admite null
    out[c] = esLista(tabla, c) && row[c] === null ? [] : normalizarValor(row[c]);
  }
  for (const [p, r] of Object.entries(e.refs ?? {})) out[p] = naturalDe(r.tabla, row[r.col], ctx);
  for (const [p, r] of Object.entries(e.listas ?? {})) {
    out[p] = (row[r.col] ?? []).map((x: unknown) => naturalDe(r.tabla, x, ctx));
  }
  return out;
}

/** Clave que identifica una fila de la forma `shape` (la misma en origen y en destino). */
export function claveDe(tabla: string, shape: Fila): string {
  return stableStringify(pick(shape, ESPECIFICACION[tabla].clave));
}

/** Texto legible de una clave natural, con los DNI/RUC enmascarados (para el reporte). */
export function etiquetaDe(tabla: string, shape: Fila): string {
  const partes = ESPECIFICACION[tabla].clave.map((p) => legible(shape[p]));
  return partes.filter((x) => x !== '').join(' / ') || '(sin clave)';
}

function legible(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(legible).join(', ');
    return Object.values(v as Fila).map(legible).join(' / ');
  }
  return enmascarar(String(v));
}

/** Enmascara documentos: DNI:12345678 -> DNI:12345*** (el paquete guarda el completo; el reporte no). */
export function enmascarar(texto: string): string {
  return texto.replace(/\b(DNI|RUC|CE):(\d{5})\d+/g, '$1:$2***');
}

/** Reemplaza las rutas /archivos/... de un JSON por `archivo://<sha>` (o al revés al importar). */
export function reescribirCadenas(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return v.map((x) => reescribirCadenas(x, fn));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Fila).map(([k, x]) => [k, reescribirCadenas(x, fn)]));
  }
  return v;
}

/** Busca en un texto las rutas de archivo públicas referenciadas (para sustituirlas por su sha). */
export function rutasReferenciadas(texto: string): string[] {
  return [...texto.matchAll(RE_RUTA_ARCHIVO)].map((m) => m[1]);
}

export function sustituirRutas(texto: string, fn: (ruta: string) => string): string {
  return texto.replace(RE_RUTA_ARCHIVO, (_m, ruta: string) => fn(ruta));
}

export function sha256Archivo(ruta: string): string | null {
  if (!fs.existsSync(ruta)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
}

/** Rutas /imagenes/... son estáticos del repo web (seed de marca): no están en uploads. */
export function esEstatica(ruta: string): boolean {
  return ruta.startsWith('/imagenes/');
}

/** sha256 de la clave de archivo: del contenido si es un fichero subido, de la ruta si es estático. */
export function shaDeArchivo(ruta: string, rutaFisica: string): string | null {
  return esEstatica(ruta) ? sha256Texto(`estatico:${ruta}`) : sha256Archivo(rutaFisica);
}

export function sha256Texto(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

export function huellaGlobal(datosSha: string, archivos: Array<{ sha256: string }>): string {
  return sha256Texto(`${datosSha}\n${archivos.map((a) => a.sha256).sort().join('\n')}`);
}

export function extension(ruta: string): string {
  const e = path.extname(ruta).toLowerCase();
  return /^\.[a-z0-9]{1,6}$/.test(e) ? e : '.bin';
}

/**
 * Carga, por tabla migrable, todas las filas (sin filtrar) para resolver referencias.
 * Se lee con SQL (SELECT *): usa las columnas que tiene CADA base, no las del cliente generado.
 */
export async function cargarFilas(db: Cliente, tablas: string[] = MIGRAR): Promise<Record<string, Map<string, Fila>>> {
  const filas: Record<string, Map<string, Fila>> = {};
  for (const t of tablas) {
    const lista: Fila[] = await db.$queryRawUnsafe(`SELECT * FROM "${t}"`);
    const mapa = new Map<string, Fila>();
    lista.forEach((f, i) => mapa.set(f.id !== undefined ? String(f.id) : `#${i}`, f));
    filas[t] = mapa;
  }
  return filas;
}

export async function ultimaMigracion(db: Cliente): Promise<string | null> {
  const r = await db.$queryRawUnsafe(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL ORDER BY "migration_name" DESC LIMIT 1`,
  );
  return r.length ? String(r[0].migration_name) : null;
}

export interface ManifiestoArchivo {
  sha256: string;
  ext: string;
  tipo_mime: string;
  bytes: number;
  /** Ruta relativa en uploads de origen (informativa; el destino se calcula por sha256). */
  ruta?: string;
  /** Estático del repo (/imagenes/...): no viaja el fichero; el paquete lleva la ruta. */
  estatico?: boolean;
}
export interface Manifiesto {
  formato: number;
  fecha: string;
  ambiente_origen: string;
  ultima_migracion: string | null;
  conteos: Record<string, number>;
  archivos: ManifiestoArchivo[];
  datos_sha256: string;
  huella: string;
}
export interface Paquete { manifiesto: Manifiesto; datos: { tablas: Record<string, Fila[]> } }

/** Lee el paquete y verifica formato, hash de datos.json, hash de cada archivo y huella global. */
export function leerPaquete(dir: string): Paquete {
  const rutaManifiesto = path.join(dir, 'manifiesto.json');
  const rutaDatos = path.join(dir, 'datos.json');
  if (!fs.existsSync(rutaManifiesto) || !fs.existsSync(rutaDatos)) {
    throw new Error(`El paquete ${dir} no tiene manifiesto.json o datos.json.`);
  }
  const manifiesto: Manifiesto = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));
  if (manifiesto.formato !== FORMATO_PAQUETE) throw new Error(`Formato de paquete no soportado: ${manifiesto.formato}`);
  const textoDatos = fs.readFileSync(rutaDatos, 'utf8');
  if (sha256Texto(textoDatos) !== manifiesto.datos_sha256) throw new Error('datos.json no coincide con su huella (alterado o incompleto).');
  for (const a of manifiesto.archivos) {
    if (a.estatico) {
      if (!a.ruta || shaDeArchivo(a.ruta, '') !== a.sha256) throw new Error(`Archivo estático inconsistente: ${a.ruta}`);
      continue;
    }
    const ruta = path.join(dir, 'archivos', `${a.sha256}${a.ext}`);
    if (sha256Archivo(ruta) !== a.sha256) throw new Error(`Archivo del paquete alterado o ausente: ${a.sha256}${a.ext}`);
  }
  if (huellaGlobal(manifiesto.datos_sha256, manifiesto.archivos) !== manifiesto.huella) {
    throw new Error('La huella global del paquete no coincide.');
  }
  return { manifiesto, datos: JSON.parse(textoDatos) };
}
