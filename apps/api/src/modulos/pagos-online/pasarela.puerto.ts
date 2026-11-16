/** Puerto de la pasarela de pago en línea: el servicio solo conoce esto; Culqi y el simulado son adaptadores. */
export const PASARELA_PAGO = Symbol('PASARELA_PAGO');

export type MedioPagoOnline = 'TARJETA' | 'YAPE';
export type ResultadoCargo = 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'REQUIERE_3DS';

export interface PedirCargo {
  montoCentimos: number;
  moneda: string;
  /** Token que entrega Culqi Checkout (tkn_... de tarjeta o ype_... de Yape); nunca datos de tarjeta */
  token: string;
  medio: MedioPagoOnline;
  email: string;
  descripcion: string;
  metadata: Record<string, string>;
  /** Huella del dispositivo (Culqi3DS.generateDevice()), va en antifraud_details */
  deviceId?: string;
  /** Parámetros que entrega Culqi3DS tras autenticar (segundo cargo del mismo intento) */
  autenticacion3ds?: Record<string, unknown>;
}

import type { ComisionCobro } from './comision-pasarela';

/** Cargo tal como lo informa la API de Culqi (GET /charges/{id}); lo único que el webhook toma como verdad. */
export interface CargoConsultado {
  cargoId: string;
  estado: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
  montoCentimos: number;
  moneda: string;
  metadata: Record<string, unknown>;
  devueltoCentimos: number;
  /** Comisión real que informa Culqi (null si no la manda) */
  comision?: ComisionCobro | null;
}

export interface CargoHecho {
  estado: ResultadoCargo;
  cargoId: string | null;
  marca: string | null;
  ultimos4: string | null;
  /** Código de error de Culqi cuando es RECHAZADO (insufficient_funds, incorrect_cvv...) */
  codigo?: string;
  /** Texto para el cliente, en español simple */
  mensaje: string;
  comision?: ComisionCobro | null;
}

export interface PedirDevolucion {
  cargoId: string;
  montoCentimos: number;
  motivo: string;
}

export interface PasarelaPago {
  readonly modo: 'SIMULADO' | 'REAL';
  /** Llave pública para Culqi Checkout (null en simulado) */
  readonly publicKey: string | null;
  /** Lanza ErrorPasarela si no se pudo saber el resultado (red, tiempo agotado): el cargo queda PENDIENTE */
  cargar(p: PedirCargo): Promise<CargoHecho>;
  /** null si el cargo no existe. Lanza ErrorPasarela si no hay respuesta. */
  consultarCargo(cargoId: string): Promise<CargoConsultado | null>;
  devolver(p: PedirDevolucion): Promise<{ devolucionId: string }>;
}

/** Fallo sin resultado conocido (red, tiempo agotado, respuesta ilegible). No debe tratarse como rechazo. */
export class ErrorPasarela extends Error {}
