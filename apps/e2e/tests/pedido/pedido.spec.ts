import { test, expect } from '@playwright/test';
import {
  loginPorUi,
  loginPorApi,
  confirmarSiNo,
  obtenerStockInsumo,
  obtenerEstadoPedido,
  obtenerPedidoConDetalle,
  asegurarCajaAbierta,
  obtenerPrismaTest,
  PUERTO_API,
} from '../../src';

test.describe('Suite E2E - Flujo Completo de Pedidos Caprichos', () => {
  const apiBaseUrl = `http://127.0.0.1:${PUERTO_API}`;

  test('(1) Cliente en carta pública agrega productos, aplica promoción 2x1 y crea pedidos (retiro y delivery) verificando en BD', async ({
    page,
  }) => {
    // 1. Cargar la carta pública
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    // 2. Localizar Café Americano en la carta
    const botonPedirCafe = page.getByRole('button', { name: /Pedir Café Americano|Agregar/i }).first();
    await expect(botonPedirCafe).toBeVisible({ timeout: 10000 });
    await botonPedirCafe.click();

    // 3. Modal de detalle del producto: aumentar cantidad a 2 para aplicar la promoción 2x1
    const modalProducto = page.getByRole('dialog', { name: /Detalles de Café Americano/i });
    await expect(modalProducto).toBeVisible();

    const botonMas = modalProducto.getByRole('button', { name: 'Más' });
    await botonMas.click();

    const botonAgregar = modalProducto.getByRole('button', { name: /Agregar al pedido/i });
    await botonAgregar.click();
    await expect(modalProducto).toBeHidden({ timeout: 5000 });

    // 4. Abrir el cajón del carrito
    const botonAbrirCarrito = page.getByRole('button', { name: /Abrir el carrito/i });
    await botonAbrirCarrito.click();

    const cajonCarrito = page.getByRole('dialog', { name: 'Carrito de compras' });
    await expect(cajonCarrito).toBeVisible();

    // El subtotal de 2 cafés a S/ 10.00 c/u es S/ 20.00
    await expect(cajonCarrito.getByRole('button', { name: /Continuar · S\/ 20\.00/i })).toBeVisible();

    // 5. Continuar al checkout
    const botonContinuar = cajonCarrito.getByRole('button', { name: /Continuar · S\/ 20\.00/i });
    await botonContinuar.click();

    const modalCheckout = page.getByRole('dialog', { name: 'Tus datos y el pago' });
    await expect(modalCheckout).toBeVisible();

    // --- Pedido 1: Modalidad Retiro / Recoger en el local ---
    const botonRecoger = modalCheckout.getByRole('button', { name: 'Recoger en el local' });
    await botonRecoger.click();

    // Si aparece opción de invitado, seleccionarla
    const botonInvitado = modalCheckout.getByRole('button', { name: 'Continuar como invitado' });
    if (await botonInvitado.isVisible()) {
      await botonInvitado.click();
    }

    // Llenar datos de contacto
    await modalCheckout.getByLabel(/Nombre completo/i).fill('Cliente Retiro');
    await modalCheckout.getByLabel(/Teléfono celular/i).fill('912345678');

    // Avanzar a paso 2 (Ubicación)
    await modalCheckout.getByRole('button', { name: 'Continuar', exact: true }).click();

    // En modalidad Recoger, paso 2 muestra información del local
    await expect(modalCheckout.getByText(/Recoges en Caprichos/i)).toBeVisible();

    // Avanzar a paso 3 (Pago)
    await modalCheckout.getByRole('button', { name: 'Continuar', exact: true }).click();

    // En paso 3 se observa la promoción automática 2x1 aplicada (-S/ 10.00) y total S/ 10.00
    await expect(modalCheckout.getByText(/2x1 Café Americano|-S\/ 10\.00/i)).toBeVisible({ timeout: 8000 });
    await expect(modalCheckout.getByText(/Total.*S\/ 10\.00|S\/ 10\.00/i).last()).toBeVisible();

    // Elegir medio de pago Efectivo
    await modalCheckout.getByRole('button', { name: 'Efectivo' }).click();

    // Enviar el pedido
    const botonEnviar = modalCheckout.getByRole('button', { name: /Enviar pedido/i });
    await botonEnviar.click();

    // 6. Pantalla de confirmación con código de pedido
    const dialogConfirmacion = page.getByRole('dialog', { name: 'Confirmación del pedido' });
    await expect(dialogConfirmacion).toBeVisible({ timeout: 15000 });
    const elementoCodigo = dialogConfirmacion.getByText(/Recibimos tu pedido #/);
    await expect(elementoCodigo).toBeVisible();
    const textoCodigo = (await elementoCodigo.textContent()) || '';
    const matchRetiro = textoCodigo.match(/CP-W\d+/);
    expect(matchRetiro).not.toBeNull();
    const codigoRetiro = matchRetiro![0];

    // 7. Verificar en base de datos el pedido de retiro
    const pedidoRetiroDb = await obtenerPedidoConDetalle(codigoRetiro);
    expect(pedidoRetiroDb).not.toBeNull();
    expect(pedidoRetiroDb?.modalidad).toBe('RECOGER');
    expect(Number(pedidoRetiroDb?.subtotal)).toBe(20);
    expect(Number(pedidoRetiroDb?.descuento)).toBe(10);
    expect(Number(pedidoRetiroDb?.total)).toBe(10);
    expect(pedidoRetiroDb?.lineas.length).toBeGreaterThanOrEqual(1);

    // Suma total de unidades en las líneas debe ser 2
    const cantidadTotalRetiro = pedidoRetiroDb?.lineas.reduce((acc, l) => acc + l.cantidad, 0);
    expect(cantidadTotalRetiro).toBe(2);

    // --- Pedido 2: Modalidad Delivery con dirección escrita ---
    // Volver a la carta para crear pedido delivery
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('CAPRICHOS').first()).toBeVisible();

    // Agregar 2 Café Americano de nuevo
    await page.getByRole('button', { name: /Pedir Café Americano|Agregar/i }).first().click();
    const modalProducto2 = page.getByRole('dialog', { name: /Detalles de Café Americano/i });
    await expect(modalProducto2).toBeVisible();
    await modalProducto2.getByRole('button', { name: 'Más' }).click();
    await modalProducto2.getByRole('button', { name: /Agregar al pedido/i }).click();

    // Abrir carrito y pasar al checkout
    await page.getByRole('button', { name: /Abrir el carrito/i }).click();
    const cajon2 = page.getByRole('dialog', { name: 'Carrito de compras' });
    await expect(cajon2).toBeVisible();
    await cajon2.getByRole('button', { name: /Continuar · S\/ 20\.00/i }).click();

    const checkout2 = page.getByRole('dialog', { name: 'Tus datos y el pago' });
    await expect(checkout2).toBeVisible();

    // Seleccionar modalidad Delivery
    await checkout2.getByRole('button', { name: 'Delivery' }).click();

    const botonInvitado2 = checkout2.getByRole('button', { name: 'Continuar como invitado' });
    if (await botonInvitado2.isVisible()) {
      await botonInvitado2.click();
    }

    await checkout2.getByLabel(/Nombre completo/i).fill('Cliente Delivery');
    await checkout2.getByLabel(/Teléfono celular/i).fill('998877665');

    // Avanzar a paso 2 (Ubicación de Delivery)
    await checkout2.getByRole('button', { name: 'Continuar', exact: true }).click();

    // Llenar dirección escrita de al menos 5 caracteres
    const inputDireccion = checkout2.locator('#f-direccion');
    await inputDireccion.fill('Av. Los Fresnos 789, La Molina');

    // Avanzar a paso 3 (Pago)
    await checkout2.getByRole('button', { name: 'Continuar', exact: true }).click();

    // Verificar descuento 2x1 también en delivery
    await expect(checkout2.getByText(/2x1 Café Americano|-S\/ 10\.00/i)).toBeVisible({ timeout: 8000 });

    // Elegir medio de pago Yape
    await checkout2.getByRole('button', { name: 'Yape' }).click();

    // Enviar pedido delivery
    await checkout2.getByRole('button', { name: /Enviar pedido/i }).click();

    // Confirmación y código de pedido delivery
    const dialogConfirmacion2 = page.getByRole('dialog', { name: 'Confirmación del pedido' });
    await expect(dialogConfirmacion2).toBeVisible({ timeout: 15000 });
    const elementoCodigo2 = dialogConfirmacion2.getByText(/Recibimos tu pedido #/);
    await expect(elementoCodigo2).toBeVisible();
    const textoCodigo2 = (await elementoCodigo2.textContent()) || '';
    const matchDelivery = textoCodigo2.match(/CP-W\d+/);
    expect(matchDelivery).not.toBeNull();
    const codigoDelivery = matchDelivery![0];

    // Verificar en BD el pedido de delivery
    const pedidoDeliveryDb = await obtenerPedidoConDetalle(codigoDelivery);
    expect(pedidoDeliveryDb).not.toBeNull();
    expect(pedidoDeliveryDb?.modalidad).toBe('DELIVERY');
    expect(pedidoDeliveryDb?.entrega_direccion).toBe('Av. Los Fresnos 789, La Molina');
    expect(Number(pedidoDeliveryDb?.subtotal)).toBe(20);
    expect(Number(pedidoDeliveryDb?.descuento)).toBe(10);
    expect(Number(pedidoDeliveryDb?.total)).toBe(10);
  });

  test('(2) Administrador/cajero crea pedido desde el panel admin, lo cobra con efectivo y otro medio, y verifica en BD', async ({
    page,
  }) => {
    // 1. Asegurar caja abierta para el día de hoy
    await asegurarCajaAbierta(100);

    // 2. Iniciar sesión por UI con rol ADMIN (cuenta con permisos de salón/mesas y caja)
    await loginPorUi(page, 'ADMIN');
    await page.goto('/admin/caja');

    // 3. Abrir modal de Nuevo Pedido desde Pedidos y caja
    const botonNuevo = page.getByRole('button', { name: 'Nuevo pedido' });
    await expect(botonNuevo).toBeVisible({ timeout: 10000 });
    await botonNuevo.click();

    const modalNuevo = page.getByRole('dialog', { name: 'Nuevo pedido de mesa' });
    await expect(modalNuevo).toBeVisible();

    // Seleccionar "¿Qué vas a hacer? -> En el local"
    await modalNuevo.getByRole('button', { name: /En el local/i }).click();

    // Seleccionar Mesa libre (Mesa 1)
    const botonMesa1 = modalNuevo.getByRole('button', { name: /Mesa 1/i }).first();
    await expect(botonMesa1).toBeVisible({ timeout: 5000 });
    await botonMesa1.click();

    // Seleccionar producto Café Americano en la carta interna
    await modalNuevo.getByRole('button', { name: /Café Americano/i }).first().click();

    // Ventana de opciones del producto (si requiere nombre de bebida)
    const ventanaOpciones = page.getByRole('dialog', { name: 'Opciones del producto' });
    if (await ventanaOpciones.isVisible({ timeout: 3000 })) {
      const inputNombreBebida = ventanaOpciones.locator('#nombre-bebida-0');
      if (await inputNombreBebida.isVisible()) {
        await inputNombreBebida.fill('Carlos');
      }
      await ventanaOpciones.getByRole('button', { name: /Agregar al pedido/i }).click();
      await expect(ventanaOpciones).toBeHidden({ timeout: 5000 });
    }

    // Registrar pedido ("Enviar directo a cocina")
    const botonRegistrar = modalNuevo.getByRole('button', { name: /Enviar directo a cocina/i });
    await expect(botonRegistrar).toBeVisible();
    await botonRegistrar.click();

    // Diálogo Sí/No de confirmación ("Sí, enviar comanda")
    await confirmarSiNo(page, 'si');
    await expect(modalNuevo).toBeHidden({ timeout: 5000 });

    // 4. Cambiar a la pestaña "En curso" y seleccionar el pedido creado
    const tabEnCurso = page.getByRole('tab', { name: /En curso/i });
    await tabEnCurso.click();

    const tarjetaMesa1 = page.locator('button').filter({ hasText: 'Mesa 1' }).first();
    await expect(tarjetaMesa1).toBeVisible({ timeout: 10000 });
    await tarjetaMesa1.click();

    // 5. En el detalle del pedido, hacer clic en "Registrar cobro"
    const botonCobrar = page.getByRole('button', { name: 'Registrar cobro' });
    await expect(botonCobrar).toBeVisible({ timeout: 5000 });
    await botonCobrar.click();

    // Modal de cobro mixto (efectivo y otro medio)
    const modalCobro = page.getByRole('dialog', { name: /Cobrar el pedido|Registrar cobro/i });
    await expect(modalCobro).toBeVisible();

    // Fila 1: Efectivo por S/ 6.00
    const inputMonto1 = modalCobro.locator('#pago-monto-0');
    await inputMonto1.fill('6.00');

    // Agregar segundo medio de pago (Yape por S/ 4.00)
    await modalCobro.getByRole('button', { name: /\+ Pagar parte con otro medio|Agregar otro medio/i }).click();
    await expect(modalCobro.getByText(/Cuadra con el total/i)).toBeVisible();

    // Confirmar cobro
    await modalCobro.getByRole('button', { name: 'Registrar cobro' }).click();

    // Diálogo de confirmación del cobro ("Cobrar")
    await confirmarSiNo(page, 'si');
    await expect(modalCobro).toBeHidden({ timeout: 5000 });

    // 6. Verificar en base de datos
    const prisma = obtenerPrismaTest();
    const pedidoDb = await prisma.pedido.findFirst({
      where: {
        modalidad: 'MESA',
      },
      orderBy: { creado_en: 'desc' },
      include: {
        cobros: {
          include: { pagos: true },
        },
      },
    });

    expect(pedidoDb).not.toBeNull();
    expect(pedidoDb?.pago_estado).toBe('PAGADO');
    expect(pedidoDb?.cobros.length).toBeGreaterThanOrEqual(1);

    const cobro = pedidoDb!.cobros[0];
    expect(Number(cobro.total)).toBe(10);
    expect(cobro.pagos.length).toBe(2);

    const mediosNombres = cobro.pagos.map((m) => m.medio);
    expect(mediosNombres).toContain('EFECTIVO');
    expect(mediosNombres).toContain('YAPE');

    const montoEfectivo = cobro.pagos.find((m) => m.medio === 'EFECTIVO')?.monto;
    const montoYape = cobro.pagos.find((m) => m.medio === 'YAPE')?.monto;
    expect(Number(montoEfectivo)).toBe(6);
    expect(Number(montoYape)).toBe(4);
  });

  test('(3) Cocina visualiza comandas en orden FIFO estricto y pasa pedido a listo tras despejar', async ({
    page,
  }) => {
    // 1. Crear dos pedidos consecutivos con diferente hora de llegada mediante la API
    const authAdmin = await loginPorApi('ADMIN');
    const prisma = obtenerPrismaTest();

    const productoCafe = await prisma.producto.findFirst({
      where: { nombre: 'Café Americano' },
    });
    expect(productoCafe).not.toBeNull();

    // Pedido Primero (T1)
    const resPedido1 = await fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `fifo-1-${Date.now()}`,
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        cliente: { nombre: 'Cliente FIFO Primero', telefono: '911111111' },
        modalidad: 'RECOGER',
        lineas: [{ productoId: productoCafe!.id.toString(), cantidad: 1 }],
        pago: { metodo: 'EFECTIVO' },
      }),
    });
    expect(resPedido1.ok).toBe(true);
    const dataPedido1 = await resPedido1.json();

    // Pequeña pausa de 1 segundo para garantizar orden temporal estricto en timestamp
    await new Promise((r) => setTimeout(r, 1100));

    // Pedido Segundo (T2)
    const resPedido2 = await fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `fifo-2-${Date.now()}`,
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        cliente: { nombre: 'Cliente FIFO Segundo', telefono: '922222222' },
        modalidad: 'RECOGER',
        lineas: [{ productoId: productoCafe!.id.toString(), cantidad: 1 }],
        pago: { metodo: 'EFECTIVO' },
      }),
    });
    expect(resPedido2.ok).toBe(true);
    const dataPedido2 = await resPedido2.json();

    // 2. Iniciar sesión con rol COCINA y navegar a /admin/cocina
    await loginPorUi(page, 'COCINA');
    await page.goto('/admin/cocina');

    // 3. Verificar que las tarjetas se listen en orden FIFO (el que llegó primero aparece antes)
    const tarjetasComandas = page.locator('[data-testid^="comanda-"]');
    await expect(tarjetasComandas.first()).toBeVisible({ timeout: 10000 });

    const tarjeta1 = page.locator(`[data-testid="comanda-${dataPedido1.codigo}"]`);
    const tarjeta2 = page.locator(`[data-testid="comanda-${dataPedido2.codigo}"]`);
    await expect(tarjeta1).toBeVisible();
    await expect(tarjeta2).toBeVisible();

    // Validar orden visual en el DOM: tarjeta1 debe preceder a tarjeta2
    const todasLasComandas = await tarjetasComandas.all();
    const indice1 = (await Promise.all(todasLasComandas.map((t) => t.getAttribute('data-testid')))).indexOf(
      `comanda-${dataPedido1.codigo}`,
    );
    const indice2 = (await Promise.all(todasLasComandas.map((t) => t.getAttribute('data-testid')))).indexOf(
      `comanda-${dataPedido2.codigo}`,
    );
    expect(indice1).toBeLessThan(indice2);

    // 4. Despejar la comanda del Pedido 1
    const botonDespejar1 = tarjeta1.getByRole('button', { name: 'Despejar' });
    await botonDespejar1.click();

    // Confirmar en el diálogo modal Sí/No
    await confirmarSiNo(page, 'si');

    // 5. Verificar en base de datos que el Pedido 1 pasó a LISTO y el Pedido 2 sigue en COLA
    await expect(async () => {
      const estado1 = await obtenerEstadoPedido(dataPedido1.codigo);
      expect(estado1).toBe('LISTO');
    }).toPass({ timeout: 8000 });

    const estado2 = await obtenerEstadoPedido(dataPedido2.codigo);
    expect(estado2).toBe('COLA');
  });

  test('(4) El stock del insumo con receta baja exactamente lo esperado al cobrar', async () => {
    // 1. Asegurar caja abierta
    await asegurarCajaAbierta(100);

    // 2. Consultar stock inicial de "Café en grano"
    const stockInicial = await obtenerStockInsumo('Café en grano');
    expect(stockInicial).not.toBeNull();
    const inicialNum = Number(stockInicial);

    // 3. Crear pedido con 2 Café Americano por API
    // Receta: 18 g de café por unidad -> 2 unidades = 36 g = 0.036 kg
    const authAdmin = await loginPorApi('ADMIN');
    const prisma = obtenerPrismaTest();

    const productoCafe = await prisma.producto.findFirst({
      where: { nombre: 'Café Americano' },
    });

    const resPedido = await fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `stk-${Date.now()}`,
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        cliente: { nombre: 'Prueba Stock', telefono: '987654321' },
        modalidad: 'RECOGER',
        lineas: [{ productoId: productoCafe!.id.toString(), cantidad: 2 }],
        pago: { metodo: 'EFECTIVO' },
      }),
    });
    expect(resPedido.ok).toBe(true);
    const pedidoCreado = await resPedido.json();

    // 4. Antes de cobrar, el stock de insumos NO debe haberse descontado todavía
    const stockAntesCobro = await obtenerStockInsumo('Café en grano');
    expect(Number(stockAntesCobro)).toBe(inicialNum);

    // 5. Realizar el cobro del pedido
    const resCobro = await fetch(`${apiBaseUrl}/admin/caja/cobrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        pedidoId: pedidoCreado.id,
        pagos: [{ medio: 'EFECTIVO', monto: pedidoCreado.total }],
      }),
    });
    expect(resCobro.ok).toBe(true);

    // 6. Verificar que el stock de "Café en grano" bajó exactamente 0.036 kg
    const stockDespuesCobro = await obtenerStockInsumo('Café en grano');
    expect(stockDespuesCobro).not.toBeNull();

    const esperado = Number((inicialNum - 0.036).toFixed(3));
    expect(Number(Number(stockDespuesCobro).toFixed(3))).toBe(esperado);

    // 7. Verificar el movimiento de stock en BD
    const movimiento = await prisma.movimientoStock.findFirst({
      where: {
        pedido_id: BigInt(pedidoCreado.id),
        tipo: 'VENTA',
      },
    });
    expect(movimiento).not.toBeNull();
    expect(Number(movimiento?.cantidad)).toBe(0.036);
  });

  test('(5) Casos negativos: producto agotado en carta y rechazo en API, local cerrado para pedidos, y cobro duplicado rechazado', async ({
    page,
  }) => {
    const prisma = obtenerPrismaTest();
    const authAdmin = await loginPorApi('ADMIN');

    // --- Caso 5.1: Producto agotado ---
    // Marcar "Capuccino" como agotado en BD
    await prisma.producto.update({
      where: { nombre: 'Capuccino' },
      data: { agotado_hasta: new Date(Date.now() + 2 * 3600 * 1000) },
    });

    // En la carta pública el botón de Capuccino debe mostrarse como "Agotado" y estar deshabilitado
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const botonCapuccino = page.getByRole('button', { name: /Capuccino agotado/i });
    await expect(botonCapuccino).toBeVisible({ timeout: 10000 });
    await expect(botonCapuccino).toBeDisabled();

    // Al intentar enviar un pedido con Capuccino por API debe ser rechazado con 409 PRODUCTO_AGOTADO
    const prodCapuccino = await prisma.producto.findFirst({ where: { nombre: 'Capuccino' } });
    const resAgotado = await fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `neg-agotado-${Date.now()}`,
      },
      body: JSON.stringify({
        cliente: { nombre: 'Cliente Negativo', telefono: '911111111' },
        modalidad: 'RECOGER',
        lineas: [{ productoId: prodCapuccino!.id.toString(), cantidad: 1 }],
        pago: { metodo: 'EFECTIVO' },
      }),
    });
    expect(resAgotado.status).toBe(409);
    const errorAgotado = await resAgotado.json();
    expect(errorAgotado.codigo).toBe('PRODUCTO_AGOTADO');

    // Restaurar Capuccino
    await prisma.producto.update({
      where: { nombre: 'Capuccino' },
      data: { agotado_hasta: null },
    });

    // --- Caso 5.2: Local cerrado para pedidos simulado por pausa ---
    await prisma.parametro.upsert({
      where: { clave: 'pausa_alta_demanda' },
      update: { valor: { activa: true, motivo: 'Local cerrado temporalmente' } },
      create: { clave: 'pausa_alta_demanda', valor: { activa: true, motivo: 'Local cerrado temporalmente' } },
    });

    // En la carta se muestra el aviso de local cerrado / pausa
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Pausa por alta demanda|Local cerrado/i).first()).toBeVisible({ timeout: 10000 });

    // Intento de envío de pedido con carta cerrada debe responder 409 CARTA_CERRADA
    const resCerrado = await fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `neg-cerrado-${Date.now()}`,
      },
      body: JSON.stringify({
        cliente: { nombre: 'Cliente Negativo', telefono: '911111111' },
        modalidad: 'RECOGER',
        lineas: [{ productoId: prodCapuccino!.id.toString(), cantidad: 1 }],
        pago: { metodo: 'EFECTIVO' },
      }),
    });
    expect(resCerrado.status).toBe(409);
    const errorCerrado = await resCerrado.json();
    expect(errorCerrado.codigo).toBe('CARTA_CERRADA');

    // Restaurar parámetro de pausa
    await prisma.parametro.update({
      where: { clave: 'pausa_alta_demanda' },
      data: { valor: false },
    });

    // --- Caso 5.3: Cobro duplicado rechazado ---
    await asegurarCajaAbierta(100);

    // Crear un pedido válido para cobrar
    const resPedidoCobro = await fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `neg-cobro-${Date.now()}`,
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        cliente: { nombre: 'Cliente Doble Cobro', telefono: '955555555' },
        modalidad: 'RECOGER',
        lineas: [{ productoId: prodCapuccino!.id.toString(), cantidad: 1 }],
        pago: { metodo: 'EFECTIVO' },
      }),
    });
    expect(resPedidoCobro.ok).toBe(true);
    const pedidoCobro = await resPedidoCobro.json();

    // Primer cobro: debe ser exitoso
    const cobro1 = await fetch(`${apiBaseUrl}/admin/caja/cobrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        pedidoId: pedidoCobro.id,
        pagos: [{ medio: 'EFECTIVO', monto: pedidoCobro.total }],
      }),
    });
    expect(cobro1.ok).toBe(true);

    // Segundo cobro del mismo pedido: debe ser rechazado con 409 YA_COBRADO
    const cobro2 = await fetch(`${apiBaseUrl}/admin/caja/cobrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authAdmin.accessToken}`,
      },
      body: JSON.stringify({
        pedidoId: pedidoCobro.id,
        pagos: [{ medio: 'EFECTIVO', monto: pedidoCobro.total }],
      }),
    });
    expect(cobro2.status).toBe(409);
    const errorDobleCobro = await cobro2.json();
    expect(errorDobleCobro.codigo).toBe('YA_COBRADO');
  });
});
