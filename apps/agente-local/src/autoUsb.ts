import type { RolImpresora } from '@caprichos/compartido';
import { ES_TICKETERA_LOCAL } from './candidatas';
import type { CandidataLocal } from './candidatas';
import { esDestinoRed } from './impresora/impresoraRed';

export const NOMBRE_ROL_AUTO: Record<RolImpresora, string> = { ETIQUETERA: 'etiquetera', TICKETERA: 'ticketera' };

const sinConexion = (c: CandidataLocal) => /offline|sin conexi/i.test(c.estadoSpooler ?? '');

/**
 * ¿Sirve para ese rol sin que nadie la configure? Ticketera: de tickets y por USB (o la POS-80 de la casa).
 * Etiquetera: de etiquetas y por USB. Las virtuales ya vienen filtradas (filtrarImpresorasWindows).
 */
export function esAutomatica(c: CandidataLocal, rol: RolImpresora): boolean {
  if (c.sugerido !== rol) return false;
  if (rol === 'ETIQUETERA') return !!c.usb;
  return !!c.usb || ES_TICKETERA_LOCAL.test(`${c.nombre} ${c.driver ?? ''}`);
}

/** La primera que sirve (orden estable de la lista; las que Windows marca sin conexión, al final). */
export function elegirAutomatica(candidatas: CandidataLocal[], rol: RolImpresora, ocupadas: string[] = []): CandidataLocal | undefined {
  const validas = candidatas.filter((c) => esAutomatica(c, rol) && !ocupadas.includes(c.id));
  return [...validas].sort((a, b) => Number(sinConexion(a)) - Number(sinConexion(b)))[0];
}

export interface DecisionAutomatica {
  rol: RolImpresora;
  candidata: CandidataLocal;
  /** Otras del mismo rol que también servían (la elegida es la primera). */
  otras: string[];
  reemplaza?: string;
}

/**
 * Qué conectar solo: cada rol sin impresora guardada (o cuya guardada ya no aparece) toma la primera USB que sirve.
 * Una guardada válida (en la lista, o de red) se respeta. Con la lista vacía no se toca nada (puede ser un fallo al leerla).
 */
export function decidirAutomatica(candidatas: CandidataLocal[], idActual: (rol: RolImpresora) => string | undefined): DecisionAutomatica[] {
  if (candidatas.length === 0) return [];
  const out: DecisionAutomatica[] = [];
  const roles: RolImpresora[] = ['TICKETERA', 'ETIQUETERA'];
  for (const rol of roles) {
    const id = idActual(rol);
    if (id && (esDestinoRed(id) || candidatas.some((c) => c.id === id))) continue;
    const otro = roles.find((r) => r !== rol)!;
    const ocupadas = [idActual(otro), ...out.filter((d) => d.rol === otro).map((d) => d.candidata.id)].filter(Boolean) as string[];
    const c = elegirAutomatica(candidatas, rol, ocupadas);
    if (!c) continue;
    const otras = candidatas.filter((x) => x.id !== c.id && esAutomatica(x, rol) && !ocupadas.includes(x.id)).map((x) => x.nombre);
    out.push({ rol, candidata: c, otras, ...(id ? { reemplaza: id } : {}) });
  }
  return out;
}

/** Mensaje simple para la consola. */
export function mensajeConexion(d: DecisionAutomatica): string {
  const por = d.candidata.usb && d.candidata.puerto ? ` por ${d.candidata.puerto}` : '';
  const aviso = d.otras.length ? ` (había más: ${d.otras.join(', ')}; elegí la primera)` : '';
  const antes = d.reemplaza ? ` (la guardada "${d.reemplaza}" ya no aparece)` : '';
  return `Conecté la ${NOMBRE_ROL_AUTO[d.rol]} ${d.candidata.nombre}${por}${antes}${aviso}`;
}

/** Texto del comando `diagnostico`: impresoras, puerto, driver, estado y qué elegiría el programa. */
export function lineasDiagnostico(candidatas: CandidataLocal[], idActual: (rol: RolImpresora) => string | undefined): string[] {
  const l: string[] = [];
  if (!candidatas.length) l.push('No veo ninguna impresora real instalada (las virtuales PDF/OneNote/XPS no cuentan). Revisa el cable USB y el driver.');
  candidatas.forEach((c, i) => {
    const tipo = c.sugerido === 'TICKETERA' ? 'tickets' : c.sugerido === 'ETIQUETERA' ? 'etiquetas' : 'tipo desconocido';
    l.push(`${i + 1}) ${c.nombre}`);
    l.push(`     tipo: ${tipo} | conexión: ${c.usb ? 'USB' : 'no USB'} | puerto: ${c.puerto ?? '-'} | driver: ${c.driver ?? '-'} | estado: ${c.estadoSpooler ?? '-'}`);
    if (c.usb && !c.puerto) l.push('     AVISO: no tiene puerto asignado; en Windows revisa Propiedades > Puertos.');
    if (sinConexion(c)) l.push('     AVISO: Windows la ve sin conexión (apagada, cable flojo o «Usar impresora sin conexión»): por eso «imprime pero no sale».');
  });
  for (const rol of ['TICKETERA', 'ETIQUETERA'] as RolImpresora[]) {
    const guardada = idActual(rol);
    const elegida = elegirAutomatica(candidatas, rol);
    const nombre = NOMBRE_ROL_AUTO[rol];
    if (guardada && (esDestinoRed(guardada) || candidatas.some((c) => c.id === guardada))) l.push(`${nombre}: ya hay una guardada (${guardada}); se respeta.`);
    else if (elegida) l.push(`${nombre}: elegiría ${elegida.nombre}${elegida.puerto ? ` (${elegida.puerto})` : ''}${guardada ? `; la guardada "${guardada}" no aparece` : ''}.`);
    else l.push(`${nombre}: no hay ninguna USB que sirva; el programa seguirá buscando cada 30 segundos.`);
  }
  return l;
}
