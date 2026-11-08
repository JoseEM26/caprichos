import { test, expect } from '@playwright/test';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  loginPorUi,
  loginPorApi,
  confirmarSiNo,
  obtenerStockInsumo,
  obtenerPrismaTest,
  PUERTO_API,
} from '../../src';

/**
 * Suite E2E para el módulo de Caja y Cierres (Caprichos).
 * Ranura asignada: E2E_SLOT=2.
 *
 * Escenarios cubiertos:
 * 1. Apertura de caja, cobros mixto (efectivo y Yape), arqueo ciego y cierre que cuadra con verificación en BD.
 * 2. Anulación de un cobro con motivo (sin código de supervisor), conservación del registro, reposición de stock y reversión de pedido.
 * 4. Bloqueo de cierre por pedido entregado sin cobrar y resolución con motivo.
 * 5. Pedido delivery exige repartidor asignado para poder pasar a estado ENTREGADO.
 * 6. Verificación de permisos: CAJERO no puede entrar a almacén ni configuración.
 */

test.describe('Suite E2E - Módulo de Caja y Cierres', () => {
  const apiBaseUrl = `http://127.0.0.1:${PUERTO_API}`;
  const prisma = obtenerPrismaTest();

  // Helper para dejar la base de datos en un estado limpio antes de cada prueba
  async function limpiarBaseDatosCaja() {
    // 1. Eliminar cierres y cobros (TRUNCATE omite el trigger de inmutabilidad tg_cierre_caja_inmutable)
    await prisma.$executeRawUnsafe('TRUNCATE TABLE cierre_medio, cierre_caja CASCADE;');
    await prisma.conteoCierre.deleteMany();
    await prisma.cobroPago.deleteMany();
    await prisma.cobro.deleteMany();
    await prisma.movimientoCaja.deleteMany();
    await prisma.liquidacion.deleteMany();
    await prisma.caja.deleteMany();

    // 2. Eliminar pedidos creados en caja y relaciones dependientes (preservando los pedidos delivery CP-D00*)
    const pedidosCaja = await prisma.pedido.findMany({
      where: { NOT: { codigo: { startsWith: 'CP-D00' } } },
      select: { id: true },
    });
    const idsCaja = pedidosCaja.map((p) => p.id);

    await prisma.comprobante.deleteMany({ where: { pedido_id: { in: idsCaja } } });
    await prisma.pedidoEstadoHistorial.deleteMany({ where: { pedido_id: { in: idsCaja } } });
    await prisma.pedidoMesa.deleteMany({ where: { pedido_id: { in: idsCaja } } });
    await prisma.movimientoStock.deleteMany({ where: { pedido_id: { in: idsCaja } } });
    await prisma.pedidoLineaOpcion.deleteMany();
    await prisma.pedidoLinea.deleteMany({ where: { pedido_id: { in: idsCaja } } });
    await prisma.comandaArea.deleteMany();
    await prisma.pedido.deleteMany({ where: { id: { in: idsCaja } } });

    // Poner pedidos delivery en COBRADO y PAGADO para que no bloqueen los arqueos ni cierres de caja
    await prisma.pedido.updateMany({
      where: { codigo: { startsWith: 'CP-D00' } },
      data: { estado: 'COBRADO', pago_estado: 'PAGADO' },
    });

    // 3. Restaurar stock inicial de Café en grano (20 kg almacén central, 5 kg barra = 25 kg)
    await prisma.stock.updateMany({
      where: { id: 1 },
      data: { cantidad: new Prisma.Decimal(20) },
    });
    await prisma.stock.updateMany({
      where: { id: 2 },
      data: { cantidad: new Prisma.Decimal(5) },
    });
  }

  // Helper para abrir la caja de hoy directamente en base de datos si la prueba lo requiere
  async function abrirCajaHoy(aperturaMonto = 50): Promise<bigint> {
    const ahora = new Date();
    const limaStr = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const fechaDate = new Date(`${limaStr}T00:00:00.000Z`);

    const admin = await prisma.partyIdentifier.findFirst({
      where: { numero: '20000001' },
    });
    const partyId = admin?.party_id || BigInt(1);

    const caja = await prisma.caja.upsert({
      where: { fecha: fechaDate },
      update: {
        apertura: new Prisma.Decimal(aperturaMonto),
        estado: 'ABIERTA',
        cerrada_por: null,
        cerrada_en: null,
      },
      create: {
        fecha: fechaDate,
        apertura: new Prisma.Decimal(aperturaMonto),
        estado: 'ABIERTA',
        abierta_por: partyId,
      },
    });

    return caja.id;
  }

  test.beforeEach(async () => {
    await limpiarBaseDatosCaja();
  });

  test('(1) Apertura de caja, cobros en efectivo y otro medio, arqueo ciego y cierre que cuadra con verificación en BD', async ({
    page,
  }) => {
    // 1. Iniciar sesión como CAJERO e ir al módulo de caja y cierres
    await loginPorUi(page, 'CAJERO');
    await page.goto('/admin/cierre', { waitUntil: 'domcontentloaded' });

    // 2. Verificar que la caja inicial esté cerrada
    await expect(page.getByText('Caja cerrada. Se abre en cero cada mañana.')).toBeVisible({ timeout: 10000 });

    // 3. Abrir la caja con monto de apertura S/ 50.00
    const botonAbrir = page.getByRole('button', { name: 'Abrir caja' });
    await expect(botonAbrir).toBeVisible();
    await botonAbrir.click();

    const modalAbrir = page.getByRole('dialog', { name: 'Abrir caja' });
    await expect(modalAbrir).toBeVisible();

    const inputApertura = modalAbrir.getByLabel(/Monto inicial/i);
    await inputApertura.fill('50.00');

    await modalAbrir.getByRole('button', { name: 'Abrir caja' }).click();

    // Confirmar en el diálogo modal Sí/No
    await confirmarSiNo(page, 'si');

    // 4. Verificar que la caja aparezca abierta y con arqueo ciego activo (sin mostrar esperado al cajero)
    await expect(page.getByText(/Caja abierta · CAJERO/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/apertura s\/ 50\.00/i)).toBeVisible();
    await expect(page.getByText(/Cierre ciego \(acta 03\)/i)).toBeVisible();

    // El cajero NO debe ver la sección de totales esperados del administrador
    await expect(page.getByTestId('seccion-esperado-admin')).toHaveCount(0);

    // 5. Crear dos pedidos pendientes en estado PREPARANDO para que aparezcan en pestaña "En curso":
    // Pedido 1: S/ 20.00 en EFECTIVO
    // Pedido 2: S/ 15.00 en YAPE
    const cajaDb = await prisma.caja.findFirstOrThrow({ where: { estado: 'ABIERTA' } });

    await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-EFEC',
        canal: 'CAJA',
        modalidad: 'MESA',
        estado: 'PREPARANDO',
        cliente_nombre: 'Cliente Efectivo',
        subtotal: new Prisma.Decimal(20.0),
        total: new Prisma.Decimal(20.0),
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
      },
    });

    await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-YAPE',
        canal: 'CAJA',
        modalidad: 'MESA',
        estado: 'PREPARANDO',
        cliente_nombre: 'Cliente Yape',
        subtotal: new Prisma.Decimal(15.0),
        total: new Prisma.Decimal(15.0),
        pago_estado: 'PENDIENTE',
        pago_metodo: 'YAPE',
      },
    });

    // Cobrar Pedido 1 (Efectivo S/ 20.00) a través de la UI
    await page.goto('/admin/caja', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /En curso/i }).click();

    await expect(page.getByText('Cliente Efectivo').first()).toBeVisible({ timeout: 10000 });
    await page.getByText('Cliente Efectivo').first().click();

    const botonCobrar1 = page.getByRole('button', { name: 'Registrar cobro' });
    await expect(botonCobrar1).toBeVisible();
    await botonCobrar1.click();

    const modalCobro1 = page.getByRole('dialog', { name: /Cobrar/i });
    await expect(modalCobro1).toBeVisible();
    await modalCobro1.getByRole('button', { name: 'Registrar cobro' }).click();
    await confirmarSiNo(page, 'si');
    await expect(modalCobro1).toBeHidden({ timeout: 5000 });

    // Cobrar Pedido 2 (Yape S/ 15.00) a través de la UI
    await page.getByRole('tab', { name: /En curso/i }).click();
    await expect(page.getByText('Cliente Yape').first()).toBeVisible({ timeout: 10000 });
    await page.getByText('Cliente Yape').first().click();

    const botonCobrar2 = page.getByRole('button', { name: 'Registrar cobro' });
    await expect(botonCobrar2).toBeVisible();
    await botonCobrar2.click();

    const modalCobro2 = page.getByRole('dialog', { name: /Cobrar/i });
    await expect(modalCobro2).toBeVisible();
    // Cambiar medio de pago a Yape
    await modalCobro2.getByRole('button', { name: 'Yape' }).click();
    await modalCobro2.getByRole('button', { name: 'Registrar cobro' }).click();
    await confirmarSiNo(page, 'si');
    await expect(modalCobro2).toBeHidden({ timeout: 5000 });

    // 6. Volver a Cierre de caja para efectuar arqueo ciego y cierre que cuadra
    await page.goto('/admin/cierre', { waitUntil: 'domcontentloaded' });

    // Verificar que el cajero sigue sin ver los montos esperados
    await expect(page.getByTestId('seccion-esperado-admin')).toHaveCount(0);

    // Iniciar Cierre de caja
    await page.getByRole('button', { name: 'Cerrar caja y cuadrar' }).click();

    const modalCierre = page.getByRole('dialog', { name: 'Cerrar caja y cuadrar' });
    await expect(modalCierre).toBeVisible();

    // Fase 1: Verificar pedidos cobrados y movimientos
    await expect(modalCierre.getByText('CP-E2E-EFEC')).toBeVisible();
    await expect(modalCierre.getByText('CP-E2E-YAPE')).toBeVisible();

    // Avanzar a Fase 2 (Conteo de efectivo y arqueo)
    await modalCierre.getByRole('button', { name: /Ya revisé: continuar al conteo/i }).click();

    // Total efectivo esperado: apertura (50.00) + cobro efectivo (20.00) = 70.00
    // Ingresar conteo de billetes: 1 billete de S/ 50 y 1 billete de S/ 20
    await modalCierre.getByLabel('Cantidad de billetes de S/ 50', { exact: true }).fill('1');
    await modalCierre.getByLabel('Cantidad de billetes de S/ 20', { exact: true }).fill('1');
    await expect(modalCierre.getByText(/Total contado: s\/ 70\.00/i)).toBeVisible();

    // Ingresar monto visto en Yape: S/ 15.00
    await modalCierre.getByLabel('Monto en yape').fill('15.00');

    // Pulsar "Revisar si cuadra" (Arqueo ciego comparado por el servidor)
    await modalCierre.getByRole('button', { name: 'Revisar si cuadra' }).click();

    // Debe mostrar que cuadra sin revelar los montos del sistema
    await expect(modalCierre.getByText('¡Cuadra! Todo en orden.')).toBeVisible({ timeout: 8000 });

    // Proceder al cierre definitivo
    await modalCierre.getByRole('button', { name: 'Cerrar caja' }).click();
    await confirmarSiNo(page, 'si');

    // Comprobar notificación de caja cerrada
    await expect(page.getByText(/Caja cerrada\. El cierre quedó registrado/i)).toBeVisible({ timeout: 10000 });

    // 7. Verificación de montos en Base de Datos
    const cajaFinal = await prisma.caja.findUnique({
      where: { id: cajaDb.id },
      include: {
        cierre: {
          include: {
            medios: true,
          },
        },
      },
    });

    expect(cajaFinal).not.toBeNull();
    expect(cajaFinal?.estado).toBe('CERRADA');
    expect(cajaFinal?.cerrada_en).not.toBeNull();

    const cierre = cajaFinal?.cierre;
    expect(cierre).not.toBeNull();
    expect(cierre?.resultado).toBe('CUADRA');

    // Verificar desglose por medios en cierre_medio
    const medios = cierre?.medios || [];
    const medioEfectivo = medios.find((m) => m.medio === 'EFECTIVO');
    const medioYape = medios.find((m) => m.medio === 'YAPE');

    expect(medioEfectivo).toBeDefined();
    expect(Number(medioEfectivo?.sistema)).toBe(70.0);
    expect(Number(medioEfectivo?.visto)).toBe(70.0);
    expect(Number(medioEfectivo?.diferencia)).toBe(0);

    expect(medioYape).toBeDefined();
    expect(Number(medioYape?.sistema)).toBe(15.0);
    expect(Number(medioYape?.visto)).toBe(15.0);
    expect(Number(medioYape?.diferencia)).toBe(0);
  });

  test('(2) Anulación de un cobro con motivo y sin código, conservación de registro, reposición de stock y reversión del pedido', async () => {
    // 1. Abrir caja del día
    await abrirCajaHoy(100);

    // 2. Medir stock inicial del insumo Café en grano (independiente del estado previo)
    const stockInicial = await obtenerStockInsumo('Café en grano');
    expect(stockInicial).not.toBeNull();
    expect(Number(stockInicial)).toBeGreaterThan(0);

    // 3. Crear pedido con Café Americano (receta: 18 gramos = 0.018 kg de café en grano)
    const prodCafe = await prisma.producto.findFirstOrThrow({
      where: { nombre: 'Café Americano' },
    });

    const pedido = await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-ANUL',
        canal: 'CAJA',
        modalidad: 'LLEVAR',
        estado: 'PREPARANDO',
        cliente_nombre: 'Cliente Anulacion',
        subtotal: new Prisma.Decimal(10.0),
        total: new Prisma.Decimal(10.0),
        pago_estado: 'PENDIENTE',
        lineas: {
          create: [
            {
              producto_id: prodCafe.id,
              nombre: prodCafe.nombre,
              cantidad: 1,
              precio_unit: new Prisma.Decimal(10.0),
              subtotal: new Prisma.Decimal(10.0),
            },
          ],
        },
      },
    });

    // 4. Cobrar el pedido mediante la API oficial de cobros
    const sesionCajero = await loginPorApi('CAJERO');

    const resCobro = await fetch(`${apiBaseUrl}/admin/caja/cobrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCajero.accessToken}`,
      },
      body: JSON.stringify({
        pedidoId: pedido.id.toString(),
        pagos: [{ medio: 'EFECTIVO', monto: 10.0 }],
      }),
    });

    expect(resCobro.ok).toBe(true);
    const dataCobro = await resCobro.json();
    const cobroId = BigInt(dataCobro.cobroId || dataCobro.id);

    // Verificar en BD que el pedido está pagado, el cobro activo y el stock descontado (-0.018 kg)
    const pedidoCobradoDb = await prisma.pedido.findUnique({
      where: { id: pedido.id },
    });
    expect(pedidoCobradoDb?.pago_estado).toBe('PAGADO');

    const stockTrasCobro = await obtenerStockInsumo('Café en grano');
    expect(Number(stockTrasCobro)).toBeCloseTo(Number(stockInicial) - 0.018, 4);

    // 5. Anular el cobro solo con el motivo: ya no hay código de supervisor
    const resConPin = await fetch(`${apiBaseUrl}/admin/caja/cobros/${cobroId}/anular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCajero.accessToken}`,
      },
      body: JSON.stringify({
        motivo: 'Cobro cobrado por duplicado por error del cajero',
      }),
    });

    expect(resConPin.ok).toBe(true);

    // 7. Verificaciones críticas en Base de Datos:
    // a) El cobro anulado se conserva como fila con anulado_en y motivo
    const cobroAnuladoDb = await prisma.cobro.findUnique({
      where: { id: cobroId },
    });
    expect(cobroAnuladoDb).not.toBeNull();
    expect(cobroAnuladoDb?.anulado_en).not.toBeNull();
    expect(cobroAnuladoDb?.motivo_anulacion).toBe('Cobro cobrado por duplicado por error del cajero');

    // b) El stock consumido por la receta se repuso completamente
    const stockTrasAnulacion = await obtenerStockInsumo('Café en grano');
    expect(Number(stockTrasAnulacion)).toBeCloseTo(Number(stockInicial), 4);

    // c) El pedido revierte su estado de pago a PENDIENTE
    const pedidoRevertidoDb = await prisma.pedido.findUnique({
      where: { id: pedido.id },
    });
    expect(pedidoRevertidoDb?.pago_estado).toBe('PENDIENTE');
  });

  test('(4) Cierre bloqueado por pedido entregado sin cobrar y resolución mediante anulación con motivo', async ({
    page,
  }) => {
    // 1. Abrir caja del día
    await abrirCajaHoy(100);

    // 2. Crear pedido entregado sin cobrar (estado: ENTREGADO, pago_estado: PENDIENTE)
    const pedidoPendiente = await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-SIN-COBRO',
        canal: 'CAJA',
        modalidad: 'LLEVAR',
        estado: 'ENTREGADO',
        pago_estado: 'PENDIENTE',
        cliente_nombre: 'Cliente Sin Cobro Cierre',
        subtotal: new Prisma.Decimal(25.0),
        total: new Prisma.Decimal(25.0),
      },
    });

    // 3. El cajero ingresa a Cierre de caja
    await loginPorUi(page, 'CAJERO');
    await page.goto('/admin/cierre', { waitUntil: 'domcontentloaded' });

    // 4. Intentar cerrar caja: abrir modal de cierre
    await page.getByRole('button', { name: 'Cerrar caja y cuadrar' }).click();

    const modalCierre = page.getByRole('dialog', { name: 'Cerrar caja y cuadrar' });
    await expect(modalCierre).toBeVisible();

    // 5. Verificar sección de pedidos sin cobrar que impiden el cierre
    await expect(modalCierre.getByText('Pedidos sin cobrar: impiden cerrar la caja')).toBeVisible();

    // El cajero ve la lista de pendientes directamente, sin ningún código
    // 6. Verificar que aparecen los botones "Cobrar ahora" y "Anular con motivo"
    await expect(modalCierre.getByText('CP-E2E-SIN-COBRO')).toBeVisible({ timeout: 8000 });

    const botonCobrarAhora = modalCierre.getByRole('button', { name: 'Cobrar ahora' });
    const botonAnularConMotivo = modalCierre.getByRole('button', { name: 'Anular con motivo' });

    await expect(botonCobrarAhora).toBeVisible();
    await expect(botonAnularConMotivo).toBeVisible();

    // 7. Intentar avanzar al conteo y cerrar sin resolver el pendiente -> debe ser bloqueado por pedidos pendientes
    await modalCierre.getByRole('button', { name: /Ya revisé: continuar al conteo/i }).click();
    await modalCierre.getByRole('button', { name: 'Cerrar caja' }).click();

    await expect(
      modalCierre.getByText('Hay pedidos sin cobrar o por confirmar. Resuélvelos antes de cerrar.'),
    ).toBeVisible();

    // Cancelar para volver a abrir y resolver el pendiente
    await modalCierre.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modalCierre).toBeHidden();

    // 8. Reabrir modal de cierre
    await page.getByRole('button', { name: 'Cerrar caja y cuadrar' }).click();
    await expect(modalCierre).toBeVisible();

    // Los pendientes se ven de entrada
    await expect(modalCierre.getByText('CP-E2E-SIN-COBRO')).toBeVisible({ timeout: 8000 });

    // 9. Resolver el pendiente: pulsar "Anular con motivo"
    await modalCierre.getByRole('button', { name: 'Anular con motivo' }).click();

    // Modal de anulación del pedido pendiente
    const modalAnularPendiente = page.getByRole('dialog', { name: 'Anular pedido' });
    await expect(modalAnularPendiente).toBeVisible();

    await modalAnularPendiente.locator('#anular-motivo').fill('Cliente no cancelo y se retiro del local');

    await modalAnularPendiente.getByRole('button', { name: 'Confirmar anulación' }).click();
    await confirmarSiNo(page, 'si');

    // Esperar a que se cierre el modal de anulación
    await expect(modalAnularPendiente).toBeHidden({ timeout: 5000 });

    // 10. Comprobar que el pedido pendiente desapareció de la lista bloqueante
    await expect(modalCierre.getByText('CP-E2E-SIN-COBRO', { exact: true })).toBeHidden({ timeout: 8000 });

    // 11. Verificar en BD que el pedido quedó ANULADO
    const pedidoAnuladoDb = await prisma.pedido.findUnique({
      where: { id: pedidoPendiente.id },
    });
    expect(pedidoAnuladoDb?.estado).toBe('ANULADO');
    expect(pedidoAnuladoDb?.motivo_anulacion).toBe('Cliente no cancelo y se retiro del local');
  });

  test('(5) Pedido delivery exige repartidor asignado para poder pasar a estado ENTREGADO', async ({
    page,
  }) => {
    // 1. Crear pedido con modalidad DELIVERY en estado EN_CAMINO sin repartidor asignado
    const pedidoDelivery = await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-DELIV',
        canal: 'CARTA',
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidor_party_id: null,
        cliente_nombre: 'Cliente Delivery Sin Rider',
        cliente_telefono: '987654321',
        entrega_direccion: 'Av. Las Palmeras 456, San Isidro',
        subtotal: new Prisma.Decimal(30.0),
        total: new Prisma.Decimal(30.0),
        pago_estado: 'PENDIENTE',
      },
    });

    // 2. Validación en la API: un delivery en camino no puede pasar a ENTREGADO sin repartidor (409 REPARTIDOR_REQUERIDO)
    const sesionCajero = await loginPorApi('CAJERO');

    const resCambioEstado = await fetch(`${apiBaseUrl}/admin/pedidos/${pedidoDelivery.id}/estado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCajero.accessToken}`,
      },
      body: JSON.stringify({
        estado: 'ENTREGADO',
      }),
    });

    expect(resCambioEstado.status).toBe(409);
    const dataError = await resCambioEstado.json();
    expect(dataError.codigo).toBe('REPARTIDOR_REQUERIDO');
    expect(dataError.mensaje).toBe('Asigna un repartidor antes de marcar el pedido como entregado');

    // Comprobar que el estado en BD no cambió
    const pedidoDb = await prisma.pedido.findUnique({ where: { id: pedidoDelivery.id } });
    expect(pedidoDb?.estado).toBe('EN_CAMINO');

    // 3. Crear pedido en estado LISTO sin repartidor para validar la UI
    await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-DELIV-LISTO',
        canal: 'CARTA',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        cliente_nombre: 'Cliente Listo Sin Rider',
        cliente_telefono: '987654322',
        entrega_direccion: 'Av. Las Palmeras 458, San Isidro',
        subtotal: new Prisma.Decimal(30.0),
        total: new Prisma.Decimal(30.0),
        pago_estado: 'PENDIENTE',
      },
    });

    // En la interfaz del cajero:
    await loginPorUi(page, 'CAJERO');
    await page.goto('/admin/caja', { waitUntil: 'domcontentloaded' });

    // Los pedidos en estado LISTO se encuentran en la pestaña "En curso"
    await page.getByRole('tab', { name: /En curso/i }).click();

    await expect(page.getByText('Cliente Listo Sin Rider').first()).toBeVisible({ timeout: 10000 });
    await page.getByText('Cliente Listo Sin Rider').first().click();

    // Debe mostrar la alerta explícita requiriendo asignar un repartidor
    await expect(
      page.getByText('Asigna un repartidor antes de marcar el pedido como entregado.'),
    ).toBeVisible({ timeout: 8000 });

    // El botón para entregar al cliente y cerrar debe estar deshabilitado
    const botonEntregar = page.getByRole('button', { name: 'Entregar al cliente y cerrar' });
    await expect(botonEntregar).toBeVisible();
    await expect(botonEntregar).toBeDisabled();
  });

  test('(6) Verificación de permisos: el rol CAJERO no tiene acceso a los módulos de almacén ni configuración', async ({
    page,
  }) => {
    // 1. Iniciar sesión con rol CAJERO
    await loginPorUi(page, 'CAJERO');

    // 2. Verificar que los módulos restringidos no figuren en la barra lateral de navegación
    await expect(page.getByRole('button', { name: 'Almacén' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Configuración del local' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Usuarios y roles' })).toHaveCount(0);

    // 3. Intentar navegar directamente a la ruta de Almacén (/admin/almacen)
    await page.evaluate(() => {
      window.history.pushState(null, '', '/admin/almacen');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Debe bloquearse y mostrar la pantalla de acceso denegado
    await expect(page.getByRole('heading', { name: 'No tienes permiso' })).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Tu rol actual no tiene acceso a este módulo o acción/i),
    ).toBeVisible();

    // 4. Intentar navegar directamente a la ruta de Configuración del local (/admin/mirest)
    await page.evaluate(() => {
      window.history.pushState(null, '', '/admin/mirest');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Debe bloquearse y mostrar la pantalla de acceso denegado
    await expect(page.getByRole('heading', { name: 'No tienes permiso' })).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Tu rol actual no tiene acceso a este módulo o acción/i),
    ).toBeVisible();

    // 5. El botón "Volver al escritorio" debe funcionar y redirigir a /admin
    const botonVolver = page.getByRole('button', { name: 'Volver al escritorio' });
    await expect(botonVolver).toBeVisible();
    await botonVolver.click();

    await expect(page).toHaveURL(/\/admin(\/.*)?$/);
    await expect(page.getByRole('heading', { name: 'Escritorio' })).toBeVisible({ timeout: 10000 });
  });

  test('(7) Anulación de cobro desde el detalle del pedido por UI: cajero anula con motivo y sin código, cobro conservado en BD, stock repuesto y pedido devuelto a PENDIENTE', async ({
    page,
  }) => {
    // 1. Abrir caja del día
    await abrirCajaHoy(100);

    // 2. Medir stock inicial del insumo Café en grano (independiente del estado previo)
    const stockInicial = await obtenerStockInsumo('Café en grano');
    expect(stockInicial).not.toBeNull();
    expect(Number(stockInicial)).toBeGreaterThan(0);

    // 3. Crear pedido con Café Americano (receta: 0.018 kg de café en grano)
    const prodCafe = await prisma.producto.findFirstOrThrow({
      where: { nombre: 'Café Americano' },
    });

    const pedido = await prisma.pedido.create({
      data: {
        codigo: 'CP-E2E-UI-ANUL',
        canal: 'CAJA',
        modalidad: 'MESA',
        estado: 'PREPARANDO',
        cliente_nombre: 'Cliente Cobro UI Anular',
        subtotal: new Prisma.Decimal(12.0),
        total: new Prisma.Decimal(12.0),
        pago_estado: 'PENDIENTE',
        lineas: {
          create: [
            {
              producto_id: prodCafe.id,
              nombre: prodCafe.nombre,
              cantidad: 1,
              precio_unit: new Prisma.Decimal(12.0),
              subtotal: new Prisma.Decimal(12.0),
            },
          ],
        },
      },
    });

    // 4. Iniciar sesión como CAJERO e ir a /admin/caja
    await loginPorUi(page, 'CAJERO');
    await page.goto('/admin/caja', { waitUntil: 'domcontentloaded' });

    // Seleccionar pestaña "En curso"
    await page.getByRole('tab', { name: /En curso/i }).click();

    await expect(page.getByText('Cliente Cobro UI Anular').first()).toBeVisible({ timeout: 10000 });
    await page.getByText('Cliente Cobro UI Anular').first().click();

    // Antes de cobrar: el botón del pie debe decir "Anular pedido"
    await expect(page.getByRole('button', { name: 'Anular pedido' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anular cobro' })).toHaveCount(0);

    // Registrar cobro mediante la UI
    const botonCobrar = page.getByRole('button', { name: 'Registrar cobro' });
    await expect(botonCobrar).toBeVisible();
    await botonCobrar.click();

    const modalCobro = page.getByRole('dialog', { name: /Cobrar/i });
    await expect(modalCobro).toBeVisible();
    await modalCobro.getByRole('button', { name: 'Registrar cobro' }).click();
    await confirmarSiNo(page, 'si');
    await expect(modalCobro).toBeHidden({ timeout: 5000 });

    // 5. Verificar que el stock se descontó
    const stockTrasCobro = await obtenerStockInsumo('Café en grano');
    expect(Number(stockTrasCobro)).toBeCloseTo(Number(stockInicial) - 0.018, 4);

    // Obtener cobro activo en BD
    const cobroCreado = await prisma.cobro.findFirstOrThrow({
      where: { pedido_id: pedido.id, anulado_en: null },
    });
    expect(cobroCreado).toBeDefined();

    // 6. Ahora que el pedido está PAGADO, el botón en el pie del detalle debe decir "Anular cobro"
    const botonAnularCobro = page.getByRole('button', { name: 'Anular cobro' });
    await expect(botonAnularCobro).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Anular pedido' })).toHaveCount(0);

    // 7. Pulsar "Anular cobro" para abrir el modal de anulación
    await botonAnularCobro.click();

    const modalAnular = page.getByRole('dialog', { name: /Anular cobro/i });
    await expect(modalAnular).toBeVisible();

    // Ingresar solo el motivo
    await modalAnular.locator('#anular-motivo').fill('Anulación del cobro solicitada por el cliente en caja');

    await modalAnular.getByRole('button', { name: 'Confirmar anulación' }).click();
    await confirmarSiNo(page, 'si');

    await expect(modalAnular).toBeHidden({ timeout: 5000 });

    // 8. Verificaciones críticas en Base de Datos:
    // a) El cobro anulado se conserva en BD con anulado_en y motivo
    const cobroAnuladoDb = await prisma.cobro.findUnique({
      where: { id: cobroCreado.id },
    });
    expect(cobroAnuladoDb).not.toBeNull();
    expect(cobroAnuladoDb?.anulado_en).not.toBeNull();
    expect(cobroAnuladoDb?.motivo_anulacion).toBe('Anulación del cobro solicitada por el cliente en caja');

    // b) El stock consumido por la receta fue repuesto íntegramente
    const stockTrasAnulacion = await obtenerStockInsumo('Café en grano');
    expect(Number(stockTrasAnulacion)).toBeCloseTo(Number(stockInicial), 4);

    // c) El pedido revierte su estado de pago a PENDIENTE
    const pedidoRevertidoDb = await prisma.pedido.findUnique({
      where: { id: pedido.id },
    });
    expect(pedidoRevertidoDb?.pago_estado).toBe('PENDIENTE');

    // d) En la interfaz, el botón vuelve a decir "Anular pedido" y "Registrar cobro" vuelve a estar disponible
    await expect(page.getByRole('button', { name: 'Anular pedido' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Registrar cobro' })).toBeVisible();
  });
});
