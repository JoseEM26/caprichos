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
  /** Tarifa pura de la zona, sin aplicar el envío gratis por monto */
  tarifaZona: number | null;
  gratisDesde: number;
  modoGratis: 'desde' | 'mas_de';
}

export interface ZonaAdminItem {
  id: string;
  codigo: string;
  tarifa: number;
  activa: boolean;
  puntos: number;
  poligono?: Coordenada[];
}
