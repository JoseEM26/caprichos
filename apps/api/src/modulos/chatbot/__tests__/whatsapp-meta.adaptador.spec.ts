import { ConfigService } from '@nestjs/config';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { PrismaService } from '../../../comun/prisma/prisma.service';

describe('WhatsAppMetaAdaptador', () => {
  let adaptador: WhatsAppMetaAdaptador;
  let mockConfigService: any;
  let mockPrisma: any;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;

    mockConfigService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'WHATSAPP_TOKEN') return 'EAAB_test_token_super_secreto_12345';
        if (key === 'WHATSAPP_PHONE_ID') return '109876543210';
        if (key === 'WHATSAPP_API_VERSION') return 'v20.0';
        if (key === 'WHATSAPP_TIMEOUT_MS') return 1000;
        return def;
      }),
    };

    mockPrisma = {
      whatsappMensaje: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: BigInt(101), ...data }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    adaptador = new WhatsAppMetaAdaptador(
      mockConfigService as ConfigService,
      mockPrisma as PrismaService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('reporta estado conectado cuando existen token y phoneId', () => {
    const estado = adaptador.estaConectado();
    expect(estado.conectado).toBe(true);
    expect(estado.modo).toBe('meta');
  });

  it('envía texto exitosamente (200 OK) y registra en BD', async () => {
    const mockRespuesta = {
      messaging_product: 'whatsapp',
      contacts: [{ input: '51987654321', wa_id: '51987654321' }],
      messages: [{ id: 'wamid.HBgLNTI5ODc2NTQzMjEVAgASGBQzQT...' }],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify(mockRespuesta)),
    } as any);

    const resultado = await adaptador.enviarTexto(
      '51987654321',
      'Hola, tu pedido va en camino',
      { pedidoId: '12' },
    );

    expect(resultado.exito).toBe(true);
    expect(resultado.estado).toBe('ENVIADO');
    expect(resultado.waMessageId).toBe('wamid.HBgLNTI5ODc2NTQzMjEVAgASGBQzQT...');
    expect(mockPrisma.whatsappMensaje.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direccion: 'SALIENTE',
          telefono_enmascarado: '+51 9*** ***21',
          estado: 'ENVIADO',
          tipo: 'TEXTO',
        }),
      }),
    );
  });

  it('reintenta con espera exponencial en errores reintentables 429 y 5xx', async () => {
    let llamadas = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      llamadas++;
      if (llamadas === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              error: { message: 'Rate limit hit', code: 130429 },
            }),
          ),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            messages: [{ id: 'wamid.reintentoExitoso' }],
          }),
        ),
      });
    });

    const resultado = await adaptador.enviarTexto('987654321', 'Aviso reintento');

    expect(resultado.exito).toBe(true);
    expect(resultado.reintentos).toBe(2);
    expect(llamadas).toBe(2);
  });

  it('falla de inmediato sin reintentar en número inválido (131026)', async () => {
    let llamadas = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      llamadas++;
      return Promise.resolve({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              message: 'Undeliverable message',
              code: 131026,
            },
          }),
        ),
      });
    });

    const resultado = await adaptador.enviarTexto('999999999', 'Mensaje a numero invalido');

    expect(resultado.exito).toBe(false);
    expect(resultado.errorCodigo).toBe('NUMERO_INVALIDO');
    expect(llamadas).toBe(1); // No reintenta
    expect(resultado.estado).toBe('FALLIDO');
  });

  it('clasifica error de ventana de 24 horas cerrada (131047)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            message: 'Message failed to send because more than 24 hours have passed',
            code: 131047,
          },
        }),
      ),
    } as any);

    const resultado = await adaptador.enviarTexto('987654321', 'Texto libre fuera de 24h');

    expect(resultado.exito).toBe(false);
    expect(resultado.errorCodigo).toBe('FUERA_DE_VENTANA_24H');
    expect(resultado.errorDetalle).toContain('24 horas');
  });

  it('clasifica error de plantilla no aprobada o inexistente (132000)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            message: 'Template does not exist',
            code: 132001,
          },
        }),
      ),
    } as any);

    const resultado = await adaptador.enviarPlantilla(
      '987654321',
      'plantilla_inexistente',
      'es',
    );

    expect(resultado.exito).toBe(false);
    expect(resultado.errorCodigo).toBe('PLANTILLA_NO_APROBADA');
  });

  it('NUNCA incluye el token secreto ni teléfonos completos en logs ni excepciones', async () => {
    const loggerWarnSpy = jest.spyOn((adaptador as any).logger, 'warn');
    const loggerErrorSpy = jest.spyOn((adaptador as any).logger, 'error');

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal server error on Meta cluster'),
    } as any);

    const telReal = '51987654321';
    await adaptador.enviarTexto(telReal, 'Mensaje prueba seguridad');

    // Verificar que los logs nunca contengan el token ni el número completo
    for (const llamada of loggerWarnSpy.mock.calls) {
      const textoLog = JSON.stringify(llamada);
      expect(textoLog).not.toContain('EAAB_test_token_super_secreto_12345');
      expect(textoLog).not.toContain(telReal);
    }
    for (const llamada of loggerErrorSpy.mock.calls) {
      const textoLog = JSON.stringify(llamada);
      expect(textoLog).not.toContain('EAAB_test_token_super_secreto_12345');
      expect(textoLog).not.toContain(telReal);
    }
  });

  it('envía botones interactivos limitando a máximo 3 botones', async () => {
    let payloadEnviado: any = null;
    global.fetch = jest.fn().mockImplementation((_url, opt: any) => {
      payloadEnviado = JSON.parse(opt.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ messages: [{ id: 'wamid.btn' }] })),
      });
    });

    const resultado = await adaptador.enviarBotones(
      '987654321',
      'Selecciona una opcion:',
      [
        { id: '1', titulo: 'Boton 1' },
        { id: '2', titulo: 'Boton 2' },
        { id: '3', titulo: 'Boton 3' },
        { id: '4', titulo: 'Boton 4 ignorado' },
      ],
    );

    expect(resultado.exito).toBe(true);
    expect(payloadEnviado.interactive.action.buttons).toHaveLength(3);
    expect(payloadEnviado.interactive.action.buttons[0].reply.title).toBe('Boton 1');
  });

  it('marca mensaje como leído enviando status read', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
    } as any);

    const exito = await adaptador.marcarLeido('wamid.test');
    expect(exito).toBe(true);
    expect(mockPrisma.whatsappMensaje.updateMany).toHaveBeenCalledWith({
      where: { wa_message_id: 'wamid.test' },
      data: { estado: 'LEIDO' },
    });
  });
});
