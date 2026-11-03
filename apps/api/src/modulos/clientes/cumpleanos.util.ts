import { BadRequestException } from '@nestjs/common';

export interface Cumpleanos {
  dia: number;
  mes: number;
}

/** Días máximos por mes; febrero admite 29 (el año, si se da, confirma si es bisiesto). */
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EDAD_MAXIMA = 120;

/**
 * Cumpleaños: día y mes (DD/MM o YYYY-MM-DD). El año es opcional y no se guarda: solo sirve para validar
 * que la fecha sea real, no futura y de una edad razonable. Devuelve el motivo si no vale.
 */
export function evaluarCumpleanos(fechaStr: string, hoy: Date = new Date()): { ok: true; valor: Cumpleanos } | { ok: false; mensaje: string } {
  const s = String(fechaStr ?? '').trim();
  const invalida = { ok: false as const, mensaje: 'La fecha de cumpleaños no es válida. Escríbela como día y mes, por ejemplo 14/03.' };
  let dia: number;
  let mes: number;
  let anio: number | undefined;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    anio = Number(m[1]);
    mes = Number(m[2]);
    dia = Number(m[3]);
  } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})$/))) {
    dia = Number(m[1]);
    mes = Number(m[2]);
  } else {
    return invalida;
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_MES[mes - 1]) return invalida;
  if (anio !== undefined) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return invalida;
    const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    if (fecha.getTime() > hoyUtc) {
      return { ok: false, mensaje: 'El cumpleaños no puede ser una fecha futura.' };
    }
    if (hoy.getFullYear() - anio > EDAD_MAXIMA) {
      return { ok: false, mensaje: 'Revisa el año de tu cumpleaños.' };
    }
  }
  return { ok: true, valor: { dia, mes } };
}

/** Versión sin motivo: null si el cumpleaños no es válido. */
export function parsearCumpleanos(fechaStr: string, hoy?: Date): Cumpleanos | null {
  const r = evaluarCumpleanos(fechaStr, hoy);
  return r.ok ? r.valor : null;
}

/** Para endpoints de alta: exige un cumpleaños válido y lanza 400 con mensaje en español. */
export function exigirCumpleanos(fechaStr: string | null | undefined, hoy?: Date): Cumpleanos {
  if (!String(fechaStr ?? '').trim()) {
    throw new BadRequestException({ codigo: 'CUMPLEANOS_REQUERIDO', mensaje: 'Escribe tu cumpleaños, para saludarte.' });
  }
  const r = evaluarCumpleanos(String(fechaStr), hoy);
  if (!r.ok) throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: r.mensaje });
  return r.valor;
}

export function formatearCumpleanos(dia?: number | null, mes?: number | null): string {
  if (!dia || !mes) return '—';
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}
