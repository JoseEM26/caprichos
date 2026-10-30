import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { obtenerPrismaTest, loginPorUi, confirmarSiNo } from '../../src';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET || 'test-whatsapp-secret-super-seguro-123456';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'test-verify-token-123456';
const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`;

function calcularFirma(cuerpo: string, secreto = APP_SECRET): string {
  const hmac = crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');
  return `sha256=${hmac}`;
}

test.describe('WhatsApp Chatbot E2E - Fase 1', () => {
  const prisma = obtenerPrismaTest();

  test.afterAll(async () => {
    // Limpieza de datos creados en la suite
    await prisma.quejaWhatsapp.deleteMany({});
    await prisma.encuestaPosventa.deleteMany({});
    await prisma.whatsappMensaje.deleteMany({});
    await prisma.clienteWhatsappConsentimiento.deleteMany({});
  });

  test('1. Webhook GET: verificación de suscripción con Meta challenge', async ({ request }) => {
    // 1. Token correcto devuelve el challenge
    const resValida = await request.get(`${apiBaseUrl}/whatsapp/webhook`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.challenge': 'challenge_secreto_e2e_123',
        'hub.verify_token': VERIFY_TOKEN,
      },
    });
    expect(resValida.status()).toBe(200);
    const texto = await resValida.text();
    expect(texto).toBe('challenge_secreto_e2e_123');

    // 2. Token incorrecto es rechazado con 403 Forbidden
    const resInvalida = await request.get(`${apiBaseUrl}/whatsapp/webhook`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.challenge': 'challenge_invalido',
        'hub.verify_token': 'token_equivocado',
      },
    });
    expect(resInvalida.status()).toBe(403);
  });

  test('2. Webhook POST: validación estricta de firma HMAC-SHA256', async ({ request }) => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });

    // 1. Sin cabecera X-Hub-Signature-256 -> 401
    const resSinFirma = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resSinFirma.status()).toBe(401);

    // 2. Con firma inválida -> 401
    const resFirmaMala = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=firma_completamente_falsa_00000000000000000000000000000000',
      },
    });
    expect(resFirmaMala.status()).toBe(401);

    // 3. Con firma válida calculada en tiempo constante -> 200
    const firmaValida = calcularFirma(payload);
    const resValida = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': firmaValida,
      },
    });
    expect(resValida.status()).toBe(200);
    const body = await resValida.json();
    expect(body.ok).toBe(true);
  });

  test('3. Webhook POST: ingestión de mensaje entrante e idempotencia por wa_message_id', async ({ request }) => {
    const wamid = `wamid.e2e_test_${Date.now()}`;
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '123456789', phone_number_id: '999888' },
                contacts: [{ profile: { name: 'Rosa E2E' }, wa_id: '51987654321' }],
                messages: [
                  {
                    id: wamid,
                    from: '51987654321',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hola, deseo consultar sobre mi pedido' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    // 1. Envío inicial: procesa 1 mensaje
    const res1 = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': calcularFirma(payload),
      },
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.procesados).toBe(1);

    // 2. Verificar persistencia en base de datos
    const mensajeDb = await prisma.whatsappMensaje.findUnique({
      where: { wa_message_id: wamid },
    });
    expect(mensajeDb).not.toBeNull();
    expect(mensajeDb?.direccion).toBe('ENTRANTE');
    expect(mensajeDb?.tipo).toBe('TEXTO');
    expect(mensajeDb?.telefono_enmascarado).toBe('+51 9*** ***21');

    // 3. Reintento idéntico (simulando reintento de Meta): procesados = 0 (idempotente)
    const res2 = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': calcularFirma(payload),
      },
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    expect(body2.procesados).toBe(0);
  });

  test('4. Webhook POST: Ley 29733 revocación de consentimiento (BAJA / STOP)', async ({ request }) => {
    const wamid = `wamid.e2e_baja_${Date.now()}`;
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                messages: [
                  {
                    id: wamid,
                    from: '51911223344',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'BAJA' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const res = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': calcularFirma(payload),
      },
    });
    expect(res.status()).toBe(200);

    // Verificar que se guardó el consentimiento como rechazado
    const hashEsperado = crypto.createHash('sha256').update('51911223344').digest('hex');
    const consentimiento = await prisma.clienteWhatsappConsentimiento.findUnique({
      where: { telefono_hash: hashEsperado },
    });
    expect(consentimiento).not.toBeNull();
    expect(consentimiento?.acepta).toBe(false);
    expect(consentimiento?.origen).toBe('WEBHOOK_BAJA');
  });

  test('5. Webhook POST: actualización de estado de entrega (read/delivered)', async ({ request }) => {
    const wamid = `wamid.e2e_status_${Date.now()}`;
    // Crear mensaje saliente previo en DB
    await prisma.whatsappMensaje.create({
      data: {
        direccion: 'SALIENTE',
        wa_message_id: wamid,
        telefono_hash: 'hash_test',
        telefono_enmascarado: '+51 9*** ***55',
        tipo: 'PLANTILLA',
        estado: 'ENVIADO',
      },
    });

    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  {
                    id: wamid,
                    status: 'read',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: '51999888777',
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const res = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': calcularFirma(payload),
      },
    });
    expect(res.status()).toBe(200);

    // Verificar que el estado cambió a LEIDO
    const actualizado = await prisma.whatsappMensaje.findUnique({
      where: { wa_message_id: wamid },
    });
    expect(actualizado?.estado).toBe('LEIDO');
  });

  test('6. Panel Administrativo: Pestaña de Quejas de WhatsApp en Reclamos', async ({ page }) => {
    // 1. Iniciar sesión como ADMIN
    await loginPorUi(page, 'ADMIN');

    // 2. Navegar al módulo de Reclamos
    await page.goto('/admin/reclamos');

    // 3. Verificar que existen las pestañas claramente separadas (Legal vs Chatbot)
    const pestanaLegal = page.getByRole('tab', { name: /Libro de Reclamaciones \(Legal\)/i });
    const pestanaWhatsapp = page.getByRole('tab', { name: /Quejas de WhatsApp \(Chatbot\)/i });
    await expect(pestanaLegal).toBeVisible();
    await expect(pestanaWhatsapp).toBeVisible();

    // 4. Cambiar a la pestaña WhatsApp
    await pestanaWhatsapp.click();

    // 5. Verificar elementos de satisfacción y aviso de canal informal
    await expect(page.getByText(/Canal informal de atención al cliente/i)).toBeVisible();
    await expect(page.getByText(/Satisfacción Posventa/i)).toBeVisible();
    await expect(page.getByText(/Quejas Nuevas/i)).toBeVisible();
  });

  test('7. Panel Administrativo: Tarjeta de conexión WhatsApp solo-lectura en Configuración', async ({ page }) => {
    await loginPorUi(page, 'ADMIN');
    await page.goto('/admin/mirest?tab=parametros', { waitUntil: 'domcontentloaded' });

    // Comprobar la tarjeta de estado de conexión de WhatsApp (modo simulado seguro)
    const tarjetaWa = page.getByText(/modo simulado \(no se envia nada\)/i);
    await expect(tarjetaWa).toBeVisible({ timeout: 10000 });

    // Confirmar que no muestra secretos ni tokens en el texto de la pantalla
    const contenidoConfig = await page.content();
    expect(contenidoConfig).not.toContain('EAAB');
    expect(contenidoConfig).not.toContain('test-whatsapp-secret');
  });

  test('8. Identificación defensiva y edición de nombre de contacto en Mensajes', async ({ request, page }) => {
    // 1. Mensaje de remitente 1 con teléfono y profile.name
    const wamid1 = `wamid.e2e_con_tel_${Date.now()}`;
    const payloadConTel = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ profile: { name: 'Cliente Con Fono E2E' }, wa_id: '51988887777' }],
                messages: [
                  {
                    id: wamid1,
                    from: '51988887777',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hola, tengo una consulta' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const res1 = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payloadConTel,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': calcularFirma(payloadConTel),
      },
    });
    expect(res1.status()).toBe(200);

    // 2. Mensaje de remitente 2 sin teléfono (BSUID / from_user_id)
    const wamid2 = `wamid.e2e_sin_tel_${Date.now()}`;
    const payloadSinTel = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ profile: { name: 'Cliente Sin Fono E2E' }, user_id: 'usr_e2e_9988' }],
                messages: [
                  {
                    id: wamid2,
                    from_user_id: 'usr_e2e_9988',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: { body: 'Hola desde usuario sin fono' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const res2 = await request.post(`${apiBaseUrl}/whatsapp/webhook`, {
      data: payloadSinTel,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': calcularFirma(payloadSinTel),
      },
    });
    expect(res2.status()).toBe(200);

    // 3. Verificar que existen dos conversaciones distintas en BD y que no se mezclan
    const conv1 = await prisma.conversacion.findUnique({ where: { telefono: '51988887777' } });
    const conv2 = await prisma.conversacion.findUnique({ where: { telefono: 'wa-user:usr_e2e_9988' } });
    expect(conv1).not.toBeNull();
    expect(conv2).not.toBeNull();
    expect(conv1?.id).not.toBe(conv2?.id);
    expect(conv2?.identificador_tipo).toBe('USUARIO_WA');

    // 4. Iniciar sesión por UI y navegar a Mensajes
    await loginPorUi(page, 'ADMIN');
    await page.goto('/admin/mensajes');

    // 5. Verificar que ambas conversaciones se ven en la lista y la etiqueta Usuario de WhatsApp
    await expect(page.getByText('Cliente Con Fono E2E')).toBeVisible();
    await expect(page.getByText('Cliente Sin Fono E2E')).toBeVisible();
    await expect(page.getByText('Usuario de WhatsApp').first()).toBeVisible();

    // 6. Seleccionar la conversación del cliente con teléfono y editar su nombre
    await page.getByText('Cliente Con Fono E2E').click();
    await page.getByRole('button', { name: 'Editar nombre' }).click();

    // Modal de edición
    const inputNombre = page.getByLabel(/Nombre o alias del contacto/i);
    await expect(inputNombre).toBeVisible();
    await inputNombre.fill('Cliente Editado E2E');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // Confirmar en el diálogo Sí/No
    await confirmarSiNo(page, 'si');

    // 7. Verificar el cambio de nombre reflejado en la cabecera y en la lista
    await expect(
      page.getByRole('heading', { level: 2 }).or(page.locator('.cv-hn')).getByText('Cliente Editado E2E'),
    ).toBeVisible();
    await expect(page.locator('.cv-rn').getByText('Cliente Editado E2E')).toBeVisible();
  });
});
