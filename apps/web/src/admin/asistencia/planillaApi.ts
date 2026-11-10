import { api } from '../../comun/api';

export type Modalidad = 'SEMANAL' | 'MENSUAL';

export type MetodoValorHora = 'DIAS_HORAS' | 'TARIFA_HORA' | 'PROGRAMADAS';
export const ETIQUETA_METODO: Record<MetodoValorHora, string> = {
  DIAS_HORAS: 'Sueldo ÷ días del mes ÷ horas por día',
  TARIFA_HORA: 'Tarifa fija por hora (sin sueldo mensual)',
  PROGRAMADAS: 'Sueldo del período ÷ horas programadas (método anterior)',
};

export interface SueldoPersona {
  modalidad: Modalidad;
  semanal: number;
  mensual: number;
  metodo?: MetodoValorHora;
  diasMes?: number | null;
  horasDia?: number | null;
  tarifaHora?: number | null;
}

/** Dato personal de pago (solo ADMIN). */
export interface PagoPersona { celular: string | null; medio: string | null }
export const MEDIOS_PAGO = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'] as const;

/** Etiquetas de los descuentos (el valor del código no lleva tilde). */
export const CATEGORIAS_DESCUENTO = ['CONSUMO', 'MERMA', 'DANO', 'PRESTAMO', 'NETFLIX', 'OTRO'] as const;
export const ETIQUETA_CATEGORIA: Record<string, string> = { CONSUMO: 'Consumo', MERMA: 'Merma', DANO: 'Daño', PRESTAMO: 'Préstamo', NETFLIX: 'Netflix', OTRO: 'Otro' };

/** Columnas del Excel del dueño, ya calculadas por el servidor. */
export interface ResumenExcel {
  pagoPorDia: number | null;
  valorHora: number;
  horasLaboradas: number;
  minutosLaborados: number;
  horasExtra: number;
  total: number;
  adicional: number;
  descuentos: number;
  descuentosPorCategoria: Record<string, number>;
  netoAPagar: number;
  adelanto: number;
  diferencia: number;
  /** Penalidad por tardanza del período (0 o ausente = sin penalidad). */
  penalidadTardanza?: number;
}

/** Penalidad por tardanza: la hora tarde no se paga y además se cobra su valor × el factor de Configuración. */
export interface PenalidadTardanza {
  total?: number;
  totalCents?: number;
  detalle: Array<{ fecha: string; minutos: number; monto: number }>;
}
/** Total en soles de la penalidad, aunque el servidor lo mande en céntimos. Sin dato = 0. */
export const totalPenalidad = (p?: PenalidadTardanza | null): number => (p ? p.total ?? (p.totalCents !== undefined ? p.totalCents / 100 : 0) : 0);

export interface FilaPlanilla {
  partyId: number;
  nombre: string;
  sueldo: SueldoPersona | null;
  pago?: PagoPersona;
  excel?: ResumenExcel;
  vinculo?: { tipo: 'PLANILLA' | 'CONTRATO_TEMPORAL'; fechaIngreso: string; fechaFin: string | null } | null;
  periodo?:{ desde: string; hasta: string };
  estado?: 'ABIERTO' | 'PAGADO';
  programadasH?: number;
  trabajadasH?: number;
  ganado?: number;
  consumos?: number;
  descuentos?: number;
  adelantos?: number;
  neto?: number;
  pendientes?: number;
  penalidad?: number;
}

export interface CuotaPeriodoApi { id: string; prestamoId: string; numero: number; numCuotas: number; monto: number; motivo: string | null; cobrar: boolean; capital?: number; interes?: number; capitalCuota?: number; interesCuota?: number; interesPctMensual?: number }
export interface RecurrentePeriodoApi { id: string; tipo: string; nombre: string; monto: number; cobrar: boolean; periodicidad?: 'SEMANAL' | 'MENSUAL' }

export interface DiaPlanillaApi {
  jornada: string;
  estado: string;
  programadaMin: number;
  trabajadaMin: number;
  tardanzaMin: number;
  salidaAnticipadaMin: number;
  extraMin: number;
  extraAprobada: boolean;
  extraAprobadaEn: string | null;
  /** Nombre del feriado activo de esa jornada (sus horas se pagan con recargo). */
  feriado?: string | null;
  recargo?: number;
  ganado?: number;
  /** Detalle del calendario (misma interpretación que calculó el pago). */
  horario?: { entrada: string; salida: string; almuerzo: string | null } | null;
  marcas?: Array<{ id: number | null; hora: string; rol: string | null; duplicada: boolean; estado: string }>;
  breakMin?: number;
  alertas?: string[];
  extraPendiente?: boolean;
  vacacion?: boolean;
}

