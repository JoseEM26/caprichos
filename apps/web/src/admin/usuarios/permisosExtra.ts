import { api } from '../../comun/api';

export interface AccionPermiso {
  clave: string;
  accion: string;
  nombre: string;
  sensible: boolean;
  porRol: boolean;
  extra: boolean;
}
export interface ModuloPermisos {
  modulo: string;
  nombre: string;
  acciones: AccionPermiso[];
}
export interface PermisoExtraVigente {
  clave: string;
  modulo: string;
  accion: string;
  venceEn: string | null;
  nota: string | null;
}
export interface RespuestaPermisos {
  rol: string;
  roles: string[];
  bloqueado: string | null;
  extras: PermisoExtraVigente[];
  efectivos: string[];
  modulos: ModuloPermisos[];
}
/** Lo que se elige por módulo: qué claves son extra, hasta cuándo (AAAA-MM-DD) y la nota. */
export interface EleccionModulo {
  claves: string[];
  hasta: string;
  nota: string;
}
export type Elecciones = Record<string, EleccionModulo>;

export const obtenerPermisos = (usuarioId: string) =>
  api.get<RespuestaPermisos>(`/admin/usuarios/${usuarioId}/permisos`);

export const guardarPermisosExtra = (
  usuarioId: string,
  permisos: Array<{ modulo: string; accion: string; venceEn: string | null; nota: string | null }>,
  confirmacionFuerte = false,
) => api.put(`/admin/usuarios/${usuarioId}/permisos-extra`, { permisos, confirmacionFuerte });

/** Fecha de Lima (AAAA-MM-DD) de un instante ISO. */
export const fechaLimaInput = (iso: string): string =>
  new Date(new Date(iso).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);

/** «Hasta» como instante: fin del día en Lima. */
export const hastaAIso = (fecha: string): string => `${fecha}T23:59:00-05:00`;

/** Elecciones iniciales a partir de lo que ya tiene la persona. */
export function eleccionesDe(r: RespuestaPermisos): Elecciones {
  const e: Elecciones = {};
  for (const x of r.extras) {
    const m = (e[x.modulo] ??= { claves: [], hasta: x.venceEn ? fechaLimaInput(x.venceEn) : '', nota: x.nota ?? '' });
    m.claves.push(x.clave);
  }
  return e;
}

/** Cada permiso a enviar: vencimiento y nota son de su módulo. */
export function permisosAEnviar(e: Elecciones) {
  return Object.entries(e).flatMap(([modulo, m]) =>
    m.claves.map((c) => ({ modulo, accion: c.split('/')[1], venceEn: m.hasta ? hastaAIso(m.hasta) : null, nota: m.nota.trim() || null })),
  );
}

/** Texto llano de los cambios entre lo guardado y lo elegido. */
export function resumenCambios(r: RespuestaPermisos, e: Elecciones): string[] {
  const nombre = (c: string) => {
    const m = r.modulos.find((x) => x.modulo === c.split('/')[0]);
    return `${m?.nombre ?? c.split('/')[0]}: ${m?.acciones.find((a) => a.clave === c)?.nombre ?? c.split('/')[1]}`;
  };
  const antes = eleccionesDe(r);
  const ant = new Set(Object.values(antes).flatMap((m) => m.claves));
  const ahora = new Set(Object.values(e).flatMap((m) => m.claves));
  const lineas: string[] = [];
  for (const c of ahora) if (!ant.has(c)) lineas.push(`Se agrega: ${nombre(c)}`);
  for (const c of ant) if (!ahora.has(c)) lineas.push(`Se quita: ${nombre(c)}`);
  for (const [mod, m] of Object.entries(e)) {
    const a = antes[mod];
    if (a && m.claves.some((c) => ant.has(c)) && (a.hasta !== m.hasta || a.nota !== m.nota)) {
      lineas.push(`Cambia el vencimiento o la nota de ${r.modulos.find((x) => x.modulo === mod)?.nombre ?? mod}`);
    }
  }
  return lineas;
}
