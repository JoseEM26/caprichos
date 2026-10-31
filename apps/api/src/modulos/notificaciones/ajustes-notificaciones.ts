/**
 * Ajustes de avisos que cambia el ADMIN en Configuración (tabla parametro, auditados como los demás).
 * Se leen aquí con valores por defecto: si falta la fila, vale lo de siempre.
 */
export const CLAVES_AJUSTES_NOTIF = {
  sonidoActivo: 'notif_sonido_activo',
  sonidoIntervaloSeg: 'notif_sonido_intervalo_seg',
  sonidoAlcance: 'notif_sonido_alcance',
  marcarTodasActivo: 'notif_marcar_todas_activo',
} as const;

export interface AjustesNotificaciones {
  sonidoActivo: boolean;
  sonidoIntervaloSeg: number;
  sonidoAlcance: 'TODOS_NO_LEIDOS' | 'SOLO_URGENTES' | 'SOLO_HOY';
  marcarTodasActivo: boolean;
}

export const AJUSTES_NOTIF_DEFECTO: AjustesNotificaciones = {
  sonidoActivo: true,
  sonidoIntervaloSeg: 15,
  sonidoAlcance: 'TODOS_NO_LEIDOS',
  marcarTodasActivo: true,
};

const esSi = (v: unknown, defecto: boolean): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'si';
  return defecto;
};

/** Convierte las filas de parametro en ajustes; lo que falte o no cuadre vale su defecto. */
export function leerAjustesNotificacion(filas: Array<{ clave: string; valor: unknown }>): AjustesNotificaciones {
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  const intervalo = Number(mapa.get(CLAVES_AJUSTES_NOTIF.sonidoIntervaloSeg));
  const alcance = String(mapa.get(CLAVES_AJUSTES_NOTIF.sonidoAlcance) ?? '').toUpperCase();
  return {
    sonidoActivo: esSi(mapa.get(CLAVES_AJUSTES_NOTIF.sonidoActivo), AJUSTES_NOTIF_DEFECTO.sonidoActivo),
    sonidoIntervaloSeg:
      Number.isInteger(intervalo) && intervalo >= 5 && intervalo <= 600 ? intervalo : AJUSTES_NOTIF_DEFECTO.sonidoIntervaloSeg,
    sonidoAlcance:
      alcance === 'SOLO_URGENTES' || alcance === 'SOLO_HOY' ? alcance : AJUSTES_NOTIF_DEFECTO.sonidoAlcance,
    marcarTodasActivo: esSi(mapa.get(CLAVES_AJUSTES_NOTIF.marcarTodasActivo), AJUSTES_NOTIF_DEFECTO.marcarTodasActivo),
  };
}
