import { test, expect } from '@playwright/test';

test.describe('Carta Virtual - Avisos de Promociones y Beneficios', () => {
  test('1. Franja de aviso superior muestra la promoción vigente de hoy y permite cerrarla con persistencia', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Esperar a que la carta cargue
    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    // 1. La franja de aviso debe estar presente y visible con atributos de accesibilidad
    const franja = page.locator('[data-testid="franja-aviso-carta"]');
    await expect(franja).toBeVisible({ timeout: 10000 });
    await expect(franja).toHaveAttribute('role', 'status');
    await expect(franja).toHaveAttribute('aria-live', 'polite');

    // Debe contener el texto de la promoción (2x1 Café Americano)
    await expect(franja).toContainText(/Hoy/i);
    await expect(franja).toContainText(/2x1/i);

    // Debe contener el botón 'Ver promociones'
    const btnVerPromo = page.locator('[data-testid="btn-ver-promociones-franja"]');
    await expect(btnVerPromo).toBeVisible();

    // 2. Cerrar la franja con el botón X
    const btnCerrar = page.locator('[data-testid="btn-cerrar-franja"]');
    await expect(btnCerrar).toBeVisible();
    await btnCerrar.click();

    // La franja debe desaparecer inmediatamente
    await expect(franja).not.toBeVisible();

    // 3. Recargar la página: debe persistir oculta durante la misma sesión (sessionStorage)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });
    await expect(franja).not.toBeVisible();
  });

  test('2. Insignia en la tarjeta del producto de la oferta vigente', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    // Localizar la tarjeta de Café Americano
    const tarjetaCafe = page.locator('article, div').filter({ hasText: 'Café Americano' }).first();
    await expect(tarjetaCafe).toBeVisible({ timeout: 10000 });

    // Debe mostrar la insignia "2x1 hoy"
    const insigniaCafe = page.locator('[data-testid^="insignia-beneficio-"]').first();
    await expect(insigniaCafe).toBeVisible({ timeout: 10000 });
    await expect(insigniaCafe).toHaveText('2x1 hoy');
  });

  test('3. Aviso "Te falta poco" en el carrito al agregar 1 unidad y desaparece al agregar la segunda', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    // 1. Abrir modal del producto Café Americano haciendo clic en su botón "Agregar"
    const btnPedirCafe = page.locator('button[aria-label="Pedir Café Americano"]').first();
    await expect(btnPedirCafe).toBeVisible({ timeout: 10000 });
    await btnPedirCafe.click();

    // 2. En el modal del producto, pulsar "Agregar al pedido"
    const btnAgregarModal = page.locator('button:has-text("Agregar al pedido")');
    await expect(btnAgregarModal).toBeVisible({ timeout: 8000 });
    await btnAgregarModal.click();

    // 3. Abrir el cajón del carrito (mediante el botón del toast "Ver pedido" o el icono del carrito en cabecera)
    const btnToast = page.locator('button:has-text("Ver pedido")');
    if (await btnToast.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btnToast.click();
    } else {
      const btnCarritoCabecera = page.locator('button[aria-label*="Abrir el carrito"]').first();
      await btnCarritoCabecera.click();
    }

    // 4. El aviso "Te falta poco" debe estar presente con el texto exacto
    const avisoFaltaPoco = page.locator('[data-testid="aviso-te-falta-poco"]');
    await expect(avisoFaltaPoco).toBeVisible({ timeout: 8000 });
    await expect(avisoFaltaPoco).toContainText('Agrega 1 Café Americano y llevas el 2x1');

    // 5. El aviso debe tener el botón "Agregar" directo
    const btnAgregarFaltaPoco = page.locator('[data-testid="btn-agregar-falta-poco"]');
    await expect(btnAgregarFaltaPoco).toBeVisible();

    // 6. Hacer clic en "Agregar" desde el aviso (o aumentar la cantidad a 2)
    await btnAgregarFaltaPoco.click();

    // 7. Al tener 2 unidades de Café Americano, el beneficio 2x1 ya aplica y el aviso desaparece
    await expect(avisoFaltaPoco).not.toBeVisible({ timeout: 8000 });
  });

  test('4. Ventana modal al entrar está apagada por defecto según el parámetro carta_aviso_entrada', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    // Con la semilla carta_aviso_entrada = 'no', el modal NO debe aparecer
    const modalEntrada = page.locator('[data-testid="modal-aviso-entrada"]');
    await expect(modalEntrada).not.toBeVisible();
  });
});