export interface ConsumoPlanillaApi {
  id: string;
  fecha: string;
  pedido: string;
  monto: number;
  cobrar: boolean;
}

export interface AjustePlanillaApi {
  id: number;
  tipo: 'ADELANTO' | 'DESCUENTO' | 'BONO';
  categoria?: string;
  fecha: string;
  monto: number;
  motivo: string;
  anulado: boolean;
  anuladoMotivo: string | null;
}

export interface DetallePlanilla {
  partyId: number;
  nombre: string;
  periodo: { desde: string; hasta: string };
  sueldo: SueldoPersona;
  pago?: PagoPersona;
  excel?: ResumenExcel;
  tercerizado?: boolean;
  metodoValorHora?: MetodoValorHora;
  cuotas?: CuotaPeriodoApi[];
  recurrentes?: RecurrentePeriodoApi[];
  estado: 'ABIERTO' | 'PAGADO';
  periodoId: number | null;
  pagadoEn?: string;
  toleranciaMin: number;
  /** Ya no se usa (antes: % pagado por tardanza). Se ignora. */
  pctTardanza?: number;
  penalidadTardanza?: PenalidadTardanza;
  pendientes: number;
  /** Jornadas que bloquean «Marcar pagado». */
  jornadasPorRevisar?: string[];
  resultado: {
    programadaMin: number;
    trabajadaMin: number;
    tardanzaMin: number;
    salidaAnticipadaMin: number;
    extraMin: number;
    extraAprobadaMin: number;
    valorHora: number;
    pagoTrabajado: number;
    pagoTardanza?: number;
    penalidadTardanza?: number;
    /** Detalle por día de la penalidad (lo manda el servidor junto con el total). */
    penalidadTardanzaDetalle?: Array<{ fecha: string; minutos: number; monto: number }>;
    pagoExtra: number;
    /** Vacaciones pagadas en dinero dentro del período. */
    pagoVacaciones?: number;
    ganado: number;
    consumosCobrados: number;
    consumosPendientes: number;
    descuentos: number;
    adelantos: number;
    adicional?: number;
    descuentosPorCategoria?: Record<string, number>;
    netoAPagar?: number;
    neto: number;
  };
  dias: DiaPlanillaApi[];
  consumos: ConsumoPlanillaApi[];
  ajustes: AjustePlanillaApi[];
}

/** Misma fórmula del servidor: semanal = mensual×12/52; mensual = semanal×52/12 (a céntimos). */
export function sueldoEquivalente(modalidad: Modalidad, monto: number): { semanal: number; mensual: number } {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return modalidad === 'MENSUAL' ? { semanal: r2((monto * 12) / 52), mensual: r2(monto) } : { semanal: r2(monto), mensual: r2((monto * 52) / 12) };
}

export const soles = (n: number | undefined | null) => (n === undefined || n === null ? '—' : `S/ ${n.toFixed(2)}`);

export const listarPlanilla = (fecha?: string) => api.get<{ fecha: string; filas: FilaPlanilla[] }>(`/admin/planilla${fecha ? `?fecha=${fecha}` : ''}`);
export const detallePlanilla = (partyId: number, fecha: string, excluir: string[], omitirCuotas: string[] = [], omitirRecurrentes: string[] = []) =>
  api.get<DetallePlanilla>(
    `/admin/planilla/persona/${partyId}?fecha=${fecha}${excluir.length ? `&excluir=${excluir.join(',')}` : ''}${omitirCuotas.length ? `&omitirCuotas=${omitirCuotas.join(',')}` : ''}${omitirRecurrentes.length ? `&omitirRecurrentes=${omitirRecurrentes.join(',')}` : ''}`,
  );
export const obtenerSueldo = (partyId: number) => api.get<{ sueldo: SueldoPersona | null; pago?: PagoPersona | null }>(`/admin/planilla/sueldo/${partyId}`);
export interface DatosSueldoExtra {
  metodo?: MetodoValorHora;
  diasMes?: number | null;
  horasDia?: number | null;
  tarifaHora?: number | null;
  pagoCelular?: string | null;
  pagoMedio?: string | null;
}
export const guardarSueldo = (partyId: number, modalidad: Modalidad, monto: number, extra: DatosSueldoExtra = {}) =>
  api.put(`/admin/planilla/sueldo/${partyId}`, { modalidad, monto, ...extra });
