/**
 * Prueba MANUAL beta (necesita red): factura con envío y descuento global (error 3300).
 *   SUNAT_PRUEBA_NUMERO=900123 npx ts-node scripts/sunat-beta-descuento.ts
 * Certificado autofirmado de PRUEBA, RUC 20000000001, credenciales públicas MODDATOS.
 */
import { SunatEmisor } from '../src/modulos/comprobantes/sunat/sunat.emisor';
import { certificadoDePrueba, datosDePrueba } from '../src/modulos/comprobantes/sunat/sunat.pruebas';

const cert = certificadoDePrueba();
const env = {
  SUNAT_AMBIENTE: 'beta',
  SUNAT_SOL_USUARIO: '20000000001MODDATOS',
  SUNAT_SOL_CLAVE: 'moddatos',
  SUNAT_CERT_P12_B64: cert.p12B64,
  SUNAT_CERT_CLAVE: cert.clave,
} as NodeJS.ProcessEnv;
const emisor = new SunatEmisor({
  env,
  emisorLocal: async () => ({ razon_social: 'EMPRESA DE PRUEBA SUNAT', nombre: 'CAPRICHOS PRUEBA', direccion_fiscal: 'AV. PRUEBA 123 LIMA', ubigeo: '150101', ruc: '20000000001' }),
  correlativo: async () => 1,
});
const numero = Number(process.env.SUNAT_PRUEBA_NUMERO ?? 900000 + (Math.floor(Date.now() / 1000) % 90000));
const escenarios: Array<[string, any]> = [
  ['desc+envio 41.49/9.62', { lineas: [{ nombre: 'Frappe Oreo', cantidad: 2, subtotalCents: 2360 }, { nombre: 'Torta', cantidad: 1, subtotalCents: 1189 }], envioCents: 600, descuentoCents: 962, totalCents: 3187 }],
  ['sin descuento', {}],
  ['grande 57.00 de 57.00+envio', { lineas: [{ nombre: 'Torta', cantidad: 1, subtotalCents: 5000 }], envioCents: 700, descuentoCents: 5700, totalCents: 0 }],
  ['exacto 22.10-11.05', { lineas: [{ nombre: 'Frappe', cantidad: 1, subtotalCents: 2210 }], envioCents: 0, descuentoCents: 1105, totalCents: 1105 }],



];
(async () => {
  let n = numero;
  for (const [nombre, extra] of escenarios.filter((_, i) => process.env.SOLO === undefined || process.env.SOLO.split(',').includes(String(i)))) {
    const datos = datosDePrueba({ tipo: 'FACTURA', serie: 'F002', numero: n, fecha: new Date(), documento: '20100066603', razon: 'CLIENTE PRUEBA SAC', ...extra });
    const r = await emisor.generar({ id: 1n, tipo: 'FACTURA', serie: 'F002', numero: n, intentos: 0, datos });
    console.log(`${nombre} F002-${n}: estado=${r.estado} · ${r.respuesta}`);
    n++;
  }
})();
