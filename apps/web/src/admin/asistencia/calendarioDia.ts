import type { DiaCalendario, Proximos } from './miCalendarioApi';

/** Helpers del calendario propio: fechas en español, marca de tipo de día y textos de próximos. Sin datos de otras personas. */

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Cada estado lleva color + icono + texto (nunca solo color). */
export const ESTADO_DIA: Record<string, { icono: string; texto: string; clase: string }> = {
  CUMPLIO: { icono: '✓', texto: 'Cumplió', clase: 'ok' },
  SALIO_DESPUES: { icono: '✓', texto: 'Salió después', clase: 'ok' },
  TARDANZA: { icono: '⏱', texto: 'Tardanza', clase: 'aviso' },
  SALIO_ANTES: { icono: '↩', texto: 'Salió antes', clase: 'aviso' },
  FALTA: { icono: '✕', texto: 'Falta', clase: 'mal' },
  INCOMPLETO: { icono: '!', texto: 'Incompleto', clase: 'mal' },
  A_REVISAR: { icono: '?', texto: 'En revisión', clase: 'rev' },
  DESCANSO: { icono: '–', texto: 'Descanso', clase: 'neutro' },
  VACACIONES: { icono: '☀', texto: 'Vacaciones', clase: 'vac' },
  SIN_EVALUAR: { icono: '•', texto: 'En curso', clase: 'neutro' },
  POR_EMPEZAR: { icono: '•', texto: 'Por empezar', clase: 'neutro' },
  SIN_MARCAR_ENTRADA: { icono: '!', texto: 'Sin marcar entrada', clase: 'aviso' },
  SIN_SALIDA: { icono: '!', texto: 'No marcó salida', clase: 'mal' },
};

/** Tipo de día (la marca del calendario). Texto corto para la celda y la leyenda. */
export const TIPO_DIA: Record<string, { icono: string; texto: string; clase: string }> = {
  TRABAJA: { icono: '◷', texto: 'Trabajas', clase: 'trabaja' },
  DESCANSO: { icono: '–', texto: 'Descanso', clase: 'descanso' },
  FERIADO: { icono: '★', texto: 'Feriado', clase: 'feriado' },
  VACACIONES: { icono: '☀', texto: 'Vacaciones', clase: 'vac' },
  COBERTURA: { icono: '⇄', texto: 'Cobertura', clase: 'cobertura' },
  REEMPLAZO: { icono: '⇆', texto: 'Reemplazo', clase: 'reemplazo' },
};

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (a: number, m0: number, d: number) => `${a}-${pad(m0 + 1)}-${pad(d)}`;
export const parse = (f: string) => { const [a, m, d] = f.split('-').map(Number); return { a, m0: m - 1, d }; };
export const sumarDias = (f: string, n: number) => {
  const { a, m0, d } = parse(f);
  return new Date(Date.UTC(a, m0, d + n)).toISOString().slice(0, 10);
};
export const diaSemanaLun = (f: string) => { const { a, m0, d } = parse(f); return (new Date(Date.UTC(a, m0, d)).getUTCDay() + 6) % 7; };
export const etiquetaFecha = (f: string) => {
  const { a, m0, d } = parse(f);
  return `${DIAS_LARGOS[new Date(Date.UTC(a, m0, d)).getUTCDay()]} ${d} de ${MESES[m0]} de ${a}`;
};

/** «martes 18» (próximo descanso). */
export const diaCorto = (f: string) => { const { a, m0, d } = parse(f); return `${DIAS_LARGOS[new Date(Date.UTC(a, m0, d)).getUTCDay()]} ${d}`; };
/** «8 dic» (próximo feriado). */
export const mesCorto = (f: string) => { const { d, m0 } = parse(f); return `${d} ${MESES_CORTOS[m0]}`; };

/** Recargo como se escribe: ×2, ×1.5. */
export const textoRecargo = (n: number) => `×${Number(n)}`;
export const horarioTexto = (h: { entrada: string; salida: string }) => `${h.entrada}–${h.salida}`;

/** Marca corta del día para la celda del calendario; null si no hay nada que mostrar. */
export function marcaDia(d: DiaCalendario): { icono: string; texto: string; clase: string } | null {
  const tipo = d.tipoDia;
  // Respuestas sin tipo (antes del cambio): se deduce de feriado y horario
  if (!tipo) {
    if (d.feriado) return { icono: TIPO_DIA.FERIADO.icono, texto: TIPO_DIA.FERIADO.texto, clase: TIPO_DIA.FERIADO.clase };
    return d.programado ? { icono: TIPO_DIA.TRABAJA.icono, texto: horarioTexto(d.programado), clase: TIPO_DIA.TRABAJA.clase } : null;
  }
  if (tipo === 'FERIADO') {
    const t = d.pagaRecargo && d.recargo ? `Feriado ${textoRecargo(d.recargo)}` : 'Feriado';
    return { icono: TIPO_DIA.FERIADO.icono, texto: t, clase: TIPO_DIA.FERIADO.clase };
  }
  if (tipo === 'TRABAJA') {
    return d.programado ? { icono: TIPO_DIA.TRABAJA.icono, texto: horarioTexto(d.programado), clase: TIPO_DIA.TRABAJA.clase } : null;
  }
  const base = TIPO_DIA[tipo];
  return base ? { icono: base.icono, texto: base.texto, clase: base.clase } : null;
}

/** Frase para el resumen: «Próximo descanso: martes 18 · Próximo feriado: 8 dic ×3». */
export function textoProximos(p?: Proximos | null): { descanso: string; feriado: string } {
  const descanso = p?.descanso ? `Próximo descanso: ${diaCorto(p.descanso.fecha)}` : 'Próximo descanso: ninguno en los próximos 60 días';
  const feriado = p?.feriado
    ? `Próximo feriado: ${mesCorto(p.feriado.fecha)} ${textoRecargo(p.feriado.recargo)}`
    : 'Próximo feriado: ninguno en los próximos 60 días';
  return { descanso, feriado };
}

