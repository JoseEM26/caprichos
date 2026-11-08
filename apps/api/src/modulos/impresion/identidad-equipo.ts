import { agenteConectado } from './estado-impresion';

/**
 * Identidad de una PC de impresión. Orden de confianza:
 *  1) equipoUid que informa el programa nuevo (hash de id de máquina o UUID guardado);
 *  2) programas viejos: hostname + sistema (sin mayúsculas; del sistema solo la familia, porque la versión cambia con
 *     las actualizaciones), con la IP local compartida como pista de desempate. La IP sola nunca basta (DHCP).
 */

export interface FilaEquipo {
  id: bigint;
  nombre?: string;
  activo: boolean;
  ultimo_latido: Date | null;
  equipo_uid: string | null;
  latido_hostname: string | null;
  latido_sistema: string | null;
  latido_ip_local: string | null;
  distinta_confirmada?: boolean;
  archivada_en?: Date | null;
  reemplazada_por?: bigint | null;
  configImpresion?: { configurado: boolean } | null;
}

export interface IdentidadEquipo {
  uid?: string | null;
  hostname?: string | null;
  sistema?: string | null;
  ipLocal?: string[] | null;
}

export const claveHost = (hostname?: string | null, sistema?: string | null): string | null => {
  const h = (hostname ?? '').trim().toLowerCase();
  const s = (sistema ?? '').trim().toLowerCase().split(/\s+/)[0];
  return h && s ? `${h}|${s}` : null;
};

const ipsDe = (f: { latido_ip_local: string | null }) => (f.latido_ip_local ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const comparteIp = (a: string[], b: string[]) => a.some((x) => b.includes(x));
const t = (f: FilaEquipo) => (f.ultimo_latido ? new Date(f.ultimo_latido).getTime() : 0);
/** La más reciente: activas primero, luego el último latido. */
const masReciente = (l: FilaEquipo[]) => [...l].sort((a, b) => Number(b.activo) - Number(a.activo) || t(b) - t(a))[0];

export interface Reconocimiento {
  /** PC conocida de la que se hereda la configuración (undefined = PC realmente nueva o caso ambiguo). */
  base?: FilaEquipo;
  /** Otras llaves de la misma PC que también quedan reemplazadas. */
  otros: FilaEquipo[];
  /** Hay candidatas pero no se puede saber cuál: no se fusiona nada, decide el humano. */
  ambiguo: boolean;
  por?: 'uid' | 'hostname';
}

/** Decide si la PC que acaba de vincularse ya era conocida. `candidatas`: llaves anteriores (con latido, no reemplazadas). */
export function reconocerEquipo(nueva: IdentidadEquipo, candidatas: FilaEquipo[], ahora = Date.now()): Reconocimiento {
  if (nueva.uid) {
    const m = candidatas.filter((c) => c.equipo_uid === nueva.uid);
    if (m.length) {
      const base = masReciente(m);
      return { base, otros: m.filter((c) => c !== base), ambiguo: false, por: 'uid' };
    }
  }
  const clave = claveHost(nueva.hostname, nueva.sistema);
  if (!clave) return { otros: [], ambiguo: false };
  let m = candidatas.filter(
    (c) => !c.distinta_confirmada && claveHost(c.latido_hostname, c.latido_sistema) === clave && !(nueva.uid && c.equipo_uid && c.equipo_uid !== nueva.uid),
  );
  if (!m.length) return { otros: [], ambiguo: false };
  const ips = nueva.ipLocal ?? [];
  const vivos = m.filter((c) => c.activo && agenteConectado(c.ultimo_latido, ahora));
  if (vivos.length) {
    // Otra PC con ese nombre está encendida ahora: solo es la misma si comparte IP y es una sola
    const mismos = vivos.filter((c) => comparteIp(ips, ipsDe(c)));
    if (mismos.length !== 1) {
      // No se sabe cuál es: se reutiliza la más reciente CON configuración (sin desactivar a ninguna) y se marca para que decida el humano
      const conCfg = m.filter((c) => c.configImpresion?.configurado);
      return { base: masReciente(conCfg.length ? conCfg : m), otros: [], ambiguo: true, por: 'hostname' };
    }
    m = [mismos[0], ...m.filter((c) => !vivos.includes(c))];
  } else {
    const conIp = m.filter((c) => comparteIp(ips, ipsDe(c)));
    if (conIp.length) m = conIp;
  }
  const base = masReciente(m);
  return { base, otros: m.filter((c) => c !== base), ambiguo: false, por: 'hostname' };
}

export interface ClasificacionEquipo {
  antigua: boolean;
  /** Otra PC con la que se confunde: el panel pregunta «¿es la misma?». */
  repetidaDe: bigint | null;
}

/** Marca antiguas (apagadas y con otra más nueva del mismo nombre, o desactivadas) y posibles repetidas. */
export function clasificarEquipos(filas: FilaEquipo[], ahora = Date.now()): Map<bigint, ClasificacionEquipo> {
  const out = new Map<bigint, ClasificacionEquipo>();
  const vivas = filas.filter((f) => !f.archivada_en);
  const grupos = new Map<string, FilaEquipo[]>();
  for (const f of vivas) {
    const k = f.distinta_confirmada ? null : claveHost(f.latido_hostname, f.latido_sistema);
    if (k) grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  for (const f of vivas) {
    const conectada = f.activo && agenteConectado(f.ultimo_latido, ahora);
    const k = f.distinta_confirmada ? null : claveHost(f.latido_hostname, f.latido_sistema);
    const grupo = k ? grupos.get(k)! : [f];
    const masNueva = grupo.some((o) => o !== f && t(o) > t(f));
    const antigua = !conectada && (!f.activo || masNueva);
    let repetidaDe: bigint | null = null;
    if (!antigua && grupo.length > 1) {
      const vivasOtras = grupo.filter((o) => o !== f && o.activo && agenteConectado(o.ultimo_latido, ahora));
      if (conectada && vivasOtras.length) repetidaDe = vivasOtras[0].id;
      else if (!f.configImpresion?.configurado) {
        // La más nueva sin configurar, con una anterior ya configurada: seguramente es la misma PC
        const previa = grupo.filter((o) => o !== f && t(o) < t(f) && o.configImpresion?.configurado);
        if (previa.length) repetidaDe = masReciente(previa).id;
      }
    }
    out.set(f.id, { antigua, repetidaDe });
  }
  return out;
}
