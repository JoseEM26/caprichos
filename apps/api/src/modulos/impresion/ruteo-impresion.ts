import { MODALIDADES_SALON, ReglasImpresion, RolImpresora, TipoTrabajoImpresion } from '@caprichos/compartido';

/** Un equipo de área: su área y los roles que declara en su último latido (configurados, no «conectados ahora»). */
export interface EquipoRuteo {
  areaId: bigint;
  roles: RolImpresora[];
}

/** Lo que hace falta para decidir a dónde va cada trabajo. */
export interface ContextoRuteo {
  /** Equipos de área activos (Caja no va aquí: Caja es area NULL). */
  equipos: EquipoRuteo[];
  /** Área de bebidas (por nombre), si existe y está activa. */
  areaBebidasId: bigint | null;
}

export const CONTEXTO_RUTEO_VACIO: ContextoRuteo = { equipos: [], areaBebidasId: null };

function equipoConRol(ctx: ContextoRuteo, areaId: bigint, rol: RolImpresora): boolean {
  return ctx.equipos.some((e) => e.areaId === areaId && e.roles.includes(rol));
}

/**
 * Destino de un trabajo: el id del área cuyo equipo lo imprime, o NULL (Caja).
 * Solo los stickers se rutean: el sticker por área va a su área si esa área tiene etiquetera asignada, y el
 * sticker por vaso va a Bebidas si tiene etiquetera. Todo lo demás (general, ticketera) es de Caja.
 * Con el equipo asignado pero caído, el trabajo espera en su cola: no vuelve solo a Caja.
 */
export function destinoDeTrabajo(
  tipo: TipoTrabajoImpresion | string,
  areaId: bigint | null,
  ctx: ContextoRuteo,
): bigint | null {
  if (tipo === 'ETIQUETA_AREA') {
    return areaId !== null && equipoConRol(ctx, areaId, 'ETIQUETERA') ? areaId : null;
  }
  if (tipo === 'ETIQUETA_BEBIDA') {
    const bebidas = ctx.areaBebidasId;
    return bebidas !== null && equipoConRol(ctx, bebidas, 'ETIQUETERA') ? bebidas : null;
  }
  return null;
}

/** Tipos que puede imprimir una máquina según sus roles. */
export function tiposDeRoles(roles: RolImpresora[]): string[] {
  return [
    ...(roles.includes('ETIQUETERA') ? ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA'] : []),
    ...(roles.includes('TICKETERA') ? ['TICKET_PAGO', 'TICKET_COMANDA_SALON'] : []),
  ];
}

/** Si el tipo de trabajo se encola para un pedido con esa modalidad según las reglas (sin tocar destinos). */
export function aplicaSegunReglas(tipo: string, modalidad: string, reglas: ReglasImpresion): boolean {
  switch (tipo) {
    case 'ETIQUETA_GENERAL':
      return reglas.generalModalidades.includes(modalidad);
    case 'ETIQUETA_BEBIDA':
      return reglas.bebidaActivo;
    case 'ETIQUETA_AREA':
      return reglas.areaActivo;
    case 'TICKET_COMANDA_SALON':
      return reglas.comandaSalonActivo && (MODALIDADES_SALON as readonly string[]).includes(modalidad);
    default:
      return true;
  }
}
