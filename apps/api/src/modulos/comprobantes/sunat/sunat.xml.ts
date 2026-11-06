import { calcularComprobante, EntradaCalculo, TotalesCalculados } from '../facturacion/facturacion.calculo';
import { identificarCliente, DatosComprobante } from '../facturacion/facturacion.datos';
import { esc, fechaIsoLima, horaLima, montoEnLetras, montoXml } from './sunat.util';
import { lineasDeCuenta } from '../../pedidos/lineas-combo.util';

/** Namespaces de UBL 2.1 y de SUNAT usados en factura, boleta, resumen y comunicación de baja. */
const NS_INVOICE =
  'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" ' +
  'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" ' +
  'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" ' +
  'xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ' +
  'xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" ' +
  'xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1" ' +
  'xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2" ' +
  'xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"';

const NS_RESUMEN = NS_INVOICE
  .replace('Invoice-2', 'SummaryDocuments-1')
  .replace('xmlns="urn:oasis:names:specification:ubl:schema:xsd:SummaryDocuments-1"', 'xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1"');

const NS_BAJA = NS_INVOICE.replace(
  'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
  'xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1"',
);

/** Datos del emisor que van al XML (RUC, razón, nombre comercial, domicilio fiscal y ubigeo). */
export interface EmisorXml {
  ruc: string;
  razon: string;
  nombreComercial: string;
  direccion: string;
  ubigeo: string;
}

/** Lo que el XML necesita del emisor: no se escribe fijo, sale de la configuración del local. */
export function validarEmisorXml(e: EmisorXml): string | null {
  if (!/^\d{11}$/.test(e.ruc)) return 'El RUC del local no es válido';
  if (!e.razon.trim()) return 'Falta la razón social del local';
  if (!e.direccion.trim()) return 'Falta el domicilio fiscal del local';
  if (!/^\d{6}$/.test(e.ubigeo)) return 'Falta el ubigeo del local (6 dígitos)';
  return null;
}

/** Bloque de firma (cac:Signature) que referencia la firma XML-DSig con Id SignatureSP. */
function bloqueFirma(e: EmisorXml): string {
  return (
    `<cac:Signature><cbc:ID>${esc(e.ruc)}</cbc:ID><cac:SignatoryParty><cac:PartyIdentification><cbc:ID>${esc(e.ruc)}</cbc:ID>` +
    `</cac:PartyIdentification><cac:PartyName><cbc:Name>${esc(e.nombreComercial || e.razon)}</cbc:Name></cac:PartyName></cac:SignatoryParty>` +
    `<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#SignatureSP</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>`
  );
}

/** Hueco donde la firma se inserta (ds:Signature dentro de ext:ExtensionContent). */
const EXTENSION = '<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>';

export interface DatosFacturaXml {
  tipo: 'BOLETA' | 'FACTURA';
  serie: string;
  numero: number;
  /** Fecha de emisión (cobro). */
  fecha: Date;
  emisor: EmisorXml;
  datos: DatosComprobante;
}

export interface ResultadoArmado {
  xml: string;
  totales: TotalesCalculados;
  /** Código SUNAT del tipo de documento: 01 factura, 03 boleta. */
  codigoTipo: '01' | '03';
  /** Documento del cliente como lo pide UBL (schemeID) y su número. */
  cliente: { schemeID: string; numero: string; nombre: string; direccion: string };
}

