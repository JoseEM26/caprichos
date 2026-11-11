import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ejecutablePropio } from './autoarranque';
import { detenerEnMarcha, dirDatos, procesoVivo, rutaBloqueo, rutaParada } from './segundoPlano';
import type { VivoFn } from './segundoPlano';

/**
 * Control de COPIAS del programa corriendo en el equipo (no solo la registrada en agente.lock): `--copias`, `--detener-todo`
 * y el cierre automático de copias anteriores al arrancar. Solo toca procesos cuyo ejecutable tiene el MISMO nombre que este
 * programa y que corren como servicio (sin argumentos, --segundo-plano o --primer-plano); nunca otros programas.
 * Windows: PowerShell (Get-CimInstance) → wmic → tasklist. Linux: /proc (solo se ven los procesos del mismo usuario).
 * NO se pudo probar en un Windows real desde aquí: ver la receta manual en el README.
 */

export interface CopiaPrograma {
  pid: number;
  /** Milisegundos desde 1970 de la hora de inicio, si el sistema la da. */
  inicioMs?: number;
  ruta?: string;
  /** Solo se sabe de la copia registrada en el bloqueo y siendo de una versión nueva; si no, «desconocida». */
  version?: string;
}
export interface CopiaCruda extends CopiaPrograma {
  /** Argumentos (sin el ejecutable); undefined = no se pudo saber (tasklist). */
  args?: string[];
}
export interface ProcLinux { pid: number; exe: string; args: string[]; inicioMs?: number }

export interface DepsCopias {
  plataforma?: NodeJS.Platform;
  /** Esta copia: pid, pid del padre (el lanzador del doble clic) y ruta del ejecutable. Sin `exe` (modo node) no se toca nada. */
  yo?: { pid: number; ppid: number; exe?: string };
  /** Windows: corre una herramienta y devuelve su salida (lanza si no existe o falla). */
  ejecutar?: (cmd: string, args: string[]) => Promise<string>;
  /** Linux: procesos visibles. */
  procLinux?: () => ProcLinux[];
  /** Cierra un proceso; true si ya no vive. */
  terminar?: (pid: number) => Promise<boolean>;
  vivo?: VivoFn;
  dormir?: (ms: number) => Promise<void>;
  dir?: string;
}

const ARGS_SERVICIO = new Set(['--segundo-plano', '--primer-plano']);
export const ARG_NO_CERRAR = '--no-cerrar-otras';
export const ENV_NO_CERRAR = 'CAPRICHOS_NO_CERRAR_OTRAS';

/** ¿Hay que dejar tranquilas a las otras copias? (`--no-cerrar-otras` o variable de entorno). */
export const noCerrarOtras = (argv = process.argv, env = process.env) =>
  argv.slice(2).includes(ARG_NO_CERRAR) || ['1', 'true', 'si', 'sí'].includes((env[ENV_NO_CERRAR] ?? '').toLowerCase());

/** Servicio = doble clic / segundo plano / primer plano. `--estado`, `--copias`, `--version`... no son copias. Sin datos de args cuenta como copia. */
export function esCopiaServicio(args?: string[]): boolean {
  if (!args) return true;
  const a = args.filter((x) => x !== ARG_NO_CERRAR);
  return a.length === 0 || ARGS_SERVICIO.has(a[0].toLowerCase());
}

/** `"C:\ruta con espacios\a.exe" --segundo-plano` → ['--segundo-plano']. */
export function argsDeLinea(linea?: string): string[] | undefined {
  if (linea === undefined || !linea.trim()) return undefined;
  const t = linea.trim();
  const resto = t.startsWith('"') ? t.slice(t.indexOf('"', 1) + 1) : t.replace(/^\S+/, '');
  return resto.split(/\s+/).filter(Boolean);
}

const base = (p: string, plataforma: NodeJS.Platform) => (plataforma === 'win32' ? p.split(/[\\/]/).pop()!.toLowerCase() : path.basename(p));