export const crearAjuste = (tipo: 'ADELANTO' | 'DESCUENTO' | 'BONO', datos: { partyId: number; fecha: string; monto: number; motivo: string; categoria?: string }) =>
  api.post(`/admin/planilla/${tipo === 'ADELANTO' ? 'adelantos' : tipo === 'BONO' ? 'bonos' : 'descuentos'}`, datos);
export const anularAjuste = (id: number, motivo: string) => api.post(`/admin/planilla/ajustes/${id}/anular`, { motivo });
export const aprobarExtra = (partyId: number, jornada: string, aprobada: boolean) => api.post('/admin/planilla/extras', { partyId, jornada, aprobada });
export const pagarPlanilla = (partyId: number, fecha: string, excluirConsumoIds: string[], omitirCuotaIds: string[] = [], omitirRecurrenteIds: string[] = []) =>
  api.post('/admin/planilla/pagar', { partyId, fecha, excluirConsumoIds, omitirCuotaIds, omitirRecurrenteIds });

// Préstamos con cuotas y descuentos recurrentes (Netflix)
export interface CuotaPrestamoApi { id: number; numero: number; monto: number; estado: 'PENDIENTE' | 'DESCONTADA' | 'OMITIDA'; periodoDesde: string | null; periodoHasta: string | null; reprogramada: boolean }
export interface PrestamoApi {
  id: number; monto: number; numCuotas: number; periodicidad: 'SEMANAL' | 'MENSUAL'; montoCuota: number; fechaInicio: string;
  /** Interés mensual del préstamo (0 o ausente = sin intereses). */
  interesPctMensual?: number; capital?: number; interesTotal?: number; interes?: number; total?: number; cuota?: number;
  estado: 'ACTIVO' | 'SALDADO' | 'ANULADO'; motivo: string | null; anuladoMotivo: string | null; saldo: number; cuotas: CuotaPrestamoApi[];
}
export interface RecurrenteApi { id: number; tipo: 'NETFLIX' | 'OTRO'; nombre: string; monto: number; activo: boolean; desde: string; periodicidad?: 'SEMANAL' | 'MENSUAL' }
export const listarPrestamos = (partyId: number) => api.get<{ netflixSemanalDefecto: number; prestamos: PrestamoApi[]; recurrentes: RecurrenteApi[] }>(`/admin/planilla/persona/${partyId}/prestamos`);
export const crearPrestamo = (d: { partyId: number; monto: number; numCuotas: number; periodicidad: 'SEMANAL' | 'MENSUAL'; fechaInicio?: string; motivo?: string; interesPctMensual?: number }) => api.post('/admin/planilla/prestamos', d);
export const anularPrestamo = (id: number, motivo: string) => api.post(`/admin/planilla/prestamos/${id}/anular`, { motivo });
export const crearRecurrente = (d: { partyId: number; tipo: 'NETFLIX' | 'OTRO'; nombre?: string; monto?: number; periodicidad?: 'SEMANAL' | 'MENSUAL' }) => api.post('/admin/planilla/recurrentes', d);
export const editarRecurrente = (id: number, d: { nombre?: string; monto?: number; periodicidad?: 'SEMANAL' | 'MENSUAL'; activo?: boolean }) => api.put(`/admin/planilla/recurrentes/${id}`, d);
export const reabrirPlanilla = (periodoId: number, motivo: string) => api.post(`/admin/planilla/periodos/${periodoId}/reabrir`, { motivo });

export interface Feriado { id: number; fecha: string; nombre: string; recargo: number; activo: boolean }
export const listarFeriados = (anio?: number) => api.get<Feriado[]>(`/admin/feriados${anio ? `?anio=${anio}` : ''}`);
export const crearFeriado = (d: { fecha: string; nombre: string; recargo: number }) => api.post<Feriado>('/admin/feriados', d);
export const editarFeriado = (id: number, d: Partial<Pick<Feriado, 'nombre' | 'recargo' | 'activo'>>) => api.patch<Feriado>(`/admin/feriados/${id}`, d);

export interface MiGanado {
  conSueldo: boolean;
  modalidad?: Modalidad;
  periodo?: { desde: string; hasta: string };
  estado?: 'ESTIMADO' | 'PAGADO';
  dias?: Array<{ jornada: string; trabajadaH: number; ganado: number; feriado: string | null; recargo: number }>;
  acumulado?: number;
  neto?: number | null;
}
export const miGanado = () => api.get<MiGanado>('/admin/asistencia/mi/ganado');
