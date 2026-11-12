/** Montos en soles; null cuando el usuario no es ADMIN (el servidor no los envía). */
export type Soles = number | null;

export interface FilaGrupo {
  id: string;
  pedidos: number;
  monto: Soles;
  ticket: Soles;
  porcentaje: number | null;
}

export interface FilaProducto {
  nombre: string;
  categoria: string;
  unidades: number;
  monto: Soles;
  pedidos: number;
  combo: boolean;
}

export interface SerieEvolucion {
  id: string;
  valores: number[];
}

export interface RespuestaVentas {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  truncado: boolean;
  limite: number;
  conDinero: boolean;
  pedidos: number;
  ventas: { monto: Soles; ticket: Soles; envio: Soles; descuento: Soles; propinaAparte: Soles };
  porCanal: FilaGrupo[];
  porModalidad: FilaGrupo[];
  porTurno: FilaGrupo[];
  evolucion: { granularidad: 'dia' | 'semana'; unidad: 'soles' | 'pedidos'; periodos: string[]; canales: SerieEvolucion[]; medios: SerieEvolucion[] };
  productos: {
    masVendidos: FilaProducto[];
    menosVendidos: FilaProducto[];
    masMonto: FilaProducto[];
    categorias: Array<{ nombre: string; unidades: number; monto: Soles }>;
    distintos: number;
  };
  medios: { filas: Array<{ id: string; pagos: number; monto: Soles; porcentaje: number | null }>; pedidosSinCobro: number };
  ofertas: {
    pedidosConCombo: number;
    aporteCombos: Soles;
    porcentajeAporte: number | null;
    combos: Array<{ nombre: string; unidades: number; monto: Soles; pedidos: number }>;
    pedidosConDescuento: number;
    descuentos: Array<{ tipo: string; nombre: string; pedidos: number; monto: Soles }>;
  };
}
