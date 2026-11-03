import { armarComprobante, ComprobanteInvalidoError, fechaFacturacion, identificarCliente } from './facturacion.datos';

const fecha = new Date('2026-10-21T18:00:00.000Z'); // 21-10-2026 en Lima
const base = {
  serie: 'B002',
  numero: 7,
  fecha,
  igvPct: 10.5,
  lineas: [{ nombre: 'Frappe Oreo', cantidad: 1, subtotalCents: 1180 }],
  envioCents: 0,
  descuentoCents: 0,
  totalCents: 1180,
};

describe('facturacion.datos: cliente y montos de BOLETA y FACTURA', () => {
  it('boleta sin DNI: cliente "-" y CLIENTE VARIOS; totales con IGV 10.5 y fecha de Lima', () => {
    const { totales, fecha: f } = armarComprobante({ ...base, tipo: 'BOLETA', documento: null, razon: null, direccion: null, correo: null });
    expect(identificarCliente({ ...base, tipo: 'BOLETA', documento: null })).toMatchObject({ tipo: '-', numero: '-', denominacion: 'CLIENTE VARIOS' });
    expect(f).toBe('21-10-2026');
    expect(totales).toMatchObject({ totalCents: 1180, totalGravadaCents: 1068, totalIgvCents: 112 });
  });

  it('boleta con DNI: tipo 1 y nombre del cliente', () => {
    expect(identificarCliente({ ...base, tipo: 'BOLETA', documento: '12345678', razon: 'Juan Perez', direccion: null })).toMatchObject({
      tipo: '1',
      numero: '12345678',
      denominacion: 'Juan Perez',
    });
  });

  it('boleta sin documento de más de S/ 700 se rechaza (exige DNI o CE)', () => {
    expect(() =>
      armarComprobante({ ...base, tipo: 'BOLETA', documento: null, razon: null, direccion: null, correo: null, lineas: [{ nombre: 'Caja', cantidad: 1, subtotalCents: 70100 }], totalCents: 70100 }),
    ).toThrow(ComprobanteInvalidoError);
  });

  it('boleta sin documento de exactamente S/ 700 sí pasa', () => {
    expect(() =>
      armarComprobante({ ...base, tipo: 'BOLETA', documento: null, razon: null, direccion: null, correo: null, lineas: [{ nombre: 'Caja', cantidad: 1, subtotalCents: 70000 }], totalCents: 70000 }),
    ).not.toThrow();
  });

  it('boleta con DNI de 7 dígitos se rechaza', () => {
    expect(() => armarComprobante({ ...base, tipo: 'BOLETA', documento: '1234567', razon: null, direccion: null, correo: null })).toThrow('DNI');
  });

  it('factura con RUC y razón social: tipo 6, dirección opcional', () => {
    expect(identificarCliente({ ...base, tipo: 'FACTURA', documento: '20601234567', razon: 'Inversiones Aybar S.A.C.', direccion: 'Av. Lima 123' })).toEqual({
      tipo: '6',
      numero: '20601234567',
      denominacion: 'Inversiones Aybar S.A.C.',
      direccion: 'Av. Lima 123',
    });
  });

  it('factura sin razón social o con RUC inválido se rechaza', () => {
    expect(() => armarComprobante({ ...base, tipo: 'FACTURA', documento: '20601234567', razon: '  ', direccion: null, correo: null })).toThrow('razón social');
    expect(() => armarComprobante({ ...base, tipo: 'FACTURA', documento: '1060123456', razon: 'X SAC', direccion: null, correo: null })).toThrow('RUC');
  });

  it('descuento y delivery: totales cuadrados con el total del pedido', () => {
    const { totales } = armarComprobante({
      ...base,
      tipo: 'BOLETA',
      documento: null,
      razon: null,
      direccion: null,
      correo: null,
      lineas: [{ nombre: 'Combo', cantidad: 1, subtotalCents: 10000 }],
      envioCents: 500,
      descuentoCents: 1000,
      totalCents: 9500,
    });
    expect(totales.totalCents).toBe(9500);
    expect(totales.totalGravadaCents + totales.totalIgvCents).toBe(9500);
  });

  it('montos incoherentes con el total del pedido: ComprobanteInvalidoError', () => {
    expect(() => armarComprobante({ ...base, tipo: 'BOLETA', documento: null, razon: null, direccion: null, correo: null, totalCents: 1200 })).toThrow(ComprobanteInvalidoError);
  });

  it('fechaFacturacion usa la hora de Lima (día anterior si es de madrugada en UTC)', () => {
    expect(fechaFacturacion(new Date('2026-10-22T03:00:00.000Z'))).toBe('21-10-2026');
  });
});
