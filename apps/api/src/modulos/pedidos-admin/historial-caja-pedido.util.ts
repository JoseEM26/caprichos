/** Historial de un pedido para Caja: junta auditoría, estados y cobros en una sola lista en español simple. */

export interface EventoHistorialCaja {
  id: string;
  fuente: 'auditoria' | 'estado' | 'cobro';
  titulo: string;
  motivo: string | null;
  en: string;
  por: string | null;
  antes: unknown;
  despues: unknown;
}

const SENSIBLE = /(clave|contrase|password|pass|token|secret|pin|authorization|api_?key)/i;
const DOCUMENTO = /(^|_)(dni|ruc|documento|doc_numero|numero_documento|nro_doc)(_|$)/i;

/** Enmascara claves/tokens por completo y deja de un documento solo sus 2 últimos caracteres. */
export function enmascarar(v: unknown, profundidad = 0): unknown {
  if (v === null || v === undefined || profundidad > 6) return v ?? null;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => enmascarar(x, profundidad + 1));
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (SENSIBLE.test(k)) o[k] = '••••';
      else if (DOCUMENTO.test(k) && (typeof val === 'string' || typeof val === 'number')) {
        const s = String(val);
        o[k] = s.length <= 2 ? '••' : `${'•'.repeat(s.length - 2)}${s.slice(-2)}`;
      } else o[k] = enmascarar(val, profundidad + 1);
    }
    return o;
  }
  return v;
}

const TITULOS: Record<string, string> = {
  ANULAR: 'Anuló el pedido',
  CAMBIAR_ESTADO: 'Cambió el estado del pedido',
  EDITAR_PEDIDO: 'Editó el pedido',
  AGREGAR_EXTRA: 'Agregó un pedido extra',
  CORREGIR_CLIENTE: 'Corrigió los datos del cliente',
  REGISTRAR_PAGO: 'Registró el pago',
  REGISTRAR_PAGO_SIN_VOUCHER: 'Registró el pago sin voucher',
  COBRAR: 'Cobró el pedido',
  ANULAR_COBRO: 'Anuló el cobro',
  EMITIR: 'Emitió el comprobante',
  REIMPRIMIR: 'Reimprimió el comprobante',
  REIMPRIMIR_TICKET_PEDIDO: 'Reimprimió el ticket',
  ANULAR_ELECTRONICO: 'Anuló el comprobante electrónico',
  SOLICITAR_CAMBIO_COMPROBANTE: 'Pidió cambiar el comprobante',
  CAMBIAR_COMPROBANTE: 'Cambió el comprobante',
  DESHACER_CAMBIO_COMPROBANTE: 'Deshizo el cambio de comprobante',
  CAMBIO_PAGO: 'Cambió el medio de pago',
  APROBAR_CAMBIO_COBRO: 'Aprobó el cambio de cobro',
  RECHAZAR_CAMBIO_COBRO: 'Rechazó el cambio de cobro',
  RECHAZAR_COBRO_MOZO: 'Rechazó el cobro del mozo',
  CAMBIAR_UBICACION: 'Cambió la ubicación de entrega',
  UBICAR_PEDIDO: 'Ubicó el pedido',
  CAMBIAR_MESA: 'Cambió la mesa',
  REABRIR_PEDIDO: 'Reabrió el pedido',
  DEVOLUCION_PEDIDO: 'Registró una devolución',
  ENTREGAR: 'Marcó entregado',
  ENTREGADO_MESA: 'Marcó entregado en mesa',
  MARCAR_COBRADO: 'Marcó como cobrado',
  DESMARCAR_COBRADO: 'Quitó la marca de cobrado',
  MARCAR_COORDINADO: 'Marcó el pago como coordinado',
  MARCAR_COORDINADO_SIN_VOUCHER: 'Marcó coordinado sin voucher',
  SUBIR: 'Subió un voucher',
  REEMPLAZAR_VOUCHER: 'Reemplazó el voucher',
  QUITAR_VOUCHER: 'Quitó el voucher',
  REASIGNAR_VOUCHER: 'Reasignó el voucher',
  DAR_EN_PEDIDO: 'Aplicó una cortesía',
  PEDIDO_FORZAR_SIN_COBRO: 'Forzó el pedido sin cobro',
  PEDIDO_FORZAR_SIN_COCINA: 'Forzó el pedido sin cocina',
  AUTORIZAR_SIN_VALIDAR: 'Autorizó sin validar',
};
const MEDIOS: Record<string, string> = { EFECTIVO: 'efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'tarjeta' };
const ESTADOS: Record<string, string> = {
  PENDIENTE: 'pendiente', POR_CONFIRMAR: 'por confirmar', EN_COLA: 'en cola', PREPARANDO: 'preparando', LISTO: 'listo',
  EN_RUTA: 'en ruta', ENTREGADO: 'entregado', ANULADO: 'anulado', RECHAZADO: 'rechazado',
};

/** Lecturas y reintentos técnicos que no cambian el pedido: no entran al historial. */
export const OMITIR_ACCION = /^(VER_|DESCARGAR_|LISTAR_|CONSULTA|CONSTANCIA_|FACTURACION_|FACTURA_WHATSAPP|CDR_|REINTENTO_)/;

export function tituloAccion(accion: string, despues: any): string {
  if (accion === 'CAMBIAR_ESTADO' && despues?.estado) return `Cambió el estado a ${ESTADOS[despues.estado] ?? String(despues.estado).toLowerCase()}`;
  if ((accion === 'EMITIR' || accion === 'CAMBIAR_COMPROBANTE') && despues?.tipo) {
    const t = String(despues.tipo).toUpperCase();
    return accion === 'EMITIR' ? `Emitió ${t === 'FACTURA' ? 'una factura' : t === 'BOLETA' ? 'una boleta' : 'el comprobante'}` : `Cambió el comprobante a ${t.toLowerCase()}`;
  }
  const t = TITULOS[accion];
  if (t) return t;
  const h = accion.toLowerCase().replace(/_/g, ' ');
  return h.charAt(0).toUpperCase() + h.slice(1);
}

export const soles = (n: unknown) => `S/ ${Number(n).toFixed(2)}`;
export const medioLegible = (m: string) => MEDIOS[m] ?? m.toLowerCase();

export function tituloCobro(total: unknown, pagos: Array<{ medio: string; monto: unknown }>): string {
  const medios = [...new Set(pagos.map((p) => medioLegible(p.medio)))].join(' y ');
  return `Cobró ${soles(total)}${medios ? ` con ${medios}` : ''}`;
}
