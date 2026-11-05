export interface TamanoCarta {
  id: string;
  nombre: string;
  precio: number;
}

export interface OpcionCarta {
  id: string;
  nombre: string;
  precioExtra: number;
  disponible: boolean;
}

export interface GrupoOpcionesCarta {
  id: string;
  nombre: string;
  obligatorio: boolean;
  minimo: number;
  maximo: number;
  opciones: OpcionCarta[];
}

export interface SaborCarta {
  id: string;
  nombre: string;
  disponible: boolean;
}

export interface ProductoCarta {
  id: string;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  precio: number;
  tamanos: TamanoCarta[];
  grupos: GrupoOpcionesCarta[];
  sabores: SaborCarta[];
  noSumaBeneficios: boolean;
  disponible: boolean;
  agotadoHasta: string | null;
  /** Controla su stock (conteo de apertura). */
  controlaStock: boolean;
  /** Quedan con apertura de hoy (entero, nunca negativo); null si no controla stock o no hay apertura hoy. */
  quedan: number | null;
}

export interface CategoriaCarta {
  id: string;
  nombre: string;
  orden: number;
  productos: ProductoCarta[];
}
