jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Prueba de punta a punta del comprobante que llega por WhatsApp:
// webhook real -> guardarVoucherPrivado / rama sin pedido -> VouchersService real -> VouchersIaService real.
// Simulados: la descarga de media de Meta, la llamada a OpenAI (fetch) y la base de datos.

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { VouchersService } from '../../vouchers/vouchers.service';
import { VouchersIaService } from '../../vouchers/vouchers-ia.service';
import { PagoPlanService } from '../../pedidos/pago-plan.service';

const flush = () => new Promise((r) => setTimeout(r, 30));

const respuestaOpenAi = (contenido: Record<string, unknown>) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{ message: { content: JSON.stringify(contenido) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  }),
  text: async () => '',
});

describe('Comprobante de WhatsApp: siempre se guarda y se analiza', () => {
  let webhook: WhatsappWebhookService;
  let prisma: any;
  let archivos: any;
  let fetchMock: jest.Mock;
  let conversacionExistente: any;
  let pedidoPorTelefono: any;
  let openAiRespuesta: () => Promise<any>;
  let config: ConfigService;
  let motor: any;
  let vouchers: VouchersService;

  const payloadImagen = (from: string, extra: Record<string, unknown> = {}) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: from, profile: { name: 'Ana' } }],
              messages: [
                {
                  id: 'wamid.TEST1',
                  from,
                  type: 'image',
                  image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'aquí va el pago' },
                  ...extra,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    conversacionExistente = null;
    pedidoPorTelefono = null;
    openAiRespuesta = async () =>
      respuestaOpenAi({ legible: true, monto: 35, operacion: 'OP-778', medioDetectado: 'YAPE', confianza: 0.92 });

    // Meta: primero la URL de media, luego los bytes; OpenAI: la lectura del voucher
    fetchMock = jest.fn(async (url: string) => {
      if (String(url).startsWith('https://graph.facebook.com/')) {
        return { ok: true, status: 200, json: async () => ({ url: 'https://lookaside.example/media-1' }) };
      }
      if (String(url).startsWith('https://lookaside.example/')) {
        const bytes = Buffer.from('imagen-del-pago');
        return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
      }
      if (String(url).startsWith('https://api.openai.com/')) {
        return openAiRespuesta();
      }
      throw new Error(`URL no simulada: ${url}`);
    });
    (global as any).fetch = fetchMock;

    const voucherRows: any[] = [];
    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      pedido: {
        findFirst: jest.fn(async () => pedidoPorTelefono),
        findUnique: jest.fn(async () => pedidoPorTelefono),
      },
      conversacion: {
        findUnique: jest.fn(async () => conversacionExistente),
        create: jest.fn(async ({ data }: any) => ({ id: 42n, duenio: 'BOT', flujo: null, ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 42n, duenio: 'BOT', ...data })),
      },
      mensajeChat: { create: jest.fn().mockResolvedValue({ id: 99n }) },
      encuestaPosventa: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 7n, ...data })) },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.clave === 'voucher_ia_activo' ? { clave: 'voucher_ia_activo', valor: true } : null,
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      voucherPago: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => {
          const fila = { id: BigInt(voucherRows.length + 1), creado_en: new Date(), ...data };
          voucherRows.push(fila);
          return fila;
        }),
      },
      $voucherRows: voucherRows,
    };

    archivos = {
      subirArchivo: jest.fn().mockResolvedValue({ id: '900', url: '/admin/archivos/900' }),
    };

    config = {
      get: (clave: string, def?: any) => {
        if (clave === 'OPENAI_API_KEY') return 'sk-test-no-real';
        if (clave === 'WHATSAPP_TOKEN') return 'token-wa-test';
        if (clave === 'WHATSAPP_API_VERSION') return 'v20.0';
        return def;
      },
    } as unknown as ConfigService;

    const iaIa = new VouchersIaService(
      config,
      prisma,
      { obtenerCliente: () => ({ incr: async () => 1, expire: async () => 1 }) } as any,
      { registrarConsumo: jest.fn().mockResolvedValue(undefined) } as any,
      { enviarAvisoAdmin: jest.fn().mockResolvedValue({ omitido: true }) } as any,
    );
    vouchers = new VouchersService(prisma, archivos, { registrar: jest.fn() } as any, iaIa, new PagoPlanService());

    const mensajeria = { enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }) };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };

    webhook = new WhatsappWebhookService(
      config,
      prisma,
      mensajeria as any,
      archivos,
      undefined,
      motor as any,
      undefined,
      vouchers,
    );
  });

  it('imagen de un cliente con pedido (teléfono): archivo privado, fila voucher_pago enlazada al pedido y análisis con IA', async () => {
    pedidoPorTelefono = { id: 50n, codigo: 'CP-50', total: 35, pago_preferido: 'YAPE', pago_metodo: null, estado: 'COLA' };

    await webhook.procesarPayload(payloadImagen('51987654321'));
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('graph.facebook.com/v20.0/media-1'), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.anything());
    expect(archivos.subirArchivo).toHaveBeenCalledWith(expect.objectContaining({ mimetype: 'image/jpeg' }), true);
    expect(prisma.$voucherRows).toHaveLength(1);
    expect(prisma.$voucherRows[0]).toMatchObject({ pedido_id: 50n, archivo_id: 900n, origen: 'WHATSAPP', semaforo: expect.any(String) });
  });

  it('voucher ligado a un pedido: acuse por el outbox al cliente y el motor no contesta esa foto', async () => {
    pedidoPorTelefono = { id: 50n, codigo: 'CP-50', total: 35, pago_preferido: 'YAPE', pago_metodo: null, estado: 'COLA' };
    const outbox = { encolar: jest.fn().mockResolvedValue({}), despertar: jest.fn() };
    const conOutbox = new WhatsappWebhookService(
      config, prisma, { enviarTexto: jest.fn() } as any, archivos, undefined, motor, undefined, vouchers, undefined, outbox as any,
    );

    await conOutbox.procesarPayload(payloadImagen('51987654321'));
    await flush();

    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    expect(outbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: '51987654321',
        clave: 'voucher-recibido-900',
        pedidoId: 50n,
        carga: expect.objectContaining({ textoLibre: expect.stringContaining('CP-50'), autor: 'BOT' }),
      }),
    );
    expect(outbox.despertar).toHaveBeenCalled();
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('una reaccion (emoji) se registra en el chat pero no llega al motor', async () => {
    const payload: any = payloadImagen('51987654321');
    payload.entry[0].changes[0].value.messages[0] = {
      id: 'wamid.REACC', from: '51987654321', type: 'reaction', reaction: { emoji: '👍', message_id: 'wamid.X' },
    };

    await webhook.procesarPayload(payload);
    await flush();

    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contenido: { texto: 'Reaccionó con 👍' } }) }),
    );
  });

  it('imagen sin pedido asociado: se guarda igual (pedido_id null) y se analiza', async () => {
    pedidoPorTelefono = null;

    await webhook.procesarPayload(payloadImagen('51912345678'));
    await flush();

    expect(prisma.$voucherRows).toHaveLength(1);
    expect(prisma.$voucherRows[0]).toMatchObject({ pedido_id: null, archivo_id: 900n, origen: 'WHATSAPP' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.anything());
  });

  it('cliente sin teléfono (BSUID): se guarda la imagen y la fila voucher_pago aunque no haya pedido', async () => {
    pedidoPorTelefono = null;

    await webhook.procesarPayload(payloadImagen('bsuid-7f3a9c'));
    await flush();

    expect(archivos.subirArchivo).toHaveBeenCalled();
    expect(prisma.$voucherRows).toHaveLength(1);
    expect(prisma.$voucherRows[0]).toMatchObject({ pedido_id: null, archivo_id: 900n });
    expect(prisma.conversacion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ telefono: expect.stringMatching(/^wa-user:/) }) }),
    );
  });

  it('la IA falla (OpenAI 500): el voucher queda guardado como SIN_LECTURA', async () => {
    pedidoPorTelefono = { id: 50n, codigo: 'CP-50', total: 35, pago_preferido: 'YAPE', pago_metodo: null, estado: 'COLA' };
    openAiRespuesta = async () => ({ ok: false, status: 500, text: async () => 'error interno', json: async () => ({}) });

    await webhook.procesarPayload(payloadImagen('51987654321'));
    await flush();

    expect(prisma.$voucherRows).toHaveLength(1);
    expect(prisma.$voucherRows[0]).toMatchObject({ semaforo: 'SIN_LECTURA', extraido: null, archivo_id: 900n });
  });

  it('chat que atiende una persona (VALIDAR_PAGO, duenio PERSONA): el análisis corre igual', async () => {
    pedidoPorTelefono = null;
    conversacionExistente = {
      id: 42n,
      telefono: '51912345678',
      duenio: 'PERSONA',
      tomado_por: 9n,
      estado: 'VALIDAR_PAGO',
      flujo: {},
    };

    await webhook.procesarPayload(payloadImagen('51912345678'));
    await flush();

    expect(prisma.$voucherRows).toHaveLength(1);
    expect(prisma.$voucherRows[0]).toMatchObject({ conversacion_id: 42n });
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.anything());
  });

  it('si Meta no entrega los bytes (falla o más de 5 MB): no hay archivo que guardar, Caja recibe aviso', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({}) }));

    await webhook.procesarPayload(payloadImagen('51912345678'));
    await flush();

    expect(prisma.$voucherRows).toHaveLength(0);
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'COMPROBANTE_NO_GUARDADO', rol_destino: 'CAJERO' }),
    });
  });
});
