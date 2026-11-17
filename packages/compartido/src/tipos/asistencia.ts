// Contratos de asistencia (marcas con tipo, «mi día», calendario del admin y calendario propio).

export const TIPOS_MARCA_QR = ['ENTRADA', 'SALIDA', 'ALMUERZO_SALIDA', 'ALMUERZO_VUELTA'] as const;
export type TipoMarca = (typeof TIPOS_MARCA_QR)[number];

/** Marca de «Mi día»: `tipo` es el que declaró la persona (null en marcas antiguas). */
export interface MarcaMiDia {
  id: number;
  tipo: TipoMarca | null;
  hora: string;
  estado: string;
}

export interface CalendarioDiaResumen {
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
export interface CalendarioResumen {
  desde: string;
  hasta: string;
  dias: CalendarioDiaResumen[];
}

export interface CalendarioMarcaFila {
  id: number;
  tipo: TipoMarca | null;
  hora: string;
  origen: string;
  estado: string;
  tieneSelfie: boolean;
}
export interface CalendarioFila {
  fecha: string;
  partyId: string;
  nombre: string;
  rol: string;
  turno: { entrada: string; salida: string } | null;
  marcas: CalendarioMarcaFila[];
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
export interface CalendarioFilas {
  total: number;
  pagina: number;
  limite: number;
  filas: CalendarioFila[];
  totales: { trabajadaMin: number; tardanzaMin: number; extraMin: number; faltas: number };
}

export type EstadoSolicitudMia = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
/** Qué tipo de día es para la persona (precedencia: vacaciones, feriado, cobertura, trabaja, reemplazo, descanso). */
export type TipoDiaCalendario = 'TRABAJA' | 'DESCANSO' | 'FERIADO' | 'VACACIONES' | 'COBERTURA' | 'REEMPLAZO';
/** Horario programado del día; `duracionMin` cuenta el almuerzo (se paga). */
export interface ProgramadoCalendario {
  entrada: string;
  salida: string;
  almuerzo?: { desde: string; hasta: string } | null;
  duracionMin?: number;
}
/** Cobertura del día: `COBRE` = cubres el turno de otra persona; `CUBIERTO` = tu turno lo cubre otra (`parcial` si te queda una parte). Sin nombres. */
export interface CoberturaDiaCalendario {
  rol: 'COBRE' | 'CUBIERTO';
  parcial: boolean;
}
export type EstadoExtraMia = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export interface MiCalendarioDia {
  fecha: string;
  /** Id de la marca que cuenta como entrada (para pedir que se justifique una tardanza); null si no hay. */
  entradaMarcaId?: number | null;
  feriado: string | null;
  programado: ProgramadoCalendario | null;
  /** Tipo de día (TRABAJA, DESCANSO, FERIADO...). Ausente en respuestas viejas. */
  tipoDia?: TipoDiaCalendario;
  /** Recargo del feriado (×N) si el día es feriado activo; null si no. */
  recargo?: number | null;
  /** true si las horas trabajadas de ese día se pagan con recargo (feriado con recargo distinto de 1, sin vacaciones). */
  pagaRecargo?: boolean;
  cobertura?: CoberturaDiaCalendario | null;
  /** Por qué no hay turno: «Descanso semanal», «Reemplazado ese día», «Cubierto por otra persona». */
  motivoDescanso?: string | null;
  /** Hay marcas en un día sin turno: solo se paga si el admin aprueba esas horas. */
  trabajoEnDescanso?: boolean;
  estado: string;
  entrada: string | null;
  almuerzoSalida: string | null;
  almuerzoVuelta: string | null;
  almuerzoMin: number | null;
  salida: string | null;
  trabajadaMin: number;
  tardanzaMin: number;
  salioAntesMin: number;
  extraMin: number;
  extraEstado: EstadoExtraMia | null;
  marcas: Array<{ tipo: TipoMarca | null; hora: string; estado: string }>;
  solicitud: { id: number; tipo: string; estado: EstadoSolicitudMia; motivo: string | null; respuesta: string | null } | null;
}
export interface MiCalendario {
  desde: string;
  hasta: string;
  dias: MiCalendarioDia[];
  resumen: {
    diasTrabajados: number; horasTrabajadasMin: number; tardanzaMin: number; extraAprobadaMin: number; extraPendienteMin: number; faltas: number;
    /** Días con turno programado en el rango. */
    diasProgramados?: number;
    /** Días de descanso (sin turno, sin cubrir). */
    diasDescanso?: number;
    /** Feriados activos del rango que pagan con recargo distinto de 1. */
    feriadosConRecargo?: number;
    horasProgramadasMin?: number;
  };
  /** Próximo descanso y próximo feriado desde hoy (independiente del mes mostrado). */
  proximos?: {
    descanso: { fecha: string } | null;
    feriado: { fecha: string; nombre: string; recargo: number } | null;
  };
}
