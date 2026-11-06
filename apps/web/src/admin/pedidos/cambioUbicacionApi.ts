import { api } from '../../comun/api';

/** Un punto del mapa con sus datos de dirección y zona (lo que guarda el historial). */
export interface PuntoHistorial {
  lat: number | null;
  lng: number | null;
  direccion: string | null;
  referencia: string | null;
  zona: string | null;
}

export interface AjusteCobro {
  tipo: 'SALDO' | 'DEVOLUCION';
  monto: number | null;
  estado: string | null;
  medio: string | null;
  codigoOperacion: string | null;
  porNombre: string | null;
  en: string | null;
}

/** Un cambio del historial (propuesta, aprobado, rechazado o cancelado). */
export interface CambioUbicacion {
  id: string;
  origen: 'CAJA' | 'REPARTIDOR' | 'WHATSAPP_CLIENTE';
  /** La ubicación del cliente cayó fuera de la zona de reparto (no se puede aplicar) */
  fueraDeZona?: boolean;
  estado: 'PROPUESTA' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
  propuestoPorNombre: string | null;
  propuestoEn: string;
  resueltoPorNombre: string | null;
  resueltoEn: string | null;
  nota: string | null;
  motivo: string | null;
  anterior: PuntoHistorial;
  nueva: PuntoHistorial;
  envioAnterior: number | null;
  envioNuevo: number | null;
  totalAnterior: number | null;
  totalNuevo: number | null;
  diferencia: number | null;
  ajuste: AjusteCobro | null;
  avisoCliente: string | null;
}

export interface HistorialUbicacion {
  editada: boolean;
  cambios: CambioUbicacion[];
}

/** Vista previa de un cambio: lo que pasaría al confirmar. */
export interface PrevisualizacionCambio {
  zona: string;
  envioAnterior: number;
  envioNuevo: number;
  diferencia: number;
  totalAnterior: number;
  totalNuevo: number;
  pagado: boolean;
  montoPagado: number | null;
  ajuste: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null;
  cambiaEnvio: boolean;
}

/** Propuesta pendiente del repartidor, con su pedido, para la bandeja de Caja. */
export interface PropuestaPendiente extends CambioUbicacion {
  pedidoId: string;
  codigo: string;
  cliente: string | null;
  pagoEstado: string | null;
  estadoPedido: string;
  direccionActual: string | null;
  /** Punto actual del pedido (para la distancia a la propuesta) */
  latActual?: number | null;
  lngActual?: number | null;
}

export const cambioUbicacionApi = {
  previsualizar(pedidoId: string, lat: number, lng: number): Promise<PrevisualizacionCambio> {
    return api.get(`/admin/pedidos/${pedidoId}/ubicacion/previsualizar?lat=${lat}&lng=${lng}`);
  },

  cambiar(
    pedidoId: string,
    dto: { lat: number; lng: number; direccion?: string; referencia?: string },
  ): Promise<PrevisualizacionCambio & { id: string; cambioId: string; codigo: string; avisoCliente: string | null }> {
    return api.post(`/admin/pedidos/${pedidoId}/ubicacion/cambiar`, dto);
  },

  /** Caja reenvía al cliente el pedido de ubicación por WhatsApp (solo con la ventana de 24 h abierta). */
  pedirUbicacionWhatsapp(pedidoId: string): Promise<{ enviado: boolean }> {
    return api.post(`/admin/pedidos/${pedidoId}/ubicacion/pedir-whatsapp`);
  },

  historial(pedidoId: string): Promise<HistorialUbicacion> {
    return api.get(`/admin/pedidos/${pedidoId}/ubicacion/historial`);
  },

  liquidarAjuste(
    pedidoId: string,
    cambioId: string,
    dto: { medio: string; codigoOperacion?: string },
  ): Promise<{ ajusteEstado: string; monto: number; medio: string }> {
    return api.post(`/admin/pedidos/${pedidoId}/ubicacion/ajustes/${cambioId}/liquidar`, dto);
  },

  propuestasPendientes(): Promise<PropuestaPendiente[]> {
    return api.get('/admin/pedidos/ubicacion/propuestas');
  },

  aprobarPropuesta(pedidoId: string, propuestaId: string) {
    return api.post(`/admin/pedidos/${pedidoId}/ubicacion/propuestas/${propuestaId}/aprobar`);
  },

  rechazarPropuesta(pedidoId: string, propuestaId: string, motivo?: string) {
    return api.post(`/admin/pedidos/${pedidoId}/ubicacion/propuestas/${propuestaId}/rechazar`, { motivo });
  },
};

/** Repartidor: propone la ubicación real del cliente en un pedido suyo en curso. */
export const propuestaUbicacionApi = {
  vigente(pedidoId: string): Promise<CambioUbicacion | null> {
    return api.get(`/admin/repartos/${pedidoId}/ubicacion/propuesta`);
  },

  proponer(pedidoId: string, dto: { lat: number; lng: number; nota?: string }): Promise<CambioUbicacion> {
    return api.post(`/admin/repartos/${pedidoId}/ubicacion/propuesta`, dto);
  },

  cancelar(pedidoId: string): Promise<{ cancelada: boolean }> {
    return api.post(`/admin/repartos/${pedidoId}/ubicacion/propuesta/cancelar`);
  },
};

/** Texto de la diferencia de envío para mostrar: «+S/ 6.00», «-S/ 2.00» o «Sin diferencia». */
export function textoDifEnvio(dif: number | null | undefined): string {
  if (dif == null || Math.abs(dif) < 0.005) return 'Sin diferencia';
  return dif > 0 ? `+S/ ${dif.toFixed(2)}` : `-S/ ${Math.abs(dif).toFixed(2)}`;
}

/** Texto del ajuste de cobro: saldo por cobrar o devolución pendiente (o ya resuelto). */
export function textoAjuste(a: AjusteCobro): string {
  const monto = a.monto != null ? `S/ ${a.monto.toFixed(2)}` : '';
  if (a.tipo === 'SALDO') return a.estado === 'COBRADO' ? `Saldo cobrado ${monto}` : `Saldo por cobrar ${monto}`;
  return a.estado === 'DEVUELTO' ? `Devuelto ${monto}` : `Devolución pendiente ${monto}`;
}

/** Metros entre dos puntos (haversine), para decir a Caja a qué distancia queda la ubicación propuesta. */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** «A 120 m» / «A 1.4 km» del punto actual; null si el pedido aún no tiene punto. */
export function textoDistancia(c: Pick<CambioUbicacion, 'anterior' | 'nueva'>): string | null {
  if (c.anterior.lat == null || c.anterior.lng == null || c.nueva.lat == null || c.nueva.lng == null) return null;
  const m = distanciaMetros({ lat: c.anterior.lat, lng: c.anterior.lng }, { lat: c.nueva.lat, lng: c.nueva.lng });
  return m < 1000 ? `A ${Math.round(m)} m del punto actual` : `A ${(m / 1000).toFixed(1)} km del punto actual`;
}

export const ORIGEN_CAMBIO: Record<CambioUbicacion['origen'], string> = {
  CAJA: 'Caja',
  REPARTIDOR: 'Repartidor',
  WHATSAPP_CLIENTE: 'Cliente (WhatsApp)',
};
