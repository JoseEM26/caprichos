export interface KpiItem {
  n: string;
  v: string;
  sub?: string;
  dCol?: string;
  dTxt?: string;
}

export interface ReporteItemCatalogo {
  id: string;
  nombre: string;
  categoria: string;
  queResponde: string;
  filtrosTexto: string;
  exportaTexto: string;
  kpiClave: string;
  kpiValor: string;
  filasTotal: number;
  sinFecha?: boolean;
}

export interface ReporteDetalle {
  id: string;
  nombre: string;
  categoria: string;
  queResponde: string;
  periodoTexto: string;
  filtrosActivosTexto: string;
  kpis: KpiItem[];
  cols: string[];
  rows: (string | number)[][];
  nota?: string;
  sinFecha?: boolean;
}

export interface IndicadorMeta {
  n: string;
  meta: string;
  v: string;
  w: string;
  bar: string;
  ok: boolean;
}

export interface TopCategoriaItem {
  categoria: string;
  producto: string;
  unidades: number;
  estrellas: string;
  porcentaje: string;
}

export interface IndicadoresData {
  metas: IndicadorMeta[];
  topActual: TopCategoriaItem[];
  topHistorial: { mes: string; top: string[] }[];
  promocionesVendidas: { nombre: string; unidades: string; desc: string }[];
  productosDescontados: { nombre: string; unidades: string }[];
}

export interface PuntoEntregaMapa {
  lat: number;
  lng: number;
  canal: string;
  total: number;
  enZona: boolean;
  zona?: string;
}

export interface ZonaVentasFila {
  zona: string;
  nombre: string;
  color: string;
  poligono: [number, number][];
  pedidos: number;
  ventas: string;
  porcentaje: string;
  barraAncho: string;
}

export interface RadioDistanciaFila {
  rango: string;
  etiqueta: string;
  metros: number;
  pedidos: number;
}

export interface MapaEntregasData {
  sede: { lat: number; lng: number; nombre: string };
  puntos: PuntoEntregaMapa[];
  kpis: KpiItem[];
  zonas: ZonaVentasFila[];
  radios: RadioDistanciaFila[];
  fueraCoberturaTexto: string;
  fueraCoberturaConteo: number;
}

/** Cifras con monto opcional: el monto solo viaja para ADMIN. */
interface ConMonto {
  monto?: string;
  valor?: number;
}

export interface FilaGrupoResumen extends ConMonto {
  n: string;
  c: string;
  pedidos: number;
  pct: number;
}

/** Respuesta de `GET /admin/informes/resumen`. Los campos marcados «solo ADMIN» no existen en la respuesta de otras cuentas. */
export interface ResumenEscritorio {
  kpisS: KpiItem[];
  rechazados: number;
  legend: FilaGrupoResumen[];
  modalidades: FilaGrupoResumen[];
  porHora: ({ hora: number; pedidos: number } & ConMonto)[];
  porDiaSemana: ({ dia: string; pedidos: number } & ConMonto)[];
  porDia: ({ fecha: string; pedidos: number; entregaMin: number } & ConMonto)[];
  porEstado: { estado: string; n: number }[];
  tops2: ({ n: string; unidades: number } & ConMonto)[];
  pending: { n: string; v: number; view: string }[];
  metaEntregaMin: number;
  /** Solo ADMIN */
  porCobrar?: string;
  /** Solo ADMIN */
  peak?: string;
  /** Solo ADMIN */
  pagos?: FilaGrupoResumen[];
  /** Solo ADMIN */
  cats2?: ({ n: string; c: string; unidades: number } & ConMonto)[];
}
