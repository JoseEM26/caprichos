export interface ClienteItem {
  id: string;
  nombre: string;
  tipo: 'Persona' | 'Empresa' | 'Personal';
  dni: string;
  telefono: string;
  correo: string;
  cumpleanos: string;
  pedidos: number;
  puntos: number;
  creditoPersonal: boolean;
  envioFijo: number | null;
  descuentoEnvio: number | null;
  activo: boolean;
}

export interface PedidoCliente {
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

export interface FichaCliente {
  id: string;
  nombre: string;
  dni: string;
  dniMascara: string;
  telefono: string;
  correo: string;
  cumpleanos: string;
  cumpleDia?: number;
  cumpleMes?: number;
  puntos: number;
  pedidos: PedidoCliente[];
}
