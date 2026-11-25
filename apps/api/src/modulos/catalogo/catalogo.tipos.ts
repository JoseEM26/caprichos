export interface TamanoCarta {
  id: string;
  nombre: string;
  precio: number;
  /** Unidades que lleva el tamaño (1 unidad, media docena = 6, docena = 12). */
  unidades: number;
  /** Foto propia del tamaño; null = se usa la del producto. Solo se muestra si `mostrarImagenesTamanos`. */
  fotoUrl?: string | null;
}

export interface OpcionCarta {
  id: string;
  nombre: string;
  precioExtra: number;
  disponible: boolean;
  /** Foto propia de la opción; null = se usa la del producto. Solo se muestra si el grupo tiene `mostrarImagenes`. */
  fotoUrl?: string | null;
}

export interface GrupoOpcionesCarta {
  id: string;
  nombre: string;
  obligatorio: boolean;
  minimo: number;
  maximo: number;
  /** Interruptor «Mostrar imágenes» del grupo (apagado por defecto). */
  mostrarImagenes?: boolean;
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
  /** Foto propia del sabor; null = se usa la del producto. Solo se muestra si `mostrarImagenesSabores`. */
  fotoUrl?: string | null;
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
  /** Interruptores del producto: mostrar la foto de cada sabor / de cada tamaño. */
  mostrarImagenesSabores?: boolean;
  mostrarImagenesTamanos?: boolean;
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
  /** Solo en la carta del panel (incluirOcultos): el producto está oculto para el cliente. */
  oculto?: boolean;
}

export interface CategoriaCarta {
  id: string;
  nombre: string;
  orden: number;
  productos: ProductoCarta[];
  /** Solo en la carta del panel (incluirOcultos): la categoría está oculta para el cliente. */
  oculta?: boolean;
}
