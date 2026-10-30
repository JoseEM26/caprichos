import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginPorUi } from '../../src';

test.describe('Iniciativas - Subida y visualización de capturas', () => {
  test('crea iniciativa con captura, muestra miniatura en tarjeta y detalle, y abre/cierra visor modal', async ({ page }) => {
    // 1. Iniciar sesión como ADMIN
    await loginPorUi(page, 'ADMIN');

    // 2. Ir al módulo de iniciativas
    await page.goto('/admin/iniciativas', { waitUntil: 'networkidle' });

    // 3. Crear una imagen temporal de prueba para adjuntar
    const tempImgPath = path.resolve('/tmp/f1shots/e2e-captura-test.png');
    if (!fs.existsSync(tempImgPath)) {
      // Imagen PNG mínima válida 1x1 pixel
      const png1x1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      fs.writeFileSync(tempImgPath, png1x1);
    }

    // 4. Abrir modal nueva iniciativa
    await page.locator('button:has-text("+ Nueva iniciativa")').click();
    await expect(page.locator('div[role="dialog"][aria-label="Nueva iniciativa"]')).toBeVisible({ timeout: 5000 });

    // 5. Llenar campos
    await page.locator('#in-t').fill('Servilleteros vacíos en barra');
    await page.locator('#in-x').fill('Las servilletas se agotaron durante el turno noche.');

    // 6. Subir archivo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempImgPath);

    // Esperar a que la previsualización aparezca
    await expect(page.locator('img[alt="Captura elegida"]')).toBeVisible({ timeout: 10000 });

    // 7. Enviar y confirmar
    await page.locator('button:has-text("Subir iniciativa")').click();
    const btnConfirmar = page.locator('button:has-text("Sí, subir")');
    await expect(btnConfirmar).toBeVisible({ timeout: 5000 });
    await btnConfirmar.click();

    // 8. Verificar que la iniciativa aparece en la lista con su captura
    await expect(page.locator('text=Servilleteros vacíos en barra')).toBeVisible({ timeout: 15000 });

    // La miniatura en la tarjeta debe estar presente y visible
    const botonMiniatura = page.locator('button[title="Clic para ver captura en grande"]').first();
    await expect(botonMiniatura).toBeVisible({ timeout: 10000 });

    // 9. Abrir acordeón "Ver y comentar"
    const btnVerComentar = page.locator('button:has-text("Ver y comentar")').first();
    await btnVerComentar.click();

    // 10. Clic en la captura para abrir el visor en grande
    await botonMiniatura.click();

    const visorModal = page.locator('div[role="dialog"][aria-label="Visor de captura"]');
    await expect(visorModal).toBeVisible({ timeout: 5000 });
    await expect(visorModal.locator('text=Captura adjunta')).toBeVisible();

    // 11. Cerrar el visor
    const btnCerrarVisor = visorModal.locator('button:has-text("Cerrar")');
    await expect(btnCerrarVisor).toBeVisible();
    await btnCerrarVisor.click();

    // Verificar que el visor se cerró
    await expect(visorModal).not.toBeVisible();
  });
});
