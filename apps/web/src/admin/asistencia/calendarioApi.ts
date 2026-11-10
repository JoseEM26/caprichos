import { api, ErrorApi } from '../../comun/api';
import { cronograma, type CronoDia, type CronoPersona } from './correccionesApi';

// Cliente del Calendario de asistencia (contrato A1). Si el servidor aún no tiene los endpoints nuevos (404),
// se arma lo mismo a partir del cronograma actual.

export type TipoMarcaCal = 'ENTRADA' | 'SALIDA' | 'ALMUERZO_SALIDA' | 'ALMUERZO_VUELTA' | null;
export interface DiaResumen {
  fecha: string;
  feriado: string | null;
  programadas: number;
  presentes: number;
  tardanzas: number;
  faltas: number;
  aRevisar: number;
  solicitudesPendientes: number;
  inconsistencias: number;
}
export interface CalendarioMes { desde: string; hasta: string; dias: DiaResumen[] }
export interface MarcaFila { id: number; tipo: TipoMarcaCal; hora: string; origen: string; estado: string; tieneSelfie: boolean }
export interface FilaCal {
  fecha: string;
  partyId: string;
  nombre: string;
  rol: string;
  turno: { entrada: string; salida: string } | null;
  marcas: MarcaFila[];
  entrada: string | null;
  salida: string | null;
  almuerzoSalida: string | null;
  almuerzoVuelta: string | null;
  almuerzoMin: number | null;
  trabajadaMin: number;
  tardanzaMin: number;
  salioAntesMin: number;
  extraMin: number;
  estado: string;
  solicitudes: Array<{ id: number; tipo: string; estado: string }>;
  inconsistencias: string[];
}
export interface TotalesCal { trabajadaMin: number; tardanzaMin: number; extraMin: number; faltas: number }
export interface RegistroCal { total: number; pagina: number; limite: number; filas: FilaCal[]; totales: TotalesCal }
export interface ParamsFilas { desde: string; hasta: string; q?: string; estado?: string[]; rol?: string[]; partyId?: string }

export const ETIQUETA_TIPO_CAL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  ALMUERZO_SALIDA: 'Salida a almorzar',
  ALMUERZO_VUELTA: 'Vuelta del almuerzo',
  SALIDA_ALMUERZO: 'Salida a almorzar',
  ENTRADA_ALMUERZO: 'Vuelta del almuerzo',
};

const ESTADOS_PRESENTE = ['CUMPLIO', 'SALIO_ANTES', 'SALIO_DESPUES'];
const A_REVISAR = ['A_REVISAR', 'INCOMPLETO'];
export const esPresente = (e: string) => ESTADOS_PRESENTE.includes(e);
export const esARevisar = (e: string) => A_REVISAR.includes(e);

const noEncontrado = (e: unknown) => (e instanceof ErrorApi ? e.statusCode === 404 : (e as any)?.statusCode === 404 || (e as any)?.status === 404);

const diasEntre = (desde: string, hasta: string) => {
  const r: string[] = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) r.push(new Date(t).toISOString().slice(0, 10));
  return r;
};

const aTipo = (rol: string | null): TipoMarcaCal =>
  rol === 'SALIDA_ALMUERZO' || rol === 'ALMUERZO_SALIDA' ? 'ALMUERZO_SALIDA'
    : rol === 'ENTRADA_ALMUERZO' || rol === 'ALMUERZO_VUELTA' ? 'ALMUERZO_VUELTA'
      : rol === 'ENTRADA' ? 'ENTRADA' : rol === 'SALIDA' ? 'SALIDA' : null;

const hm = (min: number) => `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String(((min % 60) + 60) % 60).padStart(2, '0')}`;

function filaDeCrono(p: CronoPersona, d: CronoDia): FilaCal {
  const marcas = d.marcas.filter((m) => !m.duplicada).map((m) => ({ id: m.id, tipo: aTipo(m.rol), hora: m.hora, origen: m.origen ?? '', estado: m.estado, tieneSelfie: m.tieneSelfie }));
  const hora = (t: TipoMarcaCal) => marcas.find((m) => m.tipo === t)?.hora ?? null;
  const ultima = [...marcas].reverse().find((m) => m.tipo === 'SALIDA')?.hora ?? null;
  return {
    fecha: d.jornada, partyId: String(p.partyId), nombre: p.nombre, rol: p.roles[0] ?? '',
    turno: d.turno ? { entrada: hm(d.turno.entrada), salida: hm(d.turno.salida) } : null,
    marcas, entrada: hora('ENTRADA'), salida: ultima, almuerzoSalida: hora('ALMUERZO_SALIDA'), almuerzoVuelta: hora('ALMUERZO_VUELTA'),
    almuerzoMin: d.breakMin || null, trabajadaMin: d.trabajadaMin, tardanzaMin: d.tardanzaMin, salioAntesMin: 0, extraMin: 0,
    estado: d.estado, solicitudes: d.solicitudes.map((s) => ({ id: s.id, tipo: 'CORRECCION', estado: 'PENDIENTE' })),
    inconsistencias: [...d.alertas, ...(d.inconsistencia ? [d.inconsistencia.texto] : [])],
  };
}

