import forge from 'node-forge';
import { calcularComprobante } from '../facturacion/facturacion.calculo';
import { DatosComprobante } from '../facturacion/facturacion.datos';
import { EmisorXml } from './sunat.xml';

/**
 * Datos de prueba para las pruebas unitarias y el script de beta. No son reales:
 * el certificado se genera en memoria (autofirmado) y el RUC 20000000001 es el de pruebas de SUNAT.
 */
let cacheP12: { p12B64: string; clave: string } | null = null;

/** Certificado autofirmado de PRUEBA en memoria (PKCS#12 base64). Nunca se guarda en disco. */
export function certificadoDePrueba(): { p12B64: string; clave: string } {
  if (cacheP12) return cacheP12;
  const claves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = claves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);
  const atributos = [{ name: 'commonName', value: 'CAPRICHOS PRUEBA' }];
  cert.setSubject(atributos);
  cert.setIssuer(atributos);
  cert.sign(claves.privateKey, forge.md.sha256.create());
  const clave = 'prueba-clave';
  const p12 = forge.pkcs12.toPkcs12Asn1(claves.privateKey, [cert], clave, { algorithm: '3des' });
  cacheP12 = { p12B64: forge.util.encode64(forge.asn1.toDer(p12).getBytes()), clave };
  return cacheP12;
}

/** Emisor de pruebas (RUC 20000000001 de SUNAT). */
export const EMISOR_PRUEBA: EmisorXml = {
  ruc: '20000000001',
  razon: 'EMPRESA DE PRUEBA SUNAT',
  nombreComercial: 'CAPRICHOS PRUEBA',
  direccion: 'CAL. 11 MZ. D LT. 27 URB. LOS GIRASOLES DE CAMPOY, SAN JUAN DE LURIGANCHO, LIMA',
  ubigeo: '150132',
};

/** Comprobante de prueba: una línea con IGV 10.5 %, delivery opcional y descuento opcional. */
export function datosDePrueba(extra: Partial<DatosComprobante> = {}): DatosComprobante {
  return {
    tipo: 'FACTURA',
    serie: 'F002',
    numero: 1,
    fecha: new Date('2026-11-02T15:00:00.000Z'),
    documento: '20611290064',
    razon: 'CLIENTE DE PRUEBA SAC',
    direccion: 'AV. PRUEBA 123',
    correo: null,
    igvPct: 10.5,
    lineas: [
      { nombre: 'Frappe Oreo', cantidad: 2, subtotalCents: 2360 },
      { nombre: 'Torta de chocolate', cantidad: 1, subtotalCents: 1000 },
    ],
    envioCents: 0,
    descuentoCents: 0,
    totalCents: 3360,
    ...extra,
  };
}

/** Comprueba que los números cuadran (sirve para armar datos de prueba coherentes). */
export function totalDePrueba(d: DatosComprobante): number {
  return calcularComprobante(d).totalCents;
}
