jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { esc, fechaIsoLima, horaLima, leerZip, montoEnLetras, montoXml, numeroEnLetras, zipUnico } from './sunat.util';
import { horaMinutoLima } from '../comprobantes-sunat.service';
import { proveedorDe } from '../emisor/proveedor';
import { ambienteSunat, configSunat } from './sunat.config';

describe('utilidades SUNAT', () => {
  it('monto en letras de la leyenda 1000', () => {
    expect(montoEnLetras(11800)).toBe('SON CIENTO DIECIOCHO CON 00/100 SOLES');
    expect(montoEnLetras(0)).toBe('SON CERO CON 00/100 SOLES');
    expect(montoEnLetras(2150)).toBe('SON VEINTIUNO CON 50/100 SOLES');
    expect(montoEnLetras(10000)).toBe('SON CIEN CON 00/100 SOLES');
    expect(montoEnLetras(123456789)).toBe('SON UN MILLON DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE CON 89/100 SOLES');
    expect(numeroEnLetras(2000)).toBe('DOS MIL');
  });

  it('montos con 2 decimales desde céntimos', () => {
    expect(montoXml(1180)).toBe('11.80');
    expect(montoXml(5)).toBe('0.05');
    expect(montoXml(-250)).toBe('-2.50');
  });

  it('fechas y horas en hora de Lima', () => {
    const d = new Date('2026-11-02T03:30:00.000Z'); // 2 nov 22:30 en Lima
    expect(fechaIsoLima(d)).toBe('2026-11-01');
    expect(horaLima(d)).toBe('22:30:00');
    expect(horaMinutoLima(d)).toEqual({ h: 22, m: 30 });
  });

  it('zip de un solo XML y lectura de vuelta', () => {
    const zip = zipUnico('20000000001-01-F002-1.xml', '<Invoice/>');
    const entradas = leerZip(zip);
    expect(Object.keys(entradas)).toEqual(['20000000001-01-F002-1.xml']);
    expect(entradas['20000000001-01-F002-1.xml'].toString('utf8')).toBe('<Invoice/>');
  });

  it('escapa texto para XML', () => {
    expect(esc('A & B <C> "D" \'E\'')).toBe('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
  });

  it('proveedor: desconocido es SIMULADO; ambiente por defecto beta; prod solo si se pide', () => {
    expect(proveedorDe('SUNAT')).toBe('SUNAT');
    expect(proveedorDe('otra cosa')).toBe('SIMULADO');
    expect(proveedorDe(undefined)).toBe('SIMULADO');
    expect(ambienteSunat({})).toBe('beta');
    expect(ambienteSunat({ SUNAT_AMBIENTE: 'prod' })).toBe('prod');
    expect(ambienteSunat({ SUNAT_AMBIENTE: 'PROD' })).toBe('beta');
    expect(configSunat({ SUNAT_AMBIENTE: 'prod' }).urlFactura).toBe('https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService');
    expect(configSunat({}).urlFactura).toBe('https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService');
  });
});
