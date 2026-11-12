import type { CodigoEtapa } from '@caprichos/compartido';
import type { NivelSemaforo } from '../comun';

export interface Resumen {
  n: number;
  promedio: number | null;
  mediana: number | null;
  p90: number | null;
  maximo: number | null;
}

export interface EtapaResumen extends Resumen {
  codigo: CodigoEtapa;
  paso: number;
  nombre: string;
  detalle: string;
  modalidades: string[] | null;
  compite: boolean;
  meta: number;
  sinDato: boolean;
  semaforo: NivelSemaforo;
}

export interface AreaResumen extends Resumen {
  nombre: string;
  meta: number;
  semaforo: NivelSemaforo;
}

export interface RespuestaTiempos {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  truncado: boolean;
  limite: number;
  pedidos: { entran: number; considerados: number; enCurso: number };
  anulados: { n: number; minutosPromedio: number | null; minutosMediana: number | null };
  etapaMasLenta: CodigoEtapa | null;
  etapas: EtapaResumen[];
  areas: AreaResumen[];
}

export interface Atascado {
  id: string;
  codigo: string;
  modalidad: string;
  mesa: string | null;
  etapa: CodigoEtapa;
  etapaNombre: string;
  areasPendientes: string[];
  desde: string;
  minutos: number;
  meta: number;
  veces: number;
  semaforo: NivelSemaforo;
  enlace: string;
}

export interface RespuestaAtascados {
  generadoEn: string;
  total: number;
  items: Atascado[];
}
