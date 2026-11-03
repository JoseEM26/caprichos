import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { SituacionRepresentacion } from '../facturacion/representacion';
import { montoEnLetras } from '../sunat/sunat.util';

/**
 * Representación impresa de BOLETA y FACTURA electrónica (A4 para ambas: más simple y legible que el ticket).
 * Función pura: recibe datos ya armados (montos en soles) y devuelve el PDF en memoria. Nada se guarda.
 */
export interface DatosPdfComprobante {
  tipo: 'BOLETA' | 'FACTURA';
  numeroTexto: string;
  /** DD-MM-AAAA y HH:MM:SS en hora de Lima. */
  fecha: string;
  hora: string;
  emisor: { razonSocial: string; nombreComercial: string; ruc: string; direccion: string };
  cliente: { etiqueta: 'RUC' | 'DNI' | 'Documento'; numero: string; denominacion: string; direccion: string | null };
  items: Array<{ cantidad: number; descripcion: string; precioUnit: number; importe: number }>;
  opGravada: number;
  igv: number;
  igvPct: number;
  descuento: number;
  total: number;
  totalEnLetras: string;
  situacion: SituacionRepresentacion;
  /** Título de la representación (o el aviso que la reemplaza). */
  titulo: string;
  hash: string | null;
  cadenaQr: string | null;
  /** Marca «DOCUMENTO DE PRUEBA»: comprobante simulado o ambiente beta. */
  prueba: boolean;
}

export const LEYENDA_REPRESENTACION = 'Representación impresa de la {tipo} de Venta Electrónica. Consulte su validez en www.sunat.gob.pe';
export const MARCA_PRUEBA = 'DOCUMENTO DE PRUEBA — SIN VALOR TRIBUTARIO';

const MARGEN = 40;
const ANCHO = 595.28 - MARGEN * 2;
const ROJO = '#B91C1C';
const TEXTO = '#111827';
const GRIS = '#6B7280';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Dibuja un PDF A4 y lo devuelve como Buffer. */
export async function generarPdfComprobante(d: DatosPdfComprobante, opciones: { comprimir?: boolean } = {}): Promise<Buffer> {
  const qr = d.cadenaQr ? await QRCode.toBuffer(d.cadenaQr, { type: 'png', margin: 1, width: 120, errorCorrectionLevel: 'M' }) : null;
  return new Promise<Buffer>((resolver, rechazar) => {
    // comprimir: false solo en pruebas (el texto queda legible para comprobarlo)
    const doc = new PDFDocument({ size: 'A4', margin: MARGEN, compress: opciones.comprimir ?? true, info: { Title: `${d.tipo} ${d.numeroTexto}`, Author: d.emisor.razonSocial } });
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolver(Buffer.concat(trozos)));
    doc.on('error', rechazar);
    dibujar(doc, d, qr);
    doc.end();
  });
}

