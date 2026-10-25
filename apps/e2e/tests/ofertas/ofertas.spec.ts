import { test, expect } from '@playwright/test';
import { loginPorUi, confirmarSiNo, obtenerPrismaTest } from '../../src';
import * as fs from 'fs';

test.describe('Asistente de Ofertas y Constructor de Combos por Pasos (E2E)', () => {
  test.beforeAll(() => {
    fs.mkdirSync('/tmp/f1shots', { recursive: true });
  });

  test('1. Flujo completo en PC: crear combo por los 4 pasos, ver previsualización, guardar, verificar BD y carta', async ({
    page,
  }) => {
    // 1. Configurar viewport PC
    await page.setViewportSize({ width: 1280, height: 850 });

    // 2. Iniciar sesión como ADMIN
    await loginPorUi(page, 'ADMIN');
    await expect(page).toHaveURL(/\/admin(\/.*)?$/);

    // 3. Navegar a /admin/ofertas
    await page.goto('/admin/ofertas', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/Ofertas/i, { timeout: 10000 });

    // 4. Abrir selector de nueva oferta
    const btnNuevaPromo = page.locator('button', { hasText: '+ Armar oferta' });
    await expect(btnNuevaPromo).toBeVisible({ timeout: 8000 });
    await btnNuevaPromo.click();

    // 5. Clic en "Combo" dentro de ModalArmarOferta
    const modalArmar = page.locator('[role="dialog"][aria-label="Armar oferta"]');
    await expect(modalArmar).toBeVisible({ timeout: 8000 });
    const btnCombo = modalArmar.locator('button', { hasText: 'Combo' }).first();
    await btnCombo.click();

    // 6. Modal de Constructor de Combos abierto en Paso 1
    const modalCombo = page.locator('[role="dialog"][aria-label="Constructor de combos"]');
    await expect(modalCombo).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="paso-1-combo"]')).toBeVisible({ timeout: 8000 });

    // Completar datos del Paso 1: Nombre, Categoría y Descripción
    const inputNombre = page.locator('#combo-nombre');
    await inputNombre.fill('Combo Dúo Especial E2E');
    const inputDesc = page.locator('#combo-descripcion');
    await inputDesc.fill('2 bebidas artesanales para compartir y disfrutar');

    // Captura Paso 1 PC
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso1-pc.png' });

    // Avanzar a Paso 2
    const btnSiguiente = page.locator('[data-testid="btn-siguiente-paso"]');
    await btnSiguiente.click();

    // 7. Paso 2: ¿Qué lleva el combo?
    await expect(page.locator('[data-testid="paso-2-combo"]')).toBeVisible({ timeout: 8000 });

    // Probar preset "+ 2 bebidas a elección"
    const btnPreset = page.locator('button', { hasText: '+ 2 bebidas a elección' });
    await expect(btnPreset).toBeVisible({ timeout: 5000 });
    await btnPreset.click();

    // Verificar que se agregó la parte con su guía
    await expect(modalCombo.locator('text=Bebidas a elección').first()).toBeVisible({ timeout: 5000 });

    // Probar navegación atrás y adelante sin perder datos
    const btnAtras = page.locator('button', { hasText: '← Atrás' });
    await btnAtras.click();
    await expect(page.locator('[data-testid="paso-1-combo"]')).toBeVisible({ timeout: 5000 });
    await expect(inputNombre).toHaveValue('Combo Dúo Especial E2E');
    await btnSiguiente.click();
    await expect(page.locator('[data-testid="paso-2-combo"]')).toBeVisible({ timeout: 5000 });

    // Captura Paso 2 PC
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso2-pc.png' });

    // Avanzar a Paso 3
    await btnSiguiente.click();

    // 8. Paso 3: ¿Cuánto vale?
    await expect(page.locator('[data-testid="paso-3-combo"]')).toBeVisible({ timeout: 8000 });

    // Configurar precio
    const inputPrecio = page.locator('input[aria-label="Precio del tamaño"]');
    await expect(inputPrecio).toBeVisible({ timeout: 5000 });
    await inputPrecio.fill('24.00');

    // Verificar caja de ahorro / comparación
    const cajaAhorro = page.locator('[data-testid="caja-ahorro-combo"]');
    await expect(cajaAhorro).toBeVisible({ timeout: 5000 });

    // Captura Paso 3 PC
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso3-pc.png' });

    // Avanzar a Paso 4
    await btnSiguiente.click();

    // 9. Paso 4: Visualización y Previsualización
    await expect(page.locator('[data-testid="paso-4-combo"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="paso-4-combo"]')).toContainText('Combo Dúo Especial E2E');

    // Componente de previsualización interactiva
    const preview = page.locator('[data-testid="previsualizacion-carta"]');
    await expect(preview).toBeVisible({ timeout: 5000 });

    // Cambiar a vista "Al abrirla"
    const btnAlAbrirla = preview.locator('button', { hasText: 'Al abrirla' });
    await btnAlAbrirla.click();

    // En "Al abrirla", el botón de acción debe tener texto "Vista previa" y estar deshabilitado
    const btnVistaPrevia = preview.locator('button', { hasText: 'Vista previa' });
    await expect(btnVistaPrevia).toBeVisible({ timeout: 5000 });
    await expect(btnVistaPrevia).toBeDisabled();

    // Captura Paso 4 con vista "Al abrirla" PC
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso4-abrir-pc.png' });

    // Volver a vista "Tarjeta en la lista"
    const btnTarjetaLista = preview.locator('button', { hasText: 'Tarjeta en la lista' });
    await btnTarjetaLista.click();

    // Captura Paso 4 PC
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso4-pc.png' });

    // 10. Guardar combo y confirmar con el diálogo modal Sí/No
    const btnGuardar = page.locator('[data-testid="btn-guardar-combo"]');
    await btnGuardar.click();

    // Confirmar en ModalConfirmacion usando el helper oficial
    await confirmarSiNo(page, 'si');

    // Esperar a que el modal del constructor cierre
    await expect(modalCombo).not.toBeVisible({ timeout: 10000 });

    // 11. Verificar que aparece en la lista de promociones del admin
    await expect(page.locator('text=Combo Dúo Especial E2E').first()).toBeVisible({ timeout: 10000 });

    // Probar botón "Ver como se ve en la carta"
    const btnVerEnCarta = page.getByRole('button', { name: /Ver cómo se ve Combo Dúo Especial E2E/i });
    await expect(btnVerEnCarta).toBeVisible({ timeout: 5000 });
    await btnVerEnCarta.click();

    // Modal de previsualización de lectura
    const modalVerCarta = page.locator('[role="dialog"][aria-label^="Vista previa en la carta"]');
    await expect(modalVerCarta).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: '/tmp/f1shots/ofe-modal-preview-pc.png' });

    // Cerrar modal de lectura con Escape (accesibilidad)
    await page.keyboard.press('Escape');
    await expect(modalVerCarta).not.toBeVisible({ timeout: 5000 });

    // 12. Verificar en la base de datos caprichos_test_6
    const prisma = obtenerPrismaTest();
    const ofertaDb = await prisma.oferta.findFirst({
      where: { nombre: 'Combo Dúo Especial E2E' },
      include: { combosPrecio: true, combosParte: true },
    });
    expect(ofertaDb).not.toBeNull();
    expect(ofertaDb?.tipo).toBe('COMBO');
    expect(ofertaDb?.combosPrecio.length).toBeGreaterThan(0);
    expect(ofertaDb?.combosParte.length).toBeGreaterThan(0);
    expect(ofertaDb?.activo).toBe(true);

    // 13. Navegar a la carta virtual pública (/)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    // Localizar el combo en la sección de Promociones de la carta
    const promoCarta = page.locator('.cp-tarjeta-oferta, article, div').filter({ hasText: 'Combo Dúo Especial E2E' }).first();
    await expect(promoCarta).toBeVisible({ timeout: 10000 });

    // Captura carta pública PC
    await page.screenshot({ path: '/tmp/f1shots/ofe-carta-pc.png' });
  });

  test('2. Flujo en Móvil (390px): capturas de cada paso del asistente y carta pública', async ({ page }) => {
    // Configurar viewport Celular estándar (390x844)
    await page.setViewportSize({ width: 390, height: 844 });

    // Iniciar sesión como ADMIN
    await loginPorUi(page, 'ADMIN');
    await page.goto('/admin/ofertas', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/Ofertas/i, { timeout: 10000 });

    // Abrir constructor de combos
    const btnNuevaPromo = page.locator('button', { hasText: '+ Armar oferta' });
    await expect(btnNuevaPromo).toBeVisible({ timeout: 8000 });
    await btnNuevaPromo.click();
    const modalArmar = page.locator('[role="dialog"][aria-label="Armar oferta"]');
    await modalArmar.locator('button', { hasText: 'Combo' }).first().click();

    const modalCombo = page.locator('[role="dialog"][aria-label="Constructor de combos"]');
    await expect(modalCombo).toBeVisible({ timeout: 8000 });

    // Paso 1 Móvil
    await page.locator('#combo-nombre').fill('Combo Fiesta Móvil');
    await page.locator('#combo-descripcion').fill('Especial para compartir');
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso1-movil.png' });

    // Paso 2 Móvil
    await page.locator('[data-testid="btn-siguiente-paso"]').click();
    await expect(page.locator('[data-testid="paso-2-combo"]')).toBeVisible({ timeout: 8000 });
    await page.locator('button', { hasText: '+ 2 bebidas a elección' }).click();
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso2-movil.png' });

    // Paso 3 Móvil
    await page.locator('[data-testid="btn-siguiente-paso"]').click();
    await expect(page.locator('[data-testid="paso-3-combo"]')).toBeVisible({ timeout: 8000 });
    await page.locator('input[aria-label="Precio del tamaño"]').fill('35.00');
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso3-movil.png' });

    // Paso 4 Móvil
    await page.locator('[data-testid="btn-siguiente-paso"]').click();
    await expect(page.locator('[data-testid="paso-4-combo"]')).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso4-movil.png' });

    // Vista "Al abrirla" en móvil
    const preview = page.locator('[data-testid="previsualizacion-carta"]');
    await preview.locator('button', { hasText: 'Al abrirla' }).click();
    await page.screenshot({ path: '/tmp/f1shots/ofe-paso4-abrir-movil.png' });

    // Guardar combo móvil
    await page.locator('[data-testid="btn-guardar-combo"]').click();
    await confirmarSiNo(page, 'si');
    await expect(modalCombo).not.toBeVisible({ timeout: 10000 });

    // Abrir "Ver como se ve en la carta" en móvil
    await expect(page.locator('text=Combo Fiesta Móvil').first()).toBeVisible({ timeout: 10000 });
    const btnVerEnCartaMovil = page.getByRole('button', { name: /Ver cómo se ve Combo Fiesta Móvil/i });
    await expect(btnVerEnCartaMovil).toBeVisible({ timeout: 5000 });
    await btnVerEnCartaMovil.click();
    const modalVerCarta = page.locator('[role="dialog"][aria-label^="Vista previa en la carta"]');
    await expect(modalVerCarta).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: '/tmp/f1shots/ofe-modal-preview-movil.png' });
    await page.keyboard.press('Escape');

    // Carta pública móvil
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });
    const promoCarta = page.locator('.cp-tarjeta-oferta, article, div').filter({ hasText: 'Combo Fiesta Móvil' }).first();
    await expect(promoCarta).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '/tmp/f1shots/ofe-carta-movil.png' });
  });
});
