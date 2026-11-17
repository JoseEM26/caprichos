import { BadRequestException } from '@nestjs/common';
import { obtenerFechaHoraLima } from '../cocina/cocina.util';
import { RangoMisPedidos } from './dto/mis-pedidos-query.dto';

/** Ventana máxima de una búsqueda con desde/hasta o con texto (q), en días calendario de Lima. */
export const MAX_DIAS_MIS_PEDIDOS = 92;
/** Filas que devuelve «Mis pedidos»; si hay más coincidencias, `truncado` es true. */
export const MAX_FILAS_MIS_PEDIDOS = 200;

const DIA_MS = 24 * 60 * 60 * 1000;

export interface VentanaMisPedidos {
  /** Filtro de creado_en (inclusive / exclusivo); ausente = sin límite (rango «todas») */
  gte?: Date;
  lt?: Date;
  /** Día Lima efectivo (YYYY-MM-DD); null = sin límite inferior */
  desde: string | null;
  /** Día Lima efectivo (YYYY-MM-DD), inclusivo */
  hasta: string;
}

/** Suma días a una fecha YYYY-MM-DD en aritmética de calendario (sin zona horaria). */
function sumarDias(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Inicio del día Lima (Lima es UTC-5 todo el año). */
const inicioDiaLima = (fechaIso: string) => new Date(`${fechaIso}T05:00:00.000Z`);

/** true si la fecha YYYY-MM-DD existe en el calendario (rechaza 2026-02-30). */
function esFechaReal(fechaIso: string): boolean {
  return sumarDias(fechaIso, 0) === fechaIso;
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS) + 1;
}

/**
 * Traduce los filtros de fecha de «Mis pedidos» a una ventana de creado_en por día de Lima.
 * - desde/hasta (inclusivos) mandan sobre rango; si falta hasta es hoy; si falta desde, 400.
 * - q sin desde/hasta busca en los últimos 92 días (ignora rango).
 * - Sin nada: el rango de siempre (hoy, ayer, 7dias, 30dias o todas).
 */
export function ventanaMisPedidos(
  rango: RangoMisPedidos,
  filtros: { desde?: string; hasta?: string; q?: string },
  ahora: Date = new Date(),
): VentanaMisPedidos {
  const hoy = obtenerFechaHoraLima(ahora).fechaIso;

  if (filtros.desde || filtros.hasta) {
    if (!filtros.desde) throw new BadRequestException('Indica también la fecha de inicio (desde).');
    const desde = filtros.desde;
    const hasta = filtros.hasta ?? hoy;
    if (!esFechaReal(desde) || !esFechaReal(hasta)) throw new BadRequestException('La fecha no existe en el calendario.');
    if (desde > hasta) throw new BadRequestException('La fecha de inicio no puede ser posterior a la de fin.');
    if (hasta > hoy) throw new BadRequestException('La fecha de fin no puede ser posterior a hoy.');
    if (diasEntre(desde, hasta) > MAX_DIAS_MIS_PEDIDOS) {
      throw new BadRequestException(`El rango no puede pasar de ${MAX_DIAS_MIS_PEDIDOS} días.`);
    }
    return { gte: inicioDiaLima(desde), lt: inicioDiaLima(sumarDias(hasta, 1)), desde, hasta };
  }

  // Sin tope superior: no hay pedidos con fecha futura (igual que antes del filtro por fechas)
  if (filtros.q) {
    const desde = sumarDias(hoy, -(MAX_DIAS_MIS_PEDIDOS - 1));
    return { gte: inicioDiaLima(desde), desde, hasta: hoy };
  }

  switch (rango) {
    case 'todas':
      return { desde: null, hasta: hoy };
    case 'ayer': {
      const ayer = sumarDias(hoy, -1);
      return { gte: inicioDiaLima(ayer), lt: inicioDiaLima(hoy), desde: ayer, hasta: ayer };
    }
    case '7dias':
      return { gte: inicioDiaLima(sumarDias(hoy, -6)), desde: sumarDias(hoy, -6), hasta: hoy };
    case '30dias':
      return { gte: inicioDiaLima(sumarDias(hoy, -29)), desde: sumarDias(hoy, -29), hasta: hoy };
    default:
      return { gte: inicioDiaLima(hoy), desde: hoy, hasta: hoy };
  }
}
