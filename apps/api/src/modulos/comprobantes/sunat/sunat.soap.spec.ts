import { ErrorRedEmisor } from '../emisor/emisor.tipos';
import { zipUnico } from './sunat.util';
import { codigoFault, cuerpoEnvio, enviarSoap, esFaultCliente, estadoCdr, leerCdr, parsearSoap, sobreSoap, textoCdr } from './sunat.soap';

const cdrXml = (codigo: string, descripcion: string, nota?: string) =>
  `<?xml version="1.0"?><ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" ` +
  `xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
  (nota ? `<cbc:Note>${nota}</cbc:Note>` : '') +
  `<cac:DocumentResponse><cac:Response><cbc:ResponseCode>${codigo}</cbc:ResponseCode><cbc:Description>${descripcion}</cbc:Description></cac:Response></cac:DocumentResponse></ar:ApplicationResponse>`;

const zipCdr = (codigo: string, descripcion: string, nota?: string) =>
  zipUnico('R-20000000001-01-F002-1.xml', cdrXml(codigo, descripcion, nota)).toString('base64');

const respuestaOk = (zip: string) =>
  `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>` +
  `<br:sendBillResponse xmlns:br="http://service.sunat.gob.pe"><br:applicationResponse>${zip}</br:applicationResponse></br:sendBillResponse></soap:Body></soap:Envelope>`;

const fault = (codigo: string, mensaje: string) =>
  `<?xml version="1.0"?><soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"><soap-env:Body><soap-env:Fault>` +
  `<faultcode>${codigo}</faultcode><faultstring>${mensaje}</faultstring></soap-env:Fault></soap-env:Body></soap-env:Envelope>`;

describe('sobre SOAP y respuestas de SUNAT (sin red)', () => {
  it('sobre con WS-Security UsernameToken y la operación; caracteres especiales escapados', () => {
    const sobre = sobreSoap('sendBill', cuerpoEnvio('x.zip', Buffer.from('zip')), '20000000001MODDATOS', 'mod&datos<');
    expect(sobre).toContain('<wsse:Username>20000000001MODDATOS</wsse:Username>');
    expect(sobre).toContain('PasswordText">mod&amp;datos&lt;</wsse:Password>');
    expect(sobre).toContain('<ser:sendBill><fileName>x.zip</fileName><contentFile>');
    expect(sobre).toContain(Buffer.from('zip').toString('base64'));
  });

  it('fault del cliente (0109) es rechazo con mensaje; fault de servidor no lo es', () => {
    const r = parsearSoap(fault('soap-env:Client.0109', 'Usuario o clave incorrectos'));
    expect(r.fault).toEqual({ codigo: 'soap-env:Client.0109', mensaje: 'Usuario o clave incorrectos' });
    expect(esFaultCliente(r.fault!)).toBe(true);
    expect(codigoFault(r.fault!)).toBe('0109');
    expect(esFaultCliente({ codigo: 'soap-env:Server.internal' })).toBe(false);
  });

  it('sendBill: el CDR sale del applicationResponse; código 0 es aceptada', () => {
    const r = parsearSoap(respuestaOk(zipCdr('0', 'La Factura numero F002-1, ha sido aceptada')));
    expect(r.fault).toBeUndefined();
    const cdr = leerCdr(r.textos.applicationResponse);
    expect(cdr.nombre).toBe('R-20000000001-01-F002-1.xml');
    expect(cdr.codigo).toBe(0);
    expect(estadoCdr(cdr)).toBe('ACEPTADA');
    expect(textoCdr(cdr)).toContain('ha sido aceptada');
  });

  it('CDR rechazada (código de error) y con observación (4000 a 4999)', () => {
    expect(estadoCdr(leerCdr(zipCdr('2324', 'El documento ya existe')))).toBe('RECHAZADA');
    const obs = leerCdr(zipCdr('4001', 'Aceptada con observaciones', 'El comprobante tiene un dato observado'));
    expect(estadoCdr(obs)).toBe('ACEPTADA_CON_OBSERVACIONES');
    expect(textoCdr(obs)).toContain('Obs: El comprobante tiene un dato observado');
  });

  it('enviarSoap: 500 con fault se devuelve para interpretarlo; 503 sin fault y red caída son ErrorRedEmisor', async () => {
    const conFault = jest.fn().mockResolvedValue(new Response(fault('soap-env:Client.0100', 'x'), { status: 500 }));
    await expect(enviarSoap('https://x.test', '<a/>', conFault)).resolves.toContain('Fault');
    const sinFault = jest.fn().mockResolvedValue(new Response('mantenimiento', { status: 503 }));
    await expect(enviarSoap('https://x.test', '<a/>', sinFault)).rejects.toBeInstanceOf(ErrorRedEmisor);
    const caida = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(enviarSoap('https://x.test', '<a/>', caida)).rejects.toBeInstanceOf(ErrorRedEmisor);
  });

  it('el sobre se envía con Content-Type text/xml y el cuerpo tal cual (sin registrarlo)', async () => {
    const f = jest.fn().mockResolvedValue(new Response(respuestaOk('AAAA'), { status: 200 }));
    await enviarSoap('https://x.test/svc', '<sobre/>', f);
    const init = f.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('<sobre/>');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('text/xml');
  });
});