export function parsearPowerShell(txt: string): CopiaCruda[] {
  const r: CopiaCruda[] = [];
  for (const l of txt.split(/\r?\n/)) {
    const m = /^\s*(\d+)\|([^|]*)\|([^|]*)\|(.*)$/.exec(l);
    if (!m) continue;
    const t = Date.parse(m[2]);
    r.push({ pid: Number(m[1]), inicioMs: isNaN(t) ? undefined : t, ruta: m[3].trim() || undefined, args: argsDeLinea(m[4]) });
  }
  return r;
}

/** `20261111102030.123456-300` (hora local con desfase en minutos) → ms. */
function fechaWmic(s: string): number | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.\d+([+-]\d+)$/.exec(s.trim());
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - Number(m[7]) * 60000 : undefined;
}

export function parsearWmic(txt: string): CopiaCruda[] {
  const r: CopiaCruda[] = [];
  for (const l of txt.split(/\r?\n/)) {
    if (!l.trim() || /^Node,/i.test(l.trim())) continue;
    const f = l.trim().split(',');
    // Nodo, CommandLine (puede llevar comas), CreationDate, ExecutablePath, ProcessId
    if (f.length < 5 || !/^\d+$/.test(f[f.length - 1])) continue;
    r.push({ pid: Number(f[f.length - 1]), ruta: f[f.length - 2].trim() || undefined, inicioMs: fechaWmic(f[f.length - 3]), args: argsDeLinea(f.slice(1, -3).join(',')) });
  }
  return r;
}

export function parsearTasklist(txt: string): CopiaCruda[] {
  const r: CopiaCruda[] = [];
  for (const l of txt.split(/\r?\n/)) {
    const m = /^"[^"]*","(\d+)"/.exec(l.trim());
    if (m) r.push({ pid: Number(m[1]) });
  }
  return r;
}

const scriptPs = (nombre: string) =>
  `Get-CimInstance Win32_Process -Filter "Name='${nombre.replace(/'/g, "''")}'" | ForEach-Object { "$($_.ProcessId)|$($_.CreationDate.ToString('o'))|$($_.ExecutablePath)|$($_.CommandLine)" }`;

const ejecutarReal = (cmd: string, args: string[]) =>
  new Promise<string>((resolve, reject) =>
    execFile(cmd, args, { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (err, out) => (err ? reject(err) : resolve(String(out)))),
  );

const procLinuxReal = (): ProcLinux[] => {
  const r: ProcLinux[] = [];
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const exe = fs.readlinkSync(`/proc/${d}/exe`).replace(/ \(deleted\)$/, '');
      const args = fs.readFileSync(`/proc/${d}/cmdline`, 'utf-8').split('\0').filter(Boolean).slice(1);
      r.push({ pid: Number(d), exe, args, inicioMs: fs.statSync(`/proc/${d}`).ctimeMs });
    } catch {
      /* de otro usuario o ya terminó */
    }
  }
  return r;
};

