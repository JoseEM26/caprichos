import { test, expect } from '@playwright/test';
import {
  loginPorUi,
  confirmarSiNo,
  obtenerStockInsumo,
  obtenerStockProducto,
  obtenerPrismaTest,
  limpiarRedisSupervisor,
} from '../../src';
import { Prisma } from '@prisma/client';

async function asegurarProveedorPrueba(prisma: any) {
  const role = await prisma.partyRole.findFirst({
    where: {
      rol: 'PROVEEDOR',
      party: {
        organizacion: {
          razon_social: { not: 'Compras varias (sin proveedor)' },
        },
      },
    },
    include: {
      party: {
        include: {
          organizacion: true,
          contactos: true,
        },
      },
    },
  });

  if (role) {
    return {
      id: role.party_id.toString(),
      partyId: role.party_id,
      nombre: role.party.organizacion?.razon_social || 'Distribuidora Gastronómica',
    };
  }

  const party = await prisma.party.create({
    data: {
      tipo: 'ORGANIZACION',
      estado: 'ACTIVO',
      organizacion: {
        create: {
          razon_social: 'Distribuidora Gastronómica SAC',
          nombre_comercial: 'Distribuidora Gastronómica',
        },
      },
      documentos: {
        create: {
          tipo: 'RUC',
          numero: '20601234567',
        },
      },
      contactos: {
        create: {
          tipo: 'WHATSAPP',
          valor: '51987654321',
          principal: true,
        },
      },
    },
  });

  const nuevoRole = await prisma.partyRole.create({
    data: {
      party_id: party.id,
      rol: 'PROVEEDOR',
    },
  });

  await prisma.supplierDetail.create({
    data: {
      party_role_id: nuevoRole.id,
      dias_credito: 0,
      activo: true,
    },
  });

  return {
    id: party.id.toString(),
    partyId: party.id,
    nombre: 'Distribuidora Gastronómica SAC',
  };
}

