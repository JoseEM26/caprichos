import { BadRequestException } from '@nestjs/common';
import {
  ConfigEquipoImpresion,
  ReglasImpresion,
  RolImpresora,
  esAreaBebidas,
  tamanoPcValido,
} from '@caprichos/compartido';
import { CONFIG_EQUIPO_NUEVO } from './ruteo-impresion';

export interface AreaSimple {
  id: bigint;
  nombre: string;
}

/** Fila de equipo_impresion_config → configuración (lo que falte o venga mal queda apagado). */
export function filaAConfig(f: any | null | undefined): ConfigEquipoImpresion {
  if (!f) return { ...CONFIG_EQUIPO_NUEVO };
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const t = (f.tamanos ?? {}) as Record<string, unknown>;
  return {
    ticketera: !!f.ticketera,
    etiquetera: !!f.etiquetera,
    ticketPago: !!f.ticket_pago,
    comandaSalon: !!f.comanda_salon,
    comandaAreas: ids(f.comanda_areas),
    stickerGeneral: !!f.sticker_general,
    stickerAreas: ids(f.sticker_areas),
    stickerBebidaAreas: ids(f.sticker_bebida_areas),
    // Sin migración: la lista de categorías vive en el JSON `tamanos` (ausente = todas)
    stickerBebidaCategorias: Array.isArray(t.bebidaCategorias) ? t.bebidaCategorias.map(String) : null,
    tamanoGeneral: tamanoPcValido(t.general),
    tamanoBebida: tamanoPcValido(t.bebida),
    pausado: !!f.pausado,
    configurado: !!f.configurado,
  };
}

/** Configuración → columnas de la fila. */
export function configAFila(c: ConfigEquipoImpresion) {
  return {
    configurado: c.configurado,
    pausado: c.pausado,
    ticketera: c.ticketera,
    etiquetera: c.etiquetera,
    ticket_pago: c.ticketPago,
    comanda_salon: c.comandaSalon,
    comanda_areas: c.comandaAreas as any,
    sticker_general: c.stickerGeneral,
    sticker_areas: c.stickerAreas as any,
    sticker_bebida_areas: c.stickerBebidaAreas as any,
    tamanos: { general: c.tamanoGeneral ?? null, bebida: c.tamanoBebida ?? null, bebidaCategorias: c.stickerBebidaCategorias ?? null } as any,
  };
}

const BOOLEANOS = ['ticketera', 'etiquetera', 'ticketPago', 'comandaSalon', 'stickerGeneral', 'pausado'] as const;
const LISTAS = ['comandaAreas', 'stickerAreas', 'stickerBebidaAreas'] as const;

/** Mezcla un cambio parcial sobre la configuración y lo valida (400 con mensaje claro). `configurado` queda en true. */
export function aplicarCambio(
  actual: ConfigEquipoImpresion,
  cambio: Record<string, unknown>,
  areasValidas: Set<string>,
  categoriasValidas?: Set<string>,
): ConfigEquipoImpresion {
  const r: ConfigEquipoImpresion = { ...actual, configurado: true };
  for (const k of BOOLEANOS) {
    if (cambio[k] === undefined) continue;
    if (typeof cambio[k] !== 'boolean') throw new BadRequestException({ codigo: 'VALOR_INVALIDO', mensaje: `${k} debe ser sí o no` });
    r[k] = cambio[k] as boolean;
  }
  for (const k of LISTAS) {
    if (cambio[k] === undefined) continue;
    const v = cambio[k];
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && areasValidas.has(x))) {
      throw new BadRequestException({ codigo: 'AREA_INVALIDA', mensaje: 'Hay un área que no existe o está inactiva' });
    }
    r[k] = [...new Set(v as string[])];
  }
  if (cambio.stickerBebidaCategorias !== undefined) {
    const v = cambio.stickerBebidaCategorias;
    if (v === null) r.stickerBebidaCategorias = null;
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string' && (!categoriasValidas || categoriasValidas.has(x)))) {
      r.stickerBebidaCategorias = [...new Set(v as string[])];
    } else {
      throw new BadRequestException({ codigo: 'CATEGORIA_INVALIDA', mensaje: 'Hay una categoría de bebida que no existe' });
    }
  }
  for (const k of ['tamanoGeneral', 'tamanoBebida'] as const) {
    if (cambio[k] === undefined) continue;
    if (cambio[k] === null) {
      r[k] = null;
      continue;
    }
    const t = tamanoPcValido(cambio[k]);
    if (!t) throw new BadRequestException({ codigo: 'TAMANO_INVALIDO', mensaje: 'El tamaño debe estar entre 30 y 200 mm y el margen entre 0 y 10 mm' });
    r[k] = t;
  }
  return r;
}

