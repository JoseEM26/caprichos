import { test, expect } from '@playwright/test';
import { loginPorUi, loginPorApi, obtenerStockInsumo, confirmarSiNo } from '../src';

test.describe('Pruebas de Humo E2E - Caprichos', () => {
  test('la carta pública carga correctamente con catálogo y productos', async ({ page }) => {
    // 1. Navegar a la carta virtual pública en el front aislado
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. Verificar que el cuerpo de la página cargue
    await expect(page.locator('body')).toBeVisible();

    // 3. Verificar elementos de la carta (nombre del local o producto de la semilla)
    const encabezado = page.locator('text=CAPRICHOS').first();
    await expect(encabezado).toBeVisible({ timeout: 10000 });

    // 4. Verificar que se muestre algún producto de la semilla (ej. Café Americano)
    const productoSemilla = page.locator('text=Café Americano').first();
    await expect(productoSemilla).toBeVisible({ timeout: 10000 });
  });

  test('el administrador inicia sesión con rol ADMIN, interactúa con diálogo Confirmar y visualiza el tablero', async ({ page }) => {
    // 1. Realizar login por interfaz usando el usuario ADMIN de la semilla
    await loginPorUi(page, 'ADMIN');

    // 2. Comprobar que la URL redirija a /admin (panel de control)
    await expect(page).toHaveURL(/\/admin(\/.*)?$/);

    // 3. Comprobar que el tablero administrativo esté presente y visible con su encabezado y bienvenida
    const headingEscritorio = page.getByRole('heading', { name: 'Escritorio' });
    await expect(headingEscritorio).toBeVisible({ timeout: 10000 });

    const bienvenida = page.getByText(/Hola, ADMIN/);
    await expect(bienvenida).toBeVisible({ timeout: 10000 });

    // 4. Probar el helper confirmarSiNo: abrir diálogo de cerrar sesión y cancelar con 'no'
    const botonCerrarSesion = page.getByRole('button', { name: 'Cerrar sesión' });
    if (await botonCerrarSesion.isVisible()) {
      await botonCerrarSesion.click();
      // Usar helper para pulsar "No, quedarme"
      await confirmarSiNo(page, 'no');
      // Debe seguir en /admin
      await expect(page).toHaveURL(/\/admin(\/.*)?$/);
    }
  });

  test('el helper de base de datos consulta stock de insumos correctamente', async () => {
    // Verificar que el helper obtenerStockInsumo consulte la base caprichos_test
    const stockTotal = await obtenerStockInsumo('Café en grano');
    expect(stockTotal).not.toBeNull();
    expect(Number(stockTotal)).toBeGreaterThan(0);
  });

  test('login por API devuelve token JWT válido para el rol ADMIN', async () => {
    const sesion = await loginPorApi('ADMIN');
    expect(sesion.accessToken).toBeDefined();
    expect(typeof sesion.accessToken).toBe('string');
    expect(sesion.usuario.rol).toBe('ADMIN');
    expect(sesion.debeCambiar).toBe(false);
  });
});

