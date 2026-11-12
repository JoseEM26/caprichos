export interface HuecoPedido {
  id: number;
  codigo: string;
  canal: string;
  modalidad: string;
  estado: string;
  pagoEstado: string | null;
  total: number;
  fecha: string;
}

export interface ListaHuecos {
  total: number;
  antiguo: string | null;
  items: HuecoPedido[];
}

export interface RespuestaHuecos {
  generadoEn: string;
  limiteFilas: number;
  sinCobrar: ListaHuecos;
  sinTerminar: ListaHuecos;
  entregadosSinCobrar: ListaHuecos;
}

export interface GrupoProductividad {
  personas: number;
  pedidos: number;
  ticketPromedio: number | null;
  minutosPromedio: number | null;
  minutosMediana: number | null;
}

export interface FilaProductividad {
  id: string;
  nombre: string;
  pedidos: number;
  ticketPromedio: number | null;
  minutosPromedio: number | null;
}

export interface RespuestaEquipo {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  porPersonaVisible: boolean;
  truncado: boolean;
  limite: number;
  asistencia: {
    porDia: Array<{ fecha: string; programadas: number; presentes: number; tardanzas: number; faltas: number; minutosTarde: number }>;
    totales: { presentes: number; tardanzas: number; faltas: number; puntualidadPct: number | null; minutosTarde: number };
  };
  productividad: { mozos: GrupoProductividad; cajeros: GrupoProductividad };
  personas: null | {
    asistencia: Array<{ id: string; nombre: string; dias: number; tardanzas: number; minutosTarde: number; faltas: number }>;
    mozos: FilaProductividad[];
    cajeros: FilaProductividad[];
  };
}
