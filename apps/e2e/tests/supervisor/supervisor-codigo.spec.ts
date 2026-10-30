import { test, expect } from '@playwright/test';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  loginPorUi,
  loginPorApi,
  confirmarSiNo,
  obtenerPrismaTest,
  PUERTO_API,
} from '../../src';

test.describe('E2E - Código Rotativo del Supervisor (RFC 6238 TOTP)', () => {
  const apiBaseUrl = `http://127.0.0.1:${PUERTO_API}`;
  const prisma = obtenerPrismaTest();

  // Helper para abrir la caja del día
  async function abrirCajaHoy(aperturaMonto = 100): Promise<bigint> {
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

  // Helper para crear y cobrar un pedido de prueba
  async function crearYCobrarPedido(codigoPrefijo: string): Promise<{ pedidoId: bigint; cobroId: bigint; codigoPedido: string }> {
    const ahora = new Date();
    const codigoPedido = `${codigoPrefijo}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const pedido = await prisma.pedido.create({
      data: {
        codigo: codigoPedido,
        canal: 'CAJA',
        modalidad: 'MESA',
        estado: 'COLA',
        pago_metodo: 'EFECTIVO',
        pago_estado: 'PENDIENTE',
        subtotal: new Prisma.Decimal(20),
        descuento: new Prisma.Decimal(0),
        total: new Prisma.Decimal(20),
        creado_en: ahora,
        lineas: {
          create: [
            {
              producto_id: 1,
              nombre: 'Café Americano',
              cantidad: 2,
              precio_unit: new Prisma.Decimal(10),
              subtotal: new Prisma.Decimal(20),
            },
          ],
        },
      },
    });

    const sesionCajero = await loginPorApi('CAJERO', apiBaseUrl);
    const resCobro = await fetch(`${apiBaseUrl}/admin/caja/cobrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCajero.accessToken}`,
      },
      body: JSON.stringify({
        pedidoId: pedido.id.toString(),
        pagos: [{ medio: 'EFECTIVO', monto: 20 }],
      }),
    });

    const dataCobro = await resCobro.json();
    const cobroId = BigInt(dataCobro.cobroId || dataCobro.id);

    return { pedidoId: pedido.id, cobroId, codigoPedido };
  }

  test('Flujo completo UI: ADMIN consulta código rotativo, cajero anula cobro con éxito, anti-repetición y bloqueo tras 3 intentos', async ({
    browser,
  }) => {
    await abrirCajaHoy(100);

    // 1. ADMIN abre "Código del supervisor" en contexto independiente
    const contextAdmin = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const pageAdmin = await contextAdmin.newPage();

    await loginPorUi(pageAdmin, 'ADMIN');

    // Navegar al módulo Código del supervisor
    await pageAdmin.goto('/admin/supervisor-codigo', { waitUntil: 'domcontentloaded' });

    // Verificar elementos clave en pantalla
    await expect(pageAdmin.getByTestId('vista-codigo-supervisor')).toBeVisible({ timeout: 10000 });
    await expect(pageAdmin.getByText(/Dicta este código al cajero; cambia cada 30 segundos/i)).toBeVisible();

    const displayCodigo = pageAdmin.getByTestId('codigo-grande');
    await expect(displayCodigo).toBeVisible();

    // Captura de pantalla en PC (Desktop 1280x800)
    const rutaCapturaPc = path.resolve(__dirname, '../../capturas/supervisor-codigo-pc.png');
    await pageAdmin.screenshot({ path: rutaCapturaPc, fullPage: false });

    // Captura de pantalla en Celular (Mobile 390x844)
    await pageAdmin.setViewportSize({ width: 390, height: 844 });
    const rutaCapturaMovil = path.resolve(__dirname, '../../capturas/supervisor-codigo-celular.png');
    await pageAdmin.screenshot({ path: rutaCapturaMovil, fullPage: false });

    // Volver a viewport cómodo y extraer el código visible en pantalla
    await pageAdmin.setViewportSize({ width: 1280, height: 800 });
    const textoCodigo = await displayCodigo.innerText();
    const codigoSupervisor = textoCodigo.replace(/\s+/g, '');
    expect(codigoSupervisor).toMatch(/^\d{6}$/);

    // 2. CAJERO inicia sesión en otro contexto y accede a pedidos
    const contextCajero = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const pageCajero = await contextCajero.newPage();

    const { pedidoId: ped1Id, cobroId: cobro1Id, codigoPedido: cod1Final } = await crearYCobrarPedido('CP-E2E-TOTP-1');

    await loginPorUi(pageCajero, 'CAJERO');
    await pageCajero.goto('/admin/caja', { waitUntil: 'domcontentloaded' });

    // Cambiar a la pestaña "En curso" donde está el pedido pagado
    await pageCajero.getByRole('tab', { name: /En curso/i }).click();

    // Seleccionar el pedido pagado en la lista
    const tarjetaPedido = pageCajero.getByText(cod1Final).first();
    await expect(tarjetaPedido).toBeVisible({ timeout: 10000 });
    await tarjetaPedido.click();

    // Pulsar botón "Anular cobro"
    const botonAnularCobro = pageCajero.getByRole('button', { name: 'Anular cobro' });
    await expect(botonAnularCobro).toBeVisible({ timeout: 8000 });
    await botonAnularCobro.click();

    // Modal de anulación
    const modalAnular = pageCajero.getByRole('dialog', { name: /Anular cobro/i });
    await expect(modalAnular).toBeVisible();

    // Llenar motivo y el CÓDIGO ROTATIVO dictado por el supervisor
    await modalAnular.locator('#anular-motivo').fill('Anulación autorizada con código rotativo TOTP');
    await modalAnular.locator('#anular-pin').fill(codigoSupervisor);

    await modalAnular.getByRole('button', { name: 'Confirmar anulación' }).click();
    await confirmarSiNo(pageCajero, 'si');

    // El modal debe cerrarse indicando éxito
    await expect(modalAnular).toBeHidden({ timeout: 8000 });

    // Verificar en BD que el cobro 1 quedó anulado
    const cobro1Db = await prisma.cobro.findUnique({ where: { id: cobro1Id } });
    expect(cobro1Db?.anulado_en).not.toBeNull();

    // 3. ANTI-REPETICIÓN: Un segundo uso del MISMO código debe fallar
    const { pedidoId: ped2Id, cobroId: cobro2Id } = await crearYCobrarPedido('CP-E2E-TOTP-2');

    // Intentar anular el cobro 2 con el MISMO código usado anteriormente
    const sesionCajero = await loginPorApi('CAJERO', apiBaseUrl);
    const resReplay = await fetch(`${apiBaseUrl}/admin/caja/cobros/${cobro2Id}/anular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCajero.accessToken}`,
        'X-Codigo-Supervisor': codigoSupervisor,
      },
      body: JSON.stringify({
        motivo: 'Intento de reutilización de código TOTP ya consumido',
      }),
    });

    expect(resReplay.status).toBe(403);
    const dataReplay = await resReplay.json();
    expect(dataReplay.codigo).toBe('CODIGO_INVALIDO');

    // El cobro 2 no debe haber sido anulado
    const cobro2Db = await prisma.cobro.findUnique({ where: { id: cobro2Id } });
    expect(cobro2Db?.anulado_en).toBeNull();

    // 4. BLOQUEO: 3 intentos fallidos bloquean el sistema por 5 minutos
    const { cobroId: cobro3Id } = await crearYCobrarPedido('CP-E2E-TOTP-3');

    for (let i = 1; i <= 3; i++) {
      await fetch(`${apiBaseUrl}/admin/caja/cobros/${cobro3Id}/anular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesionCajero.accessToken}`,
          'X-Codigo-Supervisor': '000000',
        },
        body: JSON.stringify({
          motivo: `Intento fallido de código supervisor #${i}`,
        }),
      });
    }

    // El 4to intento (incluso con código correcto) debe responder 403 CODIGO_BLOQUEADO
    const resBloqueo = await fetch(`${apiBaseUrl}/admin/caja/cobros/${cobro3Id}/anular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesionCajero.accessToken}`,
        'X-Codigo-Supervisor': codigoSupervisor,
      },
      body: JSON.stringify({
        motivo: 'Intento con código tras bloqueo',
      }),
    });

    expect(resBloqueo.status).toBe(403);
    const dataBloqueo = await resBloqueo.json();
    expect(['CODIGO_BLOQUEADO', 'PIN_BLOQUEADO']).toContain(dataBloqueo.codigo);

    // Cerrar contextos
    await contextAdmin.close();
    await contextCajero.close();
  });
});
