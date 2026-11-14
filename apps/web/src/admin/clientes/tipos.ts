/** Verificación de la cuenta (opcional: una API anterior no lo envía) */
export interface VerificacionCliente {
  verificado?: boolean;
  verificadoEn?: string | null;
  estadoVerificacion?: 'VERIFICADO' | 'SIN_VERIFICAR' | 'ANTIGUA';
  razonSinVerificar?: 'MOSTRADOR' | 'SIN_CONTRASENA' | null;
  tieneContrasena?: boolean;
  puedeGastarPuntos?: boolean;
}

export interface ClienteItem extends VerificacionCliente {
  id: string;
  nombre: string;
  tipo: 'Persona' | 'Empresa' | 'Personal';
  telefono: string;
  correo: string;
  cumpleanos: string;
  /** Pedidos cobrados en el rango elegido (sin rango, todos) */
  pedidos: number;
  /** Suma de esos pedidos en soles */
  consumo?: number;
  /** Última compra cobrada (ISO) */
  ultimaCompra?: string | null;
  puntos: number;
  creditoPersonal: boolean;
  envioFijo: number | null;
  descuentoEnvio: number | null;
  activo: boolean;
}

export interface PedidoCliente {
  /** Id numérico para pedir el detalle (id es el código visible) */
  pedidoId?: string;
  id: string;
  modalidad: string;
  estado: string;
  total: string;
  pago: string;
  fecha: string;
  /** Puntos del pedido: ganados, por ganar o el motivo por el que no suma */
  puntos?: { estado: 'SUMADO' | 'PENDIENTE_DE_COBRO' | 'NO_SUMA'; puntos?: number; estimado?: number; motivo?: string; texto: string } | null;
}

export interface MovimientoPuntosItem {
  id: string;
  tipo: string;
  puntos: number;
  motivo: string;
  fecha: string;
  pedido: {
    id: string;
    codigo: string;
    total: number;
    modalidad: string;
    fecha: string;
  } | null;
}

export interface FichaCliente extends VerificacionCliente {
  id: string;
  nombre: string;
  /** Solo empresas (enmascarado salvo ADMIN) */
  ruc?: string;
  telefono: string;
  correo: string;
  cumpleanos: string;
  cumpleDia?: number;
  cumpleMes?: number;
  puntos: number;
  pedidos: PedidoCliente[];
}

export interface LineaCompraCliente {
  id: string;
  cantidad: number;
  nombre: string;
  tamano: string | null;
  opciones: string[];
  sabores: Array<{ nombre: string; cantidad: number }>;
  nombresPersona: string[];
  nota: string | null;
  cortesia: boolean;
  precioUnit: number;
  subtotal: number;
}

export interface DetalleCompraCliente {
  id: string;
  codigo: string;
  fecha: string;
  modalidad: string;
  estado: string;
  lineas: LineaCompraCliente[];
  subtotal: number;
  descuento: number;
  descuentos: Array<{ tipo: string; nombre: string; monto: number }>;
  puntosCanjeados: number;
  envio: number | null;
  propina: number;
  total: number;
  pagoEstado: string | null;
  medioPago: string | null;
  /** Desglose por medio (pago dividido); vacío si no hay */
  pagos?: Array<{ medio: string; monto: number }>;
  comprobante: string | null;
  nota: string | null;
}
