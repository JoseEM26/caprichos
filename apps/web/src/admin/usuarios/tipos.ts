export interface UsuarioItem {
  id: string;
  partyId: string;
  nombres: string;
  apellidos: string;
  dni: string;
  rol: string;
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
