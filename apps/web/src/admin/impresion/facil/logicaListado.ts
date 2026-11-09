import type { ConfigEquipoImpresion, EquipoEstadoImpresion } from '@caprichos/compartido';
import { configDe } from './logicaEquipo';

/** Normaliza un nombre de computadora para comparar («CAJA-PC » = «caja-pc»). */
const clave = (t: string | null | undefined) => (t ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
/** Qué tan «viva» está una PC: conectada primero, luego el latido más reciente. */
const peso = (e: EquipoEstadoImpresion) => (e.conectado ? 1e15 : 0) + (e.ultimoLatido ? new Date(e.ultimoLatido).getTime() : 0);

export interface EquipoListado {
  equipo: EquipoEstadoImpresion;
  /** Otra PC con la que se confunde (la marca el servidor, o misma computadora e IP aquí). */
  duplicadoDe: { deviceKeyId: string; nombre: string } | null;
}

/**
 * Una tarjeta por máquina: las PC «antiguas» (apagadas con otra más nueva, desactivadas, reemplazadas o archivadas)
 * no se listan (el servidor ya las marca y nunca se borran). Lo que aún pueda ser la misma PC se marca como
 * «posible duplicado» para que la persona lo fusione o diga que no lo es; aquí nunca se esconde en silencio una PC viva.
 */
export function equiposDelListado(equipos: EquipoEstadoImpresion[]): { items: EquipoListado[]; ocultas: number } {
  const vivas = equipos.filter((e) => !e.antigua);
  const items = vivas.map((e): EquipoListado => {
    let dup = e.repetidaDe ?? null;
    if (!dup && clave(e.hostname) && e.ipLocal?.[0]) {
      // solo la menos viva se marca: así la otra queda limpia
      const mejor = vivas.find((o) => o !== e && clave(o.hostname) === clave(e.hostname) && o.ipLocal?.[0] === e.ipLocal![0] && peso(o) > peso(e));
      if (mejor) dup = { deviceKeyId: mejor.deviceKeyId, nombre: mejor.nombre };
    }
    return { equipo: e, duplicadoDe: dup };
  });
  return { items, ocultas: equipos.length - vivas.length };
}

export function contadorEquipos(equipos: Pick<EquipoEstadoImpresion, 'conectado'>[]): string {
  const n = equipos.length;
  const c = equipos.filter((e) => e.conectado).length;
  return `${n} ${n === 1 ? 'computadora' : 'computadoras'} · ${c} ${c === 1 ? 'conectada' : 'conectadas'}`;
}

interface Area {
  id: string;
  nombre: string;
}
const nombres = (ids: string[], areas: Area[]) =>
  ids
    .map((i) => areas.find((a) => a.id === i)?.nombre)
    .filter(Boolean)
    .join(', ');

/** Resumen de lo que hace la PC en chips cortos: «Ticket de pago», «Sticker bebida: Frappes, Iced», «General»... */
export function resumenConfig(cfg: ConfigEquipoImpresion, areas: Area[]): string[] {
  if (!cfg.configurado) return [];
  const out: string[] = [];
  if (cfg.ticketera) {
    if (cfg.ticketPago) out.push('🎫 Ticket de pago');
    if (cfg.comandaSalon) out.push('🎫 Comanda de salón');
    if (cfg.comandaAreas.length) out.push(`🎫 Comandas: ${nombres(cfg.comandaAreas, areas)}`);
    if (!cfg.ticketPago && !cfg.comandaSalon && !cfg.comandaAreas.length) out.push('🎫 Ticketera sin piezas');
  }
  if (cfg.etiquetera) {
    if (cfg.stickerAreas.length) out.push(`🏷️ Sticker de área: ${nombres(cfg.stickerAreas, areas)}`);
    if (cfg.stickerBebidaAreas.length) out.push(`🏷️ Sticker bebida: ${nombres(cfg.stickerBebidaAreas, areas)}`);
    if (cfg.stickerGeneral) out.push('🏷️ General');
    if (!cfg.stickerAreas.length && !cfg.stickerBebidaAreas.length && !cfg.stickerGeneral) out.push('🏷️ Etiquetera sin piezas');
  }
  return out;
}

export const resumenDe = (e: EquipoEstadoImpresion, areas: Area[]) => resumenConfig(configDe(e), areas);

/** Nombres de ejemplo para la vista previa (incluye uno largo para probar cómo se parte). */
export const NOMBRES_EJEMPLO = ['María', 'José', 'Lucía', 'Carlos', 'Valentina', 'Ana Sofía', 'Alejandro Rafael Ramos Nardini', 'Luis Fernando Quispe de la Cruz'];

export function nombreAleatorio(excluir?: string, azar: () => number = Math.random): string {
  const lista = NOMBRES_EJEMPLO.filter((n) => n !== excluir);
  return lista[Math.floor(azar() * lista.length) % lista.length];
}
