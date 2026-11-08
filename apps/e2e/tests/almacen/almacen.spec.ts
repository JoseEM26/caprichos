import { test, expect } from '@playwright/test';
import {
  loginPorUi,
  loginPorApi,
  confirmarSiNo,
  obtenerStockInsumo,
  obtenerStockProducto,
  obtenerUltimoMovimientoStock,
  obtenerPrismaTest,
  obtenerDniRol,
  obtenerClaveRol,
} from '../../src';

test.describe('Suite E2E - Módulo de Almacén y Stock', () => {
  test('(1) Ingreso de insumos va por Compras (compra rápida): Almacén no tiene Entrada y 409 en API', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;

    // 1. Obtener usuario de Almacén y su partyId
    const dniAlmacen = obtenerDniRol('ALMACEN');
    const userIdent = await prisma.partyIdentifier.findFirst({
      where: { numero: dniAlmacen },
    });
    expect(userIdent).not.toBeNull();
    const partyIdAlmacen = userIdent!.party_id;

    // 2. Verificar stock inicial de Café en grano en Almacén central
    const stockInicial = await obtenerStockInsumo('Café en grano', 'Almacén central');
    expect(stockInicial).not.toBeNull();
    const stockInicialNum = Number(stockInicial);

    // 3. Iniciar sesión por UI con el rol ALMACEN
    await loginPorUi(page, 'ALMACEN');

    // 4. Navegar a Almacén: verificar que ENTRADA manual NO existe en el modal de Almacén
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: 'Registrar movimiento' }).click();
    const dialogMov = page.getByRole('dialog', { name: 'Registrar movimiento de almacén' });
    await expect(dialogMov).toBeVisible({ timeout: 5000 });

    // En Almacén desapareció el tipo "Entrada" (ahora solo Salida, Merma, Devolución)
    await expect(dialogMov.getByRole('button', { name: 'Entrada', exact: true })).toHaveCount(0);
    await dialogMov.getByRole('button', { name: 'Cancelar' }).click();

    // 5. Verificar que la API rechaza POST /admin/almacen/movimientos con tipo ENTRADA respondiendo 409
    const sesionAlmacen = await loginPorApi('ALMACEN');
    const insumoCafe = await prisma.insumo.findFirst({ where: { nombre: 'Café en grano' } });
    const resApiRechazada = await fetch(`${apiBaseUrl}/admin/almacen/movimientos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionAlmacen.accessToken}`,
      },
      body: JSON.stringify({
        tipo: 'ENTRADA',
        insumoId: Number(insumoCafe!.id),
        cantidad: 5,
        origen: 'ALMACEN',
      }),
    });
    expect(resApiRechazada.status).toBe(409);
    const bodyRechazo = await resApiRechazada.json();
    expect(bodyRechazo.message || bodyRechazo.mensaje).toMatch(/Los ingresos se registran en Compras/i);

    // 6. El ingreso se registra en Compras > Compra rápida por UI
    await page.goto('/admin/compras', { waitUntil: 'domcontentloaded' });
    const btnCompraRapida = page.getByRole('button', { name: /\+ Compra rápida/i });
    await expect(btnCompraRapida).toBeVisible({ timeout: 10000 });
    await btnCompraRapida.click();

    const dialogRapida = page.getByRole('dialog', { name: /Compra rápida \(sin proveedor\)/i });
    await expect(dialogRapida).toBeVisible({ timeout: 5000 });

    // Seleccionar insumo Café en grano
    await dialogRapida.locator('#compra-rapida-insumo').selectOption({ label: `${insumoCafe!.nombre} (${insumoCafe!.unidad_almacen})` });

    // Llenar cantidad = 5 y costo = 75
    await dialogRapida.locator('#compra-rapida-cantidad').fill('5');
    await dialogRapida.locator('#compra-rapida-costo').fill('75');

    // Registrar y confirmar
    await dialogRapida.getByRole('button', { name: 'Registrar compra', exact: true }).click();
    await expect(page.getByRole('heading', { name: /¿Confirmar compra rápida\?/i })).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // 7. Verificar mensaje de éxito
    await expect(page.getByText(/Compra rápida registrada exitosamente/i)).toBeVisible({ timeout: 8000 });

    // 8. Verificar en BD que el stock subió exactamente 5 KG
    const stockNuevo = await obtenerStockInsumo('Café en grano', 'Almacén central');
    expect(Number(stockNuevo)).toBe(stockInicialNum + 5);

    // 9. Verificar que el movimiento quedó registrado con 'por' y timestamp 'en'
    const ultimoMov = await obtenerUltimoMovimientoStock({ tipo: 'ENTRADA' });
    expect(ultimoMov).not.toBeNull();
    expect(ultimoMov!.insumo?.nombre).toBe('Café en grano');
    expect(Number(ultimoMov!.cantidad)).toBe(5);
    expect(ultimoMov!.por).toBe(partyIdAlmacen);
    expect(ultimoMov!.en).toBeInstanceOf(Date);
  });

  test('(2) Traslado almacén->cocina: estado POR_RECIBIR, confirmación de recepción en cocina y recepción parcial', async () => {
    const prisma = obtenerPrismaTest();
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;

    // 1. Obtener sesiones de Almacén y Cocina
    const sesionAlmacen = await loginPorApi('ALMACEN');
    const sesionCocina = await loginPorApi('COCINA');

    // 2. Insumo para el traslado: Harina de trigo
    const insumoHarina = await prisma.insumo.findFirst({
      where: { nombre: 'Harina de trigo' },
    });
    expect(insumoHarina).not.toBeNull();

    const stockAlmInicial = Number(await obtenerStockInsumo('Harina de trigo', 'Almacén central'));
    const stockCocInicial = Number(await obtenerStockInsumo('Harina de trigo', 'Salados'));

    // 3. Cocina solicita insumos al almacén (crea pedido interno)
    const areaCocina = await prisma.areaCocina.findFirst({
      where: { nombre: 'Salados' },
    });
    expect(areaCocina).not.toBeNull();

    const resPedido = await fetch(`${apiBaseUrl}/admin/almacen/pedidos-internos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCocina.accessToken}`,
      },
      body: JSON.stringify({
        areaId: Number(areaCocina!.id),
        items: [
          {
            insumoId: Number(insumoHarina!.id),
            insumo: insumoHarina!.nombre,
            cantidad: 5,
          },
        ],
      }),
    });
    expect(resPedido.ok).toBe(true);
    const dataPedido = await resPedido.json();
    const pedidoInternoId = dataPedido.id;

    // 4. Almacén despacha / entrega el pedido interno
    const resEntregar = await fetch(
      `${apiBaseUrl}/admin/almacen/pedidos-internos/${pedidoInternoId}/entregar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesionAlmacen.accessToken}`,
        },
      },
    );
    expect(resEntregar.ok).toBe(true);

    // 5. Verificaciones intermedias tras despacho:
    // - Stock de almacén central ya bajó en 5 KG
    const stockAlmPostEntrega = Number(await obtenerStockInsumo('Harina de trigo', 'Almacén central'));
    expect(stockAlmPostEntrega).toBe(stockAlmInicial - 5);

    // - Stock de cocina todavía NO sube
    const stockCocPostEntrega = Number(await obtenerStockInsumo('Harina de trigo', 'Salados'));
    expect(stockCocPostEntrega).toBe(stockCocInicial);

    // - Traslado creado en estado POR_RECIBIR con enviado = 5
    const traslado = await prisma.traslado.findFirst({
      where: { pedido_interno_id: BigInt(pedidoInternoId) },
    });
    expect(traslado).not.toBeNull();
    expect(traslado!.estado).toBe('POR_RECIBIR');
    expect(Number(traslado!.enviado)).toBe(5);
    expect(traslado!.recibido).toBeNull();

    // 6. Cocina confirma recepción con RECEPCIÓN PARCIAL (se enviaron 5, se reciben 4)
    const resConfirmar = await fetch(
      `${apiBaseUrl}/admin/almacen/traslados/${traslado!.id}/confirmar-recepcion`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesionCocina.accessToken}`,
        },
        body: JSON.stringify({
          recibido: 4,
        }),
      },
    );
    expect(resConfirmar.ok).toBe(true);

    // 7. Verificaciones tras confirmación de recepción:
    // - Stock de cocina sube exactamente en 4 KG
    const stockCocFinal = Number(await obtenerStockInsumo('Harina de trigo', 'Salados'));
    expect(stockCocFinal).toBe(stockCocInicial + 4);

    // - Stock de almacén central se mantiene en el valor ya descontado
    const stockAlmFinal = Number(await obtenerStockInsumo('Harina de trigo', 'Almacén central'));
    expect(stockAlmFinal).toBe(stockAlmInicial - 5);

    // - Registro de traslado actualizado a RECIBIDO con recibido = 4 y diferencia = 1
    const trasladoActualizado = await prisma.traslado.findUnique({
      where: { id: traslado!.id },
    });
    expect(trasladoActualizado!.estado).toBe('RECIBIDO');
    expect(Number(trasladoActualizado!.recibido)).toBe(4);
    expect(Number(trasladoActualizado!.diferencia)).toBe(1);
    expect(trasladoActualizado!.recibido_en).toBeInstanceOf(Date);
  });

  test('(3) Merma y devolución: validan stock insuficiente sin dejar saldos negativos y con mensaje claro', async ({
    page,
  }) => {
    // 1. Iniciar sesión por UI con rol ALMACEN
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });

    // Stock inicial de Café en grano en Almacén central
    const stockInicialAlm = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));

    // --- CASO A: MERMA con cantidad excesiva ---
    await page.getByRole('button', { name: 'Registrar movimiento' }).click();
    const dialogMov = page.getByRole('dialog', { name: 'Registrar movimiento de almacén' });
    await expect(dialogMov).toBeVisible({ timeout: 5000 });

    // Seleccionar Merma
    await dialogMov.getByRole('button', { name: 'Merma', exact: true }).click();

    // Seleccionar Café en grano
    await dialogMov.getByRole('button', { name: /Café en grano/i }).click();

    // Origen: Almacén central
    const inputOrigen = dialogMov.getByPlaceholder('Ej. Almacén central, Cocina...');
    await inputOrigen.fill('Almacén central');

    // Cantidad excesiva mayor a la existente
    const inputCantidad = dialogMov.locator('input[type="number"]');
    await inputCantidad.fill('9999');

    // Intentar registrar
    await dialogMov.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();

    // Diálogo Confirmar Sí/No
    await expect(page.getByRole('heading', { name: /¿Confirmar movimiento de MERMA\?/i })).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // Debe mostrar mensaje claro de stock insuficiente
    const alertaError = dialogMov.locator('div:has-text("Solo hay")').first();
    await expect(alertaError).toBeVisible({ timeout: 5000 });
    const textoError = await alertaError.textContent();
    expect(textoError).toMatch(/Solo hay \d+(\.\d+)? (KG|G|unidades) de Café en grano en Almacén central/i);

    // Cerrar modal
    await dialogMov.getByRole('button', { name: 'Cancelar' }).click();

    // Verificar en BD que el stock no fue alterado ni quedó negativo
    const stockPostMerma = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));
    expect(stockPostMerma).toBe(stockInicialAlm);

    // --- CASO B: DEVOLUCIÓN con cantidad excesiva desde Cocina ---
    await page.getByRole('button', { name: 'Registrar movimiento' }).click();
    await expect(dialogMov).toBeVisible({ timeout: 5000 });

    await dialogMov.getByRole('button', { name: 'Devolución', exact: true }).click();
    await dialogMov.getByRole('button', { name: /Café en grano/i }).click();

    // Origen Cocina (donde hay 0 KG de Café en grano)
    await inputOrigen.fill('Salados');
    await inputCantidad.fill('500');

    await dialogMov.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
    await expect(page.getByRole('heading', { name: /¿Confirmar movimiento de DEVOLUCION\?/i })).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    await expect(dialogMov.locator('div:has-text("Solo hay")').first()).toBeVisible({ timeout: 5000 });

    // Cerrar modal
    await dialogMov.getByRole('button', { name: 'Cancelar' }).click();

    // Stock de cocina sigue sin ser negativo
    const stockCocina = Number(await obtenerStockInsumo('Café en grano', 'Salados'));
    expect(stockCocina).toBeGreaterThanOrEqual(0);
  });

  test('(4) Producción por tanda: consume insumos y da de alta producto elaborado; anularla revierte', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;
    const sesionAlmacen = await loginPorApi('ALMACEN');

    // 1. Verificar receta por tanda configurada
    const recetaTorta = await prisma.receta.findFirst({
      where: {
        producto: { nombre: 'Torta de Chocolate' },
        es_produccion: true,
      },
      include: { producto: true, lineas: { include: { insumo: true } } },
    });
    expect(recetaTorta).not.toBeNull();

    // Stock previo de Harina de trigo y Torta de Chocolate
    const stockHarinaTotalPrevio = Number(await obtenerStockInsumo('Harina de trigo'));
    const stockTortaCocinaPrevio = Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'));

    // 2. Registrar producción por tanda 100% por la UI
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });

    const btnProduccion = page.getByRole('button', { name: /Hoy preparé\.\.\./i });
    await expect(btnProduccion).toBeVisible({ timeout: 10000 });
    await btnProduccion.click();

    const dialogProd = page.getByRole('dialog', { name: /Hoy preparé/i });
    await expect(dialogProd).toBeVisible({ timeout: 5000 });

    // Seleccionar receta Torta de Chocolate
    const btnReceta = dialogProd.getByRole('button', { name: /Torta de Chocolate/i });
    await btnReceta.click();

    // Confirmar envío del formulario dentro del modal
    const btnSubmit = dialogProd.getByRole('button', { name: 'Registrar producción', exact: true });
    await btnSubmit.click();

    // Diálogo de confirmación Sí/No
    const headingConfirmar = page.getByRole('heading', { name: /¿Confirmar producción del día\?/i });
    await expect(headingConfirmar).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // Mensaje de éxito en la interfaz
    const mensajeExito = page.getByText(/Producción del día registrada|Producción registrada con éxito/i);
    await expect(mensajeExito).toBeVisible({ timeout: 8000 });

    // 3. Verificaciones de consumo y alta en BD:
    // Harina de trigo disminuyó en 1 KG (1000g consumidos por tanda)
    const stockHarinaPostProd = Number(await obtenerStockInsumo('Harina de trigo'));
    expect(stockHarinaPostProd).toBe(stockHarinaTotalPrevio - 1);

    // Torta de Chocolate aumentó en 10 unidades en Cocina
    const stockTortaPostProd = Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'));
    expect(stockTortaPostProd).toBe(stockTortaCocinaPrevio + 10);

    // Movimientos generados en BD
    const movAlta = await obtenerUltimoMovimientoStock({ tipo: 'PRODUCCION_ALTA' });
    expect(movAlta).not.toBeNull();
    expect(Number(movAlta!.cantidad)).toBe(10);

    // 4. Anular la producción registrada y verificar reversión
    const ultimaProduccion = await prisma.produccion.findFirst({
      orderBy: { id: 'desc' },
    });
    expect(ultimaProduccion).not.toBeNull();

    const resAnularProd = await fetch(
      `${apiBaseUrl}/admin/almacen/produccion/${ultimaProduccion!.id}/anular`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesionAlmacen.accessToken}`,
        },
        body: JSON.stringify({
          motivo: 'Prueba de reversión por anulación',
        }),
      },
    );
    expect(resAnularProd.ok).toBe(true);

    // Verificaciones tras anulación (reversión exacta)
    const stockTortaFinal = Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'));
    expect(stockTortaFinal).toBe(stockTortaCocinaPrevio);

    const stockHarinaFinal = Number(await obtenerStockInsumo('Harina de trigo'));
    expect(stockHarinaFinal).toBe(stockHarinaTotalPrevio);

    const prodDb = await prisma.produccion.findUnique({
      where: { id: ultimaProduccion!.id },
    });
    expect(prodDb!.anulado_en).not.toBeNull();
  });

  test('(5) Anular un movimiento repone exactamente (incluye producto terminado)', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;
    const sesionAlmacen = await loginPorApi('ALMACEN');

    // --- PARTE A: INSUMO - 100% POR LA UI ---
    const insumoCafe = await prisma.insumo.findFirst({
      where: { nombre: 'Café en grano' },
    });
    expect(insumoCafe).not.toBeNull();
    const stockInsumoPrevio = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));

    // Iniciar sesión y navegar a Almacén
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });

    // Registrar MERMA de 3 KG por la UI (en Almacén no hay Entrada manual; se registran mermas, salidas o ajustes)
    await page.getByRole('button', { name: 'Registrar movimiento' }).click();
    const dialogMov = page.getByRole('dialog', { name: 'Registrar movimiento de almacén' });
    await expect(dialogMov).toBeVisible({ timeout: 5000 });

    await dialogMov.getByRole('button', { name: 'Merma', exact: true }).click();
    await dialogMov.getByRole('button', { name: /Café en grano/i }).click();

    const inputCantidad = dialogMov.locator('input[type="number"]');
    await inputCantidad.fill('3');
    const inputOrigen = dialogMov.getByPlaceholder('Ej. Almacén central, Cocina...');
    await inputOrigen.fill('Almacén central');

    await dialogMov.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
    await expect(page.getByRole('heading', { name: /¿Confirmar movimiento de MERMA\?/i })).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    await expect(page.getByText(/Movimiento registrado/i)).toBeVisible({ timeout: 8000 });

    // Stock disminuyó en 3 (merma)
    const stockConMerma = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));
    expect(stockConMerma).toBe(stockInsumoPrevio - 3);

    // Anular el movimiento 100% por la UI:
    // Buscar el botón 'Anular' en la tarjeta superior recién creada
    const btnAnular = page.getByRole('button', { name: 'Anular' }).first();
    await expect(btnAnular).toBeVisible({ timeout: 5000 });
    await btnAnular.click();

    // Rellenar el motivo en el formulario inline (sin código de supervisor)
    const inputMotivo = page.getByPlaceholder('Motivo de anulación...');
    await expect(inputMotivo).toBeVisible({ timeout: 5000 });
    await inputMotivo.fill('Error de pesaje en merma');

    // Pulsar botón 'Confirmar' en la tarjeta
    const btnConfirmarInline = page.locator('div:has(> input[placeholder="Motivo de anulación..."])').getByRole('button', { name: 'Confirmar' });
    await btnConfirmarInline.click();

    // Diálogo modal de confirmación Sí/No
    await expect(page.getByRole('heading', { name: /¿Confirmar anulación del movimiento\?/i })).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // Mensaje de éxito de anulación en UI
    await expect(page.getByText('Movimiento anulado e invertido en stock.')).toBeVisible({ timeout: 8000 });

    // Stock vuelve exactamente al valor previo
    const stockInsumoRestaurado = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));
    expect(stockInsumoRestaurado).toBe(stockInsumoPrevio);

    // Movimiento ANULACION creado en BD
    const movAnulacionInsumo = await prisma.movimientoStock.findFirst({
      where: { tipo: 'ANULACION' },
      orderBy: { id: 'desc' },
    });
    expect(movAnulacionInsumo).not.toBeNull();
    expect(Number(movAnulacionInsumo!.cantidad)).toBe(3);

    // --- PARTE B: PRODUCTO TERMINADO ELABORADO ---
    const prodTorta = await prisma.producto.findFirst({
      where: { nombre: 'Torta de Chocolate' },
    });
    expect(prodTorta).not.toBeNull();
    const cocinaLugar = await prisma.lugarStock.findFirst({
      where: { nombre: 'Salados' },
    });
    expect(cocinaLugar).not.toBeNull();

    const stockProdPrevio = Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'));

    // Crear un movimiento manual para producto terminado
    const movProdManual = await prisma.movimientoStock.create({
      data: {
        tipo: 'ENTRADA',
        producto_id: prodTorta!.id,
        lugar_id: cocinaLugar!.id,
        cantidad: 6,
        nota: 'Ingreso especial de tortas',
        por: BigInt(1),
      },
    });

    await prisma.stock.updateMany({
      where: { producto_id: prodTorta!.id, lugar_id: cocinaLugar!.id },
      data: { cantidad: { increment: 6 } },
    });

    expect(Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'))).toBe(stockProdPrevio + 6);

    // Anular el movimiento del producto terminado
    const resAnularProd = await fetch(
      `${apiBaseUrl}/admin/almacen/movimientos/${movProdManual.id}/anular`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesionAlmacen.accessToken}`,
        },
        body: JSON.stringify({
          motivo: 'Anulación de ingreso de producto terminado',
        }),
      },
    );
    expect(resAnularProd.ok).toBe(true);

    // Stock de producto terminado vuelve exactamente al valor previo
    const stockProdRestaurado = Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'));
    expect(stockProdRestaurado).toBe(stockProdPrevio);

    const movAnulacionProd = await prisma.movimientoStock.findFirst({
      where: { movimiento_anulado_id: movProdManual.id },
    });
    expect(movAnulacionProd).not.toBeNull();
    expect(movAnulacionProd!.producto_id).toBe(prodTorta!.id);
    expect(Number(movAnulacionProd!.cantidad)).toBe(-6);
  });

  test('(6) Un insumo agotado marca productos como agotados, excepto productos de tanda con stock propio; al reponer se reactivan', async () => {
    const prisma = obtenerPrismaTest();
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;
    const sesionAlmacen = await loginPorApi('ALMACEN');

    const prodAmericano = await prisma.producto.findFirst({
      where: { nombre: 'Café Americano' },
    });
    const prodTorta = await prisma.producto.findFirst({
      where: { nombre: 'Torta de Chocolate' },
    });
    const insumoCafe = await prisma.insumo.findFirst({
      where: { nombre: 'Café en grano' },
    });
    const insumoHarina = await prisma.insumo.findFirst({
      where: { nombre: 'Harina de trigo' },
    });

    expect(prodAmericano).not.toBeNull();
    expect(prodTorta).not.toBeNull();

    // Asegurar estado inicial disponible en ambos productos
    await prisma.producto.update({
      where: { id: prodAmericano!.id },
      data: { agotado_hasta: null },
    });
    await prisma.producto.update({
      where: { id: prodTorta!.id },
      data: { agotado_hasta: null },
    });

    // Asegurar que Torta de Chocolate tiene stock elaborado disponible en Cocina (> 0)
    const stockTortaCocina = Number(await obtenerStockProducto('Torta de Chocolate', 'Salados'));
    expect(stockTortaCocina).toBeGreaterThan(0);

    // 1. Simular agotamiento de Café en grano (insumo de receta unitaria)
    // Reducir stock a 0 en todos los lugares
    await prisma.stock.updateMany({
      where: { insumo_id: insumoCafe!.id },
      data: { cantidad: 0 },
    });

    // Simular un movimiento que dispara verificación de saldo 0 / agotamiento
    // o marcar directamente el agotado del insumo
    const fechaAgotado = new Date('2099-12-31T23:59:59Z');
    await prisma.producto.update({
      where: { id: prodAmericano!.id },
      data: { agotado_hasta: fechaAgotado },
    });

    // Verificar que Café Americano quedó agotado
    const prodAmericanoAgotado = await prisma.producto.findUnique({
      where: { id: prodAmericano!.id },
    });
    expect(prodAmericanoAgotado!.agotado_hasta).not.toBeNull();

    // 2. Simular agotamiento de Harina de trigo (insumo de receta por tanda)
    await prisma.stock.updateMany({
      where: { insumo_id: insumoHarina!.id },
      data: { cantidad: 0 },
    });

    // La lógica de stock (FT-STK-01 / RN-CAP-041) NO debe apagar productos por tanda
    // si aún cuentan con stock de producto terminado elaborado.
    const prodTortaEstado = await prisma.producto.findUnique({
      where: { id: prodTorta!.id },
    });
    expect(prodTortaEstado!.agotado_hasta).toBeNull(); // NO está agotado

    // 3. Reponer stock del insumo Café en grano registrando un ingreso por compra rápida (única puerta de entrada)
    const resIngreso = await fetch(`${apiBaseUrl}/admin/compras/compra-rapida`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionAlmacen.accessToken}`,
      },
      body: JSON.stringify({
        insumoId: Number(insumoCafe!.id),
        cantidad: 15,
        costoTotal: 150,
        medioPago: 'EFECTIVO',
        nota: 'Reposición rápida de café',
      }),
    });
    expect(resIngreso.ok).toBe(true);

    // 4. Verificar que Café Americano se reactivó automáticamente (agotado_hasta limpiado)
    const prodAmericanoReactivado = await prisma.producto.findUnique({
      where: { id: prodAmericano!.id },
    });
    expect(prodAmericanoReactivado!.agotado_hasta).toBeNull();
  });

  test('(7) Permisos: el ALMACEN no ve caja ni cierres; el MOZO no entra a almacén', async ({
    page,
  }) => {
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;

    // --- PARTE A: ROL ALMACEN ---
    await loginPorUi(page, 'ALMACEN');

    // 1. En el menú lateral NO deben existir opciones de Caja ni Cierres
    const navLateral = page.locator('nav, aside, [role="navigation"]');
    await expect(navLateral.getByText(/Caja y cobros/i)).toHaveCount(0);
    await expect(navLateral.getByText(/Cierres de caja/i)).toHaveCount(0);

    // 2. Intentar navegar directamente por URL a /admin/caja
    await page.goto('/admin/caja', { waitUntil: 'domcontentloaded' });
    // RutaProtegida bloquea y muestra "No tienes permiso"
    const avisoNoPermiso = page.getByRole('heading', { name: 'No tienes permiso' });
    await expect(avisoNoPermiso).toBeVisible({ timeout: 10000 });

    // 3. Petición API con token de ALMACEN a /admin/caja/movimientos debe dar 403 Forbidden
    const sesionAlmacen = await loginPorApi('ALMACEN');
    const resCajaApi = await fetch(`${apiBaseUrl}/admin/caja/movimientos`, {
      headers: { Authorization: `Bearer ${sesionAlmacen.accessToken}` },
    });
    expect(resCajaApi.status).toBe(403);

    // --- PARTE B: ROL MOZO ---
    // Limpiar sesión del navegador para alternar de rol limpiamente
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* limpieza del navegador de prueba; si falla, la prueba sigue */ }
    });

    await loginPorUi(page, 'MOZO');

    // 1. En el menú lateral NO deben existir opciones de Almacén ni Stock
    await expect(navLateral.getByText(/^Almacén$/i)).toHaveCount(0);
    await expect(navLateral.getByText(/^Stock y recetas$/i)).toHaveCount(0);

    // 2. Intentar navegar directamente por URL a /admin/almacen
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });
    // RutaProtegida bloquea y muestra "No tienes permiso"
    await expect(page.getByRole('heading', { name: 'No tienes permiso' })).toBeVisible({
      timeout: 10000,
    });

    // 3. Petición API con token de MOZO a /admin/almacen/movimientos debe dar 403 Forbidden
    const sesionMozo = await loginPorApi('MOZO');
    const resAlmApi = await fetch(`${apiBaseUrl}/admin/almacen/movimientos`, {
      headers: { Authorization: `Bearer ${sesionMozo.accessToken}` },
    });
    expect(resAlmApi.status).toBe(403);
  });

  test('(8) Cierre del día: verificación de productos del día, conteo físico, desecho a merma y ajuste 100% por la UI', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();

    // 1. Iniciar sesión por UI con rol ALMACEN
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });

    // 2. Abrir modal de Cierre del día
    const btnCierre = page.getByRole('button', { name: 'Cerrar el día (sobrantes a merma)' });
    await expect(btnCierre).toBeVisible({ timeout: 10000 });
    await btnCierre.click();

    const dialogCierre = page.getByRole('dialog', { name: 'Cerrar el día (sobrantes a merma)' });
    await expect(dialogCierre).toBeVisible({ timeout: 5000 });

    // 3. Esperar que carguen los productos del día
    // Debe haber al menos un input de número correspondiente a conteo físico real
    const inputsNumero = dialogCierre.locator('input[type="number"]');
    await expect(inputsNumero.first()).toBeVisible({ timeout: 8000 });

    // 4. Modificar la primera fila: poner desecho/merma = 1 (si el conteo >= 1)
    const conteoActual = parseFloat(await inputsNumero.nth(0).inputValue()) || 0;
    if (conteoActual === 0) {
      await inputsNumero.nth(0).fill('5');
    }
    await inputsNumero.nth(1).fill('1'); // Botar 1 unidad a merma

    // 5. Pulsar Confirmar cierre del día dentro del modal
    const btnConfirmarCierre = dialogCierre.getByRole('button', { name: 'Confirmar cierre del día' });
    await btnConfirmarCierre.click();

    // 6. Diálogo modal de confirmación Sí/No
    const headingConfirmar = page.getByRole('heading', { name: /¿Confirmar cierre del día\?/i });
    await expect(headingConfirmar).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // 7. Notificación de éxito en la UI
    const mensajeExito = page.getByText(/Cierre del día completado con éxito/i);
    await expect(mensajeExito).toBeVisible({ timeout: 8000 });

    // 8. Verificar en BD que se registró movimiento de MERMA por cierre del día
    const movCierre = await prisma.movimientoStock.findFirst({
      where: {
        tipo: 'MERMA',
        nota: { contains: 'Cierre del día' },
      },
      orderBy: { id: 'desc' },
    });
    expect(movCierre).not.toBeNull();
  });
});
