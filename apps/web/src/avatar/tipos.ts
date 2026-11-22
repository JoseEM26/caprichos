import type * as THREE from 'three';

/** Lo que se guarda en la cuenta: ids de piezas y colores hex (el servidor lo valida igual). */
export interface PiezaElegida {
  id: string;
  colores: Record<string, string>;
  /** Solo la mascota: nombre opcional (máx. 14 letras) */
  nombre?: string;
}
export type CategoriaPieza = 'cabello' | 'arriba' | 'abajo' | 'calzado' | 'cabeza' | 'cara' | 'accesorio' | 'mascota';
export type Genero = 'mujer' | 'hombre' | 'neutro';
export type Expresion = 'feliz' | 'sonrisa' | 'guino' | 'sorpresa';

export interface ConfigAvatar extends Record<CategoriaPieza, PiezaElegida> {
  nombre: string;
  genero: Genero;
  piel: string;
  ojos: string;
  expresion: Expresion;
  colorPelo: string;
  disfraz: string | null;
  disfrazId: string | null;
  /** Saludo al entrar a la carta (encendido si falta) */
  mostrarAlEntrar?: boolean;
  /** Usar el retrato del avatar como foto de perfil de la cuenta */
  usarComoFoto?: boolean;
}

export interface DefPieza {
  id: string;
  nombre: string;
  grupo?: string;
  colores: string[];
  porDefecto?: Record<string, string>;
  /** Disfraz destacado: sale en la sección «Destacados ✨» del editor con insignia «Nuevo» */
  destacado?: boolean;
  /** Gorro con orejas o cuernos altos: el retrato se aleja un poco para no cortarlos */
  orejasAltas?: boolean;
  nuevo?: boolean;
  descripcion?: string;
  aplica?: Record<string, { id: string; colores?: Record<string, string> } | string>;
}

/** Partes animables del cuerpo construido (ver el contrato en nucleo.js). */
export interface PartesAvatar {
  raiz: THREE.Group;
  cuerpo: THREE.Group;
  cabeza: THREE.Group;
  brazos: THREE.Group[];
  codos: THREE.Group[];
  piernas: THREE.Group[];
  rodillas: THREE.Group[];
  ojos: THREE.Group[];
  /** Grupo de la mascota (si eligió una): va al lado del avatar, mira a +z y se anima sola */
  mascota?: THREE.Group;
  mascotaNombre?: string;
  /** Hace que la mascota festeje unos segundos (cuando el avatar celebra o saluda) */
  mascotaAlegrar?: (segundos?: number) => void;
  animar: (t: number, dt: number) => void;
}

export interface Avatar3D {
  REG: Record<string, DefPieza[]>;
  buscar: (cat: string, id: string) => DefPieza | undefined;
  construir: (c: unknown) => PartesAvatar;
}
