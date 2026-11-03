/**
 * Prueba MANUAL de códigos de error REALES de SUNAT beta (no corre en CI). Necesita red.
 *
 *   SUNAT_CODIGOS_DIR=/ruta/temporal npx ts-node --transpile-only scripts/sunat-codigos-beta.ts
 *
 * - Certificado autofirmado de PRUEBA con openssl en SUNAT_CODIGOS_DIR (nunca el real).
 * - Credenciales públicas de pruebas de SUNAT: usuario 20000000001MODDATOS, clave moddatos.
 * - Escenarios: (a) clave incorrecta, (b) usuario inexistente, (c) factura reenviada (duplicado),
 *   (d) getStatusCdr de una factura aceptada y de una inexistente, (e) total que no cuadra en el XML.
 * - Escribe informe.json e informe.txt en SUNAT_CODIGOS_DIR. Nada de la clave ni del certificado se imprime.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorRedEmisor } from '../src/modulos/comprobantes/emisor/emisor.tipos';
import { armarFacturaXml } from '../src/modulos/comprobantes/sunat/sunat.xml';
import { EMISOR_PRUEBA, datosDePrueba } from '../src/modulos/comprobantes/sunat/sunat.pruebas';
import { firmarXml, leerCertificadoP12 } from '../src/modulos/comprobantes/sunat/sunat.firma';
import { codigoFault, cuerpoEnvio, enviarSoap, leerCdr, parsearSoap, sobreSoap } from '../src/modulos/comprobantes/sunat/sunat.soap';
import { montoXml, zipUnico } from '../src/modulos/comprobantes/sunat/sunat.util';

const dir = process.env.SUNAT_CODIGOS_DIR;
if (!dir) throw new Error('Define SUNAT_CODIGOS_DIR (directorio temporal para el certificado de prueba y el informe)');
fs.mkdirSync(dir, { recursive: true });

const URL_FACTURA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';
// Beta: la ruta ol-it-wsconscpegem-beta da 404; el servicio de consulta responde en la ruta de facturación
const URL_CONSULTA = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billConsultService';
const USUARIO = '20000000001MODDATOS';
const CLAVE = 'moddatos';
const CLAVE_P12 = 'prueba-codigos';

// 1. Certificado de PRUEBA autofirmado (openssl), solo en el directorio temporal
const key = path.join(dir, 'prueba-key.pem');
const crt = path.join(dir, 'prueba-cert.pem');
const p12 = path.join(dir, 'prueba.p12');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '30', '-subj', '/CN=CAPRICHOS PRUEBA/O=PRUEBA/C=PE'], { stdio: 'ignore' });
execFileSync('openssl', ['pkcs12', '-export', '-inkey', key, '-in', crt, '-out', p12, '-passout', `pass:${CLAVE_P12}`], { stdio: 'ignore' });
const p12B64 = fs.readFileSync(p12).toString('base64');
const cert = leerCertificadoP12(p12B64, CLAVE_P12);

interface Resultado {
  escenario: string;
  servicio: 'billService' | 'billConsultService';
  tipo: 'fault' | 'cdr' | 'status' | 'red' | 'sin_contenido';
  codigo: string;
  texto: string;
  respuestaCruda?: string;
}
const informe: Resultado[] = [];
/** Pausa entre llamadas: SUNAT beta corta las peticiones seguidas (401 de nginx tras varias seguidas). */
const pausa = () => new Promise((r) => setTimeout(r, 6000));
const registrar = (r: Resultado) => {
  informe.push(r);
  console.log(`[${r.escenario}] ${r.servicio} tipo=${r.tipo} codigo=${r.codigo} · ${r.texto}`);
};

/** Numero único por corrida (SUNAT rechaza repetidos entre corridas). */
const base = 1000000 + (Math.floor(Date.now() / 1000) % 800000);

/** Factura de prueba firmada; `alterar` cambia el XML ANTES de firmar (la firma sigue siendo válida). */
function facturaFirmada(numero: number, alterar?: (xml: string) => string) {
  const arm = armarFacturaXml({
    tipo: 'FACTURA',
    serie: 'F002',
    numero,
    fecha: new Date(),
    emisor: EMISOR_PRUEBA,
    datos: datosDePrueba({ tipo: 'FACTURA', serie: 'F002', numero, fecha: new Date(), documento: '20100066603', razon: 'CLIENTE PRUEBA SAC' }),
  });
  const xml = firmarXml(alterar ? alterar(arm.xml) : arm.xml, cert);
  const nombre = `${EMISOR_PRUEBA.ruc}-01-F002-${numero}`;
  return { nombre, xml, zip: zipUnico(`${nombre}.xml`, xml) };
}

/** Envía sendBill con el usuario y clave dados y clasifica la respuesta. */
/** Respuesta que no es SOAP (HTML de nginx, 401, 404): se registra tal cual, sin interpretarla. */
function noSoap(escenario: string, servicio: Resultado['servicio'], xml: string): boolean {
  if (/<(soap-env|env|soap|S):Envelope|<Envelope/i.test(xml)) return false;
  registrar({ escenario, servicio, tipo: 'sin_contenido', codigo: 'no-SOAP', texto: xml.replace(/\s+/g, ' ').slice(0, 160), respuestaCruda: xml.slice(0, 300) });
  return true;
}