/** Todas las copias de servicio con el mismo nombre de ejecutable, INCLUIDA esta. Lanza si no se pudo consultar. */
async function listarTodas(d: DepsCopias): Promise<{ todas: CopiaCruda[]; yo: NonNullable<DepsCopias['yo']> }> {
  const plataforma = d.plataforma ?? process.platform;
  const yo = d.yo ?? { pid: process.pid, ppid: process.ppid, exe: ejecutablePropio() };
  if (!yo.exe) return { todas: [], yo };
  const nombre = base(yo.exe, plataforma);
  let crudas: CopiaCruda[] = [];
  if (plataforma === 'win32') {
    const ejecutar = d.ejecutar ?? ejecutarReal;
    const intentos = [
      async () => parsearPowerShell(await ejecutar('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(scriptPs(nombre), 'utf16le').toString('base64')])),
      async () => parsearWmic(await ejecutar('wmic', ['process', 'where', `name='${nombre}'`, 'get', 'CommandLine,CreationDate,ExecutablePath,ProcessId', '/format:csv'])),
      async () => parsearTasklist(await ejecutar('tasklist', ['/FI', `IMAGENAME eq ${nombre}`, '/FO', 'CSV', '/NH'])),
    ];
    let ok = false;
    for (const i of intentos) {
      try {
        crudas = await i();
        if (crudas.length) { ok = true; break; } // esta copia siempre aparece: lista vacía = la herramienta no sirvió
      } catch { /* siguiente herramienta */ }
    }
    if (!ok) throw new Error('No se pudo consultar la lista de programas del equipo (PowerShell, wmic y tasklist fallaron).');
  } else {
    crudas = (d.procLinux ?? procLinuxReal)()
      .filter((p) => base(p.exe, plataforma) === nombre)
      .map((p) => ({ pid: p.pid, ruta: p.exe, args: p.args, inicioMs: p.inicioMs }));
  }
  return { todas: crudas.filter((c) => esCopiaServicio(c.args)), yo };
}

function versionDelBloqueo(dir: string): { pid?: number; version?: string } {
  try {
    const j = JSON.parse(fs.readFileSync(rutaBloqueo(dir), 'utf-8'));
    return { pid: Number(j.pid), version: typeof j.version === 'string' ? j.version : undefined };
  } catch {
    return {};
  }
}

/** Las OTRAS copias corriendo (sin esta ni el lanzador que la abrió). */
export async function listarCopias(d: DepsCopias = {}): Promise<CopiaPrograma[]> {
  const { todas, yo } = await listarTodas(d);
  const lock = versionDelBloqueo(d.dir ?? dirDatos());
  return todas
    .filter((c) => c.pid !== yo.pid && c.pid !== yo.ppid)
    .map(({ args: _a, ...c }) => ({ ...c, version: c.pid === lock.pid ? lock.version : undefined }));
}

export function describirCopias(copias: CopiaPrograma[], nombreExe = 'el programa'): string[] {
  if (!copias.length) return ['No hay otras copias del programa corriendo.'];
  const l = [`Hay ${copias.length} ${copias.length === 1 ? 'copia' : 'copias'} del programa corriendo (sin contar esta ventana):`];
  for (const c of copias) {
    l.push(`  - pid ${c.pid} · ${c.version ? `versión ${c.version}` : 'versión desconocida'}${c.inicioMs ? ` · desde ${new Date(c.inicioMs).toLocaleString('es-PE')}` : ''}${c.ruta ? ` · ${c.ruta}` : ''}`);
  }
  l.push(`Para cerrarlas todas: ${nombreExe} --detener-todo`);
  return l;
}

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Cierra un proceso: Windows taskkill /F (respaldo Stop-Process); Linux SIGTERM y, si no sale en 3 s, SIGKILL. true = ya no vive. */
export async function terminarProceso(pid: number, d: DepsCopias = {}): Promise<boolean> {
  const plataforma = d.plataforma ?? process.platform;
  const vivo = d.vivo ?? procesoVivo;
  const dormir = d.dormir ?? dormirReal;
  const esperar = async (ms: number) => {
    for (let t = 0; t < ms; t += 250) {
      if (!vivo(pid)) return true;
      await dormir(250);
    }
    return !vivo(pid);
  };
  if (plataforma === 'win32') {
    const ejecutar = d.ejecutar ?? ejecutarReal;
    try { await ejecutar('taskkill', ['/PID', String(pid), '/F']); } catch {
      try { await ejecutar('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${pid} -Force`]); } catch { /* sin permiso */ }
    }
    return esperar(3000);
  }
  try { process.kill(pid, 'SIGTERM'); } catch { /* ya no estaba o sin permiso */ }
  if (await esperar(3000)) return true;
  try { process.kill(pid, 'SIGKILL'); } catch { /* sin permiso */ }
  return esperar(2000);
}

export interface ResultadoCierre { cerradas: number[]; fallidas: number[] }

async function cerrarLista(pids: number[], d: DepsCopias): Promise<ResultadoCierre> {
  const r: ResultadoCierre = { cerradas: [], fallidas: [] };
  for (const pid of pids) ((await (d.terminar ?? ((p) => terminarProceso(p, d)))(pid)) ? r.cerradas : r.fallidas).push(pid);
  return r;
}

/**
 * `--detener-todo`: parada ordenada de la copia registrada y cierre del resto; nunca esta copia. Limpia agente.lock y
 * detener.flag huérfanos. Devuelve las líneas a mostrar y el código de salida (1 si alguna no se pudo cerrar).
 */
export async function detenerTodo(d: DepsCopias = {}, nombreExe = 'el programa'): Promise<{ lineas: string[]; codigo: number }> {
  const dir = d.dir ?? dirDatos();
  const vivo = d.vivo ?? procesoVivo;
  const { todas: antes, yo } = await listarTodas(d);
  if (!yo.exe) return { lineas: ['Esta orden solo funciona en el programa instalado (el archivo .exe), no ejecutándolo con node.'], codigo: 1 };
  const otras = antes.filter((c) => c.pid !== yo.pid && c.pid !== yo.ppid);
  const registrada = versionDelBloqueo(dir).pid;
  // La registrada se detiene primero con calma (archivo detener.flag) para que termine el trabajo en curso
  if (registrada && otras.some((c) => c.pid === registrada)) await detenerEnMarcha(dir, { vivo, matar: () => undefined, esperaMs: 10000, dormir: d.dormir });
  const cerradas: number[] = [];
  const fallidas: number[] = [];
  for (const c of otras) {
    if (!vivo(c.pid) && c.pid === registrada) { cerradas.push(c.pid); continue; }
    const r = await cerrarLista([c.pid], d);
    cerradas.push(...r.cerradas);
    fallidas.push(...r.fallidas);
  }
  // Huérfanos: el bloqueo de un proceso que ya no vive y la petición de parada
  const lock = versionDelBloqueo(dir).pid;
  if (!lock || !vivo(lock)) fs.rmSync(rutaBloqueo(dir), { force: true });
  fs.rmSync(rutaParada(dir), { force: true });
  const lineas: string[] = [];
  if (!otras.length) lineas.push('No había otras copias del programa corriendo.');
  if (cerradas.length) lineas.push(`Cerré ${cerradas.length} ${cerradas.length === 1 ? 'copia' : 'copias'}: pid ${cerradas.join(', ')}.`);
  if (fallidas.length) {
    lineas.push(`✘ No pude cerrar ${fallidas.length === 1 ? 'la copia' : 'las copias'} pid ${fallidas.join(', ')}. Puede ser de otro usuario de Windows o necesitar permisos: ciérrala desde esa sesión o abre la ventana de comandos como administrador y repite ${nombreExe} --detener-todo.`);
  }
  return { lineas, codigo: fallidas.length ? 1 : 0 };
}

/**
 * Al arrancar una versión nueva (ya con el bloqueo tomado): cierra las copias que arrancaron ANTES que esta. Si dos arrancan a la
 * vez, la más vieja la cierra la más nueva y nunca al revés (desempata el pid). Nunca lanza: el arranque sigue pase lo que pase.
 */
export async function cerrarCopiasPrevias(log: (m: string) => void, d: DepsCopias = {}): Promise<ResultadoCierre> {
  const vacio: ResultadoCierre = { cerradas: [], fallidas: [] };
  try {
    const { todas, yo } = await listarTodas(d);
    const mia = todas.find((c) => c.pid === yo.pid)?.inicioMs ?? Date.now() - process.uptime() * 1000;
    const previas = todas.filter((c) => c.pid !== yo.pid && c.pid !== yo.ppid && (c.inicioMs === undefined || c.inicioMs < mia || (c.inicioMs === mia && c.pid < yo.pid)));
    if (!previas.length) return vacio;
    const r = await cerrarLista(previas.map((c) => c.pid), d);
    if (r.cerradas.length) log(`Había ${previas.length} ${previas.length === 1 ? 'copia' : 'copias'} del programa; cerré las anteriores (pid ${r.cerradas.join(', ')}).`);
    if (r.fallidas.length) log(`AVISO: no pude cerrar la copia pid ${r.fallidas.join(', ')} (otro usuario o sin permiso). Usa --detener-todo desde esa sesión.`);
    return r;
  } catch (e: any) {
    log(`AVISO: no se pudo revisar si hay otras copias del programa (${e?.message ?? e}).`);
    return vacio;
  }
}
