export interface ClienteSesion {
  partyId: string;
  nombre: string;
  dniMascara: string;
  correo: string | null;
  cumpleanos: string | null;
  puntos: number;
}

export interface RegistroClienteDto {
  dni: string;
  nombre: string;
  contrasena: string;
  correo?: string;
  cumpleanos: string; // YYYY-MM-DD o DD/MM
  aceptaDatos: boolean;
}

export interface IngresoClienteDto {
  dni: string;
  contrasena: string;
}

export interface NotificacionCliente {
  id: string;
  t: string; // título
  x: string; // descripción
  fresh?: boolean;
  code?: string;
  hasCode?: boolean;
  hasTicket?: boolean;
  tCode?: string;
  tNote?: string;
  tVence?: string;
  askBday?: boolean;
}

export interface ClienteAdminListItem {
  id: string;
  nombre: string;
  tipo: 'Persona' | 'Empresa' | 'Personal';
  dni: string;
  telefono: string;
  correo: string;
  cumpleanos: string;
  pedidos: number;
  puntos: number;
  creditoPersonal: boolean;
  envioFijo: number | null;
  descuentoEnvio: number | null;
  activo: boolean;
}

export interface RegistrarMostradorDto {
  nombre: string;
  dni: string;
  telefono?: string;
  correo?: string;
  cumpleanos?: string; // YYYY-MM-DD
  aceptaDatos: boolean;
}

export interface EditarClienteAdminDto {
  nombre?: string;
  telefono?: string;
  correo?: string;
  cumpleanos?: string; // DD/MM o YYYY-MM-DD
  envioFijo?: number | null;
  descuentoEnvio?: number | null;
}

export interface AjustarPuntosDto {
  puntos: number;
  tipo?: 'SUMA' | 'REVERSA' | 'CANJE';
  motivo: string;
}
