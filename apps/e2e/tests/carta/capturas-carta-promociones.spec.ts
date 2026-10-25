import { test, expect } from '@playwright/test';

test.describe('Capturas de pantalla - Carta Virtual Avisos de Promociones', () => {
  test('Generar capturas en PC y Móvil de las 4 ideas', async ({ page }) => {
    // -------------------------------------------------------------------------
    // IDEA 1: Franja de aviso superior (PC y Móvil)
    // -------------------------------------------------------------------------
    for (const esMovil of [false, true]) {
      const sufijo = esMovil ? 'movil' : 'pc';
      await page.setViewportSize(esMovil ? { width: 390, height: 844 } : { width: 1280, height: 800 });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.sessionStorage.clear();
        window.localStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });
      const franja = page.locator('[data-testid="franja-aviso-carta"]');
      await expect(franja).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(600);

      await page.screenshot({ path: `/tmp/f1shots/franja-aviso-${sufijo}.png` });
      console.log(`Generado: /tmp/f1shots/franja-aviso-${sufijo}.png`);
    }

    // -------------------------------------------------------------------------
    // IDEA 2: Insignia en la tarjeta de producto (PC y Móvil)
    // -------------------------------------------------------------------------
    for (const esMovil of [false, true]) {
      const sufijo = esMovil ? 'movil' : 'pc';
      await page.setViewportSize(esMovil ? { width: 390, height: 844 } : { width: 1280, height: 800 });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.sessionStorage.clear();
        window.localStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });
      const tarjetaCafe = page.locator('article, div').filter({ hasText: 'Café Americano' }).first();
      await expect(tarjetaCafe).toBeVisible({ timeout: 10000 });
      await tarjetaCafe.scrollIntoViewIfNeeded();

      const insignia = page.locator('[data-testid^="insignia-beneficio-"]').first();
      await expect(insignia).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(600);

      await page.screenshot({ path: `/tmp/f1shots/insignia-producto-${sufijo}.png` });
      console.log(`Generado: /tmp/f1shots/insignia-producto-${sufijo}.png`);
    }

    // -------------------------------------------------------------------------
    // IDEA 3: Aviso "Te falta poco" en el carrito (PC y Móvil)
    // -------------------------------------------------------------------------
    for (const esMovil of [false, true]) {
      const sufijo = esMovil ? 'movil' : 'pc';
      await page.setViewportSize(esMovil ? { width: 390, height: 844 } : { width: 1280, height: 800 });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.sessionStorage.clear();
        window.localStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

      // Abrir modal de Café Americano y agregar 1 unidad
      const btnPedirCafe = page.locator('button[aria-label="Pedir Café Americano"]').first();
      await expect(btnPedirCafe).toBeVisible({ timeout: 10000 });
      await btnPedirCafe.click();

      const btnAgregarModal = page.locator('button:has-text("Agregar al pedido")');
      await expect(btnAgregarModal).toBeVisible({ timeout: 8000 });
      await btnAgregarModal.click();

      // Abrir carrito
      const btnToast = page.locator('button:has-text("Ver pedido")');
      if (await btnToast.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btnToast.click();
      } else {
        const btnCarritoCabecera = page.locator('button[aria-label*="Abrir el carrito"]').first();
        await btnCarritoCabecera.click();
      }

      const avisoFaltaPoco = page.locator('[data-testid="aviso-te-falta-poco"]');
      await expect(avisoFaltaPoco).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(600);

      await page.screenshot({ path: `/tmp/f1shots/carrito-te-falta-poco-${sufijo}.png` });
      console.log(`Generado: /tmp/f1shots/carrito-te-falta-poco-${sufijo}.png`);
    }

    // -------------------------------------------------------------------------
    // IDEA 4: Ventana al entrar (modal) (PC y Móvil)
    // -------------------------------------------------------------------------
    for (const esMovil of [false, true]) {
      const sufijo = esMovil ? 'movil' : 'pc';
      await page.setViewportSize(esMovil ? { width: 390, height: 844 } : { width: 1280, height: 800 });

      // Interceptar /carta/estado para simular carta_aviso_entrada = true
      await page.route('**/carta/estado', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        json.cartaAvisoEntrada = true;
        if (json && json.datos) {
          json.datos.cartaAvisoEntrada = true;
        }
        await route.fulfill({ response, json });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.sessionStorage.clear();
        window.localStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });
      const modal = page.locator('[data-testid="modal-aviso-entrada"]');
      await expect(modal).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(600);

      await page.screenshot({ path: `/tmp/f1shots/modal-aviso-entrada-${sufijo}.png` });
      console.log(`Generado: /tmp/f1shots/modal-aviso-entrada-${sufijo}.png`);

      await page.unroute('**/carta/estado');
    }
  });
});