async function desdeCronograma(desde: string, hasta: string) {
  const c = await cronograma(desde, hasta);
  const filas: FilaCal[] = c.personas.flatMap((p) => p.dias.map((d) => filaDeCrono(p, d)));
  const dias: DiaResumen[] = diasEntre(desde, hasta).map((fecha) => {
    const f = filas.filter((x) => x.fecha === fecha && x.estado !== 'DESCANSO');
    return {
      fecha, feriado: null, programadas: f.filter((x) => x.turno).length,
      presentes: f.filter((x) => esPresente(x.estado)).length, tardanzas: f.filter((x) => x.estado === 'TARDANZA').length,
      faltas: f.filter((x) => x.estado === 'FALTA').length,
      aRevisar: f.filter((x) => esARevisar(x.estado) || x.marcas.some((m) => m.estado === 'A_REVISAR')).length,
      solicitudesPendientes: f.reduce((s, x) => s + x.solicitudes.length, 0), inconsistencias: f.filter((x) => x.inconsistencias.length > 0).length,
    };
  });
  return { dias, filas };
}

export async function calendario(desde: string, hasta: string): Promise<CalendarioMes> {
  try {
    return await api.get<CalendarioMes>(`/admin/asistencia/calendario?desde=${desde}&hasta=${hasta}`);
  } catch (e) {
    if (!noEncontrado(e)) throw e;
    return { desde, hasta, dias: (await desdeCronograma(desde, hasta)).dias };
  }
}

export function totalesDe(filas: FilaCal[]): TotalesCal {
  return filas.reduce((t, f) => ({
    trabajadaMin: t.trabajadaMin + f.trabajadaMin, tardanzaMin: t.tardanzaMin + f.tardanzaMin, extraMin: t.extraMin + f.extraMin,
    faltas: t.faltas + (f.estado === 'FALTA' ? 1 : 0),
  }), { trabajadaMin: 0, tardanzaMin: 0, extraMin: 0, faltas: 0 });
}

/** Siempre pide «todas» las filas del rango (≤ 62 días): la pantalla filtra y recorta sin volver al servidor. */
export async function calendarioFilas(p: ParamsFilas): Promise<RegistroCal> {
  const qs = new URLSearchParams({ desde: p.desde, hasta: p.hasta, limite: 'todas' });
  if (p.q) qs.set('q', p.q);
  if (p.estado?.length) qs.set('estado', p.estado.join(','));
  if (p.rol?.length) qs.set('rol', p.rol.join(','));
  if (p.partyId) qs.set('partyId', p.partyId);
  try {
    return await api.get<RegistroCal>(`/admin/asistencia/calendario/filas?${qs}`);
  } catch (e) {
    if (!noEncontrado(e)) throw e;
    const { filas } = await desdeCronograma(p.desde, p.hasta);
    const f = filas.filter((x) => x.estado !== 'DESCANSO' || x.marcas.length > 0);
    return { total: f.length, pagina: 1, limite: f.length, filas: f, totales: totalesDe(f) };
  }
}

const csvCelda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export const csvDeRegistro = (filas: FilaCal[]) =>
  ['Fecha,Persona,Rol,Turno,Entrada,Salida a almorzar,Vuelta,Almuerzo (min),Salida,Trabajado (min),Tardanza (min),Extra (min),Estado']
    .concat(filas.map((f) => [f.fecha, f.nombre, f.rol, f.turno ? `${f.turno.entrada}-${f.turno.salida}` : '', f.entrada, f.almuerzoSalida, f.almuerzoVuelta, f.almuerzoMin, f.salida, f.trabajadaMin, f.tardanzaMin, f.extraMin, f.estado].map(csvCelda).join(',')))
    .join('\n');
