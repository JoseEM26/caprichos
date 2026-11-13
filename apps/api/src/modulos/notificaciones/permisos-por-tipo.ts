/**
 * Permiso (basta uno) que hace falta para VER cada tipo de aviso guardado.
 * DENEGAR POR DEFECTO: un tipo que no esté aquí solo lo ve el ADMIN (o su destinatario directo por party_destino).
 * '*' = cualquier usuario del panel (mensajes internos y difusiones).
 * Cada tipo que el código crea con `notificacion.create` debe estar aquí: lo vigila permisos-por-tipo.spec.ts.
 */
export const LIBRE = '*';

export const PERMISOS_POR_TIPO: Record<string, string[]> = {
  PEDIDO_NUEVO: ['caja/ver', 'pedidos/ver'],
  PEDIDO_POR_CONFIRMAR: ['caja/ver', 'pedidos/ver'],
  PEDIDOS_SIN_PAGAR_TOPE: ['caja/ver', 'pedidos/ver'],
  UBICACION_PROPUESTA: ['caja/ver', 'pedidos/ver'],
  ANULACION_SIN_DEVOLUCION: ['caja/ver'],
  CAJA_CERRADA_APERTURA: ['caja/ver'],
  PAGO_EFECTIVO_MOZO: ['caja/ver'],
  PAGO_SIN_CAPTURA_MOZO: ['caja/ver', 'vouchers/ver'],
  CAMBIO_COBRO_SOLICITADO: ['pedidos/validar_cambio_cobro'],
  CAMBIO_COBRO_APLICADO: ['caja/ver'],
  CAMBIO_COBRO_RESUELTO: ['caja/ver'], // además va por party_destino al repartidor
  REPROG_COBRAR_RECARGO: ['caja/ver'],
  COMPROBANTE_PENDIENTE: ['comprobantes/ver'],
  COMPROBANTE_RECIBIDO: ['comprobantes/ver'],
  COMPROBANTE_NO_GUARDADO: ['comprobantes/ver'],
  RESERVA_NUEVA: ['reservas/ver'],
  RESERVA_CANCELADA: ['reservas/ver'],
  RECLAMO_CARTA: ['reclamos/ver'],
  QUEJA_WHATSAPP: ['reclamos/ver'],
  VOUCHER_ILEGIBLE: ['caja/ver', 'vouchers/ver'],
  VOUCHER_PENDIENTE_MOZO: ['caja/ver', 'vouchers/ver'],
  VOUCHER_IA_CAIDA: ['caja/ver', 'vouchers/ver'],
  VOUCHER_IA_RECUPERADA: ['caja/ver', 'vouchers/ver'],
  VOUCHER_IA_TOPE: ['caja/ver', 'vouchers/ver'],
  STOCK_BAJO: ['stock/ver', 'compras/ver'],
  DELIVERY_POR_CONFIRMAR: ['repartos/ver'],
  REPROGRAMACION_DELIVERY: ['repartos/ver', 'caja/ver'],
  REPROGRAMACION_CANCELADA: ['repartos/ver', 'caja/ver'],
  RETIRO_MOVILIDAD: ['repartos/ver', 'caja/ver'],
  ESPERA_AGOTADA: ['repartos/ver', 'caja/ver'],
  MESA_LISTA: ['mesas/ver'],
  ATENCION_WHATSAPP: ['mensajes/ver'],
  CHAT_SIN_RESPUESTA: ['mensajes/ver'],
  CHAT_BLOQUEADO_SPAM: ['mensajes/ver'],
  WHATSAPP_ALERTA: ['mensajes/ver'],
  ALERTA_INTERNA: ['mensajes/ver', 'configuracion/ver'],
  ERROR_IMPRESORA: ['configuracion/ver', 'caja/ver'],
  IMPRESORA_SIN_CONEXION: ['configuracion/ver', 'caja/ver'],
  WHATSAPP_CONSUMO: ['configuracion/ver'],
  REDIS_CAIDO: ['configuracion/ver'],
  REDIS_RECUPERADO: ['configuracion/ver'],
  APRENDIZAJES_PROPUESTAS: ['aprendizajes/ver'],
  // Reemplazos y cambios de turno: a Supervisión (rol_destino) y, por party_destino, al reemplazo y al solicitante
  TURNO_PEDIDO: ['asistencia/marcar'],
  TURNO_POR_APROBAR: ['asistencia/aprobar_reemplazos'],
  TURNO_RESUELTO: ['asistencia/marcar'],
  TURNO_SIN_MARCA: ['asistencia/aprobar_reemplazos'],
  MENSAJE_INTERNO: [LIBRE],
};

/** Tipos con sufijo variable (p. ej. `FACTURACION:<clave>`): se resuelven por prefijo. */
export const PERMISOS_POR_PREFIJO: Record<string, string[]> = {
  'FACTURACION:': ['comprobantes/ver'],
};

export const permisosDeTipo = (tipo: string): string[] | undefined =>
  PERMISOS_POR_TIPO[tipo] ?? Object.entries(PERMISOS_POR_PREFIJO).find(([p]) => tipo.startsWith(p))?.[1];

export const tipoVisible = (tipo: string, puede: (permiso: string) => boolean): boolean => {
  const permisos = permisosDeTipo(tipo);
  return !!permisos && permisos.some((p) => p === LIBRE || puede(p));
};
