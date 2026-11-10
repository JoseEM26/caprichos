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
export type EstadoExtraMia = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export interface MiCalendarioDia {
  fecha: string;
  feriado: string | null;
  programado: { entrada: string; salida: string } | null;
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
  resumen: { diasTrabajados: number; horasTrabajadasMin: number; tardanzaMin: number; extraAprobadaMin: number; extraPendienteMin: number; faltas: number };
}
