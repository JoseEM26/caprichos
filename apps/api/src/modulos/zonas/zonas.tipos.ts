export type Coordenada = [number, number]; // [lat, lng]

export interface ZonaDetectada {
  zonaId: bigint;
  codigo: string;
  tarifa: number;
  /** Minutos típicos de entrega de la zona (null si no están definidos). */
  minutos?: RangoMinutosZona | null;
}

/** Rango de minutos de entrega de una zona (enteros). */
export interface RangoMinutosZona {
  min: number;
  max: number;
}

export interface RespuestaConsultaEnvio {
  cubierto: boolean;
  zona: string | null;
  /** Minutos típicos de la zona, aditivo (null si no hay zona o no tiene minutos). */
  minutos?: RangoMinutosZona | null;
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
  /** Minutos típicos de entrega (null si la zona aún no los tiene). */
  minutosMin?: number | null;
  minutosMax?: number | null;
  activa: boolean;
  puntos: number;
  poligono?: Coordenada[];
}
