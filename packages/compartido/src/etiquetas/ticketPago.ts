import type { TicketPagoDatos } from '../tipos/etiquetas.js';
import { detalleLinea, resumenAntesDelTotal, type DetalleLinea } from './detalleLinea.js';

/** Una linea del ticket de pago ya maquetada al ancho del papel (58 mm = 32 columnas, 80 mm = 48). */
export interface LineaTicket {
  texto: string;
  centrado?: boolean;
  negrita?: boolean;
  /** Bloque del código QR (cadena de SUNAT). El agente lo imprime con GS ( k; la vista previa lo deja en blanco. */
  qr?: string;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Texto a la izquierda y monto a la derecha en `cols` columnas. */
function fila(izq: string, der: string, cols: number): string {
  const max = Math.max(1, cols - der.length - 1);
  return `${izq.length > max ? izq.slice(0, max) : izq.padEnd(max)} ${der}`;
}

/** Parte un texto en renglones de `cols` columnas, cortando por palabras (y por bloque si no hay espacios). */
function envolver(texto: string, cols: number): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    for (let trozo = palabra; trozo.length > 0; ) {
      const cabe = actual ? actual.length + 1 + trozo.length <= cols : trozo.length <= cols;
      if (cabe) {
        actual = actual ? `${actual} ${trozo}` : trozo;
        break;
      }
      if (actual) {
        out.push(actual);
        actual = '';
      } else {
        out.push(trozo.slice(0, cols));
        trozo = trozo.slice(cols);
      }
    }
  }
  if (actual) out.push(actual);
  return out;
}

/** Como `fila`, pero si el texto no cabe sigue en renglones aparte (sin cortar palabras): el monto va en el primero. */
function filaEnvuelta(izq: string, der: string, cols: number): string[] {
  const max = Math.max(1, cols - der.length - 1);
  const [primero = '', ...resto] = envolver(izq, max);
  return [fila(primero, der, cols), ...resto];
}

/** Etiqueta larga en renglones y el monto al final, en el último renglón (descuentos con nombre largo). */
function filaMontoAlFinal(izq: string, der: string, cols: number): string[] {
  const rs = envolver(izq, cols);
  const ultimo = rs.pop() ?? '';
  return ultimo.length + 1 + der.length <= cols ? [...rs, fila(ultimo, der, cols)] : [...rs, ultimo, fila('', der, cols)];
}

/** Renglones con sangría fija y continuación alineada bajo el texto (no bajo el guion). */
function conSangria(texto: string, cols: number, sangria: string, continuacion = sangria): string[] {
  return envolver(texto, Math.max(1, cols - sangria.length)).map((r, i) => `${i === 0 ? sangria : continuacion}${r}`);
}

/** Una línea del pedido: producto y subtotal, luego su detalle sangrado y, si es combo, sus piezas. */
function lineasDeDetalle(d: DetalleLinea, cols: number, esParte = false): string[] {
  const out: string[] = [];
  if (esParte) {
    out.push(...conSangria(`${d.cantidad} x ${d.titulo}`, cols, '  - ', '    '));
  } else {
    out.push(...filaEnvuelta(`${d.cantidad} x ${d.titulo}`, soles(d.subtotal), cols));
    if (d.precioUnit != null && d.cantidad > 1 && !d.cortesia) out.push(...conSangria(`${d.cantidad} x ${soles(d.precioUnit)}`, cols, '  '));
  }
  const sang = esParte ? '      ' : '  ';
  for (const r of d.detalles) out.push(...conSangria(r, cols, sang));
  for (const parte of d.partes) out.push(...lineasDeDetalle(parte, cols, true));
  return out;
}

const centrar = (t: string, cols: number) =>
  t.length >= cols ? t.slice(0, cols) : ' '.repeat(Math.floor((cols - t.length) / 2)) + t;

