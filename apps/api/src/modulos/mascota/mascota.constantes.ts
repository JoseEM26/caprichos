import { AspectoBase, MascotaConfig, TemaMascota } from './mascota.tipos';

export const CLAVE_PARAMETRO_MASCOTA = 'mascota_config';

export const ESTILOS_CABELLO = [
  'colitas',
  'suelto',
  'trenza',
  'mono',
  'corto',
  'rizado',
  'melena',
  'coleta',
] as const;

export const TIPOS_GORRO = [
  'chef',
  'bruja',
  'navideno',
  'ninguno',
  'corona',
  'sombrero',
  'gorra',
  'boina',
  'beanie',
  'diadema',
] as const;

export const PRENDAS_UNIFORME = ['chaqueta', 'polo', 'mandil', 'pechera'] as const;

export const ESCALA_MINIMA = 0.7;
export const ESCALA_MAXIMA = 1.5;
export const ESCALA_DEFECTO = 1;

export const ACCESORIOS_VALIDOS = [
  'calabaza',
  'bufanda',
  'corazon',
  'bandera',
  'banda',
  'lazo',
  'estrellas',
  'guirnalda',
  'antifaz',
  'bigote',
  'lentes',
  'confeti',
  'flor',
  'aretes',
  'mochila',
  'medalla',
] as const;

export const TONOS_PIEL_SUGERIDOS = [
  '#FFE0C2',
  '#F5C6A5',
  '#E0AC69',
  '#C68642',
  '#8D5524',
  '#3D2314',
] as const;

export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const MM_DD_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export const DEFAULT_ASPECTO_BASE: AspectoBase = {
  piel: '#FFE0C2',
  cabello: {
    color: '#3D2314',
    estilo: 'colitas',
  },
  ojos: '#1C1C22',
  uniforme: {
    principal: '#E67929',
    delantal: '#1C1C22',
    ribete: '#D99E39',
    prenda: 'chaqueta',
  },
  gorro: {
    tipo: 'chef',
    color: '#FBF4EC',
  },
  accesorios: [],
};

export const DEFAULT_TEMAS: TemaMascota[] = [
  {
    clave: 'halloween',
    nombre: 'Halloween',
    desde: '10-24',
    hasta: '11-02',
    activo: true,
    aspecto: {
      gorro: {
        tipo: 'bruja',
        color: '#4A154B',
      },
      uniforme: {
        principal: '#E67929',
        delantal: '#2D132C',
        ribete: '#9B51E0',
      },
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
      gorro: {
        tipo: 'navideno',
        color: '#D32F2F',
      },
      uniforme: {
        principal: '#B2500F',
        delantal: '#1C3A27',
        ribete: '#D99E39',
      },
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
      gorro: {
        tipo: 'chef',
        color: '#FBF4EC',
      },
      uniforme: {
        principal: '#D32F2F',
        delantal: '#FFFFFF',
        ribete: '#D32F2F',
      },
      accesorios: ['bandera', 'banda'],
    },
  },
  {
    clave: 'san_valentin',
    nombre: 'San Valentín',
    desde: '02-10',
    hasta: '02-15',
    activo: true,
    aspecto: {
      gorro: {
        tipo: 'corona',
        color: '#E91E63',
      },
      uniforme: {
        principal: '#E91E63',
        delantal: '#F8BBD0',
        ribete: '#C2185B',
      },
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
      gorro: {
        tipo: 'ninguno',
        color: '#FBF4EC',
      },
      uniforme: {
        principal: '#F06292',
        delantal: '#FCE4EC',
        ribete: '#D99E39',
      },
      accesorios: ['lazo', 'flor'],
    },
  },
  {
    clave: 'ano_nuevo',
    nombre: 'Año Nuevo',
    desde: '12-27',
    hasta: '01-02',
    activo: true,
    aspecto: {
      gorro: {
        tipo: 'sombrero',
        color: '#D99E39',
      },
      uniforme: {
        principal: '#D99E39',
        delantal: '#0B2C3E',
        ribete: '#FBF4EC',
      },
      accesorios: ['estrellas', 'confeti'],
    },
  },
  {
    clave: 'verano',
    nombre: 'Verano',
    desde: '01-05',
    hasta: '03-15',
    activo: true,
    aspecto: {
      gorro: {
        tipo: 'sombrero',
        color: '#F4D06F',
      },
      uniforme: {
        principal: '#2A9D8F',
        delantal: '#E76F51',
        ribete: '#F4A261',
      },
      accesorios: ['lentes'],
    },
  },
];

export const DEFAULT_MASCOTA_CONFIG: MascotaConfig = {
  base: DEFAULT_ASPECTO_BASE,
  temas: DEFAULT_TEMAS,
  modo: 'AUTOMATICO',
  temaManual: 'normal',
  escala: ESCALA_DEFECTO,
};
