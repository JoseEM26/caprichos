import type { FilaCal } from './calendarioApi';
import type { ResultadoLote } from './correccionesApi';
import type { DetallePlanilla, TipoSeleccion } from './planillaApi';

export type Avisar = (m: string | null) => void;
export type SeccionPlanilla = 'resumen' | 'asistencia' | 'descuentos' | 'pago' | 'historial';
export const SECCIONES: SeccionPlanilla[] = ['resumen', 'asistencia', 'descuentos', 'pago', 'historial'];

/** Todo lo que comparten las pestañas de la página de una persona (estado, acciones y cálculos del bloqueo de pago). */
export interface CtlPlanilla {
  d: DetallePlanilla;
  r: DetallePlanilla['resultado'];
  pagado: boolean;
  ocupado: boolean;
  ejecutar: (fn: () => Promise<unknown>, ok: string) => Promise<void>;
  cargar: () => Promise<void>;
  recargarCal: () => Promise<void>;
  filasCal: FilaCal[] | null;
  errorCal: boolean;
  irA: (s: SeccionPlanilla) => void;
  onError: Avisar;
  onOk: Avisar;
  // asistencia
  porRevisar: string[];
  faltan: number;
  penal: number;
  detallePenal: Array<{ fecha: string; minutos: number; monto: number }>;
  setConfirmaSimples: (v: boolean) => void;
  resSimples: ResultadoLote | null;
  // pagar igual
  pagarIgual: string | null;
  setPagarIgual: (v: string | null) => void;
  borradorIgual: string | null;
  setBorradorIgual: (v: string | null) => void;
  // créditos y selecciones del pago
  antSinCobrar: DetallePlanilla['consumos'];
  antTotal: number;
  sinDescontarAnt: boolean;
  setSinDescontarAnt: (v: boolean) => void;
  faltaCredito: boolean;
  /** Guarda en el servidor un check del pago (consumo, cuota o descuento personalizado) y recarga el detalle. */
  seleccionar: (tipo: TipoSeleccion, refId: string, activo: boolean) => Promise<void>;
  /** Clave (claveSeleccion) del check que se está guardando, o null. */
  guardando: string | null;
  /** Motivo claro por el que «Marcar pagado» está bloqueado (null = se puede pagar). */
  bloqueo: { texto: string; seccion: SeccionPlanilla } | null;
  alPagar: () => void;
}
