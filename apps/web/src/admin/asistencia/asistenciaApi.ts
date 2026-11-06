import { api } from '../../comun/api';

export type TipoMarca = 'ENTRADA' | 'SALIDA_ALMUERZO' | 'ENTRADA_ALMUERZO' | 'SALIDA';

export const ETIQUETA_TIPO: Record<TipoMarca, string> = {
  ENTRADA: 'Entrada',
  SALIDA_ALMUERZO: 'Salida a almuerzo',
  ENTRADA_ALMUERZO: 'Regreso de almuerzo',
  SALIDA: 'Salida',
};

export const ETIQUETA_ESTADO: Record<string, string> = {
  CUMPLIO: 'Cumplió',
  TARDANZA: 'Tardanza',
  SALIO_ANTES: 'Salió antes',
  SALIO_DESPUES: 'Salió después',
  FALTA: 'Falta',
  DESCANSO: 'Descanso',
  INCOMPLETO: 'Incompleto',
  A_REVISAR: 'A revisar',
  SIN_EVALUAR: 'En curso',
};

export interface QrPantalla {
  slot: number;
  ahora: number;
  cambiaEn: number;
  ventanaSeg: number;
  qr: string;
  codigo: string;
}

export interface MiMarca {
  tipo: TipoMarca;
  momento: string;
  estado: 'VALIDA' | 'A_REVISAR';
}

export interface MiHoy {
  jornada: string;
  ahora: string;
  turno: { entrada: string; salida: string; almuerzo: string | null } | null;
  estado: string;
  marcas: MiMarca[];
  pendiente: TipoMarca | null;
  permitidas: TipoMarca[];
  consentimientoAceptado: boolean;
  consentimientoAceptadoEn?: string | null;
  textoConsentimiento?: string;
  consentimiento: { version: string; texto: string } | null;
  dispositivoVinculado: boolean;
}

export interface ResultadoMarca {
  ok: boolean;
  mensaje: string;
  marca: { id: number; tipo: TipoMarca; estado: string; alertas: string[] };
  pendiente: TipoMarca | null;
}

export interface DatosMarca {
  tipo: TipoMarca;
  qr?: string;
  codigo?: string;
  lat: number;
  lng: number;
  precision: number;
  selfie: string;
  dispositivo: string;
  consentimiento?: boolean;
}

export interface FilaHoy {
  partyId: number;
  nombre: string;
  turno: { entrada: string; salida: string; almuerzo: string | null } | null;
  estado: string;
  alertas: string[];
  entrada: string | null;
  salida: string | null;
  trabajadaMin: number;
  tardanzaMin: number;
}

export interface FilaMes {
  partyId: number;
  nombre: string;
  jornada: string;
  estado: string;
  programadaMin: number;
  trabajadaMin: number;
  tardanzaMin: number;
  salioAntesMin: number;
  extraMin: number;
  alertas: string[];
}

export interface ResumenMes {
  partyId: number;
  nombre: string;
  programadasH: number;
  trabajadasH: number;
  diasTrabajados: number;
}

export interface MarcaAdmin {
  id: number;
  partyId: number;
  nombre: string;
  jornada: string;
  tipo: TipoMarca;
  origen: 'CELULAR' | 'CORRECCION';
  momento: string;
  estado: string;
  alertas: string | null;
  distanciaM: number | null;
  precisionM: number | null;
  motivo: string | null;
  tieneSelfie: boolean;
}

export interface ConfigAsistenciaAdmin {
  radioM: number;
  toleranciaMin: number;
  retencionDias: number;
  precisionMaxM: number;
  localLat: number | null;
  localLng: number | null;
}

export const pantallaQr = () => api.get<QrPantalla>('/admin/asistencia/pantalla/qr');
/** Pantalla del local sin sesión: el enlace secreto va en la ruta (el token no se guarda en la web). */
export const pantallaQrPublica = (token: string) =>
  api.get<QrPantalla>(`/carta/asistencia-pantalla/${encodeURIComponent(token)}/qr`);

