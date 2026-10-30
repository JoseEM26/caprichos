import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginPorUi, obtenerPrismaTest, confirmarSiNo } from '../../src';

const CAPTURAS_DIR = path.resolve(__dirname, '../../../../docs/capturas-reparto');

test.describe('Reparto: Rutas sugeridas por sector, limpieza de mapa e iniciar ruta seguro', () => {
  test.setTimeout(60000);

  test.beforeEach(async () => {
    const prisma = obtenerPrismaTest();
    // Asegurar que los pedidos CP-D001 a CP-D008 estén en estado LISTO y sin repartidor asignado
    await prisma.pedido.updateMany({
      where: {
        codigo: {
          in: [
            'CP-D001',
            'CP-D002',
            'CP-D003',
            'CP-D004',
            'CP-D005',
            'CP-D006',
            'CP-D007',
            'CP-D008',
            'CP-D009',
            'CP-D010',
          ],
        },
      },
      data: {
        estado: 'LISTO',
        pago_estado: 'PENDIENTE',
        repartidor_party_id: null,
        tomado_en: null,
        salio_en: null,
        llego_en: null,
        entregado_en: null,
      },
    });

    // Trampas de la semilla: un ANULADO y un ENTREGADO que el mapa nunca debe dibujar
    await prisma.pedido.updateMany({
      where: { codigo: 'CP-D011' },
      data: { estado: 'ANULADO', repartidor_party_id: null },
    });
    await prisma.pedido.updateMany({
      where: { codigo: 'CP-D012' },
      data: { estado: 'ENTREGADO', repartidor_party_id: null },
    });

    // Asegurar que los repartidores de prueba no tengan pedidos pendientes residuales
    const repartidores = await prisma.partyIdentifier.findMany({
      where: { tipo: 'DNI', numero: { in: ['20000006', '20000007'] } },
    });
    const partyIds = repartidores.map((r) => r.party_id);
    if (partyIds.length > 0) {
      await prisma.pedido.updateMany({
        where: {
          repartidor_party_id: { in: partyIds },
          estado: { not: 'ENTREGADO' },
        },
        data: {
          repartidor_party_id: null,
          estado: 'LISTO',
          tomado_en: null,
          salio_en: null,
          llego_en: null,
        },
      });
    }
  });

  test('1. Mapa limpio de coordenadas y zonas, activación de rutas sugeridas y cola visible (PC y Celular 390px)', async ({
    page,
  }) => {
    // 1. Iniciar sesión como Repartidor (Juan)
    await loginPorUi(page, 'REPARTIDOR');

    // 2. Navegar a Repartos en vista Desktop PC (1280x720)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/repartos', { waitUntil: 'domcontentloaded' });

    // 3. Esperar que cargue el mapa y los marcadores
    const mapa = page.locator('.leaflet-container');
    await expect(mapa).toBeVisible({ timeout: 15000 });

    // 4. Verificar cola de espera visible
    const contadorCola = page.getByTestId('contador-cola-espera');
    await expect(contadorCola).toBeVisible();
    await expect(contadorCola).toContainText('pedidos esperando repartidor');
    await expect(contadorCola).toContainText('del más antiguo al más nuevo');

    // 5. Verificar ausencia de coordenadas GPS en toda la interfaz
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/-12\.\d{3,}/);
    expect(bodyText).not.toMatch(/-76\.\d{3,}/);
    expect(bodyText).not.toMatch(/-77\.\d{3,}/);

    // 6. Verificar que las zonas de colores no se dibujen en el mapa de reparto
    // (no debe haber polígonos con clase cp-zona-poligono)
    const zonasPoligonos = page.locator('.cp-zona-poligono');
    expect(await zonasPoligonos.count()).toBe(0);

    // Captura PC: Mapa limpio sin coordenadas ni zonas
    await page.screenshot({
      path: path.join(CAPTURAS_DIR, 'pc-mapa-limpio.png'),
      fullPage: false,
    });

    // 7. Activar "Ver rutas sugeridas"
    const btnVerRutas = page.getByTestId('btn-ver-rutas-sugeridas');
    await expect(btnVerRutas).toBeVisible();
    await btnVerRutas.click();

    // 8. Verificar que aparezca el contenedor de rutas sugeridas con las 3 rutas
    const contenedorRutas = page.getByTestId('contenedor-rutas-sugeridas');
    await expect(contenedorRutas).toBeVisible({ timeout: 10000 });
    await expect(contenedorRutas).toContainText('Ruta Norte');

    // Captura PC: Rutas sugeridas con líneas de colores y listado
    await page.screenshot({
      path: path.join(CAPTURAS_DIR, 'pc-rutas-sugeridas.png'),
      fullPage: false,
    });

    // 9. Comprobar responsividad en pantalla de celular (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600); // permitir reajuste de Leaflet

    // Captura Móvil: Rutas sugeridas en celular 390px
    await page.screenshot({
      path: path.join(CAPTURAS_DIR, 'movil-rutas-sugeridas.png'),
      fullPage: false,
    });

    // Desactivar rutas para captura de mapa limpio móvil
    await btnVerRutas.click();
    await expect(contenedorRutas).not.toBeVisible();
    await page.waitForTimeout(300);

    // Captura Móvil: Mapa limpio en celular 390px
    await page.screenshot({
      path: path.join(CAPTURAS_DIR, 'movil-mapa-limpio.png'),
      fullPage: false,
    });
  });

  test('2. Iniciar ruta eligiendo 2 de 4 pedidos en Sector Norte respetando límite', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();

    // 1. Iniciar sesión como Repartidor
    await loginPorUi(page, 'REPARTIDOR');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/repartos', { waitUntil: 'domcontentloaded' });

    // 2. Activar "Ver rutas sugeridas"
    const btnVerRutas = page.getByTestId('btn-ver-rutas-sugeridas');
    await expect(btnVerRutas).toBeVisible({ timeout: 15000 });
    await btnVerRutas.click();

    // 3. Tocar la ruta Norte para cargarla en el panel
    const btnRutaNorte = page.getByRole('button', { name: /Ruta Norte/i }).first();
    await expect(btnRutaNorte).toBeVisible({ timeout: 10000 });
    await btnRutaNorte.click();

    // 4. Verificar que se muestre el panel de ruta sugerida con los pedidos candidatos
    const panel = page.getByTestId('panel-ruta-sugerida');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Los 4 pedidos candidatos deben estar visibles en el panel
    await expect(panel).toContainText('CP-D001');
    await expect(panel).toContainText('CP-D002');
    await expect(panel).toContainText('CP-D003');
    await expect(panel).toContainText('CP-D004');

    // Desmarcar pedidos para elegir exactamente 2 de 4 (CP-D001 y CP-D002)
    const checkP3 = page.getByTestId('check-parada-3'); // O id del pedido 3
    const checkCP003 = page.locator('input[type="checkbox"]').filter({
      has: page.locator('..').getByText('CP-D003'),
    }).first();

    // Desmarcar CP-D003 si está seleccionado
    const checkP3Directo = page.locator('input[aria-label="Incluir pedido CP-D003 en la ruta"]');
    if (await checkP3Directo.isVisible() && (await checkP3Directo.isChecked())) {
      await checkP3Directo.click();
    }

    // Asegurar que CP-D001 y CP-D002 estén marcados
    const checkP1 = page.locator('input[aria-label="Incluir pedido CP-D001 en la ruta"]');
    if (await checkP1.isVisible() && !(await checkP1.isChecked())) {
      await checkP1.click();
    }
    const checkP2 = page.locator('input[aria-label="Incluir pedido CP-D002 en la ruta"]');
    if (await checkP2.isVisible() && !(await checkP2.isChecked())) {
      await checkP2.click();
    }

    // Captura PC: Panel con casillas de verificación
    await page.screenshot({
      path: path.join(CAPTURAS_DIR, 'pc-panel-casillas.png'),
      fullPage: false,
    });

    // Captura Celular 390px del panel con casillas
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(CAPTURAS_DIR, 'movil-panel-casillas.png'),
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 720 });

    // 5. Iniciar la ruta pulsando el botón "Iniciar ruta"
    const btnIniciarRuta = page.getByTestId('btn-iniciar-ruta');
    await expect(btnIniciarRuta).toBeVisible();
    await btnIniciarRuta.click();

    // 6. Debe abrir el diálogo Confirmar modal con los códigos seleccionados
    const dialogConfirmar = page.getByRole('dialog');
    await expect(dialogConfirmar).toBeVisible({ timeout: 5000 });
    await expect(dialogConfirmar).toContainText('¿Iniciar ruta de reparto?');
    await expect(dialogConfirmar).toContainText('CP-D001');
    await expect(dialogConfirmar).toContainText('CP-D002');

    // Confirmar inicio de ruta
    const btnConfirmarSi = dialogConfirmar.getByRole('button', { name: /Sí, iniciar ruta/i });
    await btnConfirmarSi.click();

    // 7. Verificar en Base de Datos que los pedidos tomados pasaron a EN_CAMINO
    await expect.poll(async () => {
      const p1 = await prisma.pedido.findUnique({ where: { codigo: 'CP-D001' } });
      const p2 = await prisma.pedido.findUnique({ where: { codigo: 'CP-D002' } });
      return p1?.estado === 'EN_CAMINO' && p2?.estado === 'EN_CAMINO' && p1.salio_en !== null;
    }, { timeout: 10000 }).toBe(true);

    // Verificar que los pedidos no seleccionados sigan disponibles en LISTO
    const p3 = await prisma.pedido.findUnique({ where: { codigo: 'CP-D003' } });
    const p4 = await prisma.pedido.findUnique({ where: { codigo: 'CP-D004' } });
    expect(p3?.estado).toBe('LISTO');
    expect(p3?.repartidor_party_id).toBeNull();
    expect(p4?.estado).toBe('LISTO');
    expect(p4?.repartidor_party_id).toBeNull();
  });

  test('3. Dos repartidores en paralelo con sesiones independientes manejando concurrencia de pedidos', async ({
    browser,
  }) => {
    const prisma = obtenerPrismaTest();

    // 1. Crear dos contextos de navegación completamente aislados
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Repartidor 1: Juan (DNI 20000006)
    await loginPorUi(page1, 'REPARTIDOR');
    await page1.goto('/admin/repartos', { waitUntil: 'domcontentloaded' });

    // Repartidor 2: Carlos (DNI 20000007)
    await loginPorUi(page2, 'REPARTIDOR_2');
    await page2.goto('/admin/repartos', { waitUntil: 'domcontentloaded' });

    // 2. Ambos repartidores activan rutas sugeridas
    const btnVer1 = page1.getByTestId('btn-ver-rutas-sugeridas');
    const btnVer2 = page2.getByTestId('btn-ver-rutas-sugeridas');
    await expect(btnVer1).toBeVisible({ timeout: 15000 });
    await expect(btnVer2).toBeVisible({ timeout: 15000 });
    await btnVer1.click();
    await btnVer2.click();

    // 3. Ambos seleccionan Ruta Sur (pedidos CP-D005 y CP-D006)
    const btnRutaSur1 = page1.getByRole('button', { name: /Ruta Sur/i }).first();
    const btnRutaSur2 = page2.getByRole('button', { name: /Ruta Sur/i }).first();
    await expect(btnRutaSur1).toBeVisible({ timeout: 10000 });
    await expect(btnRutaSur2).toBeVisible({ timeout: 10000 });
    await btnRutaSur1.click();
    await btnRutaSur2.click();

    // 4. Repartidor 1 pulsa "Iniciar ruta" y confirma primero
    const btnIniciar1 = page1.getByTestId('btn-iniciar-ruta');
    await expect(btnIniciar1).toBeVisible();
    await btnIniciar1.click();
    const dialog1 = page1.getByRole('dialog');
    await expect(dialog1).toBeVisible();
    await dialog1.getByRole('button', { name: /Sí, iniciar ruta/i }).click();

    // Esperar que en BD queden asignados a Juan
    await expect.poll(async () => {
      const p5 = await prisma.pedido.findUnique({ where: { codigo: 'CP-D005' } });
      return p5?.estado === 'EN_CAMINO';
    }, { timeout: 8000 }).toBe(true);

    // 5. Repartidor 2 (Carlos) intenta iniciar la misma ruta que ya fue tomada
    const btnIniciar2 = page2.getByTestId('btn-iniciar-ruta');
    await expect(btnIniciar2).toBeVisible();
    await btnIniciar2.click();
    const dialog2 = page2.getByRole('dialog');
    await expect(dialog2).toBeVisible();
    await dialog2.getByRole('button', { name: /Sí, iniciar ruta/i }).click();

    // 6. Repartidor 2 debe ver el aviso claro de pedido perdido
    const bannerPerdidos = page2.getByTestId('banner-pedidos-perdidos');
    await expect(bannerPerdidos).toBeVisible({ timeout: 10000 });
    await expect(bannerPerdidos).toContainText('ya lo tomó');

    // Captura PC: Aviso claro de pedido perdido
    await page2.screenshot({
      path: path.join(CAPTURAS_DIR, 'pc-aviso-perdido.png'),
      fullPage: false,
    });

    // Captura Móvil: Aviso claro de pedido perdido en 390px
    await page2.setViewportSize({ width: 390, height: 844 });
    await page2.screenshot({
      path: path.join(CAPTURAS_DIR, 'movil-aviso-perdido.png'),
      fullPage: false,
    });

    // 7. Verificación final en BD: cada pedido pertenece a un único repartidor sin colisiones
    const p5Db = await prisma.pedido.findUnique({ where: { codigo: 'CP-D005' } });
    const p6Db = await prisma.pedido.findUnique({ where: { codigo: 'CP-D006' } });
    expect(p5Db?.estado).toBe('EN_CAMINO');
    expect(p6Db?.estado).toBe('EN_CAMINO');
    expect(p5Db?.repartidor_party_id).toBeDefined();
    expect(p6Db?.repartidor_party_id).toBeDefined();
    // Juan tomó los pedidos de la ruta primero; Carlos fue bloqueado de tomarlos y recibió el aviso claro
    const juan = await prisma.partyIdentifier.findUnique({
      where: { tipo_numero: { tipo: 'DNI', numero: '20000006' } },
    });
    const carlos = await prisma.partyIdentifier.findUnique({
      where: { tipo_numero: { tipo: 'DNI', numero: '20000007' } },
    });
    expect(p5Db?.repartidor_party_id).toEqual(juan?.party_id);
    expect(p6Db?.repartidor_party_id).toEqual(juan?.party_id);
    expect(p5Db?.repartidor_party_id).not.toEqual(carlos?.party_id);
    expect(p6Db?.repartidor_party_id).not.toEqual(carlos?.party_id);

    await context1.close();
    await context2.close();
  });
  test('4. Caja ve solo pedidos activos en el mapa (sin anulados ni entregados), varias rutas y ningún teléfono ni coordenada en pantalla', async ({
    page,
  }) => {
    await loginPorUi(page, 'ADMIN');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/admin/repartos', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('contador-cola-espera')).toBeVisible();

    // Los pedidos LISTO de la semilla sí aparecen en el mapa (pin con su código)
    for (const codigo of ['CP-D001', 'CP-D005', 'CP-D007', 'CP-D009']) {
      await expect(page.locator(`[data-codigo="${codigo}"]`)).toHaveCount(1, { timeout: 10000 });
    }

    // Trampas: ni el pin ni el texto del anulado y del entregado aparecen
    await expect(page.locator('[data-codigo="CP-D011"]')).toHaveCount(0);
    await expect(page.locator('[data-codigo="CP-D012"]')).toHaveCount(0);
    const textoSinTrampas = await page.locator('body').innerText();
    expect(textoSinTrampas).not.toContain('CP-D011');
    expect(textoSinTrampas).not.toContain('CP-D012');

    // Varias rutas sugeridas, incluida la más cercana
    await page.getByTestId('btn-ver-rutas-sugeridas').click();
    const contenedorRutas = page.getByTestId('contenedor-rutas-sugeridas');
    await expect(contenedorRutas).toBeVisible({ timeout: 10000 });
    const botonesRuta = contenedorRutas.locator('[data-testid^="btn-ruta-"]');
    expect(await botonesRuta.count()).toBeGreaterThanOrEqual(3);
    await expect(contenedorRutas).toContainText('Ruta más cercana');
    await expect(contenedorRutas).toContainText('Ruta Norte');

    // Texto visible sin teléfonos ni coordenadas
    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/-?\d+\.\d{3,}/);
    expect(texto).not.toMatch(/\d{7,}/);
    expect(texto).not.toContain('987111001');

    // Captura opcional de PC (solo si E2E_CAPTURAS_DIR está definido; fuera del repo)
    const dirCapturas = process.env.E2E_CAPTURAS_DIR;
    if (dirCapturas) {
      await page.screenshot({ path: path.join(dirCapturas, 'pc-1280-mapa-varias-rutas.png') });
    }

    // Celular 390px: sin scroll horizontal y con el mismo mapa y rutas
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const anchoPagina = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(anchoPagina).toBeLessThanOrEqual(390);
    if (dirCapturas) {
      await page.screenshot({ path: path.join(dirCapturas, 'movil-390-mapa-varias-rutas.png') });
    }
  });

});
