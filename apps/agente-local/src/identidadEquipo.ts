import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { rutaArchivoConfiguracion } from './config';

/** Id de máquina del sistema (Windows MachineGuid / Linux machine-id) o undefined si no se puede leer sin permisos especiales. */
export function leerIdMaquina(plataforma: string = process.platform): string | undefined {
  try {
    if (plataforma === 'win32') {
      const salida = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], {
        encoding: 'utf-8',
        timeout: 3000,
        windowsHide: true,
      });
      return /MachineGuid\s+REG_SZ\s+(\S+)/i.exec(salida)?.[1];
    }
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      if (fs.existsSync(f)) {
        const v = fs.readFileSync(f, 'utf-8').trim();
        if (v) return v;
      }
    }
  } catch {
    /* sin id de máquina: se usa el UUID guardado */
  }
  return undefined;
}

const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/**
 * Identidad estable de esta PC. Con id de máquina: hash SHA-256 (sobrevive a borrar la configuración o reinstalar el
 * programa). Sin él: un UUID aleatorio que se genera una vez y queda guardado en la configuración local.
 * Nunca se envía el valor crudo del sistema.
 */
export function obtenerEquipoUid(ruta = rutaArchivoConfiguracion(), idMaquina: () => string | undefined = leerIdMaquina): string {
  const id = idMaquina();
  if (id) return `m-${sha(`caprichos-equipo:${id.toLowerCase()}`).slice(0, 40)}`;
  let actual: Record<string, unknown> = {};
  try {
    actual = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch {
    /* aún no existe */
  }
  if (typeof actual.equipoUid === 'string' && actual.equipoUid) return actual.equipoUid;
  const uid = `u-${crypto.randomUUID()}`;
  try {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify({ ...actual, equipoUid: uid }, null, 2), { mode: 0o600 });
  } catch {
    /* sin poder guardar: este arranque usa el UUID y el próximo generará otro */
  }
  return uid;
}

let cache: string | undefined;
/** Igual que obtenerEquipoUid pero calculado una sola vez por ejecución. */
export function equipoUidEstable(): string {
  return (cache ??= obtenerEquipoUid());
}
