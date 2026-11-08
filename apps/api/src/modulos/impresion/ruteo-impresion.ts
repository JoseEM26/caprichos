import {
  ConfigEquipoImpresion,
  MODALIDADES_SALON,
  ReglasImpresion,
  RolImpresora,
  TipoTrabajoImpresion,
} from '@caprichos/compartido';

/** Una computadora con su configuración: cada PC manda (qué imprime y de qué áreas). */
export interface EquipoRuteo {
  id: bigint;
  /** Área histórica del equipo (NULL = Caja); solo sirve para ordenar la cola por máquina. */
  areaId: bigint | null;
  conectado: boolean;
  config: ConfigEquipoImpresion;
}

/** Lo que hace falta para decidir a dónde va cada trabajo. */
export interface ContextoRuteo {
  /** Equipos de impresión activos (vinculados) con su configuración. */
  equipos: EquipoRuteo[];
  /** Área de bebidas (por nombre), si existe y está activa. */
  areaBebidasId: bigint | null;
}

export const CONTEXTO_RUTEO_VACIO: ContextoRuteo = { equipos: [], areaBebidasId: null };

/** Config de una PC nueva: todo apagado y sin configurar (no recibe trabajos). */
export const CONFIG_EQUIPO_NUEVO: ConfigEquipoImpresion = {
  ticketera: false,
  etiquetera: false,
  ticketPago: false,
  comandaSalon: false,
  comandaAreas: [],
  stickerGeneral: false,
  stickerAreas: [],
  stickerBebidaAreas: [],
  tamanoGeneral: null,
  tamanoBebida: null,
  pausado: false,
  configurado: false,
};

/**
 * ¿Esta PC imprime este trabajo? Solo si está configurada y no en pausa, tiene la máquina encendida y el tipo
 * (y el área) activados. `areaIds` son las áreas candidatas del trabajo (la del sticker o comanda; en vasos, la de la
 * línea y la de Bebidas).
 */
export function equipoAcepta(cfg: ConfigEquipoImpresion, tipo: string, areaIds: Array<string | null>): boolean {
  if (!cfg.configurado || cfg.pausado) return false;
  const area = areaIds[0] ?? null;
  switch (tipo) {
    case 'TICKET_PAGO':
      return cfg.ticketera && cfg.ticketPago;
    case 'TICKET_COMANDA_SALON':
      return cfg.ticketera && cfg.comandaSalon;
    case 'TICKET_COMANDA_AREA':
      // Una comanda sin área la toma quien tenga comandas de área encendidas
      return cfg.ticketera && (area === null ? cfg.comandaAreas.length > 0 : cfg.comandaAreas.includes(area));
    case 'ETIQUETA_GENERAL':
      return cfg.etiquetera && cfg.stickerGeneral;
    case 'ETIQUETA_AREA':
      return cfg.etiquetera && area !== null && cfg.stickerAreas.includes(area);
    case 'ETIQUETA_BEBIDA':
      return cfg.etiquetera && areaIds.some((a) => a !== null && cfg.stickerBebidaAreas.includes(a));
    default:
      return false;
  }
}

/** Áreas candidatas para decidir el destino: el sticker de vaso mira su línea y Bebidas. */
export function areasParaRuteo(tipo: string, areaId: bigint | string | null, areaBebidasId: bigint | null, areaPayload?: string | null): Array<string | null> {
  const a = areaId === null || areaId === undefined ? null : String(areaId);
  if (tipo === 'ETIQUETA_BEBIDA') return [areaPayload ?? null, areaBebidasId !== null ? String(areaBebidasId) : null];
  return [a];
}

/**
 * Destino de un trabajo: la PC configurada que lo imprime (prefiere una conectada; si hay varias, la de id menor),
 * o null si ninguna lo imprime: el trabajo espera en cola con aviso.
 */
export function destinoDeTrabajo(
  tipo: TipoTrabajoImpresion | string,
  areaIds: Array<string | null>,
  ctx: ContextoRuteo,
): EquipoRuteo | null {
  const candidatos = ctx.equipos
    .filter((e) => equipoAcepta(e.config, tipo, areaIds))
    .sort((a, b) => Number(b.conectado) - Number(a.conectado) || (a.id < b.id ? -1 : 1));
  return candidatos[0] ?? null;
}

/** Roles (máquinas) que la configuración de la PC tiene encendidos. */
export function rolesDeConfig(cfg: ConfigEquipoImpresion): RolImpresora[] {
  return [...(cfg.etiquetera ? (['ETIQUETERA'] as const) : []), ...(cfg.ticketera ? (['TICKETERA'] as const) : [])];
}

/** Tipos que puede imprimir una máquina según sus roles. */
export function tiposDeRoles(roles: RolImpresora[]): string[] {
  return [
    ...(roles.includes('ETIQUETERA') ? ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA'] : []),
    ...(roles.includes('TICKETERA') ? ['TICKET_PAGO', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA'] : []),
  ];
}

const MODALIDADES_STICKER_GENERAL = ['LLEVAR', 'RECOGER', 'DELIVERY'];

/**
 * Si el tipo de trabajo se encola para un pedido con esa modalidad. La PC decide QUÉ imprime y de qué áreas;
 * las reglas del local solo conservan el CUÁNDO (modalidades: en mesa no salen stickers). Sticker general con la lista
 * vacía: solo llevar, recoger y delivery.
 */
export function aplicaSegunReglas(tipo: string, modalidad: string, reglas: ReglasImpresion): boolean {
  switch (tipo) {
    case 'ETIQUETA_GENERAL':
      return (reglas.generalModalidades.length ? reglas.generalModalidades : MODALIDADES_STICKER_GENERAL).includes(modalidad);
    case 'ETIQUETA_BEBIDA':
      return reglas.bebidaModalidades.includes(modalidad);
    case 'ETIQUETA_AREA':
      return reglas.areaModalidades.includes(modalidad);
    case 'TICKET_COMANDA_SALON':
      return (MODALIDADES_SALON as readonly string[]).includes(modalidad);
    // Comanda por área y pago: en cualquier modalidad.
    default:
      return true;
  }
}
