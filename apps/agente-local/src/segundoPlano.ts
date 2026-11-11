import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { LINEA_VERSION, VERSION_NUMERO, rutaArchivoConfiguracion } from './config';

/**
 * Ciclo de vida como proceso de segundo plano: instancia única (archivo de bloqueo con el pid),
 * archivo de estado para `--estado`, petición de parada por archivo (portable: en Windows un proceso sin
 * ventana no recibe SIGTERM) y relanzamiento oculto. Todo recibe `dir` para poder probarse sin tocar el equipo real.
 */
export const dirDatos = (env: NodeJS.ProcessEnv = process.env): string => path.dirname(rutaArchivoConfiguracion(env));
const f = (dir: string, n: string) => path.join(dir, n);
export const rutaBloqueo = (dir = dirDatos()) => f(dir, 'agente.lock');
export const rutaEstado = (dir = dirDatos()) => f(dir, 'estado.json');
export const rutaParada = (dir = dirDatos()) => f(dir, 'detener.flag');
/** Marca de que el inicio automático ya se instaló una vez: así `--quitar-inicio` no se deshace solo en la próxima ejecución. */
export const rutaMarcaInicio = (dir = dirDatos()) => f(dir, 'inicio-configurado');

/** N de «0.1.N»; 0 para una compilación de desarrollo o un texto raro. */
export const numeroVersion = (v?: string): number => Number(/^\d+\.\d+\.(\d+)/.exec(v ?? '')?.[1] ?? 0);

export type VivoFn = (pid: number) => boolean;
export const procesoVivo: VivoFn = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    return e?.code === 'EPERM'; // existe pero es de otro usuario
  }
};

