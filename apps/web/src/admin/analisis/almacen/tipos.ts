export type EstadoInsumo = 'AGOTADO' | 'CRITICO' | 'PRONTO' | 'OK' | 'SIN_CONSUMO';

export interface InsumoDura {
  id: string;
  nombre: string;
  unidad: string;
  stock: number;
  minimo: number;
  consumoRango: number;
  consumoDiario: number | null;
  diasRestantes: number | null;
  seAcabaEl: string | null;
  estado: EstadoInsumo;
  bajoMinimo: boolean;
}

export interface MermaItem {
  tipo: 'INSUMO' | 'PRODUCTO';
  nombre: string;
  unidad: string | null;
  veces: number;
  cantidad: number;
  costo: number | null;
  motivos: Array<{ motivo: string; veces: number }>;
}

export interface TerminadoItem {
  id: string;
  nombre: string;
  unidades: number;
  vendidasRango: number;
  ventaDiaria: number | null;
  diasRestantes: number | null;
  agotado: boolean;
  pocas: boolean;
}

export interface RespuestaAlmacen {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  almacenActivo: boolean;
  umbralPocas: number;
  insumos: { truncado: boolean; limite: number; items: InsumoDura[] } | null;
  mermas: { truncado: boolean; limite: number; registros: number; costoTotal: number | null; items: MermaItem[] };
  terminados: { truncado: boolean; limite: number; items: TerminadoItem[] };
}
