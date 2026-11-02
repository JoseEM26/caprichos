import { test, expect, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginPorUi, loginPorApi, confirmarSiNo, obtenerPrismaTest, PUERTO_API } from '../../src';

/**
 * Facturación electrónica directa a SUNAT contra el ambiente BETA (pruebas).
 * Requiere, en el proceso de Playwright, SUNAT_AMBIENTE=beta y las credenciales/certificado de prueba
 * (ver el runner de la sesión). Nunca se escriben valores en el repositorio.
 *
 * Escenarios:
 * a. ADMIN cambia el proveedor a SUNAT directo (Sí/No) y la pantalla muestra beta + credenciales configuradas.
 * b. Factura (RUC) emitida y aceptada por beta, con número F002-n, hash, XML y CDR descargables.
 * c. Dos boletas (con DNI y sin documento) quedan PENDIENTE_RESUMEN; se envía el resumen desde la pantalla
 *    y pasan a EMITIDO_SUNAT.
 * d. Anulación de la factura desde la pantalla (motivo + Sí/No) y baja aceptada por SUNAT.
 */

const CAPTURAS = process.env.SUNAT_CAPTURAS_DIR || path.resolve(__dirname, '../../test-results/facturacion-sunat');
const API = `http://127.0.0.1:${PUERTO_API}`;
/** RUC y DNI de prueba (mismos datos que el script de prueba beta del repositorio). */
const RUC_CLIENTE = '20100066603';
const RAZON_CLIENTE = 'CLIENTE PRUEBA SAC';
const DNI_CLIENTE = '45678912';
// Tickets: la tarea de la API consulta cada 10 minutos; se espera hasta 11 min y un margen.
const ESPERA_TICKETS_MS = 11 * 60 * 1000;