test.describe('Suite E2E - Módulo de Compras y Producción', () => {
  test.beforeEach(() => {
    limpiarRedisSupervisor();
  });

  test('(1) Compra rápida por UI sube stock en Almacén central con costo unitario y auditoría', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();

    // 1. Obtener insumo de prueba y verificar stock inicial
    const insumoCafe = await prisma.insumo.findFirst({
      where: { nombre: 'Café en grano' },
    });
    expect(insumoCafe).not.toBeNull();
    const stockInicial = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));

    // 2. Iniciar sesión como ALMACEN y navegar a Compras
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/compras', { waitUntil: 'domcontentloaded' });

    // 3. Abrir modal de Compra rápida
    const btnCompraRapida = page.getByRole('button', { name: '+ Compra rápida' });
    await expect(btnCompraRapida).toBeVisible({ timeout: 8000 });
    await btnCompraRapida.click();

    const dialogCompraRapida = page.getByRole('dialog', { name: /Compra rápida/i });
    await expect(dialogCompraRapida).toBeVisible({ timeout: 5000 });

    // 4. Seleccionar insumo por selector
    await dialogCompraRapida
      .locator('#compra-rapida-insumo')
      .selectOption(insumoCafe!.id.toString());

    // 5. Completar cantidad, costo total, medio de pago y nota
    await dialogCompraRapida.locator('#compra-rapida-cantidad').fill('10');
    await dialogCompraRapida.locator('#compra-rapida-costo').fill('400');

    // Verificar cálculo en vivo de costo unitario: 400 / 10 = S/ 40.00
    await expect(dialogCompraRapida.getByText(/40\.00/)).toBeVisible();

    await dialogCompraRapida.locator('#compra-rapida-mediopago').selectOption('Efectivo');
    await dialogCompraRapida
      .locator('#compra-rapida-nota')
      .fill('Compra de urgencia en mercado central');

    // 6. Registrar y confirmar mediante diálogo Sí/No
    await dialogCompraRapida
      .getByRole('button', { name: 'Registrar compra', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: /¿Confirmar compra rápida\?/i })).toBeVisible({
      timeout: 5000,
    });
    await confirmarSiNo(page, 'si');

    // 7. Notificación de éxito
    await expect(
      page.getByText(/Compra rápida registrada exitosamente/i),
    ).toBeVisible({ timeout: 8000 });

    // 8. Verificaciones en Base de Datos
    // Stock en Almacén central aumentó exactamente en 10
    const stockFinal = Number(await obtenerStockInsumo('Café en grano', 'Almacén central'));
    expect(stockFinal).toBe(stockInicial + 10);

    // Costo unitario del insumo actualizado
    const insumoActualizado = await prisma.insumo.findUnique({
      where: { id: insumoCafe!.id },
    });
    expect(Number(insumoActualizado!.costo_unit)).toBe(40.0);

    // Registro de compra creado con proveedor genérico y pagada
    const compraRapidaDb = await prisma.compra.findFirst({
      where: { comprobante_tipo: 'COMPRA_RAPIDA' },
      orderBy: { id: 'desc' },
      include: { lineas: true },
    });
    expect(compraRapidaDb).not.toBeNull();
    expect(Number(compraRapidaDb!.total)).toBe(400);
    expect(compraRapidaDb!.pagada_en).not.toBeNull();
    expect(compraRapidaDb!.lineas).toHaveLength(1);
    expect(Number(compraRapidaDb!.lineas[0].cantidad_compra)).toBe(10);
    expect(Number(compraRapidaDb!.lineas[0].costo_unit)).toBe(40.0);

    // Movimiento de stock ENTRADA creado
    const movStock = await prisma.movimientoStock.findFirst({
      where: { compra_id: compraRapidaDb!.id },
    });
    expect(movStock).not.toBeNull();
    expect(movStock!.tipo).toBe('ENTRADA');
    expect(Number(movStock!.cantidad)).toBe(10);
  });

  test('(2) Insumo bajo mínimo activa aviso en Escritorio y pestaña Por pedir con WhatsApp', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();
    const prov = await asegurarProveedorPrueba(prisma);

    // 1. Configurar insumo Harina de trigo con stock bajo (2 KG < 5 KG mínimo) y proveedor habitual prov.partyId
    const insumoHarina = await prisma.insumo.findFirst({
      where: { nombre: 'Harina de trigo' },
    });
    expect(insumoHarina).not.toBeNull();

    await prisma.insumo.update({
      where: { id: insumoHarina!.id },
      data: {
        minimo: new Prisma.Decimal(5),
        proveedor_a: prov.partyId,
      },
    });

    // Poner stock total en 2 KG (menor al mínimo de 5)
    await prisma.stock.updateMany({
      where: { insumo_id: insumoHarina!.id },
      data: { cantidad: new Prisma.Decimal(1) },
    });

    // 2. Iniciar sesión como ADMIN y verificar aviso en Escritorio
    await loginPorUi(page, 'ADMIN');
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    // 3. Tarjeta/aviso de insumos con stock bajo visible en el contenido de Escritorio
    const seccionStockBajo = page.locator('main').getByText(/insumos? con stock bajo/i).first();
    await expect(seccionStockBajo).toBeVisible({ timeout: 8000 });
    const btnPedir = page.locator('main').getByRole('button', { name: /Pedir al proveedor|Ver insumos por pedir/i }).first();
    await expect(btnPedir).toBeVisible();

    // 4. Click en el aviso redirige a Compras > Por pedir
    await btnPedir.click();
    await expect(page).toHaveURL(/\/admin\/compras\?tab=pedir/);

    // 5. Verificar que la pestaña "Por pedir" muestra Harina de trigo y los datos de stock
    await expect(page.getByText('Harina de trigo')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('2 KG')).toBeVisible();
    await expect(page.getByText('5 KG')).toBeVisible();

    // 6. El botón para pedir al proveedor por WhatsApp está presente
    const btnWhatsApp = page.getByRole('link', { name: /Pedir al proveedor \(WhatsApp\)/i });
    await expect(btnWhatsApp).toBeVisible();
    const href = await btnWhatsApp.getAttribute('href');
    expect(href).toContain('wa.me');
  });

  test('(3) Recibir pedido de proveedor por UI da entrada a stock, registra costo y comprobante', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();
    const prov = await asegurarProveedorPrueba(prisma);

    const insumoHarina = await prisma.insumo.findFirst({
      where: { nombre: 'Harina de trigo' },
    });
    expect(insumoHarina).not.toBeNull();

    const stockHarinaPrevio = Number(
      await obtenerStockInsumo('Harina de trigo', 'Almacén central'),
    );

    // 1. Crear un PedidoProveedor en estado POR_RECIBIR
    const pedidoProveedor = await prisma.pedidoProveedor.create({
      data: {
        proveedor_party_id: prov.partyId,
        estado: 'POR_RECIBIR',
        enviado_en: new Date(),
        lineas: {
          create: {
            insumo_id: insumoHarina!.id,
            cantidad_compra: new Prisma.Decimal(12),
            recibido: new Prisma.Decimal(0),
          },
        },
      },
    });

    // 2. Iniciar sesión como ALMACEN y navegar a Compras
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/compras', { waitUntil: 'domcontentloaded' });

    // Asegurarse de estar en la pestaña Compras del módulo principal
    const pestanaCompras = page.getByRole('main').getByRole('button', { name: 'Compras', exact: true });
    if (await pestanaCompras.isVisible()) {
      await pestanaCompras.click();
    }

    // 3. Buscar la tarjeta del pedido por recibir y abrirla
    const tarjetaPedido = page.getByText(new RegExp(`PED-${pedidoProveedor.id}`));
    await expect(tarjetaPedido).toBeVisible({ timeout: 8000 });
    await tarjetaPedido.click();

    // 4. Modal de detalle con panel de recepción
    const dialogDetalle = page.getByRole('dialog', { name: 'Detalle de compra' });
    await expect(dialogDetalle).toBeVisible({ timeout: 5000 });
    await expect(dialogDetalle.getByText('Recepción del pedido de proveedor')).toBeVisible();

    // 5. Completar comprobante
    const inputNumeroComp = dialogDetalle.getByPlaceholder('Ej. F001-00042');
    await inputNumeroComp.fill(`FAC-${Date.now().toString().slice(-6)}`);

    const btnRecibir = dialogDetalle.getByRole('button', {
      name: /Recibir pedido y dar entrada/i,
    });
    await expect(btnRecibir).toBeVisible();
    await btnRecibir.click();

    // 6. Confirmar con diálogo Sí/No
    await expect(
      page.getByRole('heading', { name: /¿Confirmar recepción del pedido\?/i }),
    ).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // 7. Notificación de éxito
    await expect(
      page.getByText(/Compra registrada exitosamente|Compra actualizada exitosamente/i),
    ).toBeVisible({ timeout: 8000 });

    // 8. Verificaciones en Base de Datos
    // Stock en Almacén central aumentó en 12 KG
    const stockHarinaFinal = Number(
      await obtenerStockInsumo('Harina de trigo', 'Almacén central'),
    );
    expect(stockHarinaFinal).toBe(stockHarinaPrevio + 12);

    // Estado del pedido actualizado a RECIBIDO
    const pedidoActualizado = await prisma.pedidoProveedor.findUnique({
      where: { id: pedidoProveedor.id },
    });
    expect(pedidoActualizado!.estado).toBe('RECIBIDO');

    // Compra generada asociada al pedido del proveedor
    const compraGenerada = await prisma.compra.findFirst({
      where: { pedido_proveedor_id: pedidoProveedor.id },
    });
    expect(compraGenerada).not.toBeNull();
    expect(compraGenerada!.proveedor_party_id).toBe(prov.partyId);

    // Movimiento ENTRADA asociado a la compra
    const movEntrada = await prisma.movimientoStock.findFirst({
      where: { compra_id: compraGenerada!.id },
    });
    expect(movEntrada).not.toBeNull();
    expect(movEntrada!.tipo).toBe('ENTRADA');
    expect(Number(movEntrada!.cantidad)).toBe(12);
  });

  test('(4) Producción del día "Hoy preparé..." por UI descuenta de Cocina y da alta a producto terminado', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();

    // 1. Verificar insumo y producto con receta de producción
    const prodTorta = await prisma.producto.findFirst({
      where: { nombre: 'Torta de Chocolate' },
    });
    const insumoHarina = await prisma.insumo.findFirst({
      where: { nombre: 'Harina de trigo' },
    });
    const lugarCocina = await prisma.lugarStock.findFirst({
      where: { nombre: 'Cocina' },
    });

    expect(prodTorta).not.toBeNull();
    expect(insumoHarina).not.toBeNull();
    expect(lugarCocina).not.toBeNull();

    // Asegurar stock suficiente de Harina en Cocina (mínimo 10 KG)
    await prisma.stock.upsert({
      where: { id: 4 },
      update: { cantidad: new Prisma.Decimal(15) },
      create: {
        insumo_id: insumoHarina!.id,
        lugar_id: lugarCocina!.id,
        cantidad: new Prisma.Decimal(15),
      },
    });

    const stockInsumoCocinaPrevio = Number(
      await obtenerStockInsumo('Harina de trigo', 'Cocina'),
    );
    const stockProdCocinaPrevio = Number(
      await obtenerStockProducto('Torta de Chocolate', 'Cocina'),
    );

    // 2. Iniciar sesión como ALMACEN y navegar a Almacén
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });

    // 3. Abrir modal "Hoy preparé..."
    const btnHoyPrepare = page.getByRole('button', { name: /Hoy preparé\.\.\./i });
    await expect(btnHoyPrepare).toBeVisible({ timeout: 8000 });
    await btnHoyPrepare.click();

    const dialogProduccion = page.getByRole('dialog', {
      name: /Hoy preparé/i,
    });
    await expect(dialogProduccion).toBeVisible({ timeout: 5000 });

    // 4. Verificar mensaje claro: "Se descuenta de: Cocina"
    await expect(dialogProduccion.getByText('Se descuenta de: Cocina')).toBeVisible();

    // 5. Seleccionar "Torta de Chocolate"
    await dialogProduccion.getByRole('button', { name: /Torta de Chocolate/i }).click();

    // 6. Escribir unidades preparadas: 20 porciones (rinde 10 por tanda -> consume 2 kg)
    const inputUnidades = dialogProduccion.locator('input[type="number"]');
    await inputUnidades.fill('20');

    // 7. Verificar cálculo en vivo de insumos a gastar
    await expect(
      dialogProduccion.getByText(/Se gastará de cocina:/i),
    ).toBeVisible({ timeout: 5000 });

    // 8. Registrar producción y confirmar mediante diálogo Sí/No
    await dialogProduccion.getByRole('button', { name: 'Registrar producción' }).click();
    await expect(
      page.getByRole('heading', { name: /¿Confirmar producción del día\?/i }),
    ).toBeVisible({ timeout: 5000 });
    await confirmarSiNo(page, 'si');

    // 9. Notificación de éxito
    await expect(
      page.getByText(/Producción del día registrada|Producción registrada/i),
    ).toBeVisible({ timeout: 8000 });

    // 10. Verificaciones en Base de Datos
    // Stock de Torta de Chocolate en Cocina aumentó en 20
    const stockProdCocinaFinal = Number(
      await obtenerStockProducto('Torta de Chocolate', 'Cocina'),
    );
    expect(stockProdCocinaFinal).toBe(stockProdCocinaPrevio + 20);

    // Stock de Harina en Cocina disminuyó en 2 KG
    const stockInsumoCocinaFinal = Number(
      await obtenerStockInsumo('Harina de trigo', 'Cocina'),
    );
    expect(stockInsumoCocinaFinal).toBe(stockInsumoCocinaPrevio - 2);

    // Registro de producción creado
    const prodDb = await prisma.produccion.findFirst({
      where: { receta: { producto_id: prodTorta!.id } },
      orderBy: { id: 'desc' },
    });
    expect(prodDb).not.toBeNull();
    expect(Number(prodDb!.unidades)).toBe(20);
    expect(prodDb!.anulado_en).toBeNull();

    // Movimientos de stock en BD:
    // PRODUCCION_ALTA (+20 en Cocina)
    const movAlta = await prisma.movimientoStock.findFirst({
      where: {
        tipo: 'PRODUCCION_ALTA',
        producto_id: prodTorta!.id,
        lugar_id: lugarCocina!.id,
      },
      orderBy: { id: 'desc' },
    });
    expect(movAlta).not.toBeNull();
    expect(Number(movAlta!.cantidad)).toBe(20);

    // PRODUCCION_CONSUMO (-2 en Cocina)
    const movConsumo = await prisma.movimientoStock.findFirst({
      where: {
        tipo: 'PRODUCCION_CONSUMO',
        insumo_id: insumoHarina!.id,
        lugar_id: lugarCocina!.id,
      },
      orderBy: { id: 'desc' },
    });
    expect(movConsumo).not.toBeNull();
    expect(Number(movConsumo!.cantidad)).toBe(-2);
  });
});
