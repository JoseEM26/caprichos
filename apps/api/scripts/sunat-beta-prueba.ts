/**
 * Prueba MANUAL contra el servicio BETA de SUNAT (no corre en CI). Necesita red.
 *
 *   SUNAT_PRUEBA_DIR=/ruta/temporal npx ts-node scripts/sunat-beta-prueba.ts
 *
 * - Genera un certificado autofirmado de PRUEBA con openssl en SUNAT_PRUEBA_DIR (nunca el real).
 * - Firma una factura F002 y una boleta B002 con el RUC de pruebas 20000000001 y las envía a beta.
 * - La boleta va en un resumen diario (RC) y se consulta su ticket.
 * Credenciales de prueba públicas de SUNAT: usuario 20000000001MODDATOS, clave moddatos.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SunatEmisor } from '../src/modulos/comprobantes/sunat/sunat.emisor';
import { armarResumenDiarioXml } from '../src/modulos/comprobantes/sunat/sunat.xml';
import { datosDePrueba } from '../src/modulos/comprobantes/sunat/sunat.pruebas';
import { fechaIsoLima, yyyymmddLima } from '../src/modulos/comprobantes/sunat/sunat.util';
import { leerCertificadoP12, verificarFirma } from '../src/modulos/comprobantes/sunat/sunat.firma';

const dir = process.env.SUNAT_PRUEBA_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'sunat-beta-'));
const clave = 'prueba-beta-clave';
fs.mkdirSync(dir, { recursive: true });

// 1. Certificado de PRUEBA (autofirmado) con openssl, solo en el directorio temporal
const key = path.join(dir, 'prueba-key.pem');
const crt = path.join(dir, 'prueba-cert.pem');
const p12 = path.join(dir, 'prueba.p12');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '30', '-subj', '/CN=CAPRICHOS PRUEBA/O=PRUEBA/C=PE'], { stdio: 'ignore' });
execFileSync('openssl', ['pkcs12', '-export', '-inkey', key, '-in', crt, '-out', p12, '-passout', `pass:${clave}`], { stdio: 'ignore' });
const p12B64 = fs.readFileSync(p12).toString('base64');

const env = {
  SUNAT_AMBIENTE: 'beta',
  SUNAT_SOL_USUARIO: '20000000001MODDATOS',
  SUNAT_SOL_CLAVE: 'moddatos',
  SUNAT_CERT_P12_B64: p12B64,
  SUNAT_CERT_CLAVE: clave,
} as NodeJS.ProcessEnv;

const numero = Number(process.env.SUNAT_PRUEBA_NUMERO ?? Math.floor(Date.now() / 1000) % 90000 + 1);
const serieFactura = process.env.SUNAT_PRUEBA_SERIE_FACTURA ?? 'F002';
const serieBoleta = process.env.SUNAT_PRUEBA_SERIE_BOLETA ?? 'B002';

// Correlativo de la comunicación de baja: el mismo número de la prueba (cada corrida usa un número nuevo)
let correlativoRa = 1;
const emisor = new SunatEmisor({
  env,
  emisorLocal: async () => ({
    razon_social: 'EMPRESA DE PRUEBA SUNAT',
    nombre: 'CAPRICHOS PRUEBA',
    direccion_fiscal: 'AV. PRUEBA 123 LIMA',
    ubigeo: '150101',
    ruc: '20611290064', // en beta se reemplaza por 20000000001
  }),
  correlativo: async () => correlativoRa,
});

async function main() {
  const informe: string[] = [];
  const decir = (linea: string) => {
    informe.push(linea);
    console.log(linea);
  };
  decir(`Directorio de prueba: ${dir}`);
  decir(`Ambiente: beta · endpoint: ${emisor.config().urlFactura}`);

  // 2. Factura
  const fecha = new Date();
  correlativoRa = numero;
  const datosFactura = datosDePrueba({ tipo: 'FACTURA', serie: serieFactura, numero, fecha, documento: '20100066603', razon: 'CLIENTE PRUEBA SAC' });
  const factura = await emisor.generar({ id: 1n, tipo: 'FACTURA', serie: serieFactura, numero, intentos: 0, datos: datosFactura });
  decir(`FACTURA ${serieFactura}-${numero}: estado=${factura.estado} · respuesta=${factura.respuesta}`);
  const xmlFactura = factura.archivos?.find((a) => a.tipo === 'XML');
  if (xmlFactura) {
    fs.writeFileSync(path.join(dir, xmlFactura.nombre), xmlFactura.contenido);
    const cert = leerCertificadoP12(p12B64, clave);
    decir(`Firma verificable con el certificado de prueba: ${verificarFirma(xmlFactura.contenido.toString('utf8'), cert.certBase64)}`);
  }

  // 2b. Comunicación de baja (RA) de la factura aceptada
  if (factura.estado === 'EMITIDO_SUNAT') {
    const baja = await emisor.anular({ id: 1n, tipo: 'FACTURA', serie: serieFactura, numero, intentos: 0, datos: datosFactura }, 'Prueba de comunicación de baja');
    if (baja.resumen) {
      fs.writeFileSync(path.join(dir, `${baja.resumen.nombre}.xml`), baja.resumen.xml);
      const enviadaBaja = await emisor.enviarResumen(baja.resumen.nombre, baja.resumen.zip);
      if ('rechazo' in enviadaBaja) {
        decir(`BAJA ${baja.resumen.nombre}: rechazada al enviar: ${enviadaBaja.rechazo}`);
      } else {
        decir(`BAJA ${baja.resumen.nombre}: ticket ${enviadaBaja.ticket}`);
        for (let intento = 1; intento <= 6; intento++) {
          await new Promise((r) => setTimeout(r, 10000));
          const estado = await emisor.consultarTicket(enviadaBaja.ticket);
          decir(`  getStatus baja intento ${intento}: ${estado.estado} · ${estado.respuesta}`);
          if (estado.estado !== 'EN_PROCESO') break;
        }
      }
    }
  }

  // 3. Boleta en resumen diario
  const boleta = await emisor.generar({
    id: 2n,
    tipo: 'BOLETA',
    serie: serieBoleta,
    numero,
    intentos: 0,
    datos: datosDePrueba({ tipo: 'BOLETA', serie: serieBoleta, numero, fecha, documento: null, razon: null, direccion: null }),
  });
  decir(`BOLETA ${serieBoleta}-${numero}: estado=${boleta.estado} (se reporta en el resumen)`);
  const ruc = (await emisor.emisorXml()).ruc;
  const nombre = `${ruc}-RC-${yyyymmddLima(fecha)}-${numero}`;
  const xmlRc = armarResumenDiarioXml({
    idDoc: `RC-${yyyymmddLima(fecha)}-${numero}`,
    emisor: await emisor.emisorXml(),
    fechaEmision: fecha,
    fechaRef: fechaIsoLima(fecha),
    igvPct: 10.5,
    lineas: [{ serie: serieBoleta, numero, documento: null, totalCents: boleta.totalCents ?? 0, igvCents: boleta.igvCents ?? 0, estado: 1 }],
  });
  const firmado = emisor.firmarDocumento(xmlRc, nombre);
  fs.writeFileSync(path.join(dir, `${nombre}.xml`), firmado.xml);
  const enviado = await emisor.enviarResumen(nombre, firmado.zip);
  if ('rechazo' in enviado) {
    decir(`RESUMEN ${nombre}: rechazado al enviar: ${enviado.rechazo}`);
  } else {
    decir(`RESUMEN ${nombre}: ticket ${enviado.ticket}`);
    for (let intento = 1; intento <= 6; intento++) {
      await new Promise((r) => setTimeout(r, 10000));
      const estado = await emisor.consultarTicket(enviado.ticket);
      decir(`  getStatus intento ${intento}: ${estado.estado} · ${estado.respuesta}`);
      if (estado.estado !== 'EN_PROCESO') break;
    }
  }

  fs.writeFileSync(path.join(dir, 'informe.txt'), informe.join('\n') + '\n');
  decir(`Informe guardado en ${path.join(dir, 'informe.txt')}`);
}

main().catch((e) => {
  console.error(`Error en la prueba: ${e?.message ?? e}`);
  process.exitCode = 1;
});
