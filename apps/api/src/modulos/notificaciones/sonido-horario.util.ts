import { CoberturaDia, MomentoLima, VentanaDia, enVentana } from '../correo';

export interface SonidoHorario {
  suenaAhora: boolean;
  /** Línea para la campanita cuando el sonido está en pausa (null si suena). */
  texto: string | null;
}

export interface DatosSonido {
  esAdmin: boolean;
  h247: boolean;
  horarios: VentanaDia[];
  /** Coberturas de hoy donde esta persona cubre a alguien. */
  coberturas: Pick<CoberturaDia, 'desde' | 'hasta'>[];
}

const hhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * ADMIN, 24/7 y quien no tiene horario cargado: suena siempre. Con horario: solo dentro de una ventana de hoy
 * (o el tramo de ayer que cruza la medianoche) o de una cobertura de hoy. Reemplazo fijo por día: no se considera.
 */
export function sonidoPorHorario(momento: MomentoLima, d: DatosSonido): SonidoHorario {
  if (d.esAdmin || d.h247 || d.horarios.length === 0) return { suenaAhora: true, texto: null };
  const { dia, minuto } = momento;
  const ayer = (dia + 6) % 7;
  const hoy = d.horarios.filter((h) => h.dia === dia);
  const suena =
    hoy.some((h) => (h.entrada <= h.salida ? enVentana(minuto, h.entrada, h.salida) : minuto >= h.entrada)) ||
    d.horarios.some((h) => h.dia === ayer && h.entrada > h.salida && minuto < h.salida) ||
    d.coberturas.some((c) => enVentana(minuto, c.desde, c.hasta));
  if (suena) return { suenaAhora: true, texto: null };
  const rangos = hoy.map((h) => `${hhmm(h.entrada)}–${hhmm(h.salida)}`).join(', ');
  return { suenaAhora: false, texto: rangos ? `Sonido en pausa: fuera de tu horario (${rangos})` : 'Hoy no tienes turno: sonido en pausa' };
}
