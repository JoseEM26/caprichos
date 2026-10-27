export type TipoImagenIngreso = 'defecto' | 'archivo';

export interface ImagenIngreso {
  tipo: TipoImagenIngreso;
  /** defecto: nombre del archivo de fábrica; archivo: ruta pública /archivos/publico/... */
  valor: string;
}

export interface PantallaIngresoConfig {
  imagenes: ImagenIngreso[];
  frase: string;
}

/** Respuesta pública (GET /carta/ingreso): URLs ya resueltas, sin datos internos. */
export interface PantallaIngresoPublica {
  imagenes: string[];
  frase: string;
}

/** Respuesta admin (GET/PUT /admin/pantalla-ingreso). */
export interface PantallaIngresoAdmin extends PantallaIngresoConfig {
  fabrica: string[];
}
