import { api } from '../../comun/api';

export interface ComentarioIniciativa {
  id: string;
  iniciativaId: string;
  texto: string;
  creadoEn: string;
  fechaTexto: string;
  autor: {
    id: string;
    nombre: string;
    rol: string;
  };
}

export interface IniciativaItem {
  id: string;
  codigo: string;
  tipo: 'QUEJA' | 'MEJORA' | 'IDEA' | string;
  tipoTexto: string;
  area: string;
  areaTexto: string;
  titulo: string;
  detalle: string;
  archivoId: string | null;
  fotoUrl: string | null;
  estado: 'NUEVA' | 'EN_REVISION' | 'HECHA' | 'NO_POR_AHORA' | string;
  estadoTexto: string;
  creadoEn: string;
  fechaTexto: string;
  autor: {
    id: string;
    nombre: string;
    rol: string;
  };
  comentarios: ComentarioIniciativa[];
  totalComentarios: number;
}

export interface ConteosIniciativas {
  total: number;
  nuevas: number;
  enRevision: number;
  hechas: number;
  noPorAhora: number;
  quejas: number;
  mejoras: number;
  ideas: number;
}

export interface RespuestaIniciativas {
  conteos: ConteosIniciativas;
  elementos: IniciativaItem[];
}

export interface FiltrosIniciativas {
  busqueda?: string;
  tipo?: string;
  estado?: string;
  soloMias?: boolean;
}

export interface CrearIniciativaPayload {
  tipo: string;
  area: string;
  titulo: string;
  detalle: string;
  archivoId?: string | number | null;
}

export async function listarIniciativas(filtros: FiltrosIniciativas = {}): Promise<RespuestaIniciativas> {
  const params = new URLSearchParams();
  if (filtros.busqueda) params.set('busqueda', filtros.busqueda);
  if (filtros.tipo && filtros.tipo !== 'TODOS') params.set('tipo', filtros.tipo);
  if (filtros.estado && filtros.estado !== 'TODOS') params.set('estado', filtros.estado);
  if (filtros.soloMias) params.set('soloMias', 'true');

  const query = params.toString();
  return api.get<RespuestaIniciativas>(`/admin/iniciativas${query ? `?${query}` : ''}`);
}

export async function crearIniciativa(payload: CrearIniciativaPayload): Promise<any> {
  return api.post('/admin/iniciativas', payload);
}

export async function comentarIniciativa(id: string, texto: string): Promise<ComentarioIniciativa> {
  return api.post(`/admin/iniciativas/${id}/comentarios`, { texto });
}

export async function cambiarEstadoIniciativa(id: string, estado: string): Promise<any> {
  return api.patch(`/admin/iniciativas/${id}/estado`, { estado });
}

export async function subirCapturaIniciativa(archivo: File): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  formData.append('privado', 'true');

  const res = await fetch('/admin/archivos', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Error al subir la captura de la iniciativa');
  }

  return res.json();
}