function dibujar(doc: PDFKit.PDFDocument, d: DatosPdfComprobante, qr: Buffer | null) {
  const nombreTipo = d.tipo === 'FACTURA' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';

  // Marca de agua en documentos de prueba (detrás del contenido)
  if (d.prueba) {
    doc.save();
    doc.opacity(0.09).fillColor(ROJO).fontSize(46);
    doc.rotate(-35, { origin: [297, 420] });
    doc.text(MARCA_PRUEBA, 0, 380, { width: 595.28, align: 'center' });
    doc.restore();
    doc.opacity(1);
    // Franja superior visible
    doc.rect(0, 0, 595.28, 26).fill(ROJO);
    doc.fillColor('#FFFFFF').fontSize(11).text(MARCA_PRUEBA, MARGEN, 8, { width: ANCHO, align: 'center' });
  }

  // Emisor (izquierda) y recuadro con RUC, tipo y número (derecha)
  const yTop = d.prueba ? 40 : MARGEN;
  doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(15).text(d.emisor.nombreComercial || d.emisor.razonSocial, MARGEN, yTop, { width: 300 });
  doc.font('Helvetica').fontSize(9).fillColor(TEXTO);
  if (d.emisor.nombreComercial && d.emisor.razonSocial !== d.emisor.nombreComercial) doc.text(d.emisor.razonSocial, { width: 300 });
  doc.text(`Dirección fiscal: ${d.emisor.direccion || 'Sin dirección fiscal registrada'}`, { width: 300 });
  const yCaja = yTop;
  const xCaja = MARGEN + ANCHO - 200;
  doc.lineWidth(1).strokeColor(TEXTO).rect(xCaja, yCaja, 200, 78).stroke();
  doc.font('Helvetica-Bold').fontSize(10).text(`R.U.C. ${d.emisor.ruc}`, xCaja, yCaja + 8, { width: 200, align: 'center' });
  doc.fontSize(11).text(nombreTipo, xCaja, yCaja + 26, { width: 200, align: 'center' });
  doc.fontSize(12).text(d.numeroTexto, xCaja, yCaja + 50, { width: 200, align: 'center' });

  // Fecha y cliente
  let y = Math.max(doc.y, yCaja + 84) + 8;
  doc.font('Helvetica').fontSize(9).fillColor(TEXTO).text(`Fecha de emisión: ${d.fecha}   Hora: ${d.hora}`, MARGEN, y, { width: ANCHO });
  y = doc.y + 4;
  doc.text(`${d.cliente.etiqueta}: ${d.cliente.numero}`, MARGEN, y, { width: ANCHO });
  doc.text(`Cliente: ${d.cliente.denominacion}`, { width: ANCHO });
  if (d.cliente.direccion) doc.text(`Dirección: ${d.cliente.direccion}`, { width: ANCHO });

  // Detalle
  y = doc.y + 10;
  const cols = { cant: MARGEN, desc: MARGEN + 50, pu: MARGEN + ANCHO - 170, imp: MARGEN + ANCHO - 80 };
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Cant.', cols.cant, y, { width: 40 });
  doc.text('Descripción', cols.desc, y, { width: cols.pu - cols.desc - 6 });
  doc.text('P. unit.', cols.pu, y, { width: 80, align: 'right' });
  doc.text('Importe', cols.imp, y, { width: 80, align: 'right' });
  y += 14;
  doc.moveTo(MARGEN, y - 2).lineTo(MARGEN + ANCHO, y - 2).strokeColor(GRIS).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(9).fillColor(TEXTO);
  for (const it of d.items) {
    const yFila = y;
    doc.text(String(it.cantidad), cols.cant, yFila, { width: 40 });
    doc.text(it.descripcion, cols.desc, yFila, { width: cols.pu - cols.desc - 6 });
    const alto = doc.y - yFila;
    doc.text(soles(it.precioUnit), cols.pu, yFila, { width: 80, align: 'right' });
    doc.text(soles(it.importe), cols.imp, yFila, { width: 80, align: 'right' });
    y = Math.max(doc.y, yFila + alto) + 3;
    doc.y = y;
  }
  y += 4;
  doc.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO, y).strokeColor(GRIS).lineWidth(0.5).stroke();

  // Totales (derecha)
  const filaTotal = (etiqueta: string, valor: string, negrita = false) => {
    y += 15;
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(negrita ? 11 : 9).fillColor(TEXTO);
    doc.text(etiqueta, MARGEN + ANCHO - 260, y, { width: 170, align: 'right' });
    doc.text(valor, MARGEN + ANCHO - 90, y, { width: 90, align: 'right' });
  };
  filaTotal('Op. gravada (sin IGV)', soles(d.opGravada));
  filaTotal(`IGV (${d.igvPct}%)`, soles(d.igv));
  if (d.descuento > 0) filaTotal('Descuento', `- ${soles(d.descuento)}`);
  filaTotal('TOTAL', soles(d.total), true);
  y += 22;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXTO).text(d.totalEnLetras, MARGEN, y, { width: ANCHO });
  y = doc.y + 12;

  // Situación del documento: aviso si no está firmado o SUNAT no lo aceptó
  if (d.situacion === 'REGULARIZAR') {
    doc.rect(MARGEN, y, ANCHO, 30).fill(ROJO);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text('PENDIENTE DE REGULARIZAR: SUNAT no aceptó este comprobante. No tiene validez hasta regularizarlo.', MARGEN + 8, y + 9, { width: ANCHO - 16, align: 'center' });
    y += 42;
  } else if (d.situacion === 'EN_PROCESO') {
    doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(9).text(d.titulo, MARGEN, y, { width: ANCHO });
    y = doc.y + 10;
  }

  // QR (izquierda) y hash + leyenda (derecha)
  const yQr = y;
  if (qr) doc.image(qr, MARGEN, yQr, { width: 110, height: 110 });
  const xTexto = MARGEN + 125;
  const anchoTexto = ANCHO - 125;
  doc.fillColor(TEXTO).font('Helvetica').fontSize(9);
  if (d.situacion === 'FIRMADO') doc.text(d.titulo, xTexto, yQr, { width: anchoTexto });
  if (d.hash) doc.font('Helvetica-Bold').text(`Resumen (hash): ${d.hash}`, { width: anchoTexto });
  doc.font('Helvetica').text(LEYENDA_REPRESENTACION.replace('{tipo}', d.tipo === 'FACTURA' ? 'Factura' : 'Boleta'), { width: anchoTexto });
  doc.fillColor(GRIS).fontSize(8).text('Este documento es la representación impresa; el comprobante electrónico es el XML firmado que consta en SUNAT.', { width: anchoTexto });
}