/** Factura o boleta UBL 2.1 sin firmar (con el hueco de la firma). */
export function armarFacturaXml(p: DatosFacturaXml): ResultadoArmado {
  const d = p.datos;
  let totales: TotalesCalculados;
  try {
    totales = calcularComprobante(d as EntradaCalculo);
  } catch (e: any) {
    throw new Error(e?.message || 'Montos no válidos');
  }
  const cliente = identificarCliente(d);
  const esFactura = p.tipo === 'FACTURA';
  const codigoTipo = esFactura ? '01' : '03';
  const schemeCliente = cliente.tipo === '6' ? '6' : cliente.tipo === '1' ? '1' : '0';
  const id = `${p.serie}-${p.numero}`;
  const ruc = p.emisor.ruc;

  const clienteXml = esFactura
    ? `<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="6">${esc(cliente.numero)}</cbc:ID></cac:PartyIdentification>` +
      `<cac:PartyLegalEntity><cbc:RegistrationName>${esc(cliente.denominacion)}</cbc:RegistrationName>` +
      (cliente.direccion ? `<cac:RegistrationAddress><cac:AddressLine><cbc:Line>${esc(cliente.direccion)}</cbc:Line></cac:AddressLine></cac:RegistrationAddress>` : '') +
      `</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`
    : `<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="${schemeCliente}">${esc(cliente.numero)}</cbc:ID></cac:PartyIdentification>` +
      `<cac:PartyLegalEntity><cbc:RegistrationName>${esc(cliente.denominacion)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`;

  const emisorXml =
    `<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="6">${esc(ruc)}</cbc:ID></cac:PartyIdentification>` +
    `<cac:PartyName><cbc:Name>${esc(p.emisor.nombreComercial)}</cbc:Name></cac:PartyName>` +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${esc(p.emisor.razon)}</cbc:RegistrationName>` +
    `<cac:RegistrationAddress><cbc:ID>${esc(p.emisor.ubigeo)}</cbc:ID><cbc:AddressTypeCode>0000</cbc:AddressTypeCode>` +
    `<cac:AddressLine><cbc:Line>${esc(p.emisor.direccion)}</cbc:Line></cac:AddressLine>` +
    `<cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country></cac:RegistrationAddress>` +
    `</cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>`;

  // Líneas: el valor de venta sin IGV de cada línea; el precio unitario con IGV va como precio de referencia (01)
  const lineas = totales.items
    .map((it, i) => {
      const valorUnit = (it.baseCents / it.cantidad / 100).toFixed(10);
      return (
        `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID>` +
        `<cbc:InvoicedQuantity unitCode="${it.esEnvio ? 'ZZ' : 'NIU'}">${it.cantidad}</cbc:InvoicedQuantity>` +
        `<cbc:LineExtensionAmount currencyID="PEN">${montoXml(it.baseCents)}</cbc:LineExtensionAmount>` +
        `<cac:PricingReference><cac:AlternativeConditionPrice><cbc:PriceAmount currencyID="PEN">${montoXml(it.precioUnitCents)}</cbc:PriceAmount>` +
        `<cbc:PriceTypeCode>01</cbc:PriceTypeCode></cac:AlternativeConditionPrice></cac:PricingReference>` +
        `<cac:TaxTotal><cbc:TaxAmount currencyID="PEN">${montoXml(it.igvCents)}</cbc:TaxAmount><cac:TaxSubtotal>` +
        `<cbc:TaxableAmount currencyID="PEN">${montoXml(it.baseCents)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="PEN">${montoXml(it.igvCents)}</cbc:TaxAmount>` +
        `<cac:TaxCategory><cbc:Percent>${d.igvPct.toFixed(2)}</cbc:Percent><cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>` +
        `<cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>` +
        `</cac:TaxSubtotal></cac:TaxTotal>` +
        `<cac:Item><cbc:Description>${esc(it.nombre)}</cbc:Description></cac:Item>` +
        `<cac:Price><cbc:PriceAmount currencyID="PEN">${valorUnit}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`
      );
    })
    .join('');

  const baseLineas = totales.items.reduce((a, it) => a + it.baseCents, 0);
  const descuento =
    totales.descuentoCents > 0
      ? `<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReasonCode>02</cbc:AllowanceChargeReasonCode>` +
        `<cbc:Amount currencyID="PEN">${montoXml(totales.descuentoBaseCents)}</cbc:Amount>` +
        `<cbc:BaseAmount currencyID="PEN">${montoXml(baseLineas)}</cbc:BaseAmount></cac:AllowanceCharge>`
      : '';

  const xml =
    `<?xml version="1.0" encoding="utf-8"?><Invoice ${NS_INVOICE}>${EXTENSION}` +
    `<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>2.0</cbc:CustomizationID>` +
    `<cbc:ID>${esc(id)}</cbc:ID><cbc:IssueDate>${fechaIsoLima(p.fecha)}</cbc:IssueDate><cbc:IssueTime>${horaLima(p.fecha)}</cbc:IssueTime>` +
    `<cbc:InvoiceTypeCode listID="0101">${codigoTipo}</cbc:InvoiceTypeCode>` +
    `<cbc:Note languageLocaleID="1000"><![CDATA[${montoEnLetras(totales.totalCents)}]]></cbc:Note>` +
    `<cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>` +
    bloqueFirma(p.emisor) +
    emisorXml +
    clienteXml +
    `<cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID></cac:PaymentTerms>` +
    descuento +
    // ponytail: una sola categoría IGV con el porcentaje del local; confirmar con el contador si el IPM va separado
    `<cac:TaxTotal><cbc:TaxAmount currencyID="PEN">${montoXml(totales.totalIgvCents)}</cbc:TaxAmount><cac:TaxSubtotal>` +
    `<cbc:TaxableAmount currencyID="PEN">${montoXml(totales.totalGravadaCents)}</cbc:TaxableAmount>` +
    `<cbc:TaxAmount currencyID="PEN">${montoXml(totales.totalIgvCents)}</cbc:TaxAmount>` +
    `<cac:TaxCategory><cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>` +
    `</cac:TaxSubtotal></cac:TaxTotal>` +
    `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="PEN">${montoXml(baseLineas)}</cbc:LineExtensionAmount>` +
    `<cbc:TaxInclusiveAmount currencyID="PEN">${montoXml(totales.totalCents)}</cbc:TaxInclusiveAmount>` +
    (totales.descuentoCents > 0 ? `<cbc:AllowanceTotalAmount currencyID="PEN">${montoXml(totales.descuentoBaseCents)}</cbc:AllowanceTotalAmount>` : '') +
    `<cbc:PayableAmount currencyID="PEN">${montoXml(totales.totalCents)}</cbc:PayableAmount></cac:LegalMonetaryTotal>` +
    lineas +
    `</Invoice>`;

  return {
    xml,
    totales,
    codigoTipo,
    cliente: { schemeID: schemeCliente, numero: cliente.numero, nombre: cliente.denominacion, direccion: cliente.direccion },
  };
}

/** Línea de un resumen diario: boleta nueva (estado 1) o anulada (estado 3). Montos en céntimos. */
export interface LineaResumen {
  serie: string;
  numero: number;
  /** DNI de 8 dígitos o null (boleta sin identificar). */
  documento: string | null;
  totalCents: number;
  igvCents: number;
  estado: 1 | 3;
}

function cabeceraEmisorResumen(e: EmisorXml): string {
  return (
    `<cac:AccountingSupplierParty><cbc:CustomerAssignedAccountID>${esc(e.ruc)}</cbc:CustomerAssignedAccountID>` +
    `<cbc:AdditionalAccountID>6</cbc:AdditionalAccountID><cac:Party><cac:PartyLegalEntity>` +
    `<cbc:RegistrationName>${esc(e.razon)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>`
  );
}

/**
 * Resumen diario de boletas (SummaryDocuments, UBL 2.0). Un resumen por fecha de referencia.
 * idDoc = RC-{AAAAMMDD}-{correlativo} (sin RUC: el RUC va en el nombre del archivo); fechaEmision = día en que se genera; fechaRef = día de las boletas.
 */
export function armarResumenDiarioXml(p: { idDoc: string; emisor: EmisorXml; fechaEmision: Date; fechaRef: string; igvPct: number; lineas: LineaResumen[] }): string {
  const lineas = lineasDeCuenta(p.lineas)
    .map((l, i) => {
      const dniOk = l.documento && /^\d{8}$/.test(l.documento);
      const tipoCliente = dniOk ? '1' : '0';
      const numCliente = dniOk ? l.documento : '-';
      return (
        `<sac:SummaryDocumentsLine><cbc:LineID>${i + 1}</cbc:LineID><cbc:DocumentTypeCode>03</cbc:DocumentTypeCode>` +
        `<cbc:ID>${esc(`${l.serie}-${l.numero}`)}</cbc:ID>` +
        `<cac:AccountingCustomerParty><cbc:CustomerAssignedAccountID>${esc(numCliente)}</cbc:CustomerAssignedAccountID>` +
        `<cbc:AdditionalAccountID>${tipoCliente}</cbc:AdditionalAccountID></cac:AccountingCustomerParty>` +
        `<cac:Status><cbc:ConditionCode>${l.estado}</cbc:ConditionCode></cac:Status>` +
        `<sac:TotalAmount currencyID="PEN">${montoXml(l.totalCents)}</sac:TotalAmount>` +
        // Valor de venta (sin IGV) y tipo de operación 01 = gravada; con el IGV suma el total de la línea
        `<sac:BillingPayment><cbc:PaidAmount currencyID="PEN">${montoXml(l.totalCents - l.igvCents)}</cbc:PaidAmount><cbc:InstructionID>01</cbc:InstructionID></sac:BillingPayment>` +
        `<cac:TaxTotal><cbc:TaxAmount currencyID="PEN">${montoXml(l.igvCents)}</cbc:TaxAmount><cac:TaxSubtotal>` +
        `<cbc:TaxAmount currencyID="PEN">${montoXml(l.igvCents)}</cbc:TaxAmount><cac:TaxCategory>` +
        `<cbc:Percent>${p.igvPct.toFixed(2)}</cbc:Percent><cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode><cac:TaxScheme>` +
        `<cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>` +
        `</cac:TaxSubtotal></cac:TaxTotal></sac:SummaryDocumentsLine>`
      );
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="utf-8"?><SummaryDocuments ${NS_RESUMEN}>${EXTENSION}` +
    `<cbc:UBLVersionID>2.0</cbc:UBLVersionID><cbc:CustomizationID>1.1</cbc:CustomizationID>` +
    `<cbc:ID>${esc(p.idDoc)}</cbc:ID><cbc:ReferenceDate>${p.fechaRef}</cbc:ReferenceDate>` +
    `<cbc:IssueDate>${fechaIsoLima(p.fechaEmision)}</cbc:IssueDate>` +
    bloqueFirma(p.emisor) +
    cabeceraEmisorResumen(p.emisor) +
    lineas +
    `</SummaryDocuments>`
  );
}

/** Comunicación de baja de facturas (VoidedDocuments, UBL 2.0). fechaRef = fecha de emisión de la factura. */
export function armarBajaXml(p: {
  idDoc: string;
  emisor: EmisorXml;
  fechaEmision: Date;
  fechaRef: string;
  lineas: Array<{ serie: string; numero: number; motivo: string }>;
}): string {
  const lineas = lineasDeCuenta(p.lineas)
    .map(
      (l, i) =>
        `<sac:VoidedDocumentsLine><cbc:LineID>${i + 1}</cbc:LineID><cbc:DocumentTypeCode>01</cbc:DocumentTypeCode>` +
        `<sac:DocumentSerialID>${esc(l.serie)}</sac:DocumentSerialID><sac:DocumentNumberID>${l.numero}</sac:DocumentNumberID>` +
        `<sac:VoidReasonDescription>${esc(l.motivo)}</sac:VoidReasonDescription></sac:VoidedDocumentsLine>`,
    )
    .join('');
  return (
    `<?xml version="1.0" encoding="utf-8"?><VoidedDocuments ${NS_BAJA}>${EXTENSION}` +
    `<cbc:UBLVersionID>2.0</cbc:UBLVersionID><cbc:CustomizationID>1.0</cbc:CustomizationID>` +
    `<cbc:ID>${esc(p.idDoc)}</cbc:ID><cbc:ReferenceDate>${p.fechaRef}</cbc:ReferenceDate>` +
    `<cbc:IssueDate>${fechaIsoLima(p.fechaEmision)}</cbc:IssueDate>` +
    bloqueFirma(p.emisor) +
    cabeceraEmisorResumen(p.emisor) +
    lineas +
    `</VoidedDocuments>`
  );
}