export function pidEnMarcha(dir = dirDatos(), vivo: VivoFn = procesoVivo): number | undefined {
  try {
    const pid = Number(JSON.parse(fs.readFileSync(rutaBloqueo(dir), 'utf-8')).pid);
    return pid && vivo(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

/** Toma el bloqueo (creación exclusiva). false = ya hay otra instancia viva. Un bloqueo de un proceso muerto se reemplaza. */
// ponytail: un pid reutilizado por otro programa tras un apagón bloquearía el arranque; si pasa, usar --detener o borrar agente.lock
export function tomarBloqueo(dir = dirDatos(), pid = process.pid, vivo: VivoFn = procesoVivo): boolean {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 2; i++) {
    try {
      fs.writeFileSync(rutaBloqueo(dir), JSON.stringify({ pid, inicio: new Date().toISOString(), version: VERSION_NUMERO }), { flag: 'wx' });
      fs.rmSync(rutaParada(dir), { force: true });
      return true;
    } catch (e: any) {
      if (e?.code !== 'EEXIST') throw e;
      if (pidEnMarcha(dir, vivo)) return false;
      fs.rmSync(rutaBloqueo(dir), { force: true });
    }
  }
  return false;
}

/** Versión escrita en el bloqueo por la copia en marcha (las versiones viejas no la escribían). */
export function versionEnMarcha(dir = dirDatos()): string | undefined {
  try {
    const v = JSON.parse(fs.readFileSync(rutaBloqueo(dir), 'utf-8')).version;
    return typeof v === 'string' ? v : undefined;
  } catch {
    return undefined;
  }
}

/** La copia en marcha es de una versión anterior (o muy vieja, sin versión) y esta puede reemplazarla. Misma versión o más nueva: se respeta. */
export function reemplazable(dir = dirDatos(), vivo: VivoFn = procesoVivo, miVersion = VERSION_NUMERO): boolean {
  return Boolean(pidEnMarcha(dir, vivo)) && numeroVersion(versionEnMarcha(dir)) < numeroVersion(miVersion);
}

export function soltarBloqueo(dir = dirDatos(), pid = process.pid): void {
  try {
    if (Number(JSON.parse(fs.readFileSync(rutaBloqueo(dir), 'utf-8')).pid) === pid) fs.rmSync(rutaBloqueo(dir), { force: true });
  } catch {
    /* ya no estaba */
  }
}

export interface EstadoLocal {
  pid: number;
  inicio: string;
  actualizado: string;
  ultimaConexionOk?: string;
  ultimoError?: string;
  necesitaVincular?: boolean;
  roles?: { rol: string; estado: string; detalle?: string }[];
}

export function guardarEstado(e: Omit<EstadoLocal, 'actualizado'>, dir = dirDatos()): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(rutaEstado(dir), JSON.stringify({ ...e, actualizado: new Date().toISOString() }, null, 2));
}

export function leerEstado(dir = dirDatos()): EstadoLocal | undefined {
  try {
    return JSON.parse(fs.readFileSync(rutaEstado(dir), 'utf-8'));
  } catch {
    return undefined;
  }
}

/** Texto de `--estado`. */
export function describirEstado(dir = dirDatos(), vivo: VivoFn = procesoVivo): string {
  const pid = pidEnMarcha(dir, vivo);
  const e = leerEstado(dir);
  if (!pid) return 'El programa de impresión NO está corriendo. Ábrelo de nuevo (doble clic) o reinicia la PC.';
  const l = [LINEA_VERSION, `El programa de impresión está corriendo en segundo plano (pid ${pid}).`];
  if (e?.necesitaVincular) l.push('ATENCIÓN: este equipo necesita vincularse de nuevo (la llave ya no vale). Descarga el programa otra vez desde Caprichos › Configuración › Impresión.');
  l.push(e?.ultimaConexionOk ? `Última conexión con Caprichos: ${e.ultimaConexionOk}` : 'Aún no se conectó con Caprichos desde que arrancó.');
  if (e?.ultimoError && !e.necesitaVincular) l.push(`Último problema: ${e.ultimoError}`);
  for (const r of e?.roles ?? []) l.push(`  ${r.rol === 'TICKETERA' ? 'Ticketera' : 'Etiquetera'}: ${r.estado}${r.detalle ? ` (${r.detalle})` : ''}`);
  return l.join('\n');
}

/** Pide parar al programa en marcha: primero con el archivo (cierre ordenado), y si no responde en `esperaMs`, a la fuerza. */
export async function detenerEnMarcha(
  dir = dirDatos(),
  o: { vivo?: VivoFn; matar?: (pid: number) => void; esperaMs?: number; dormir?: (ms: number) => Promise<void> } = {},
): Promise<'no-corria' | 'ordenado' | 'forzado'> {
  const vivo = o.vivo ?? procesoVivo;
  const pid = pidEnMarcha(dir, vivo);
  if (!pid) return 'no-corria';
  fs.writeFileSync(rutaParada(dir), String(Date.now()));
  const dormir = o.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const limite = o.esperaMs ?? 10000;
  for (let t = 0; t < limite; t += 250) {
    if (!vivo(pid)) return 'ordenado';
    await dormir(250);
  }
  (o.matar ?? ((p) => process.kill(p)))(pid);
  fs.rmSync(rutaBloqueo(dir), { force: true });
  return 'forzado';
}

/** Vigila el archivo de parada (lo escribe `--detener`) cada segundo. Devuelve la función que lo apaga. */
export function vigilarParada(alPedir: () => void, dir = dirDatos(), cadaMs = 1000): () => void {
  const t = setInterval(() => {
    if (fs.existsSync(rutaParada(dir))) alPedir();
  }, cadaMs);
  t.unref();
  return () => clearInterval(t);
}

/** Relanza este mismo programa sin ventana y desacoplado de la consola que lo abrió. */
export function relanzarOculto(args: string[], lanzar: typeof spawn = spawn): void {
  const empaquetado = Boolean((process as any).pkg);
  // Con pkg el .exe ya sabe cuál es su script; con node (desarrollo) hay que pasarlo
  const hijo = lanzar(process.execPath, [...(empaquetado ? [] : [process.argv[1]]), ...args], {
    detached: true,
    stdio: 'ignore',
    // pkg: si PKG_EXECPATH no está definido, pkg arranca el hijo como «node script»; con cualquier valor distinto arranca el programa normal
    env: { ...process.env, PKG_EXECPATH: 'caprichos-segundo-plano' },
    windowsHide: true,
  });
  hijo.unref();
}
