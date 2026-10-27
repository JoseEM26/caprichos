/**
 * tiposAspecto.ts
 * Definición de tipos, esquemas, presets y utilidades de aspecto para Capri.
 */

export type EstiloCabello = 'colitas' | 'suelto' | 'trenza' | 'mono';
export type TipoGorro = 'chef' | 'bruja' | 'navideno' | 'ninguno' | 'corona' | 'sombrero';
export type TipoAccesorio =
  | 'calabaza'
  | 'bufanda'
  | 'corazon'
  | 'bandera'
  | 'lazo'
  | 'estrellas'
  | 'guirnalda'
  | 'antifaz'
  | 'bigote';

export const ESTILOS_CABELLO: readonly EstiloCabello[] = [
  'colitas',
  'suelto',
  'trenza',
  'mono',
] as const;

export const TIPOS_GORRO: readonly TipoGorro[] = [
  'chef',
  'bruja',
  'navideno',
  'corona',
  'sombrero',
  'ninguno',
] as const;

export const TIPOS_ACCESORIOS: readonly TipoAccesorio[] = [
  'calabaza',
  'bufanda',
  'corazon',
  'bandera',
  'lazo',
  'estrellas',
  'guirnalda',
  'antifaz',
  'bigote',
] as const;

export interface CabelloConfig {
  color: string;
  estilo: EstiloCabello;
}

export interface UniformeConfig {
  principal: string;
  delantal: string;
  ribete: string;
}

export interface GorroConfig {
  tipo: TipoGorro;
  color: string;
}

export interface AspectoCapri {
  piel: string;
  cabello: CabelloConfig;
  ojos: string;
  uniforme: UniformeConfig;
  gorro: GorroConfig;
  accesorios: TipoAccesorio[];
}

export interface TemaMascota {
  clave: string;
  nombre: string;
  aspecto: Partial<{
    piel: string;
    cabello: Partial<CabelloConfig>;
    ojos: string;
    uniforme: Partial<UniformeConfig>;
    gorro: Partial<GorroConfig>;
    accesorios: TipoAccesorio[];
  }>;
  desde: string; // 'MM-DD'
  hasta: string; // 'MM-DD'
  activo: boolean;
}

export type ModoMascota = 'AUTOMATICO' | 'MANUAL';

export interface ConfiguracionMascota {
  base: AspectoCapri;
  temas: TemaMascota[];
  modo: ModoMascota;
  temaManual?: string; // clave o 'normal'
}

export interface RespuestaPublicaMascota {
  tema: string;
  aspecto: AspectoCapri;
}

export interface RespuestaAdminMascota {
  ok?: boolean;
  config: ConfiguracionMascota;
  aspectoResuelto: AspectoCapri;
  temaActivo: string;
}

/** 6 tonos sugeridos para la paleta de piel */
export const PALETA_PIEL_SUGERIDA = [
  '#FFD9B5', // Melocotón claro (por defecto)
  '#FCD0A1', // Trigueño claro
  '#E5A670', // Trigueño canela
  '#B77742', // Moreno cálido
  '#7D4723', // Cacao profundo
  '#FFE6D5', // Porcelana suave
] as const;

/** Aspecto base de fábrica (el diseño clásico de Capri) */
export const ASPECTO_BASE_DEFECTO: AspectoCapri = {
  piel: '#FFD9B5',
  cabello: {
    color: '#4A2C1D',
    estilo: 'colitas',
  },
  ojos: '#14141A',
  uniforme: {
    principal: '#E67929', // Naranja corporativo
    delantal: '#1C1C22',  // Negro suave / marino oscuro
    ribete: '#D99E39',    // Dorado corporativo
  },
  gorro: {
    tipo: 'chef',
    color: '#FBF4EC',    // Crema suave
  },
  accesorios: [],
};

/** Presets razonables de fábrica para las temporadas */
export const TEMAS_PREDETERMINADOS: TemaMascota[] = [
  {
    clave: 'halloween',
    nombre: 'Halloween',
    desde: '10-24',
    hasta: '11-02',
    activo: true,
    aspecto: {
      uniforme: { principal: '#E67929', delantal: '#2B1B3F', ribete: '#D99E39' },
      gorro: { tipo: 'bruja', color: '#2B1B3F' },
      accesorios: ['calabaza'],
    },
  },
  {
    clave: 'navidad',
    nombre: 'Navidad',
    desde: '12-01',
    hasta: '12-26',
    activo: true,
    aspecto: {
      uniforme: { principal: '#B2500F', delantal: '#1F6B3A', ribete: '#D99E39' },
      gorro: { tipo: 'navideno', color: '#C5221F' },
      accesorios: ['bufanda'],
    },
  },
  {
    clave: 'fiestas_patrias',
    nombre: 'Fiestas Patrias',
    desde: '07-24',
    hasta: '07-30',
    activo: true,
    aspecto: {
      uniforme: { principal: '#FFFFFF', delantal: '#C5221F', ribete: '#D99E39' },
      gorro: { tipo: 'chef', color: '#FBF4EC' },
      accesorios: ['bandera'],
    },
  },
  {
    clave: 'san_valentin',
    nombre: 'San Valentín',
    desde: '02-10',
    hasta: '02-15',
    activo: true,
    aspecto: {
      uniforme: { principal: '#E84A7F', delantal: '#4A1525', ribete: '#FFD1DC' },
      gorro: { tipo: 'corona', color: '#D99E39' },
      accesorios: ['corazon'],
    },
  },
  {
    clave: 'dia_madre',
    nombre: 'Día de la Madre',
    desde: '05-05',
    hasta: '05-12',
    activo: true,
    aspecto: {
      uniforme: { principal: '#E67929', delantal: '#8E2856', ribete: '#D99E39' },
      gorro: { tipo: 'chef', color: '#FBF4EC' },
      accesorios: ['lazo', 'guirnalda'],
    },
  },
  {
    clave: 'ano_nuevo',
    nombre: 'Año Nuevo',
    desde: '12-27',
    hasta: '01-02',
    activo: true,
    aspecto: {
      uniforme: { principal: '#0B2C3E', delantal: '#D99E39', ribete: '#FFFFFF' },
      gorro: { tipo: 'sombrero', color: '#0B2C3E' },
      accesorios: ['estrellas'],
    },
  },
  {
    clave: 'verano',
    nombre: 'Verano',
    desde: '01-05',
    hasta: '03-15',
    activo: true,
    aspecto: {
      uniforme: { principal: '#3BB4E7', delantal: '#0B2C3E', ribete: '#F5C518' },
      gorro: { tipo: 'sombrero', color: '#D2B48C' },
      accesorios: ['antifaz'],
    },
  },
];

export const CONFIGURACION_DEFECTO: ConfiguracionMascota = {
  base: ASPECTO_BASE_DEFECTO,
  temas: TEMAS_PREDETERMINADOS,
  modo: 'AUTOMATICO',
  temaManual: 'normal',
};
