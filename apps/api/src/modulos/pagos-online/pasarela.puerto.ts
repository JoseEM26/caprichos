/** Puerto de la pasarela de pago en línea: el servicio solo conoce esto; Culqi y el simulado son adaptadores. */
export const PASARELA_PAGO = Symbol('PASARELA_PAGO');

export type MedioPagoOnline = 'TARJETA' | 'YAPE';
export type ResultadoCargo = 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';

export interface PedirCargo {
  montoCentimos: number;
  moneda: string;
  /** Token que entrega Culqi Checkout (tkn_... de tarjeta o ype_... de Yape); nunca datos de tarjeta */
  token: string;
  medio: MedioPagoOnline;
  email: string;
  descripcion: string;
  metadata: Record<string, string>;
}

export interface CargoHecho {
  estado: ResultadoCargo;
  cargoId: string | null;
  marca: string | null;
  ultimos4: string | null;
  /** Texto para el cliente, en español simple */
  mensaje: string;
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
  devolver(p: PedirDevolucion): Promise<{ devolucionId: string }>;
}

/** Fallo sin resultado conocido (red, tiempo agotado, respuesta ilegible). No debe tratarse como rechazo. */
export class ErrorPasarela extends Error {}
