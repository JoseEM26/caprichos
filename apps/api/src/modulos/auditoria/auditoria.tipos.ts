export interface RegistroAuditoria {
  categoria: 'CAMBIO' | 'ACCESO' | 'LECTURA_SENSIBLE';
  modulo: string;
  accion: string;
  resultado?: 'OK' | 'RECHAZADO';
  entidad?: string;
  entidadId?: bigint;
  antes?: unknown; // DNI y teléfonos enmascarados por quien llama (ADR-005)
  despues?: unknown;
  motivo?: string;
  partyId?: bigint;
  conPinAdmin?: boolean;
  ip?: string;
  dispositivo?: string;
  requestId?: string;
}
