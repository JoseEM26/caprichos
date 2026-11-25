import { api } from '../../comun/api';

/** Contratos de «Mi asistencia» (calendario) y «Mis pagos». Solo estado, horas y resultados: nunca foto, GPS ni datos ajenos. */
export type EstadoRespuesta = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export type TipoDia = 'TRABAJA' | 'DESCANSO' | 'FERIADO' | 'VACACIONES' | 'COBERTURA' | 'REEMPLAZO';

export interface DiaCalendario {
  fecha: string;
  /** Marca de entrada que cuenta (para justificar una tardanza). */
  entradaMarcaId?: number | null;
  feriado?: string | null;
  /** Horario del turno; almuerzo y duración (que cuenta el almuerzo) si el API los trae. */
  programado?: { entrada: string; salida: string; almuerzo?: { desde: string; hasta: string } | null; duracionMin?: number } | null;
  tipoDia?: TipoDia;
  /** Recargo del feriado (×N); null si no es feriado. */
  recargo?: number | null;
  /** Las horas trabajadas ese día se pagan con recargo. */
  pagaRecargo?: boolean;
  cobertura?: { rol: 'COBRE' | 'CUBIERTO'; parcial: boolean } | null;
  motivoDescanso?: string | null;
  /** Hay marcas en un día sin turno: se paga solo si el admin lo aprueba. */
  trabajoEnDescanso?: boolean;
  estado: string;
  entrada?: string | null;
  almuerzoSalida?: string | null;
  almuerzoVuelta?: string | null;
  almuerzoMin?: number | null;
  salida?: string | null;
  trabajadaMin?: number | null;
  tardanzaMin?: number | null;
  salioAntesMin?: number | null;
  extraMin?: number | null;
  extraEstado?: EstadoRespuesta | null;
  marcas?: { tipo: string | null; hora: string; estado: string }[];
  solicitud?: { id: number; tipo: string; estado: EstadoRespuesta; motivo?: string | null; respuesta?: string | null } | null;
}

export interface ResumenCalendario {
  diasTrabajados?: number;
  horasTrabajadasMin?: number;
  tardanzaMin?: number;
  extraAprobadaMin?: number;
  extraPendienteMin?: number;
  faltas?: number;
  diasProgramados?: number;
  diasDescanso?: number;
  feriadosConRecargo?: number;
  horasProgramadasMin?: number;
}

export interface Proximos {
  descanso: { fecha: string } | null;
  feriado: { fecha: string; nombre: string; recargo: number } | null;
}

export interface MiCalendario {
  desde: string;
  hasta: string;
  dias: DiaCalendario[];
  resumen?: ResumenCalendario;
  proximos?: Proximos;
}

export const miCalendario = (desde: string, hasta: string) =>
  api.get<MiCalendario>(`/admin/mi-asistencia/calendario?desde=${desde}&hasta=${hasta}`);

export interface MiPlanilla {
  /** false: sin sueldo configurado (o sin vínculo con una ficha: sinVinculo). */
  conSueldo?: boolean;
  sinVinculo?: boolean;
  /** Jornada de hoy según el servidor (Lima). */
  hoy?: string;
  /** true si hoy cae dentro del período: el monto puede cambiar. */
  enCurso?: boolean;
  periodo?: { desde: string; hasta: string; tipo?: string };
  base?: { sueldo?: number | null; tarifaHora?: number | null; valorHora?: number | null };
  horas?: { trabajadasMin?: number; extraAprobadaMin?: number; extraPendienteMin?: number; extraRechazadaMin?: number };
  ganado?: { bruto?: number; extras?: number; bonos?: number };
  /** Se te suma (bruto + bonos) y se te descuenta (suma − neto), para «Cómo se calcula». */
  resumen?: { seSuma: number; seDescuenta: number };
  reglas?: { metodo?: string; valorHora?: number; toleranciaMin?: number; penalidadTardanzaPct?: number; multiplicadorExtra?: number; tercerizado?: boolean; tarifasEspeciales?: { diaSemana: number; desdeHora: string; tarifaHora: number; vigenteDesde: string; vigenteHasta: string | null }[] };
  descuentos?: { id: string | number; fecha?: string; etiqueta?: string; concepto?: string; monto: number; periodicidad?: string }[];
  consumos?: { fecha: string; pedido: string; productos: string[]; monto: number; anterior: boolean; cobrar: boolean }[];
  adelantos?: { id: number; fecha?: string; monto: number; motivo?: string | null }[];
  /** Mis propinas por día (ya incluidas en «Se te suma» y en el neto). */
  propinas?: { total: number; lineas: { fecha: string; totalLocal: number; horas: number; horasTotales: number; porcentaje: number; monto: number; pendiente: boolean }[] };
  bonosManuales?: { id: number; fecha: string; monto: number; motivo?: string | null }[];
  penalidadTardanza?: { total: number; detalle?: { fecha: string; minutos: number; monto: number }[] };
  prestamos?: { id: number; capital: number; interesPctMensual?: number; cuota: number; saldo: number; cuotasPagadas: number; cuotasTotales: number; estado?: string }[];
  serviciosExtra?: { nombre: string; monto: number; periodicidad?: string; activo?: boolean }[];
  feriadosPagados?: { fecha: string; nombre: string; recargo: number; trabajadaH: number; ganado: number }[];
  /** Un registro por día del período (para el detalle de «Mi calendario»). */
  dias?: { fecha: string; estado: string; trabajadaMin: number; tardanzaMin: number; extraMin: number; extraAprobada: boolean; ganado: number; feriado: string | null; vacacion: boolean; penalidadTardanza: number; tarifaEspecial?: { desdeHora: string; tarifaHora: number; horasEspecialesH: number; ganadoEspecial: number } | null }[];
  neto?: number;
  estadoPago?: 'PENDIENTE' | 'PAGADO';
  pagadoEn?: string | null;
}

export const miPlanilla = (periodo?: string) =>
  api.get<MiPlanilla>(`/admin/mi-planilla${periodo ? `?periodo=${periodo}` : ''}`);
