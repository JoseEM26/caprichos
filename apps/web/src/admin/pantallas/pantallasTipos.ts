export interface PantallaItem {
  id: string;
  nombre: string;
  estacion: string;
  /** Qué muestra la TV vinculada por código: «Salón en vivo», «Pedidos del local» o «Cocina · área»; null en TV antiguas */
  vista?: string | null;
  areaId: string | null;
  ultimaConexion: string;
  llave: string;
  estado: 'Activa' | 'Inactiva';
  activo: boolean;
  codigoVinculo: string | null;
  creadoEn: string;
}

export interface AreaCocinaItem {
  id: string;
  nombre: string;
}

export interface RespuestaListarPantallas {
  total: number;
  pantallas: PantallaItem[];
  estaciones: string[];
}
