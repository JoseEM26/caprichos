import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

export interface CertificadoFirma {
  /** Clave privada en PEM (solo en memoria; nunca se registra). */
  clavePem: string;
  /** Certificado X.509 en DER base64 (para KeyInfo). */
  certBase64: string;
  /** Vencimiento del certificado (para avisar antes). */
  vence: Date;
}

/** Extrae clave y certificado de un PKCS#12 en base64 con su clave. Lanza error genérico (sin valores). */
export function leerCertificadoP12(p12B64: string, clave: string): CertificadoFirma {
  let asn1;
  let p12;
  try {
    asn1 = forge.asn1.fromDer(forge.util.decode64(p12B64));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, clave);
  } catch {
    throw new Error('No se pudo abrir el certificado (.p12): revise SUNAT_CERT_P12_B64 y SUNAT_CERT_CLAVE');
  }
  const bolsasClave = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const bolsasCert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const clavePriv = bolsasClave.find((b) => b.key)?.key;
  const cert = bolsasCert.find((b) => b.cert)?.cert;
  if (!clavePriv || !cert) throw new Error('El certificado (.p12) no trae clave privada y certificado');
  return {
    clavePem: forge.pki.privateKeyToPem(clavePriv),
    certBase64: forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()),
    vence: cert.validity.notAfter,
  };
}

/**
 * Firma XML-DSig enveloped (RSA-SHA256, c14n) dentro de ext:ExtensionContent, Id SignatureSP,
 * referencia URI="" con transforms enveloped-signature + c14n, certificado X509 en KeyInfo.
 */
export function firmarXml(xml: string, cert: CertificadoFirma): string {
  const firma = new SignedXml({
    privateKey: cert.clavePem,
    signatureAlgorithm: RSA_SHA256,
    canonicalizationAlgorithm: C14N,
  });
  firma.addReference({
    xpath: '/*',
    uri: '',
    isEmptyUri: true,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA256,
  });
  firma.getKeyInfoContent = () =>
    `<ds:X509Data><ds:X509Certificate>${cert.certBase64}</ds:X509Certificate></ds:X509Data>`;
  firma.computeSignature(xml, {
    prefix: 'ds',
    attrs: { Id: 'SignatureSP' },
    location: { reference: "//*[local-name(.)='ExtensionContent']", action: 'append' },
  });
  return firma.getSignedXml();
}

/** DigestValue de la firma (codigo_hash de la representación impresa). */
export function digestDeFirma(xmlFirmado: string): string {
  const m = /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(xmlFirmado);
  if (!m) throw new Error('El XML no trae DigestValue');
  return m[1];
}

/** Verifica la firma con el certificado público (usado en pruebas y en el script de beta). */
export function verificarFirma(xmlFirmado: string, certBase64: string): boolean {
  const m = /<ds:Signature[\s\S]*?<\/ds:Signature>/.exec(xmlFirmado);
  if (!m) return false;
  const pem = `-----BEGIN CERTIFICATE-----\n${certBase64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
  const v = new SignedXml({ publicCert: pem, signatureAlgorithm: RSA_SHA256, canonicalizationAlgorithm: C14N });
  v.loadSignature(m[0]);
  return v.checkSignature(xmlFirmado);
}
