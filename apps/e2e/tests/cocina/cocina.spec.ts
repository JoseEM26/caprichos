import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';
import {
  loginPorUi,
  obtenerPrismaTest,
  obtenerStockInsumo,
  obtenerUltimoMovimientoStock,
} from '../../src';

const DIRECTORIO_CAPTURAS = path.resolve(__dirname, '../../capturas/cocina');
const DIRECTORIO_TMP = '/tmp/f1shots';

async function guardarCaptura(page: any, nombreArchivo: string) {
  const rutaLocal = path.join(DIRECTORIO_CAPTURAS, nombreArchivo);
  const rutaTmp = path.join(DIRECTORIO_TMP, nombreArchivo);

  await page.screenshot({ path: rutaLocal, fullPage: false });
  try {
    fs.copyFileSync(rutaLocal, rutaTmp);
  } catch {
    // Si /tmp/f1shots falla no detiene la prueba
  }
}

test.describe('Suite E2E - Pantalla de Cocina Simple e Intuitiva', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(DIRECTORIO_CAPTURAS, { recursive: true });
    try {
      fs.mkdirSync(DIRECTORIO_TMP, { recursive: true });
    } catch {
      // Ignorar
    }

    // Asegurar insumo sin stock en almacén para la fila atenuada ("Sin stock en almacén")
    const prisma = obtenerPrismaTest();
    const almacenCentral = await prisma.lugarStock.findFirst({
      where: { nombre: { contains: 'Almacén', mode: 'insensitive' } },
    });
    const cocinaStock = await prisma.lugarStock.findFirst({
      where: { nombre: { contains: 'Cocina', mode: 'insensitive' } },
    });

    if (almacenCentral && cocinaStock) {
      const insumoSinStock = await prisma.insumo.upsert({
        where: { nombre: 'Mantequilla artesanal' },
        update: {
          unidad_compra: 'KG',
          unidad_almacen: 'KG',
          unidad_receta: 'G',
          factor_compra: new Prisma.Decimal(1),
          factor_receta: new Prisma.Decimal(1000),
          costo_unit: new Prisma.Decimal(15),
          minimo: new Prisma.Decimal(4),
          maximo: new Prisma.Decimal(20),
          lugar_consumo_id: cocinaStock.id,
          activo: true,
        },
        create: {
          nombre: 'Mantequilla artesanal',
          unidad_compra: 'KG',
          unidad_almacen: 'KG',
          unidad_receta: 'G',
          factor_compra: new Prisma.Decimal(1),
          factor_receta: new Prisma.Decimal(1000),
          costo_unit: new Prisma.Decimal(15),
          minimo: new Prisma.Decimal(4),
          maximo: new Prisma.Decimal(20),
          lugar_consumo_id: cocinaStock.id,
          activo: true,
        },
      });

      // Stock 0 en almacén, 1 en cocina (bajo el mínimo)
      await prisma.stock.deleteMany({
        where: { insumo_id: insumoSinStock.id },
      });
      await prisma.stock.create({
        data: {
          insumo_id: insumoSinStock.id,
          lugar_id: cocinaStock.id,
          cantidad: new Prisma.Decimal(1),
        },
      });
      await prisma.stock.create({
        data: {
          insumo_id: insumoSinStock.id,
          lugar_id: almacenCentral.id,
          cantidad: new Prisma.Decimal(0),
        },
      });

      // Asegurar stock de Café en grano en Cocina para pruebas de merma
      const insumoCafe = await prisma.insumo.findFirst({
        where: { nombre: 'Café en grano' },
      });
      if (insumoCafe) {
        const stockCafeCocina = await prisma.stock.findFirst({
          where: { insumo_id: insumoCafe.id, lugar_id: cocinaStock.id },
        });
        if (!stockCafeCocina) {
          await prisma.stock.create({
            data: {
              insumo_id: insumoCafe.id,
              lugar_id: cocinaStock.id,
              cantidad: new Prisma.Decimal(5),
            },
          });
        }
      }

      // Asegurar stock de Harina de trigo en Cocina (10 KG) y Almacén central (30 KG)
      const insumoHarina = await prisma.insumo.findFirst({
        where: { nombre: 'Harina de trigo' },
      });
      if (insumoHarina) {
        const stockHarinaCocina = await prisma.stock.findFirst({
          where: { insumo_id: insumoHarina.id, lugar_id: cocinaStock.id },
        });
        if (stockHarinaCocina) {
          await prisma.stock.update({
            where: { id: stockHarinaCocina.id },
            data: { cantidad: new Prisma.Decimal(10) },
          });
        } else {
          await prisma.stock.create({
            data: {
              insumo_id: insumoHarina.id,
              lugar_id: cocinaStock.id,
              cantidad: new Prisma.Decimal(10),
            },
          });
        }

        const stockHarinaAlm = await prisma.stock.findFirst({
          where: { insumo_id: insumoHarina.id, lugar_id: almacenCentral.id },
        });
        if (stockHarinaAlm) {
          await prisma.stock.update({
            where: { id: stockHarinaAlm.id },
            data: { cantidad: new Prisma.Decimal(30) },
          });
        }
      }
    }
  });

  test.beforeEach(async () => {
    const prisma = obtenerPrismaTest();
    const almacenCentral = await prisma.lugarStock.findFirst({
      where: { nombre: { contains: 'Almacén', mode: 'insensitive' } },
    });
    const cocinaStock = await prisma.lugarStock.findFirst({
      where: { nombre: { contains: 'Cocina', mode: 'insensitive' } },
    });
    if (almacenCentral && cocinaStock) {
      const insumoHarina = await prisma.insumo.findFirst({ where: { nombre: 'Harina de trigo' } });
      if (insumoHarina) {
        await prisma.stock.deleteMany({
          where: { insumo_id: insumoHarina.id, lugar_id: { in: [almacenCentral.id, cocinaStock.id] } },
        });
        await prisma.stock.createMany({
          data: [
            { insumo_id: insumoHarina.id, lugar_id: almacenCentral.id, cantidad: new Prisma.Decimal(30) },
            { insumo_id: insumoHarina.id, lugar_id: cocinaStock.id, cantidad: new Prisma.Decimal(10) },
          ],
        });
      }
      const insumoCafe = await prisma.insumo.findFirst({ where: { nombre: 'Café en grano' } });
      if (insumoCafe) {
        await prisma.stock.deleteMany({
          where: { insumo_id: insumoCafe.id, lugar_id: cocinaStock.id },
        });
        await prisma.stock.create({
          data: { insumo_id: insumoCafe.id, lugar_id: cocinaStock.id, cantidad: new Prisma.Decimal(5) },
        });
      }
    }
  });

  test('1) Marcar agotado desde la lista, verificar en carta pública y reactivar', async ({
    page,
  }) => {
    // 1. Iniciar sesión como COCINA
    await loginPorUi(page, 'COCINA');
    await page.goto('/admin/cocina', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Cocina' })).toBeVisible({ timeout: 10000 });

    // 2. Abrir modal de agotados desde la barra de acciones
    const btnAgotados = page.getByRole('button', { name: 'Marcar agotado', exact: true });
    await expect(btnAgotados).toBeVisible({ timeout: 10000 });
    await btnAgotados.click();

    const dialogAgotados = page.getByRole('dialog', { name: 'Marcar agotado' });
    await expect(dialogAgotados).toBeVisible({ timeout: 5000 });

    // 3. Verificar lista agrupada sin buscar y texto de ayuda reescrito
    await expect(
      dialogAgotados.getByText(
        'El cliente ya no podrá pedirlo en la carta ni en el chatbot. Puedes reactivarlo antes desde esta lista.',
      ),
    ).toBeVisible();

    // Captura PC de lista de agotados
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'lista-agotados-pc.png');

    // Captura Móvil de lista de agotados (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'lista-agotados-movil.png');

    // Restaurar a PC
    await page.setViewportSize({ width: 1280, height: 800 });

    // 4. Marcar agotado el producto "Pie de Limón"
    await expect(dialogAgotados.getByText('Pie de Limón').first()).toBeVisible({ timeout: 5000 });
    const btnAgotarHoy = dialogAgotados.getByLabel(/Agotar hoy Pie de Limón/i);
    await expect(btnAgotarHoy).toBeVisible({ timeout: 5000 });
    await btnAgotarHoy.click();

    // Diálogo de confirmación Sí/No
    const btnConfirmar = page.getByRole('button', { name: 'Sí, marcar agotado' });
    await expect(btnConfirmar).toBeVisible({ timeout: 5000 });
    await btnConfirmar.click();

    // 5. Verificar que en la lista ahora se muestra como agotado con botón "Reactivar"
    await expect(
      dialogAgotados.getByText(/Agotado · Vuelve mañana/i).first(),
    ).toBeVisible({ timeout: 10000 });
    const btnReactivar = dialogAgotados.getByRole('button', { name: /Reactivar/i }).first();
    await expect(btnReactivar).toBeVisible();

    // Cerrar modal
    await dialogAgotados.getByLabel('Cerrar').first().click();

    // 6. Ir a la carta pública y verificar que Pie de Limón aparece como agotado
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=CAPRICHOS').first()).toBeVisible({ timeout: 10000 });

    const tarjetaPie = page.locator('article, div').filter({ hasText: 'Pie de Limón' }).first();
    await expect(tarjetaPie).toBeVisible({ timeout: 10000 });
    await tarjetaPie.scrollIntoViewIfNeeded();

    const botonAgotado = tarjetaPie.locator('button[disabled]').filter({ hasText: 'Agotado' });
    await expect(botonAgotado).toBeVisible({ timeout: 5000 });

    // 7. Volver a cocina y reactivar
    await page.goto('/admin/cocina', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Marcar agotado', exact: true }).click();
    await expect(dialogAgotados).toBeVisible({ timeout: 5000 });

    const btnReactivarPie = dialogAgotados.getByRole('button', { name: /Reactivar/i }).first();
    await btnReactivarPie.click();

    const btnConfirmarReactivar = page.getByRole('button', { name: 'Sí, reactivar' });
    await expect(btnConfirmarReactivar).toBeVisible({ timeout: 5000 });
    await btnConfirmarReactivar.click();

    // Verificar que desaparece del bloque de agotados
    await expect(dialogAgotados.getByRole('button', { name: /Reactivar/i })).toHaveCount(0, {
      timeout: 10000,
    });

    // 8. Verificar que la carta vuelve a mostrarlo disponible
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const tarjetaPieDisponible = page.locator('article, div').filter({ hasText: 'Pie de Limón' }).first();
    await expect(tarjetaPieDisponible).toBeVisible({ timeout: 10000 });
    await tarjetaPieDisponible.scrollIntoViewIfNeeded();

    const botonDisponible = tarjetaPieDisponible.getByRole('button', { name: /Pedir Pie de Limón|Agregar/i });
    await expect(botonDisponible).toBeEnabled({ timeout: 5000 });
  });

  test('2) Interruptor de sonido simplificado y registro de mermas de 2 líneas con verificación en BD', async ({
    page,
  }) => {
    // 1. Iniciar sesión como COCINA
    await loginPorUi(page, 'COCINA');
    await page.goto('/admin/cocina', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Cocina' })).toBeVisible({ timeout: 10000 });

    // 2. Verificar interruptor de sonido simplificado (sin botón Probar sonido ni textos largos)
    await expect(page.getByRole('button', { name: /Probar sonido/i })).toHaveCount(0);
    const switchSonido = page.getByRole('switch', { name: /Sonido/i });
    await expect(switchSonido).toBeVisible();

    // 3. Abrir modal único de mermas
    const btnMerma = page.getByRole('button', { name: 'Registrar mermas', exact: true });
    await expect(btnMerma).toBeVisible();
    await btnMerma.click();

    const dialogMerma = page.getByRole('dialog', { name: 'Registrar mermas' });
    await expect(dialogMerma).toBeVisible({ timeout: 5000 });

    // Esperar a que cargue la lista de insumos
    await expect(dialogMerma.getByText('Línea 1')).toBeVisible({ timeout: 10000 });

    // Captura PC del modal de mermas
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'modal-mermas-pc.png');

    // Captura Móvil del modal de mermas (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'modal-mermas-movil.png');

    // Restaurar a PC
    await page.setViewportSize({ width: 1280, height: 800 });

    // 4. Configurar Línea 1
    // Insumo: Harina de trigo
    const selectInsumo1 = dialogMerma.locator('select').first();
    await selectInsumo1.selectOption({ label: 'Harina de trigo (KG)' });

    const inputCant1 = dialogMerma.locator('input[placeholder="Ej. 1.5"]').first();
    await inputCant1.fill('1');

    // Motivo rápido: 'Se cayó'
    const btnSeCayo = dialogMerma.getByRole('button', { name: 'Se cayó' }).first();
    await btnSeCayo.click();

    // 5. Agregar Línea 2
    const btnAgregar = dialogMerma.getByRole('button', { name: /\+ Agregar otra línea/i });
    await btnAgregar.click();
    await expect(dialogMerma.getByText('Línea 2')).toBeVisible();
    await expect(dialogMerma.getByText('Total: 2 líneas para mermar')).toBeVisible();

    // Configurar Línea 2
    const selects = dialogMerma.locator('select');
    // El segundo select de insumo es el que está en Línea 2
    await selects.nth(2).selectOption({ label: 'Café en grano (KG)' });

    const inputsCant = dialogMerma.locator('input[placeholder="Ej. 1.5"]');
    await inputsCant.nth(1).fill('0.5');

    // Motivo rápido en línea 2: 'Vencido'
    const btnsVencido = dialogMerma.getByRole('button', { name: 'Vencido' });
    await btnsVencido.nth(1).click();

    // 6. Consultar stocks previos en BD
    const stockHarinaAntes = await obtenerStockInsumo('Harina de trigo');
    const stockCafeAntes = await obtenerStockInsumo('Café en grano');

    // 7. Enviar merma con confirmación Sí/No
    const btnSubmitMerma = dialogMerma.getByRole('button', { name: 'Registrar mermas', exact: true });
    await btnSubmitMerma.click();

    const btnConfirmarMerma = page.getByRole('button', { name: 'Sí, registrar mermas' });
    await expect(btnConfirmarMerma).toBeVisible({ timeout: 5000 });
    await btnConfirmarMerma.click();

    // Verificar que el modal se cierre tras guardar con éxito
    await expect(dialogMerma).toHaveCount(0, { timeout: 10000 });

    // 8. Verificar en Base de Datos
    const stockHarinaDespues = await obtenerStockInsumo('Harina de trigo');
    const stockCafeDespues = await obtenerStockInsumo('Café en grano');

    expect(Number(stockHarinaDespues)).toBe(Number(stockHarinaAntes) - 1);
    expect(Number(stockCafeDespues)).toBe(Number(stockCafeDespues) - 0.5 + 0.5); // decremento de 0.5
    expect(Number(stockCafeDespues)).toBe(Number(stockCafeAntes) - 0.5);

    // Verificar movimientos en BD
    const movHarina = await obtenerUltimoMovimientoStock({ tipo: 'MERMA' });
    expect(movHarina).not.toBeNull();
  });

  test('3) Pedir al almacén con stock a la vista, entrega con "Ya se lo pasé" y recepción parcial en cocina', async ({
    page,
  }) => {
    // 1. Iniciar sesión como COCINA
    await loginPorUi(page, 'COCINA');
    await page.goto('/admin/cocina', { waitUntil: 'domcontentloaded' });

    // 2. Abrir ModalPedirAlmacen
    const btnPedir = page.getByRole('button', { name: 'Pedir al almacén', exact: true });
    await expect(btnPedir).toBeVisible();
    await btnPedir.click();

    const dialogPedir = page.getByRole('dialog', { name: 'Pedir al almacén' });
    await expect(dialogPedir).toBeVisible({ timeout: 5000 });

    // Verificar aclaración obligatoria
    await expect(
      dialogPedir.getByText('Cocina pide, Almacén entrega, Cocina confirma que recibió.'),
    ).toBeVisible();

    // Esperar a que carguen las existencias
    await expect(dialogPedir.getByText('Harina de trigo')).toBeVisible({ timeout: 10000 });

    // Verificar fila sin stock en almacén: "Sin stock en almacén · Pídelo a Compras" con botón deshabilitado
    await expect(
      dialogPedir.getByText(/Sin stock en almacén · Pídelo a Compras/i).first(),
    ).toBeVisible({ timeout: 5000 });
    const btnAumentarDeshabilitado = dialogPedir.getByLabel(/Aumentar Mantequilla artesanal/i);
    await expect(btnAumentarDeshabilitado).toBeDisabled();

    // Captura PC de pedir al almacén con barras y fila sin stock
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'pedir-almacen-barras-pc.png');

    // Captura Móvil de pedir al almacén (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'pedir-almacen-barras-movil.png');

    // Restaurar a PC
    await page.setViewportSize({ width: 1280, height: 800 });

    // 3. Aumentar cantidad para Harina de trigo con botón +
    const btnMasHarina = dialogPedir.getByLabel(/Aumentar Harina de trigo/i);
    await btnMasHarina.click(); // 1
    await btnMasHarina.click(); // 2

    await expect(dialogPedir.getByText('Total a pedir: 1 insumo')).toBeVisible();

    // 4. Enviar pedido interno con confirmación Sí/No
    const btnEnviarPedido = dialogPedir.getByRole('button', { name: /Enviar pedido a almacén/i });
    await btnEnviarPedido.click();

    const btnConfirmarEnvio = page.getByRole('button', { name: 'Sí, enviar pedido' });
    await expect(btnConfirmarEnvio).toBeVisible({ timeout: 5000 });
    await btnConfirmarEnvio.click();

    // Pasa automáticamente a la pestaña de seguimiento
    await expect(dialogPedir.getByText('1. Enviado al almacén').first()).toBeVisible({ timeout: 10000 });

    // 5. Iniciar sesión como ALMACEN para despachar el pedido
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* limpieza del navegador de prueba; si falla, la prueba sigue */ }
    });
    await page.context().clearCookies();
    await loginPorUi(page, 'ALMACEN');
    await page.goto('/admin/almacen', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Almacén', exact: true })).toBeVisible({ timeout: 10000 });

    // En la sección de pedidos internos de Cocina, buscar el botón "Ya se lo pasé"
    const btnPase = page.getByRole('button', { name: 'Ya se lo pasé' }).first();
    await expect(btnPase).toBeVisible({ timeout: 10000 });
    await btnPase.click();

    // Confirmación Sí/No de entrega
    const btnConfirmarEntrega = page.getByRole('button', { name: /Sí, ya se lo pasé/i });
    await expect(btnConfirmarEntrega).toBeVisible({ timeout: 5000 });
    await btnConfirmarEntrega.click();

    // Verificar aviso de éxito en almacén
    await expect(
      page.getByText(/Pedido interno entregado: insumos trasladados a Cocina/i),
    ).toBeVisible({ timeout: 10000 });

    // 6. Volver a iniciar sesión como COCINA para confirmar recepción
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* limpieza del navegador de prueba; si falla, la prueba sigue */ }
    });
    await page.context().clearCookies();
    await loginPorUi(page, 'COCINA');
    await page.goto('/admin/cocina', { waitUntil: 'domcontentloaded' });

    // Abrir modal de pedir y pasar a pestaña Seguimiento
    await page.getByRole('button', { name: 'Pedir al almacén', exact: true }).click();
    await expect(dialogPedir).toBeVisible({ timeout: 5000 });

    const tabSeguimiento = dialogPedir.getByRole('button', { name: /Seguimiento de pedidos/i });
    await tabSeguimiento.click();

    // 7. El estado ahora debe ser "Almacén ya lo entregó" con botón "Confirmar recibido"
    await expect(dialogPedir.getByText('Almacén ya lo entregó').first()).toBeVisible({ timeout: 10000 });
    const btnConfirmarRecibido = dialogPedir.getByRole('button', { name: 'Confirmar recibido' }).first();
    await expect(btnConfirmarRecibido).toBeVisible();

    // Captura PC de seguimiento de pedidos (con los 3 estados claros)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'seguimiento-pedidos-pc.png');

    // Captura Móvil de seguimiento (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await guardarCaptura(page, 'seguimiento-pedidos-movil.png');

    // Restaurar a PC
    await page.setViewportSize({ width: 1280, height: 800 });

    // 8. Confirmar recepción parcial (enviaron 2 kg, recibimos 1.5 kg)
    const stockCocinaAntes = await obtenerStockInsumo('Harina de trigo', 'Cocina');
    await btnConfirmarRecibido.click();

    const dialogRecepcion = page.getByRole('dialog', { name: 'Confirmar recepción de insumo', exact: true });
    await expect(dialogRecepcion).toBeVisible({ timeout: 5000 });

    const inputReal = dialogRecepcion.getByLabel(/Cantidad que realmente llegó a Cocina/i);
    await expect(inputReal).toBeVisible({ timeout: 5000 });
    await inputReal.fill('1.5');

    // Comprobar que calcula la diferencia
    await expect(dialogRecepcion.getByText(/Diferencia: 0.50 faltante/i)).toBeVisible();

    // Confirmar recibido
    const btnBotonRecibido = dialogRecepcion.getByRole('button', { name: 'Recibido', exact: true });
    await btnBotonRecibido.click();

    const btnSiRecibido = page.getByRole('button', { name: 'Sí, confirmar recibido' });
    await expect(btnSiRecibido).toBeVisible({ timeout: 5000 });
    await btnSiRecibido.click();

    // Esperar que se cierre el modal de recepción y aparezca el traslado recibido con cantidad 1.5
    await expect(dialogRecepcion).not.toBeVisible({ timeout: 5000 });
    await expect(dialogPedir.getByText(/1\.5 de Harina de trigo/i)).toBeVisible({ timeout: 10000 });

    // 9. Verificar stock en BD
    const stockCocinaDespues = await obtenerStockInsumo('Harina de trigo', 'Cocina');
    expect(Number(stockCocinaDespues)).toBe(Number(stockCocinaAntes) + 1.5);
  });
});
