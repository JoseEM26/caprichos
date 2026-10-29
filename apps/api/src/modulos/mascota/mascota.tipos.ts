export type EstiloCabello =
  | 'colitas'
  | 'suelto'
  | 'trenza'
  | 'mono'
  | 'corto'
  | 'rizado'
  | 'melena'
  | 'coleta';

export type TipoPrenda = 'chaqueta' | 'polo' | 'mandil' | 'pechera';

export type TipoGorro =
  | 'chef'
  | 'bruja'
  | 'navideno'
  | 'ninguno'
  | 'corona'
  | 'sombrero'
  | 'gorra'
  | 'boina'
  | 'beanie'
  | 'diadema';

export type ModoMascota = 'AUTOMATICO' | 'MANUAL';

export interface CabelloConfig {
  color: string;
  estilo: EstiloCabello;
}

export interface UniformeConfig {
  principal: string;
  delantal: string;
  ribete: string;
  prenda?: TipoPrenda;
}

export interface GorroConfig {
  tipo: TipoGorro;
  color: string;
}

export interface AspectoBase {
  piel: string;
  cabello: CabelloConfig;
  ojos: string;
  uniforme: UniformeConfig;
  gorro: GorroConfig;
  accesorios: string[];
}

export interface AspectoParcial {
  piel?: string;
  cabello?: Partial<CabelloConfig>;
  ojos?: string;
  uniforme?: Partial<UniformeConfig>;
  gorro?: Partial<GorroConfig>;
  accesorios?: string[];
}

export interface TemaMascota {
  clave: string;
  nombre: string;
  aspecto: AspectoParcial;
  desde: string; // 'MM-DD'
  hasta: string; // 'MM-DD'
  activo: boolean;
}

export interface MascotaConfig {
  base: AspectoBase;
  temas: TemaMascota[];
  modo: ModoMascota;
  temaManual?: string;
  escala?: number;
}

export interface AspectoResuelto {
  tema: string | null;
  aspecto: AspectoBase;
}

export interface MascotaAdminResponse extends MascotaConfig {
  resuelto: AspectoResuelto;
}