export interface EstadoEnlacePantalla {
  activo: boolean;
  generadoEn: string | null;
}
export const estadoEnlacePantalla = () => api.get<EstadoEnlacePantalla>('/admin/asistencia/pantalla/enlace');
/** Genera o regenera (invalida el anterior). La ruta trae el token en claro: solo se muestra una vez. */
export const generarEnlacePantalla = () => api.post<{ ruta: string; generadoEn: string }>('/admin/asistencia/pantalla/enlace', {});
export const desactivarEnlacePantalla = () => api.delete<EstadoEnlacePantalla>('/admin/asistencia/pantalla/enlace');
export const miHoy = () => api.get<MiHoy>('/admin/asistencia/mi/hoy');
export const miHistorial = (dias = 14) => api.get<any[]>(`/admin/asistencia/mi/historial?dias=${dias}`);
/** Mi parte de los repartos de propinas aprobados o pagados (solo mis filas). */
export interface MiPropina {
  anio: number;
  mes: number;
  estado: string;
  horas: number;
  porcentaje: number;
  monto: number;
  pagadoEn: string | null;
  pagadoMedio: string | null;
}
export const miPropinas = () => api.get<MiPropina[]>('/admin/asistencia/mi/propinas');
export const marcarAsistencia = (datos: DatosMarca) => api.post<ResultadoMarca>('/admin/asistencia/marcar', datos);
export const reporteHoy = () => api.get<{ jornada: string; filas: FilaHoy[] }>('/admin/asistencia/hoy');
export const reporteMes = (anio: number, mes: number) =>
  api.get<{ dias: string[]; filas: FilaMes[]; personas: ResumenMes[] }>(`/admin/asistencia/mes?anio=${anio}&mes=${mes}&formato=json`);
export const listarMarcas = (params: { desde?: string; hasta?: string; partyId?: number }) => {
  const qs = new URLSearchParams();
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.partyId) qs.set('partyId', String(params.partyId));
  const s = qs.toString();
  return api.get<MarcaAdmin[]>(`/admin/asistencia/marcas${s ? `?${s}` : ''}`);
};
export const corregirMarca = (datos: {
  partyId: number;
  jornada: string;
  tipo: TipoMarca;
  momento: string;
  motivo: string;
}) => api.post('/admin/asistencia/correcciones', datos);
export const reiniciarCelular = (partyId: number) => api.post(`/admin/asistencia/dispositivos/${partyId}/reiniciar`);
export const obtenerConfigAsistencia = () => api.get<ConfigAsistenciaAdmin>('/admin/asistencia/config');
export const guardarConfigAsistencia = (datos: Partial<ConfigAsistenciaAdmin>) =>
  api.put<ConfigAsistenciaAdmin>('/admin/asistencia/config', datos);

/** Identificador estable de este navegador (la huella que el servidor guarda en hash). */
export function identificadorDispositivo(): string {
  const clave = 'caprichos.asistencia.dispositivo';
  try {
    const guardado = window.localStorage.getItem(clave);
    if (guardado && guardado.length >= 8) return guardado;
    const nuevo = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 80);
    window.localStorage.setItem(clave, nuevo);
    return nuevo;
  } catch {
    return `sin-almacen-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;
  }
}

/** CSV del mes a partir de las filas del reporte (sin pedirlo otra vez al servidor). */
export function csvDeFilas(filas: FilaMes[]): string {
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ['persona', 'fecha', 'estado', 'programada_h', 'trabajada_h', 'tardanza_min', 'salio_antes_min', 'extra_min', 'alertas'];
  const lineas = filas.map((f) =>
    [f.nombre, f.jornada, ETIQUETA_ESTADO[f.estado] ?? f.estado, (f.programadaMin / 60).toFixed(2), (f.trabajadaMin / 60).toFixed(2), f.tardanzaMin, f.salioAntesMin, f.extraMin, f.alertas.join(' | ')].map(celda).join(','),
  );
  return [cab.join(','), ...lineas].join('\n') + '\n';
}
