export type TipoAvisoEquipo = 'PEDIDO_NUEVO' | 'ALMACEN_AGOTADO' | 'ALMACEN_BAJO_STOCK';

export interface DatosLineaResumen {
  nombre: string;
  cantidad: number;
  tamano?: string | null;
  nota?: string | null;
}

export interface DatosAvisoNuevoPedido {
  pedidoId: bigint | string;
  codigo: string;
  canal: string;
  modalidad: string;
  clienteNombre: string;
  clienteTelefonoMask: string;
  total: number;
  direccion?: string | null;
  referencia?: string | null;
  lineas: DatosLineaResumen[];
  creadoEn?: Date;
}

export interface DatosAvisoAlmacen {
  insumoId: bigint | string;
  nombreInsumo: string;
  tipoAlerta: 'AGOTADO' | 'POR_PEDIR' | 'STOCK_BAJO';
  stockActual: number;
  stockMinimo: number;
  unidadMedida?: string | null;
  lugarNombre?: string | null;
}

export interface ResultadoEnvioEquipo {
  telefonoEnmascarado: string;
  exito: boolean;
  modo: 'VENTANA_24H' | 'PLANTILLA' | 'OMITIDO_IDEMPOTENTE' | 'ERROR';
  waMessageId?: string;
  error?: string;
}

export interface ResultadoNotificacionEquipo {
  omitido: boolean;
  motivo?: 'DESACTIVADO' | 'SIN_NUMEROS' | 'PROCESADO';
  destinatariosTotal: number;
  enviosExitosos: number;
  detalles: ResultadoEnvioEquipo[];
}
