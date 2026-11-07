import type { TicketPagoDatos } from '../tipos/etiquetas.js';

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

const centrar = (t: string, cols: number) =>
  t.length >= cols ? t.slice(0, cols) : ' '.repeat(Math.floor((cols - t.length) / 2)) + t;

/** Lineas del ticket de pago (una por renglon impreso); las usan el agente (ESC/POS) y la vista previa del panel. */
export function lineasTicketPago(t: TicketPagoDatos, columnas: number = 48): LineaTicket[] {
  const c = columnas;
  const linea = '-'.repeat(c);
  const o: LineaTicket[] = [];
  const p = (texto: string, extra: Partial<LineaTicket> = {}) => o.push({ texto, ...extra });
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
  p(`Pedido ${t.codigo}`);
  p(`${t.fecha} ${t.hora}`);
  if (d && d.tipo !== 'SIMPLE') {
    // Cliente del comprobante: boleta sin datos sale a «VARIOS»; factura lleva RUC, razón social y dirección
    if (d.tipo === 'FACTURA') {
      if (d.docNumero) p(`${d.docTipo ?? 'RUC'}: ${d.docNumero}`);
      for (const r of envolver(`Razón social: ${d.clienteNombre ?? ''}`, c)) p(r);
      if (d.direccion) for (const r of envolver(`Dirección: ${d.direccion}`, c)) p(r);
    } else {
      p(`Cliente: ${d.clienteNombre || 'VARIOS'}`);
      if (d.docNumero) p(`${d.docTipo ?? 'DNI'}: ${d.docNumero}`);
    }
    if (t.who) p(`Atendido: ${t.who}`);
  } else if (t.who) p(`Cliente: ${t.who}`);
  if (t.modalidad) p(`Modalidad: ${t.modalidad}`);
  p(linea);
  for (const l of t.lineas) {
    p(fila(`${l.cantidad} x ${l.nombre}${l.tamano ? ` (${l.tamano})` : ''}`, soles(l.subtotal), c));
  }
  p(linea);
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
  if (t.pagos.length) {
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
  p(linea);
  p(centrar('Gracias por tu visita', c));
  return o;
}
