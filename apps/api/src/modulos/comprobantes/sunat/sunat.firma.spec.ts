import { certificadoDePrueba, datosDePrueba, EMISOR_PRUEBA } from './sunat.pruebas';
import { armarFacturaXml } from './sunat.xml';
import { digestDeFirma, firmarXml, leerCertificadoP12, verificarFirma } from './sunat.firma';

describe('firma XML-DSig de SUNAT (certificado de prueba en memoria)', () => {
  const p12 = certificadoDePrueba();
  const cert = leerCertificadoP12(p12.p12B64, p12.clave);
  const arm = armarFacturaXml({ tipo: 'FACTURA', serie: 'F002', numero: 1, fecha: new Date('2026-11-02T15:00:00Z'), emisor: EMISOR_PRUEBA, datos: datosDePrueba() });
  const firmado = firmarXml(arm.xml, cert);

  it('la firma va dentro de ExtensionContent con Id SignatureSP y referencia URI vacía', () => {
    expect(firmado).toMatch(/<ext:ExtensionContent><ds:Signature[^>]*Id="SignatureSP"/);
    expect(firmado).toMatch(/<ds:Reference URI="">/);
    expect(firmado).toMatch(/enveloped-signature/);
    expect(firmado).toMatch(/<ds:X509Certificate>[A-Za-z0-9+/=]+<\/ds:X509Certificate>/);
    expect(firmado).toMatch(/rsa-sha256/);
  });

  it('la firma verifica con el certificado y deja de verificar si el XML cambia', () => {
    expect(verificarFirma(firmado, cert.certBase64)).toBe(true);
    const alterado = firmado.replace('Frappe Oreo', 'Frappe Otro');
    expect(verificarFirma(alterado, cert.certBase64)).toBe(false);
  });

  it('el DigestValue del XML firmado es el codigo_hash (SHA-256 en base64, 44 caracteres)', () => {
    const digest = digestDeFirma(firmado);
    expect(digest).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  });

  it('un .p12 con clave incorrecta falla sin revelar la clave', () => {
    expect(() => leerCertificadoP12(p12.p12B64, 'otra-clave')).toThrow(/revise SUNAT_CERT_P12_B64/);
    try {
      leerCertificadoP12(p12.p12B64, 'otra-clave');
    } catch (e: any) {
      expect(String(e.message)).not.toContain('otra-clave');
    }
  });
});