function captura(page: Page, nombre: string) {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  return page.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/** Fila (li) de un comprobante electrónico por su número, p. ej. F002-1. */
function filaDe(page: Page, numeroTexto: string): Locator {
  return page.locator('li[data-testid^="electronico-"]').filter({ hasText: numeroTexto });
}

test.describe('Facturación electrónica SUNAT (beta)', () => {
  // El flujo crea pedidos y cambia la configuración: no es repetible sin reiniciar la base (sin reintentos).
  test.describe.configure({ retries: 0 });

  test('factura y boletas aceptadas por SUNAT beta, descarga de XML/CDR y baja', async ({ page }) => {
    test.setTimeout(20 * 60 * 1000);
    const prisma = obtenerPrismaTest();

    // Ambiente de la prueba: el runner pone SUNAT_AMBIENTE=beta; aquí solo se verifica.
    expect(process.env.SUNAT_AMBIENTE ?? 'beta').toBe('beta');

    // ---------- a. Configuración desde la pantalla ----------
    await loginPorUi(page, 'ADMIN');
    await page.goto('/admin/comprobantes?tab=electronicos', { waitUntil: 'domcontentloaded' });
    const seccion = page.locator('section[aria-label="Facturación electrónica"]');
    await expect(seccion).toBeVisible({ timeout: 15000 });
    await expect(seccion).toContainText('Modo simulado (sin SUNAT)');

    await seccion.locator('select').first().selectOption('SUNAT');
    await seccion.getByRole('button', { name: 'Guardar configuración' }).click();
    await confirmarSiNo(page, 'si');
    await expect(page.locator('[role="status"]:not([aria-label])')).toContainText('Configuración de facturación guardada');

    await expect(seccion).toContainText('SUNAT directo · beta (pruebas)');
    await expect(seccion).toContainText('Ambiente: beta (pruebas)');
    await expect(seccion).toContainText('Credenciales SUNAT: configuradas');
    await captura(page, '01-configuracion-sunat-beta');

    // ---------- Pedidos por API autenticada (caja abierta, cobro con caja) ----------
    const cajero = await loginPorApi('CAJERO');
    const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${cajero.accessToken}` };
    const abrir = await fetch(`${API}/admin/caja/abrir`, { method: 'POST', headers: cabeceras, body: JSON.stringify({ apertura: 100 }) });
    expect(abrir.ok, `abrir caja: ${await abrir.clone().text()}`).toBeTruthy();

    const producto = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Café Americano' } });

    async function crearYCobrar(comprobante: Record<string, unknown>, etiqueta: string) {
      const r = await fetch(`${API}/admin/pedidos`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({
          cliente: { nombre: etiqueta },
          modalidad: 'RECOGER',
          lineas: [{ productoId: Number(producto.id), cantidad: 1 }],
          pago: { metodo: 'EFECTIVO', pagaCon: 10 },
          comprobante,
        }),
      });
      expect(r.ok, `crear pedido ${etiqueta}: ${await r.clone().text()}`).toBeTruthy();
      const pedido = await r.json();
      const pedidoId = String(pedido.id ?? pedido.pedidoId);
      const cobro = await fetch(`${API}/admin/caja/cobrar`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ pedidoId, pagos: [{ medio: 'EFECTIVO', monto: 10 }] }),
      });
      expect(cobro.ok, `cobrar ${etiqueta}: ${await cobro.clone().text()}`).toBeTruthy();
      return pedidoId;
    }

    const pedidoFactura = await crearYCobrar({ tipo: 'FACTURA', ruc: RUC_CLIENTE, razonSocial: RAZON_CLIENTE, direccion: 'AV. PRUEBA 456' }, 'Cliente Factura');
    const pedidoBoletaDni = await crearYCobrar({ tipo: 'BOLETA', dni: DNI_CLIENTE }, 'Cliente Boleta DNI');
    const pedidoBoletaSinDoc = await crearYCobrar({ tipo: 'BOLETA' }, 'Cliente Boleta Anonima');

    const comprobanteFactura = await prisma.comprobante.findFirstOrThrow({ where: { pedido_id: BigInt(pedidoFactura), tipo: 'FACTURA' } });
    const comprobanteBoletaDni = await prisma.comprobante.findFirstOrThrow({ where: { pedido_id: BigInt(pedidoBoletaDni), tipo: 'BOLETA' } });
    const comprobanteBoletaSinDoc = await prisma.comprobante.findFirstOrThrow({ where: { pedido_id: BigInt(pedidoBoletaSinDoc), tipo: 'BOLETA' } });
    const numeroFactura = comprobanteFactura.numero_texto;
    const numeroBoletaDni = comprobanteBoletaDni.numero_texto;
    const numeroBoletaSinDoc = comprobanteBoletaSinDoc.numero_texto;
    console.log(`[SUNAT e2e] comprobantes: ${numeroFactura}, ${numeroBoletaDni}, ${numeroBoletaSinDoc}`);

    // ---------- b. Factura aceptada por beta ----------
    await page.goto('/admin/comprobantes?tab=electronicos', { waitUntil: 'domcontentloaded' });
    await expect(filaDe(page, numeroFactura)).toBeVisible({ timeout: 15000 });
    await expect(filaDe(page, numeroFactura)).toContainText('Emitido SUNAT', { timeout: 60000 });
    await expect(filaDe(page, numeroFactura)).toContainText(`Documento ${RUC_CLIENTE}`);
    await captura(page, '02-factura-emitida-sunat');

    const facturaDb = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobanteFactura.id } });
    console.log(`[SUNAT e2e] factura ${numeroFactura}: estado=${facturaDb.facturacion_estado} respuesta=${facturaDb.facturacion_respuesta}`);
    expect(facturaDb.facturacion_estado).toBe('EMITIDO_SUNAT');
    expect(numeroFactura).toMatch(/^F002-\d+$/);
    expect(facturaDb.facturacion_hash, 'hash de la factura').toBeTruthy();

    const filaFactura = filaDe(page, numeroFactura);
    const [descargaXml] = await Promise.all([
      page.waitForEvent('download'),
      filaFactura.getByRole('button', { name: 'XML firmado' }).click(),
    ]);
    const rutaXml = path.join(CAPTURAS, descargaXml.suggestedFilename());
    await descargaXml.saveAs(rutaXml);
    expect(fs.statSync(rutaXml).size).toBeGreaterThan(0);

    const [descargaCdr] = await Promise.all([
      page.waitForEvent('download'),
      filaFactura.getByRole('button', { name: 'CDR SUNAT' }).click(),
    ]);
    const rutaCdr = path.join(CAPTURAS, descargaCdr.suggestedFilename());
    await descargaCdr.saveAs(rutaCdr);
    expect(fs.statSync(rutaCdr).size).toBeGreaterThan(0);
    console.log(`[SUNAT e2e] XML: ${rutaXml} · CDR: ${rutaCdr}`);

    // ---------- c. Boletas: pendientes de resumen, luego resumen y aceptación ----------
    await expect(filaDe(page, numeroBoletaDni)).toContainText('Pendiente de resumen diario');
    await expect(filaDe(page, numeroBoletaSinDoc)).toContainText('Pendiente de resumen diario');
    await captura(page, '03-boletas-pendientes-resumen');

    await seccion.getByRole('button', { name: 'Enviar resumen de boletas' }).click();
    await expect(page.locator('[role="status"]:not([aria-label])')).toContainText('Resumen diario enviado', { timeout: 30000 });
    await captura(page, '04-resumen-enviado');

    // ---------- d. Anulación de la factura (baja por RA, enviada junto al resumen) ----------
    await page.reload({ waitUntil: 'domcontentloaded' });
    await filaDe(page, numeroFactura).getByRole('button', { name: 'Anular' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.locator('textarea').fill('Prueba e2e de baja de factura en beta');
    await confirmarSiNo(page, 'si');
    await expect(page.locator('[role="status"]:not([aria-label])')).toContainText('Se envió la baja', { timeout: 30000 });
    await captura(page, '05-baja-enviada');

    // ---------- Espera: SUNAT responde por ticket; la API consulta los tickets en su tarea de 10 minutos ----------
    const inicio = Date.now();
    let boletasAceptadas = false;
    let bajaAceptada = false;
    while (Date.now() - inicio < ESPERA_TICKETS_MS) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(filaDe(page, numeroBoletaDni)).toBeVisible({ timeout: 15000 });
      const dni = (await filaDe(page, numeroBoletaDni).textContent()) ?? '';
      const sinDoc = (await filaDe(page, numeroBoletaSinDoc).textContent()) ?? '';
      const factura = (await filaDe(page, numeroFactura).textContent()) ?? '';
      boletasAceptadas = dni.includes('Emitido SUNAT') && sinDoc.includes('Emitido SUNAT');
      bajaAceptada = factura.includes('Anulado (baja aceptada)');
      if (boletasAceptadas && bajaAceptada) break;
      await page.waitForTimeout(10000);
    }
    console.log(`[SUNAT e2e] esperó ${Math.round((Date.now() - inicio) / 1000)} s a los tickets`);
    await captura(page, '06-resultado-tickets');

    const boletasDb = await prisma.comprobante.findMany({
      where: { id: { in: [comprobanteBoletaDni.id, comprobanteBoletaSinDoc.id] } },
      select: { numero_texto: true, facturacion_estado: true, facturacion_respuesta: true },
    });
    console.log(`[SUNAT e2e] boletas: ${JSON.stringify(boletasDb)}`);
    expect(boletasAceptadas, 'boletas EMITIDO_SUNAT tras el resumen diario (ticket consultado)').toBeTruthy();

    const bajaDb = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobanteFactura.id } });
    console.log(`[SUNAT e2e] baja factura: ${bajaDb.baja_estado} · ${bajaDb.baja_respuesta}`);
    expect(bajaAceptada, 'baja de la factura aceptada por SUNAT').toBeTruthy();
  });
});
