import { execFile } from 'child_process';

/**
 * Arranque automático al iniciar sesión en Windows: una entrada del usuario actual en
 * HKCU\Software\Microsoft\Windows\CurrentVersion\Run. Sin administrador, sin servicios; se quita con `autoarranque desactivar`.
 * NO se pudo probar en Windows real desde Linux: solo con funciones simuladas (ver README y la guía de operación).
 */
export const CLAVE_RUN = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export const VALOR_RUN = 'CaprichosImpresion';

export type EjecutarReg = (args: string[]) => Promise<string>;

export interface OpcionesAutoarranque {
  plataforma?: NodeJS.Platform;
  /** Ruta del .exe (solo existe empaquetado); sin ella no se activa para no registrar `node.exe`. */
  ejecutable?: string;
  ejecutar?: EjecutarReg;
}

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
  if ((o.plataforma ?? process.platform) !== 'win32') return false;
  try {
    await (o.ejecutar ?? regReal)(['query', CLAVE_RUN, '/v', VALOR_RUN]);
    return true;
  } catch {
    return false;
  }
}

export async function activarAutoarranque(o: OpcionesAutoarranque = {}): Promise<{ ok: boolean; mensaje: string }> {
  if ((o.plataforma ?? process.platform) !== 'win32') {
    return { ok: false, mensaje: 'El arranque automático solo está disponible en Windows.' };
  }
  const exe = o.ejecutable ?? ejecutablePropio();
  if (!exe) {
    return { ok: false, mensaje: 'Solo se puede activar desde el programa instalado (.exe), no ejecutándolo con node.' };
  }
  try {
    await (o.ejecutar ?? regReal)(['add', CLAVE_RUN, '/v', VALOR_RUN, '/t', 'REG_SZ', '/d', `"${exe}"`, '/f']);
    return { ok: true, mensaje: 'Listo: el programa se abrirá solo cuando enciendas la computadora e inicies sesión.' };
  } catch (err: any) {
    return { ok: false, mensaje: `No se pudo activar el arranque automático: ${err.message}` };
  }
}

export async function desactivarAutoarranque(o: OpcionesAutoarranque = {}): Promise<{ ok: boolean; mensaje: string }> {
  if ((o.plataforma ?? process.platform) !== 'win32') {
    return { ok: false, mensaje: 'El arranque automático solo está disponible en Windows.' };
  }
  try {
    await (o.ejecutar ?? regReal)(['delete', CLAVE_RUN, '/v', VALOR_RUN, '/f']);
    return { ok: true, mensaje: 'Arranque automático desactivado: el programa ya no se abre solo.' };
  } catch (err: any) {
    // Si la entrada no existía, ya está como se pidió
    return (await autoarranqueActivo(o))
      ? { ok: false, mensaje: `No se pudo desactivar el arranque automático: ${err.message}` }
      : { ok: true, mensaje: 'El arranque automático ya estaba desactivado.' };
  }
}
