export interface UsuarioItem {
  id: string;
  partyId: string;
  nombres: string;
  apellidos: string;
  /** Documento: completo para el ADMIN; enmascarado (12****78) para el resto. */
  dni: string;
  /** Celular de la persona (solo llega al ADMIN). */
  celular?: string | null;
  correo?: string | null;
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
  /** Sin celular activo: no tendrá descuento de personal en la carta. */
  sinCelular?: boolean;
  /** Su cuenta de cliente está vinculada: ya recibe el descuento de personal en la carta. */
  cuentaClienteVinculada?: boolean;
  debeCambiar: boolean;
  altaEn?: string;
}

export interface RespuestaListarUsuarios {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  elementos: UsuarioItem[];
  conteos?: ConteosUsuarios;
}

export interface ConteosUsuarios {
  total: number;
  activos: number;
  inactivos: number;
  porRol: Record<string, number>;
}

export interface RegistroAuditoriaItem {
  id: string;
  categoria: string;
  modulo: string;
  /** Nombre en español del módulo (lo arma el servidor). */
  moduloNombre?: string;
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
  /** Nombre y apellidos de quien hizo la acción; null si no se conoce. */
  usuarioNombre?: string | null;
  /** Nombre real de la entidad (producto, categoría...), si se conoce. */
  entidadNombre?: string | null;
  /** Frase en español que resume qué se hizo y sobre qué. */
  descripcion?: string;
}

export interface RespuestaListarAuditoria {
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
  datos: RegistroAuditoriaItem[];
  conteos?: { categoria: Record<string, number>; resultado: Record<string, number> };
  aviso?: string;
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
