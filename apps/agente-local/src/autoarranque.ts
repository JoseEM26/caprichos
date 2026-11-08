import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Arranque automático al iniciar sesión. Windows: una entrada del usuario actual en
 * HKCU\Software\Microsoft\Windows\CurrentVersion\Run. Linux: ~/.config/autostart/*.desktop. Sin administrador, sin servicios;
 * se quita con `--quitar-inicio`. Arranca con `--segundo-plano` (sin ventana).
 * NO se pudo probar en Windows real desde Linux: solo con funciones simuladas (ver README y la guía de operación).
 */
export const CLAVE_RUN = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export const VALOR_RUN = 'CaprichosImpresion';
export const ARG_SEGUNDO_PLANO = '--segundo-plano';
export const NOMBRE_DESKTOP = 'caprichos-impresion.desktop';

export type EjecutarReg = (args: string[]) => Promise<string>;

export interface OpcionesAutoarranque {
  plataforma?: NodeJS.Platform;
  /** Ruta del .exe (solo existe empaquetado); sin ella no se activa para no registrar `node.exe`. */
  ejecutable?: string;
  ejecutar?: EjecutarReg;
  /** Linux: carpeta autostart (por defecto ~/.config/autostart). */
  dirAutostart?: string;
}

const dirAutostartDe = (o: OpcionesAutoarranque) =>
  o.dirAutostart ?? path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '.', '.config'), 'autostart');

export const contenidoDesktop = (exe: string) =>
  `[Desktop Entry]\nType=Application\nName=Caprichos Impresion\nExec="${exe}" ${ARG_SEGUNDO_PLANO}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`;

const soportada = (o: OpcionesAutoarranque) => ['win32', 'linux'].includes(o.plataforma ?? process.platform);

const regReal: EjecutarReg = (args) =>
  new Promise((resolve, reject) =>
    execFile('reg.exe', args, { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || err.message).trim())) : resolve(stdout),
    ),
  );

/** El .exe armado con pkg expone process.pkg; ejecutando con node (desarrollo) no hay nada que registrar. */
export function ejecutablePropio(): string | undefined {
  return (process as any).pkg ? process.execPath : undefined;
}

export async function autoarranqueActivo(o: OpcionesAutoarranque = {}): Promise<boolean> {
  if (!soportada(o)) return false;
  if ((o.plataforma ?? process.platform) === 'linux') return fs.existsSync(path.join(dirAutostartDe(o), NOMBRE_DESKTOP));
  try {
    await (o.ejecutar ?? regReal)(['query', CLAVE_RUN, '/v', VALOR_RUN]);
    return true;
  } catch {
    return false;
  }
}

export async function activarAutoarranque(o: OpcionesAutoarranque = {}): Promise<{ ok: boolean; mensaje: string }> {
  if (!soportada(o)) {
    return { ok: false, mensaje: 'El arranque automático solo está disponible en Windows y Linux.' };
  }
  const exe = o.ejecutable ?? ejecutablePropio();
  if (!exe) {
    return { ok: false, mensaje: 'Solo se puede activar desde el programa instalado (.exe), no ejecutándolo con node.' };
  }
  try {
    if ((o.plataforma ?? process.platform) === 'linux') {
      fs.mkdirSync(dirAutostartDe(o), { recursive: true });
      fs.writeFileSync(path.join(dirAutostartDe(o), NOMBRE_DESKTOP), contenidoDesktop(exe));
      return { ok: true, mensaje: 'Listo: el programa se abrirá solo (sin ventana) cada vez que inicies sesión.' };
    }
    await (o.ejecutar ?? regReal)(['add', CLAVE_RUN, '/v', VALOR_RUN, '/t', 'REG_SZ', '/d', `"${exe}" ${ARG_SEGUNDO_PLANO}`, '/f']);
    return { ok: true, mensaje: 'Listo: el programa se abrirá solo cuando enciendas la computadora e inicies sesión.' };
  } catch (err: any) {
    return { ok: false, mensaje: `No se pudo activar el arranque automático: ${err.message}` };
  }
}

export async function desactivarAutoarranque(o: OpcionesAutoarranque = {}): Promise<{ ok: boolean; mensaje: string }> {
  if (!soportada(o)) {
    return { ok: false, mensaje: 'El arranque automático solo está disponible en Windows y Linux.' };
  }
  try {
    if ((o.plataforma ?? process.platform) === 'linux') {
      fs.rmSync(path.join(dirAutostartDe(o), NOMBRE_DESKTOP), { force: true });
      return { ok: true, mensaje: 'Arranque automático desactivado: el programa ya no se abre solo.' };
    }
    await (o.ejecutar ?? regReal)(['delete', CLAVE_RUN, '/v', VALOR_RUN, '/f']);
    return { ok: true, mensaje: 'Arranque automático desactivado: el programa ya no se abre solo.' };
  } catch (err: any) {
    // Si la entrada no existía, ya está como se pidió
    return (await autoarranqueActivo(o))
      ? { ok: false, mensaje: `No se pudo desactivar el arranque automático: ${err.message}` }
      : { ok: true, mensaje: 'El arranque automático ya estaba desactivado.' };
  }
}