/** Lineas del ticket de pago (una por renglon impreso); las usan el agente (ESC/POS) y la vista previa del panel. */
export function lineasTicketPago(t: TicketPagoDatos, columnas: number = 48): LineaTicket[] {
  const c = columnas;
  const linea = '-'.repeat(c);
  const o: LineaTicket[] = [];
  const p = (texto: string, extra: Partial<LineaTicket> = {}) => o.push({ texto, ...extra });
  if (t.marca) p(`*** ${t.marca} ***`, { centrado: true, negrita: true });
  p(t.local.nombre, { centrado: true, negrita: true });
  if (t.local.razonSocial) p(t.local.razonSocial, { centrado: true });
  if (t.local.ruc) p(`RUC ${t.local.ruc}`, { centrado: true });
  if (t.local.direccion) p(t.local.direccion, { centrado: true });
  p(linea);
  const d = t.documento ?? null;
  if (d) {
    const titulo = d.tipo === 'FACTURA' ? 'FACTURA ELECTRÓNICA' : d.tipo === 'BOLETA' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'COMPROBANTE SIMPLE';
    p(titulo, { centrado: true, negrita: true });
    if (d.tipo === 'SIMPLE') p('Documento interno, sin valor tributario', { centrado: true });
    else if (t.comprobante?.numero) p(t.comprobante.numero, { centrado: true, negrita: true });
    p(linea);
  }
  if (t.personal) {
    p('CONSUMO DE PERSONAL', { centrado: true, negrita: true });
    p(linea);
  }
  p(`Pedido ${t.codigo}`);
  p(`${t.fecha} ${t.hora}`);
  if (d && d.tipo !== 'SIMPLE') {
    // Cliente del comprobante: boleta sin datos sale a «VARIOS»; factura lleva RUC, razón social y dirección
    if (d.tipo === 'FACTURA') {
      if (d.docNumero) p(`${d.docTipo ?? 'RUC'}: ${d.docNumero}`);
      for (const r of envolver(`Razón social: ${d.clienteNombre ?? ''}`, c)) p(r);
      if (d.direccion) for (const r of envolver(`Dirección: ${d.direccion}`, c)) p(r);
    } else {
      for (const r of envolver(`Cliente: ${d.clienteNombre || 'VARIOS'}`, c)) p(r);
      if (d.docNumero) p(`${d.docTipo ?? 'DNI'}: ${d.docNumero}`);
    }
    if (t.who) for (const r of envolver(`Atendido: ${t.who}`, c)) p(r);
  } else if (t.who) for (const r of envolver(`Cliente: ${t.who}`, c)) p(r);
  if (t.modalidad) for (const r of envolver(`Modalidad: ${t.modalidad}`, c)) p(r);
  if (t.entrega) for (const r of envolver(`Entrega: ${t.entrega}`, c)) p(r);
  if (t.clienteTelefono) p(`Celular: ${t.clienteTelefono}`);
  p(linea);
  for (const l of t.lineas) for (const r of lineasDeDetalle(detalleLinea(l), c)) p(r);
  if (t.notaPedido?.trim()) for (const r of envolver(`Nota del pedido: ${t.notaPedido.trim()}`, c)) p(r);
  p(linea);
  // Subtotal, descuentos desglosados (promoción, cupón, personal, puntos) y envío
  for (const x of resumenAntesDelTotal(t)) {
    for (const r of filaMontoAlFinal(x.etiqueta, `${x.resta ? '-' : ''}${soles(x.monto)}`, c)) p(r);
  }
  if (d && d.tipo !== 'SIMPLE' && d.igvPct != null && d.igvPct >= 0) {
    // Desglose: el total ya incluye el IGV
    const base = Math.round((t.total / (1 + d.igvPct / 100)) * 100) / 100;
    const igv = Math.round((t.total - base) * 100) / 100;
    p(fila('Op. gravada', soles(base), c));
    p(fila(`IGV (${d.igvPct}%)`, soles(igv), c));
  }
  p(fila('TOTAL', soles(t.total), c), { negrita: true });
  // Propina aparte: línea propia, no es venta ni va en el comprobante
  if (t.propina && t.propina > 0) p(fila('Propina (aparte)', soles(t.propina), c));
  // Ajuste por cambio de dirección: solo si queda pendiente (no es venta ni va en el comprobante)
  if (t.ajusteUbicacion) {
    const a = t.ajusteUbicacion;
    if (a.tipo === 'SALDO') p(`Ajuste por cambio de dirección: +${soles(a.monto)}`);
    else p(`Devolución pendiente ${soles(a.monto)}`);
  }
  if (t.personal) {
    p('Pago:');
    p(fila('  Crédito del personal', soles(t.total), c));
    if (t.personal.trabajador) for (const r of envolver(`Trabajador: ${t.personal.trabajador}`, c)) p(r);
    for (const r of envolver(t.personal.pagado ? 'Pagado ahora' : 'Cargado a su crédito: se paga en su cuenta semanal', c)) p(r, { negrita: true });
  } else if (t.pagos.length) {
    p('Pago:');
    for (const x of t.pagos) {
      p(fila(`  ${x.medio}`, soles(x.monto), c));
      if (x.recibido != null) p(fila('  Recibido', soles(x.recibido), c));
      if (x.vuelto != null) p(fila('  Vuelto', soles(x.vuelto), c));
    }
  } else if (t.plan?.length) {
    p('Pago dividido:');
    for (const x of t.plan) p(fila(`  ${x.medio}`, soles(x.monto), c));
  }
  // Efectivo: con cuánto paga y vuelto, si el cobro aún no los trae
  if (t.pagaCon != null && !t.pagos.some((x) => x.recibido != null)) {
    const efectivo = (t.pagos.length ? t.pagos : t.plan ?? []).filter((x) => x.medio === 'EFECTIVO').reduce((a, x) => a + x.monto, 0);
    p(fila('Paga con', soles(t.pagaCon), c));
    if (efectivo > 0 && t.pagaCon >= efectivo) p(fila('Vuelto', soles(Math.round((t.pagaCon - efectivo) * 100) / 100), c));
  }
  if (t.comprobante) {
    p(linea);
    if (!d) p(`${t.comprobante.tipo.replace('_', ' ')} ${t.comprobante.numero}`); // con el título de arriba ya sale el número
    if (t.comprobante.representacion) for (const r of envolver(t.comprobante.representacion, c)) p(r);
    // Bloque del QR entre la representación y el hash: si no hay cadena, el ticket sale como antes (sin bloque)
    if (t.comprobante.cadenaQr) p('', { centrado: true, qr: t.comprobante.cadenaQr });
    if (t.comprobante.hash) for (const h of envolver(`Hash: ${t.comprobante.hash}`, c)) p(h);
    if (t.comprobante.simulado) p(centrar('SIMULADO - SIN VALOR TRIBUTARIO', c), { centrado: true });
  }
  if (t.cobradoPorMozo) p(`Cobrado por mozo ${t.cobradoPorMozo}`);
  // Cupón: solo si viene uno REAL y vigente (el servidor no lo manda mientras el interruptor esté apagado)
  if (t.cuponSiguiente?.codigo) {
    p(linea);
    p(centrar('Tu cupón para tu próxima compra', c), { centrado: true, negrita: true });
    p(centrar(t.cuponSiguiente.codigo, c), { centrado: true, negrita: true });
    if (t.cuponSiguiente.descripcion) for (const r of envolver(t.cuponSiguiente.descripcion, c)) p(r, { centrado: true });
    if (t.cuponSiguiente.vence) p(centrar(`Vence ${t.cuponSiguiente.vence}`, c), { centrado: true });
  }
  p(linea);
  p(centrar('Gracias por tu visita', c));
  return o;
}
