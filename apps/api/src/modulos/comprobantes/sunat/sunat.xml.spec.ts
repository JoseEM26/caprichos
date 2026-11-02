import { DOMParser } from '@xmldom/xmldom';
import { calcularComprobante } from '../facturacion/facturacion.calculo';
import { ComprobanteInvalidoError } from '../facturacion/facturacion.datos';
import { datosDePrueba, EMISOR_PRUEBA } from './sunat.pruebas';
import { armarBajaXml, armarFacturaXml, armarResumenDiarioXml, validarEmisorXml } from './sunat.xml';
import { montoXml } from './sunat.util';

/** Parsea el XML y lanza si no está bien formado (sin ruido en consola). */
function parsear(xml: string): any {
  const errores: string[] = [];
  const doc = new DOMParser({ errorHandler: (nivel: string, msg: string) => { if (nivel !== 'warning') errores.push(msg); } }).parseFromString(xml, 'text/xml');
  if (errores.length) throw new Error(`XML mal formado: ${errores[0]}`);
  return doc;
}
const valor = (doc: any, nombre: string, i = 0): string | null => doc.getElementsByTagNameNS('*', nombre)[i]?.textContent ?? null;
const fecha = new Date('2026-11-02T15:00:00.000Z');

describe('UBL 2.1 de factura y boleta (IGV 10.5, sin red)', () => {
  it('factura: cabecera, leyenda 1000, cliente RUC schemeID 6 y totales cuadrados al céntimo', () => {
    const d = datosDePrueba();
    const { xml, totales } = armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 1, fecha, emisor: EMISOR_PRUEBA, datos: d });
    const doc = parsear(xml);
    expect(valor(doc, 'UBLVersionID')).toBe('2.1');
    expect(valor(doc, 'CustomizationID')).toBe('2.0');
    expect(valor(doc, 'ID')).toBe('F002-1');
    expect(valor(doc, 'IssueDate')).toBe('2026-11-02');
    expect(valor(doc, 'IssueTime')).toBe('10:00:00');
    expect(valor(doc, 'InvoiceTypeCode')).toBe('01');
    expect(doc.getElementsByTagNameNS('*', 'InvoiceTypeCode')[0].getAttribute('listID')).toBe('0101');
    expect(valor(doc, 'Note')).toBe(`SON TREINTA Y TRES CON 60/100 SOLES`);
    expect(doc.getElementsByTagNameNS('*', 'Note')[0].getAttribute('languageLocaleID')).toBe('1000');
    expect(valor(doc, 'DocumentCurrencyCode')).toBe('PEN');
    expect(doc.getElementsByTagNameNS('*', 'AccountingCustomerParty')[0].getElementsByTagNameNS('*', 'ID')[0].getAttribute('schemeID')).toBe('6');
    expect(doc.getElementsByTagNameNS('*', 'RegistrationName')[1].textContent).toBe('CLIENTE DE PRUEBA SAC');
    expect(doc.getElementsByTagNameNS('*', 'RegistrationAddress')[0].getElementsByTagNameNS('*', 'ID')[0].textContent).toBe('150132');
    expect(valor(doc, 'TaxInclusiveAmount')).toBe(montoXml(totales.totalCents));
    expect(valor(doc, 'PayableAmount')).toBe('33.60');
    expect(valor(doc, 'TaxableAmount')).toBe(montoXml(totales.totalGravadaCents));
    expect(valor(doc, 'TaxAmount')).toBe(montoXml(totales.totalIgvCents));
    expect(totales.totalGravadaCents + totales.totalIgvCents).toBe(3360);
  });

  it('cada línea: NIU, precio de referencia 01 con IGV, TaxExemptionReasonCode 10 y Percent 10.50', () => {
    const { xml } = armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 1, fecha, emisor: EMISOR_PRUEBA, datos: datosDePrueba() });
    const doc = parsear(xml);
    const lineas = doc.getElementsByTagNameNS('*', 'InvoiceLine');
    expect(lineas.length).toBe(2);
    const primera = lineas[0];
    expect(primera.getElementsByTagNameNS('*', 'InvoicedQuantity')[0].getAttribute('unitCode')).toBe('NIU');
    expect(primera.getElementsByTagNameNS('*', 'PriceAmount')[0].textContent).toBe('11.80');
    expect(primera.getElementsByTagNameNS('*', 'PriceTypeCode')[0].textContent).toBe('01');
    expect(primera.getElementsByTagNameNS('*', 'TaxExemptionReasonCode')[0].textContent).toBe('10');
    expect(primera.getElementsByTagNameNS('*', 'Percent')[0].textContent).toBe('10.50');
    expect(primera.getElementsByTagNameNS('*', 'Description')[0].textContent).toBe('Frappe Oreo');
  });

  it('delivery como línea ZZ y descuento global como AllowanceCharge', () => {
    const d = datosDePrueba({ envioCents: 500, totalCents: 3860 + 0, descuentoCents: 0 });
    const { xml } = armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 1, fecha, emisor: EMISOR_PRUEBA, datos: d });
    const doc = parsear(xml);
    expect(doc.getElementsByTagNameNS('*', 'InvoiceLine').length).toBe(3);
    expect(doc.getElementsByTagNameNS('*', 'InvoicedQuantity')[2].getAttribute('unitCode')).toBe('ZZ');
    expect(valor(doc, 'PayableAmount')).toBe('38.60');

    const conDescuento = datosDePrueba({ descuentoCents: 360, totalCents: 3000 });
    const r = armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 1, fecha, emisor: EMISOR_PRUEBA, datos: conDescuento });
    const doc2 = parsear(r.xml);
    expect(doc2.getElementsByTagNameNS('*', 'AllowanceCharge').length).toBe(1);
    expect(valor(doc2, 'AllowanceTotalAmount')).toBe(montoXml(r.totales.descuentoBaseCents));
    expect(valor(doc2, 'PayableAmount')).toBe('30.00');
    expect(r.totales.totalCents).toBe(3000);
  });

  it('boleta sin documento: schemeID 0 y "-", CLIENTE VARIOS; con DNI: schemeID 1', () => {
    const sin = armarFacturaXml({ tipo: 'BOLETA', serie: 'B002', numero: 7, fecha, emisor: EMISOR_PRUEBA, datos: datosDePrueba({ tipo: 'BOLETA', documento: null, razon: null, direccion: null }) });
    const d1 = parsear(sin.xml);
    expect(sin.codigoTipo).toBe('03');
    expect(valor(d1, 'InvoiceTypeCode')).toBe('03');
    expect(d1.getElementsByTagNameNS('*', 'AccountingCustomerParty')[0].getElementsByTagNameNS('*', 'ID')[0].getAttribute('schemeID')).toBe('0');
    expect(valor(d1, 'RegistrationName', 1)).toBe('CLIENTE VARIOS');
    const con = armarFacturaXml({ tipo: 'BOLETA', serie: 'B002', numero: 8, fecha, emisor: EMISOR_PRUEBA, datos: datosDePrueba({ tipo: 'BOLETA', documento: '12345678', razon: 'ANA' }) });
    const d2 = parsear(con.xml);
    expect(d2.getElementsByTagNameNS('*', 'AccountingCustomerParty')[0].getElementsByTagNameNS('*', 'ID')[0].getAttribute('schemeID')).toBe('1');
  });

  it('reglas de cliente: boleta mayor a S/ 700 sin documento y factura con RUC malo no se arman', () => {
    const grande = datosDePrueba({ tipo: 'BOLETA', documento: null, razon: null, lineas: [{ nombre: 'Torta', cantidad: 1, subtotalCents: 70001 }], totalCents: 70001 });
    expect(() => armarFacturaXml({ tipo: 'BOLETA', serie: 'B002', numero: 9, fecha, emisor: EMISOR_PRUEBA, datos: grande })).toThrow(ComprobanteInvalidoError);
    expect(() => armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 9, fecha, emisor: EMISOR_PRUEBA, datos: datosDePrueba({ documento: '123' }) })).toThrow(/RUC/);
  });

  it('los montos de la factura son los del cálculo (céntimos, sin floats)', () => {
    const d = datosDePrueba();
    const t = calcularComprobante(d);
    const { xml } = armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 1, fecha, emisor: EMISOR_PRUEBA, datos: d });
    expect(xml).toContain(`<cbc:PayableAmount currencyID="PEN">${montoXml(t.totalCents)}</cbc:PayableAmount>`);
  });

  it('validarEmisorXml exige RUC, razón, domicilio y ubigeo', () => {
    expect(validarEmisorXml({ ...EMISOR_PRUEBA })).toBeNull();
    expect(validarEmisorXml({ ...EMISOR_PRUEBA, ubigeo: '' })).toMatch(/ubigeo/);
    expect(validarEmisorXml({ ...EMISOR_PRUEBA, ruc: '123' })).toMatch(/RUC/);
  });
});

