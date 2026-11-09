export interface UsuarioItem {
  id: string;
  partyId: string;
  nombres: string;
  apellidos: string;
  /** Documento enmascarado (12****78). */
  dni: string;
  tipoDocumento?: string;
  /** Rol principal. */
  rol: string;
  /** Principal primero, luego los extra. */
  roles?: string[];
  paisNacimiento?: string | null;
  /** DD/MM (solo día y mes). */
  cumpleanos?: string | null;
  /** Recibe los avisos del sistema por correo. */
  avisosCorreo?: boolean;
  /** Disponible 24/7 (recibe avisos si nadie con casilla está de turno). */
  horario24_7?: boolean;
  /** Roles extra con fecha de fin vigente (rol temporal). */
  rolesTemporales?: Array<{ rol: string; nombre: string; venceEn: string | null; motivo: string | null }>;
  activo: boolean;
  debeCambiar: boolean;
  altaEn?: string;
}

export interface RespuestaListarUsuarios {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  elementos: UsuarioItem[];
}

export interface RegistroAuditoriaItem {
  id: string;
  categoria: string;
  modulo: string;
  accion: string;
  resultado: 'OK' | 'RECHAZADO' | string;
  entidad: string | null;
  entidadId: string | null;
  antes: unknown;
  despues: unknown;
  motivo: string | null;
  partyId: string | null;
  conPinAdmin: boolean;
  ip: string | null;
  dispositivo: string | null;
  requestId: string | null;
  en: string;
  hashAnterior: string | null;
  hash: string;
}

export interface RespuestaListarAuditoria {
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
  datos: RegistroAuditoriaItem[];
}

export interface ResultadoVerificacionCadena {
  valida: boolean;
  totalFilas: number;
  discrepancias: number;
  primerFalloId?: string | null;
  error?: string;
}

export interface HorarioDiaApi {
  dia: number; // 0 = Domingo
  entrada: string;
  salida: string;
  /** Almuerzo programado (opcional, ambos o ninguno) */
  almuerzoInicio?: string | null;
  almuerzoFin?: string | null;
}

export interface ReemplazoDiaApi {
  dia: number;
  reemplazaPartyId: string;
  nombre?: string;
}

export interface PersonalHorario {
  id: string;
  partyId: string;
  nombres: string;
  apellidos: string;
  rol: string;
  horarios: HorarioDiaApi[];
  reemplazos: ReemplazoDiaApi[];
}