async function sendBill(escenario: string, usuario: string, clave: string, nombre: string, zip: Buffer) {
  await pausa();
  try {
    const xml = await enviarSoap(URL_FACTURA, sobreSoap('sendBill', cuerpoEnvio(`${nombre}.zip`, zip), usuario, clave));
    if (noSoap(escenario, 'billService', xml)) return { ok: false as const, cdrCodigo: null };
    const r = parsearSoap(xml);
    if (r.fault) {
      const cod = codigoFault(r.fault);
      registrar({ escenario, servicio: 'billService', tipo: 'fault', codigo: `${r.fault.codigo} (${cod})`, texto: r.fault.mensaje, respuestaCruda: xml.slice(0, 600) });
      return { ok: false as const, cdrCodigo: null as number | null };
    }
    const cdr = leerCdr(r.textos.applicationResponse ?? '');
    registrar({ escenario, servicio: 'billService', tipo: 'cdr', codigo: String(cdr.codigo), texto: `${cdr.descripcion}${cdr.observaciones.length ? ' | ' + cdr.observaciones.join(' | ') : ''}` });
    return { ok: cdr.codigo === 0, cdrCodigo: cdr.codigo };
  } catch (e) {
    if (e instanceof ErrorRedEmisor) registrar({ escenario, servicio: 'billService', tipo: 'red', codigo: '-', texto: e.message });
    else throw e;
    return { ok: false as const, cdrCodigo: null };
  }
}

/** getStatusCdr: el cuerpo lleva RUC, tipo, serie y número del comprobante a consultar. */
async function getStatusCdr(escenario: string, usuario: string, clave: string, serie: string, numero: number) {
  await pausa();
  const cuerpo =
    `<rucComprobante>${EMISOR_PRUEBA.ruc}</rucComprobante><tipoComprobante>01</tipoComprobante>` +
    `<serieComprobante>${serie}</serieComprobante><numeroComprobante>${numero}</numeroComprobante>`;
  try {
    const xml = await enviarSoap(URL_CONSULTA, sobreSoap('getStatusCdr', cuerpo, usuario, clave));
    if (noSoap(escenario, 'billConsultService', xml)) return;
    const r = parsearSoap(xml);
    if (r.fault) {
      registrar({ escenario, servicio: 'billConsultService', tipo: 'fault', codigo: `${r.fault.codigo} (${codigoFault(r.fault)})`, texto: r.fault.mensaje, respuestaCruda: xml.slice(0, 600) });
      return;
    }
    const status = r.textos.statusCode ?? '';
    if (!r.textos.content) {
      registrar({ escenario, servicio: 'billConsultService', tipo: 'sin_contenido', codigo: `statusCode=${status || '-'}`, texto: 'Sin CDR en la respuesta', respuestaCruda: xml.slice(0, 600) });
      return;
    }
    const cdr = leerCdr(r.textos.content);
    registrar({ escenario, servicio: 'billConsultService', tipo: 'status', codigo: `statusCode=${status} cdr=${cdr.codigo}`, texto: cdr.descripcion });
  } catch (e) {
    if (e instanceof ErrorRedEmisor) registrar({ escenario, servicio: 'billConsultService', tipo: 'red', codigo: '-', texto: e.message });
    else throw e;
  }
}

async function main() {
  // (a) clave SOL incorrecta con documento nuevo
  const fa = facturaFirmada(base + 1);
  await sendBill('a_clave_incorrecta', USUARIO, 'clave-incorrecta-prueba', fa.nombre, fa.zip);

  // (b) usuario inexistente: documento NUEVO (no el ZIP ya aceptado en (a), que SUNAT devuelve tal cual)
  const fb = facturaFirmada(base + 4);
  await sendBill('b_usuario_inexistente', '20000000001NOEXISTE', CLAVE, fb.nombre, fb.zip);

  // (c) duplicado: la misma factura (mismo ZIP) con credenciales correctas, y luego OTRO contenido con el mismo número
  const fc = facturaFirmada(base + 2);
  const primera = await sendBill('c1_primer_envio', USUARIO, CLAVE, fc.nombre, fc.zip);
  await sendBill('c2_reenvio_mismo_zip', USUARIO, CLAVE, fc.nombre, fc.zip);
  const fc2 = facturaFirmada(base + 2, (xml) => xml.replace('CLIENTE PRUEBA SAC', 'OTRO CLIENTE SAC'));
  await sendBill('c3_mismo_numero_otro_contenido', USUARIO, CLAVE, fc2.nombre, fc2.zip);

  // (d) getStatusCdr: factura aceptada (si la primera fue aceptada), inexistente y con clave incorrecta
  if (primera.cdrCodigo !== null) await getStatusCdr('d1_factura_aceptada', USUARIO, CLAVE, 'F002', base + 2);
  await getStatusCdr('d2_factura_inexistente', USUARIO, CLAVE, 'F002', 99999999);
  await getStatusCdr('d3_clave_incorrecta_consulta', USUARIO, 'clave-incorrecta-prueba', 'F002', base + 2);

  // (e) XML con total que no cuadra: TaxInclusiveAmount y PayableAmount suben 100 soles, lo demás queda igual
  const fe = facturaFirmada(base + 3, (xml) =>
    xml.replace(/(<cbc:(?:TaxInclusiveAmount|PayableAmount) currencyID="PEN">)([\d.]+)(<\/cbc:)/g, (_m, a, v, c) => `${a}${montoXml(Math.round(Number(v) * 100) + 10000)}${c}`),
  );
  await sendBill('e_total_no_cuadra', USUARIO, CLAVE, fe.nombre, fe.zip);

  fs.writeFileSync(path.join(dir, 'informe.json'), JSON.stringify(informe, null, 2) + '\n');
  const lineas = informe.map((r) => `[${r.escenario}] ${r.servicio} ${r.tipo} ${r.codigo} · ${r.texto}`);
  fs.writeFileSync(path.join(dir, 'informe.txt'), lineas.join('\n') + '\n');
  console.log(`Informe: ${path.join(dir, 'informe.txt')}`);
}

main().catch((e) => {
  console.error(`Error en la prueba: ${e?.message ?? e}`);
  process.exitCode = 1;
});