describe('resumen diario (RC) y comunicación de baja (RA)', () => {
  it('RC: ReferenceDate de las boletas, líneas con estado 1 y 3, DNI schemeID 1 o "-" con 0', () => {
    const xml = armarResumenDiarioXml({
      idDoc: 'RC-20261102-1',
      emisor: EMISOR_PRUEBA,
      fechaEmision: fecha,
      fechaRef: '2026-11-01',
      igvPct: 10.5,
      lineas: [
        { serie: 'B002', numero: 1, documento: null, totalCents: 1180, igvCents: 112, estado: 1 },
        { serie: 'B002', numero: 2, documento: '12345678', totalCents: 2000, igvCents: 190, estado: 3 },
      ],
    });
    const doc = parsear(xml);
    expect(doc.documentElement.localName).toBe('SummaryDocuments');
    expect(valor(doc, 'ID')).toBe('RC-20261102-1');
    expect(valor(doc, 'ReferenceDate')).toBe('2026-11-01');
    expect(valor(doc, 'IssueDate')).toBe('2026-11-02');
    const lineas = doc.getElementsByTagNameNS('*', 'SummaryDocumentsLine');
    expect(lineas.length).toBe(2);
    expect(lineas[0].getElementsByTagNameNS('*', 'ConditionCode')[0].textContent).toBe('1');
    expect(lineas[0].getElementsByTagNameNS('*', 'Percent')[0].textContent).toBe('10.50');
    // valor de venta + IGV = total de la línea (SUNAT 4027)
    expect(lineas[0].getElementsByTagNameNS('*', 'PaidAmount')[0].textContent).toBe('10.68');
    expect(lineas[0].getElementsByTagNameNS('*', 'InstructionID')[0].textContent).toBe('01');
    expect(lineas[0].getElementsByTagNameNS('*', 'CustomerAssignedAccountID')[0].textContent).toBe('-');
    expect(lineas[0].getElementsByTagNameNS('*', 'AdditionalAccountID')[0].textContent).toBe('0');
    expect(lineas[1].getElementsByTagNameNS('*', 'ConditionCode')[0].textContent).toBe('3');
    expect(lineas[1].getElementsByTagNameNS('*', 'AdditionalAccountID')[0].textContent).toBe('1');
    expect(lineas[1].getElementsByTagNameNS('*', 'TotalAmount')[0].textContent).toBe('20.00');
  });

  it('RA: VoidedDocuments con la factura, serie, número y motivo', () => {
    const xml = armarBajaXml({ idDoc: 'RA-20261102-1', emisor: EMISOR_PRUEBA, fechaEmision: fecha, fechaRef: '2026-11-02', lineas: [{ serie: 'F002', numero: 3, motivo: 'Cobro duplicado' }] });
    const doc = parsear(xml);
    expect(doc.documentElement.localName).toBe('VoidedDocuments');
    expect(valor(doc, 'ID')).toBe('RA-20261102-1');
    expect(valor(doc, 'DocumentSerialID')).toBe('F002');
    expect(valor(doc, 'DocumentNumberID')).toBe('3');
    expect(valor(doc, 'VoidReasonDescription')).toBe('Cobro duplicado');
    expect(valor(doc, 'DocumentTypeCode')).toBe('01');
  });
});
