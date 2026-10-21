export type Coordenada = [number, number]; // [lat, lng]

export interface ZonaDetectada {
  zonaId: bigint;
  codigo: string;
  tarifa: number;
}

export interface RespuestaConsultaEnvio {
  cubierto: boolean;
  zona: string | null;
  tarifa: number | null;
  gratisDesde: number;
}

export interface ZonaAdminItem {
  id: string;
  codigo: string;
  tarifa: number;
  activa: boolean;
  puntos: number;
  poligono?: Coordenada[];
}
