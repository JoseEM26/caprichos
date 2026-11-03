import { fechaFacturacion } from '../facturacion/facturacion.datos';
import { IGV_PCT_DEFECTO, aCentimos, calcularComprobante } from '../facturacion/facturacion.calculo';
import { representacionDe } from '../facturacion/representacion';
import { enmascararDni } from '../comprobantes.util';
import { horaLima, montoEnLetras } from '../sunat/sunat.util';
import { AmbienteSunat } from '../sunat/sunat.config';
import { DatosPdfComprobante } from './comprobante-pdf';

/** Texto no vacío o cadena vacía. */
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Arma los datos de la representación impresa a partir de la fila guardada (comprobante + pedido + local).
 * Montos: se recalculan con el IGV del propio comprobante (derivado de los montos guardados) para que el
 * desglose cuadre con el XML. Si no cuadra, se usan los totales guardados sin desglose de descuento.
 * El DNI/RUC del cliente se enmascara salvo para ADMIN.
 */
export function armarDatosPdf(
  c: any,
  pedido: any,
  local: Record<string, unknown>,
  opciones: { esAdmin: boolean; ambiente: AmbienteSunat },
): DatosPdfComprobante {
  const rep = representacionDe(c, opciones.ambiente);
  const igvGuardado = c.sunat_igv_cents != null ? Number(c.sunat_igv_cents) : null;
  const totalGuardado = c.sunat_total_cents != null ? Number(c.sunat_total_cents) : aCentimos(Number(pedido.total));
  // Porcentaje real del comprobante: IGV / base, redondeado a 0,1 (10,5 con el IGV vigente al emitir)
  const pctDerivado = igvGuardado != null && totalGuardado - igvGuardado > 0 ? Math.round((igvGuardado * 1000) / (totalGuardado - igvGuardado)) / 10 : IGV_PCT_DEFECTO;

  const entrada = {
    lineas: (pedido.lineas || []).map((l: any) => ({
      nombre: l.nombre,
      cantidad: Number(l.cantidad) || 1,
      subtotalCents: aCentimos(Number(l.subtotal ?? Number(l.precio_unit) * (Number(l.cantidad) || 1))),
    })),
    envioCents: aCentimos(Number(pedido.envio ?? 0)),
    descuentoCents: aCentimos(Number(pedido.descuento ?? 0)),
    totalCents: aCentimos(Number(pedido.total)),
    igvPct: pctDerivado,
  };
  let totales: ReturnType<typeof calcularComprobante> | null = null;
  let items: DatosPdfComprobante['items'] = [];
  try {
    totales = calcularComprobante(entrada);
    items = totales.items.map((i) => ({ cantidad: i.cantidad, descripcion: i.nombre, precioUnit: i.precioUnitCents / 100, importe: i.totalCents / 100 }));
  } catch {
    // montos que no cuadran con el pedido: el PDF sale con los totales guardados
  }
  const base = totales ? totales.totalGravadaCents : totalGuardado - (igvGuardado ?? 0);
  const igv = totales ? totales.totalIgvCents : igvGuardado ?? 0;
  const descuento = totales ? totales.descuentoCents : aCentimos(Number(pedido.descuento ?? 0));
  const totalCents = totales ? totales.totalCents : totalGuardado;
  if (!items.length) {
    items = (pedido.lineas || []).map((l: any) => ({
      cantidad: Number(l.cantidad) || 1,
      descripcion: l.nombre,
      precioUnit: Number(l.precio_unit),
      importe: Number(l.subtotal ?? Number(l.precio_unit) * (Number(l.cantidad) || 1)),
    }));
  }

  // Cliente: factura por RUC; boleta por DNI o «Cliente varios». Enmascarado para quien no es ADMIN.
  const esFactura = c.tipo === 'FACTURA';
  const docCrudo = texto(c.documento);
  const docVisible = (valor: string) => (opciones.esAdmin || !valor ? valor : enmascararDni(valor));
  const cliente: DatosPdfComprobante['cliente'] = esFactura
    ? { etiqueta: 'RUC', numero: docVisible(docCrudo), denominacion: texto(c.razon_social) || texto(pedido.comprobante_razon), direccion: texto(pedido.comprobante_direccion) || null }
    : docCrudo
      ? { etiqueta: 'DNI', numero: docVisible(docCrudo), denominacion: texto(c.razon_social) || texto(pedido.cliente_nombre) || 'CLIENTE', direccion: null }
      : { etiqueta: 'Documento', numero: '-', denominacion: 'CLIENTE VARIOS', direccion: null };

  const fechaCobro = new Date(c.creado_en);
  return {
    tipo: esFactura ? 'FACTURA' : 'BOLETA',
    numeroTexto: c.numero_texto,
    fecha: fechaFacturacion(fechaCobro),
    hora: horaLima(fechaCobro),
    emisor: {
      razonSocial: texto(local.razon_social) || texto(local.razonSocial),
      nombreComercial: texto(local.nombre),
      ruc: texto(local.ruc),
      direccion: texto(local.direccion_fiscal) || texto(local.direccion),
    },
    cliente,
    items,
    opGravada: base / 100,
    igv: igv / 100,
    igvPct: pctDerivado,
    descuento: descuento / 100,
    total: totalCents / 100,
    totalEnLetras: montoEnLetras(totalCents),
    situacion: rep.situacion,
    titulo: rep.titulo,
    hash: rep.hash,
    cadenaQr: rep.cadenaQr,
    prueba: rep.prueba,
  };
}
