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
  /** Plan B: «Se acabaron: X. Elige entre: Y» (solo si hay opciones agotadas por stock y otras disponibles) */
  aviso?: string | null;
  /** Todas las opciones del paso están agotadas por stock: el combo no se puede armar */
  sinStock?: boolean;
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
  /** «Alcanza para …» (opcional). */
  porciones: string | null;
  /** Alérgenos que contiene; solo se muestran/afirman si alergenosConfirmados. */
  alergenos: string[];
  alergenosConfirmados: boolean;
}

export interface CategoriaCarta {
  id: string;
  nombre: string;
  orden: number;
  productos: ProductoCarta[];
}
