export interface TamanoCarta {
  id: string;
  nombre: string;
  precio: number;
  /** Unidades que lleva el tamaño (1 unidad, media docena = 6, docena = 12). */
  unidades: number;
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
  activo: boolean;
  /** Disponible para elegir: activo, no agotado y con saldo si hay apertura de hoy. */
  disponible: boolean;
  /** Saldo de hoy si hay conteo de apertura del sabor; null si no hay (sin tope). */
  quedan: number | null;
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
  /** Hay al menos un sabor disponible para elegir. */
  saboresConStock: boolean;
}

export interface CategoriaCarta {
  id: string;
  nombre: string;
  orden: number;
  productos: ProductoCarta[];
}