/** «Usar lo general»: las reglas del local como valores iniciales de una PC (ticketera y etiquetera encendidas). */
export function configDesdeGeneral(reglas: ReglasImpresion, areas: AreaSimple[], areaBebidasId: bigint | null): ConfigEquipoImpresion {
  return {
    ...CONFIG_EQUIPO_NUEVO,
    ticketera: true,
    etiquetera: true,
    ticketPago: true,
    comandaSalon: reglas.comandaSalonActivo,
    comandaAreas: reglas.comandaAreaActivo ? areas.map((a) => String(a.id)) : [],
    stickerGeneral: reglas.generalModalidades.length > 0,
    stickerAreas: reglas.areaActivo ? areas.filter((a) => !esAreaBebidas(a.nombre)).map((a) => String(a.id)) : [],
    stickerBebidaAreas: reglas.bebidaActivo && areaBebidasId !== null ? [String(areaBebidasId)] : [],
    configurado: true,
  };
}

export interface EquipoLegado {
  id: bigint;
  areaId: bigint | null;
  roles: RolImpresora[];
}

/**
 * Lo que hacía el ruteo anterior (por área y reglas del local) como configuración de esa PC, para que nada deje de
 * imprimir al desplegar. Caja: pago, comanda de salón y todo lo que ningún equipo de área atendía; PC de un área:
 * lo suyo. Respeta los interruptores del local (si el sticker por área estaba apagado, queda apagado).
 */
export function configDesdeComportamientoActual(
  e: EquipoLegado,
  todos: EquipoLegado[],
  areas: AreaSimple[],
  reglas: ReglasImpresion,
  areaBebidasId: bigint | null,
): ConfigEquipoImpresion {
  const conRol = (areaId: bigint, rol: RolImpresora) => todos.some((o) => o.areaId === areaId && o.roles.includes(rol));
  const tick = e.roles.includes('TICKETERA');
  const etiq = e.roles.includes('ETIQUETERA');
  const esCaja = e.areaId === null;
  const stickerAreas = areas
    .filter((a) => !esAreaBebidas(a.nombre))
    .filter((a) => (esCaja ? !conRol(a.id, 'ETIQUETERA') : a.id === e.areaId))
    .map((a) => String(a.id));
  const bebidasMia = areaBebidasId !== null && (esCaja ? !conRol(areaBebidasId, 'ETIQUETERA') : e.areaId === areaBebidasId);
  const comandaAreas = areas
    .filter((a) => (esCaja ? !conRol(a.id, 'TICKETERA') : a.id === e.areaId))
    .map((a) => String(a.id));
  return {
    ...CONFIG_EQUIPO_NUEVO,
    ticketera: tick,
    etiquetera: etiq,
    ticketPago: tick && esCaja,
    comandaSalon: tick && esCaja && reglas.comandaSalonActivo,
    comandaAreas: tick && reglas.comandaAreaActivo ? comandaAreas : [],
    stickerGeneral: etiq && esCaja && reglas.generalModalidades.length > 0,
    stickerAreas: etiq && reglas.areaActivo ? stickerAreas : [],
    stickerBebidaAreas: etiq && reglas.bebidaActivo && bebidasMia ? [String(areaBebidasId)] : [],
    configurado: true,
  };
}
