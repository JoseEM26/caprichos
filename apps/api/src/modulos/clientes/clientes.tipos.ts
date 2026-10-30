export interface ClienteSesion {
  partyId: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  fotoUrl: string | null;
  cumpleanos: string | null;
  puntos: number;
}

export interface RegistroClienteDto {
  nombre: string;
  telefono: string; // celular de 9 dígitos que empieza con 9: es el usuario de la cuenta
  contrasena: string; // mínimo 8 caracteres
  correo?: string;
  cumpleanos?: string; // YYYY-MM-DD o DD/MM
  aceptaDatos: boolean;
}

export interface PerfilClienteDto {
  nombre?: string;
  telefono?: string; // solo se acepta el mismo celular de la cuenta
  correo?: string;
  cumpleanos?: string; // YYYY-MM-DD o DD/MM
}

export interface IngresoClienteDto {
  telefono: string;
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
  telefono?: string; // obligatorio para una persona
  ruc?: string; // solo empresas (11 dígitos)
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
