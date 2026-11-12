import type { NivelSemaforo } from '../comun';

export interface RespuestaDemanda {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  truncado: boolean;
  limite: number;
  pedidos: { entran: number; validos: number };
  mapa: { dias: string[]; valores: number[][]; pico: { dia: string; hora: number; pedidos: number } | null };
  cumplimiento: {
    evaluados: number;
    cumplieron: number;
    porcentaje: number | null;
    retrasoPromedioMin: number | null;
    deliverySinPromesa: number;
    otrasModalidadesSinDato: number;
    sinDato: boolean;
  };
  anulados: {
    n: number;
    porcentaje: number | null;
    rechazados: number;
    minutos: { promedio: number | null; mediana: number | null };
    motivos: Array<{ motivo: string; n: number; porcentaje: number | null }>;
    etapas: Array<{ etapa: string; n: number; porcentaje: number | null }>;
    quienes: Array<{ nombre: string; n: number }>;
  };
}

export interface RespuestaVivo {
  generadoEn: string;
  meta: number;
  total: number;
  areas: Array<{ nombre: string; enCola: number; masAntiguaMin: number | null; promedioMin: number | null; meta: number; semaforo: NivelSemaforo }>;
}
