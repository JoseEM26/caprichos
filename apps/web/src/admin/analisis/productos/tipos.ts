export type Monto = number | null;
export type Marca = 'TOP' | 'BAJO' | null;
export type GrupoMargen = 'BAJO' | 'MEDIO' | 'ALTO' | 'SIN_COSTO';

export interface FilaProducto {
  id: string;
  nombre: string;
  categoria: string;
  unidades: number;
  monto: Monto;
  porcentaje: number | null;
  pedidos: number;
  unidadesAnterior: number;
  tendencia: number | null;
  marca: Marca;
}
export interface DiaSemana {
  dia: string;
  dias: number;
  pedidos: number;
  promedioPedidos: number | null;
  monto: Monto;
  promedioMonto: Monto;
}
export interface FechaVenta {
  fecha: string;
  pedidos: number;
  monto: Monto;
}
export interface Opcion {
  grupo: string;
  opcion: string;
  veces: number;
}
export interface FilaMargen {
  id: string;
  nombre: string;
  categoria: string;
  grupo: GrupoMargen;
  margen: number | null;
  precio: Monto;
  costo: Monto;
  unidades: number;
  base: 'ventas' | 'catalogo';
  motivos: string[];
}

export interface RespuestaProductos {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  conDinero: boolean;
  productos: { total: number; conVentas: number; sinVentas: number; unidades: number; monto: Monto; categorias: string[]; filas: FilaProducto[] };
  dias: { porSemana: DiaSemana[]; masVentas: FechaVenta[]; menosVentas: FechaVenta[]; diasConVentas: number };
  modificadores: { porProducto: Array<{ id: string; nombre: string; total: number; opciones: Opcion[] }>; global: Opcion[] };
  margen: null | {
    grupos: Record<GrupoMargen, number>;
    ponderado: { margen: number | null; ingresos: number; costo: number; productos: number };
    filas: FilaMargen[];
  };
}
