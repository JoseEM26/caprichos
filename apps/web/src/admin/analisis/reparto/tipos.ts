import type { NivelSemaforo } from '../comun';

export interface ZonaReparto {
  id: string;
  zona: string;
  activa: boolean;
  tarifa: number | null;
  pedidos: number;
  entregados: number;
  minutosPromedio: number | null;
  minutosMediana: number | null;
  minutosP90: number | null;
  metaMin: number | null;
  semaforo: NivelSemaforo;
  porTurno: number[];
}

export interface RepartidorFila {
  id: string;
  nombre: string;
  entregas: number;
  minutosPorEntrega: number | null;
  horasTrabajadas: number | null;
  entregasPorHora: number | null;
}

export interface RespuestaReparto {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  porPersonaVisible: boolean;
  truncado: boolean;
  limite: number;
  turnos: string[];
  totales: { pedidos: number; sinZona: number; entregas: number };
  zonas: ZonaReparto[];
  productividad: {
    repartidores: number;
    entregas: number;
    minutosPorEntrega: number | null;
    horasTrabajadas: number | null;
    entregasPorHora: number | null;
    porPersona: RepartidorFila[] | null;
  };
}

export interface RespuestaPorRendir {
  generadoEn: string;
  ventanaDias: number;
  porPersonaVisible: boolean;
  total: number;
  repartidoresConSaldo: number;
  pedidosPendientes: number;
  desde: string | null;
  porPersona: Array<{ id: string; nombre: string; pendiente: number; desde: string | null; pedidos: number }> | null;
}
