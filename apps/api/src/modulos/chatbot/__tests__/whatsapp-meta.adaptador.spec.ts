import { ConfigService } from '@nestjs/config';
import {
  WhatsAppMetaAdaptador,
  construirDestinatario,
} from '../adaptadores/whatsapp-meta.adaptador';
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

  it('envía lista interactiva limitando a máximo 10 filas', async () => {
    let payloadEnviado: any = null;
    global.fetch = jest.fn().mockImplementation((_url, opt: any) => {
      payloadEnviado = JSON.parse(opt.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ messages: [{ id: 'wamid.list' }] })),
      });
    });

    const filasPrueba = Array.from({ length: 15 }, (_, i) => ({
      id: `item_${i + 1}`,
      titulo: `Opción ${i + 1}`,
      descripcion: `Detalle ${i + 1}`,
    }));

    const resultado = await adaptador.enviarLista(
      '987654321',
      'Elige de la lista:',
      'Ver lista',
      filasPrueba,
      { tituloSeccion: 'Categorías' },
    );

    expect(resultado.exito).toBe(true);
    expect(payloadEnviado.type).toBe('interactive');
    expect(payloadEnviado.interactive.type).toBe('list');
    expect(payloadEnviado.interactive.action.button).toBe('Ver lista');
    expect(payloadEnviado.interactive.action.sections[0].title).toBe('Categorías');
    expect(payloadEnviado.interactive.action.sections[0].rows).toHaveLength(10);
    expect(payloadEnviado.interactive.action.sections[0].rows[0].id).toBe('item_1');
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

  describe('construirDestinatario (función pura)', () => {
    it('BSUID con prefijo wa-user devuelve recipient y no to', () => {
      const res = construirDestinatario('wa-user:PE.1048174911395155');
      expect(res).toEqual({
        recipient_type: 'individual',
        recipient: 'PE.1048174911395155',
      });
      expect(res.to).toBeUndefined();
    });

    it('BSUID con prefijo wa-user corto devuelve recipient', () => {
      const res = construirDestinatario('wa-user:PE.123');
      expect(res).toEqual({
        recipient_type: 'individual',
        recipient: 'PE.123',
      });
      expect(res.to).toBeUndefined();
    });

    it('BSUID sin prefijo devuelve recipient y no to', () => {
      const res = construirDestinatario('PE.1048174911395155');
      expect(res).toEqual({
        recipient_type: 'individual',
        recipient: 'PE.1048174911395155',
      });
      expect(res.to).toBeUndefined();
    });

    it('BSUID sin prefijo corto devuelve recipient', () => {
      const res = construirDestinatario('PE.123');
      expect(res).toEqual({
        recipient_type: 'individual',
        recipient: 'PE.123',
      });
      expect(res.to).toBeUndefined();
    });

    it('E.164 con + devuelve to sin + y no recipient', () => {
      const res = construirDestinatario('+51987654321');
      expect(res).toEqual({
        recipient_type: 'individual',
        to: '51987654321',
      });
      expect(res.recipient).toBeUndefined();
    });

    it('E.164 sin + devuelve to y no recipient', () => {
      const res = construirDestinatario('51987654321');
      expect(res).toEqual({
        recipient_type: 'individual',
        to: '51987654321',
      });
      expect(res.recipient).toBeUndefined();
    });

    it('identificador vacío devuelve to vacío', () => {
      const res = construirDestinatario('');
      expect(res).toEqual({
        recipient_type: 'individual',
        to: '',
      });
      expect(res.recipient).toBeUndefined();
    });
  });

  describe('Cuerpo exacto en los cuatro métodos de envío (recipient vs to)', () => {
    let payloadCapturado: any;

    beforeEach(() => {
      payloadCapturado = null;
      global.fetch = jest.fn().mockImplementation((_url, opt: any) => {
        payloadCapturado = JSON.parse(opt.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({ messages: [{ id: 'wamid.test.123' }] }),
          ),
        });
      });
    });

    it('enviarTexto con BSUID envía recipient y NO to', async () => {
      await adaptador.enviarTexto('wa-user:PE.1048174911395155', 'Hola por BSUID');
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          recipient: 'PE.1048174911395155',
          type: 'text',
          text: { preview_url: false, body: 'Hola por BSUID' },
        }),
      );
      expect(payloadCapturado.to).toBeUndefined();
    });

    it('enviarTexto con teléfono envía to y NO recipient', async () => {
      await adaptador.enviarTexto('+51987654321', 'Hola por teléfono');
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '51987654321',
          type: 'text',
          text: { preview_url: false, body: 'Hola por teléfono' },
        }),
      );
      expect(payloadCapturado.recipient).toBeUndefined();
    });

    it('enviarPlantilla con BSUID envía recipient y NO to', async () => {
      await adaptador.enviarPlantilla('PE.123', 'caprichos_reabrir_conversacion', 'es', ['Cliente']);
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          recipient: 'PE.123',
          type: 'template',
          template: expect.objectContaining({
            name: 'caprichos_reabrir_conversacion',
            language: { code: 'es' },
          }),
        }),
      );
      expect(payloadCapturado.to).toBeUndefined();
    });

    it('enviarPlantilla con teléfono envía to y NO recipient', async () => {
      await adaptador.enviarPlantilla('51987654321', 'caprichos_reabrir_conversacion', 'es', ['Cliente']);
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '51987654321',
          type: 'template',
        }),
      );
      expect(payloadCapturado.recipient).toBeUndefined();
    });

    it('enviarBotones con BSUID envía recipient y NO to', async () => {
      await adaptador.enviarBotones('wa-user:PE.123', 'Elige:', [{ id: '1', titulo: 'Opcion' }]);
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          recipient: 'PE.123',
          type: 'interactive',
        }),
      );
      expect(payloadCapturado.to).toBeUndefined();
    });

    it('enviarBotones con teléfono envía to y NO recipient', async () => {
      await adaptador.enviarBotones('987654321', 'Elige:', [{ id: '1', titulo: 'Opcion' }]);
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '51987654321',
          type: 'interactive',
        }),
      );
      expect(payloadCapturado.recipient).toBeUndefined();
    });

    it('enviarLista con BSUID envía recipient y NO to', async () => {
      await adaptador.enviarLista('wa-user:PE.123', 'Lista:', 'Ver', [{ id: '1', titulo: 'Fila' }]);
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          recipient: 'PE.123',
          type: 'interactive',
        }),
      );
      expect(payloadCapturado.to).toBeUndefined();
    });

    it('enviarLista con teléfono envía to y NO recipient', async () => {
      await adaptador.enviarLista('+51987654321', 'Lista:', 'Ver', [{ id: '1', titulo: 'Fila' }]);
      expect(payloadCapturado).toEqual(
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '51987654321',
          type: 'interactive',
        }),
      );
      expect(payloadCapturado.recipient).toBeUndefined();
    });
  });

  describe('Mapeo de errores al rechazar BSUID por Meta', () => {
    it('clasifica error 100 de Meta sobre recipient como BSUID_NO_PERMITIDO con mensaje amigable', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 100,
              message: 'Invalid parameter',
              error_data: { details: 'Invalid recipient format or identifier not allowed' },
            },
          }),
        ),
      } as any);

      const res = await adaptador.enviarTexto('wa-user:PE.123456789', 'Prueba error BSUID');
      expect(res.exito).toBe(false);
      expect(res.errorCodigo).toBe('BSUID_NO_PERMITIDO');
      expect(res.errorDetalle).toBe(
        'Meta no permite escribir a este contacto por su identificador. Pidele su numero de celular.',
      );
    });

    it('clasifica error 131009 con BSUID como BSUID_NO_PERMITIDO', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 131009,
              message: 'Parameter value is not valid',
            },
          }),
        ),
      } as any);

      const res = await adaptador.enviarPlantilla('PE.123', 'caprichos_reabrir_conversacion', 'es');
      expect(res.exito).toBe(false);
      expect(res.errorCodigo).toBe('BSUID_NO_PERMITIDO');
      expect(res.errorDetalle).toBe(
        'Meta no permite escribir a este contacto por su identificador. Pidele su numero de celular.',
      );
    });
  });

  describe('Enmascarado seguro de BSUID', () => {
    it('enmascara BSUID en logs y BD sin registrar nunca el identificador completo', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({ messages: [{ id: 'wamid.bsuid.ok' }] }),
        ),
      } as any);

      const loggerWarnSpy = jest.spyOn((adaptador as any).logger, 'warn');
      const loggerLogSpy = jest.spyOn((adaptador as any).logger, 'log');

      await adaptador.enviarTexto('wa-user:PE.187654326', 'Prueba enmascarado');

      expect(mockPrisma.whatsappMensaje.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telefono_enmascarado: 'PE.187***6',
          }),
        }),
      );

      // Verificar que los logs no tengan el BSUID completo
      for (const call of [...loggerWarnSpy.mock.calls, ...loggerLogSpy.mock.calls]) {
        const txt = JSON.stringify(call);
        expect(txt).not.toContain('187654326');
      }
    });
  });

  describe('Envío de imágenes (enviarImagen)', () => {
    it('envía imagen con URL correctamente a Meta y persiste tipo IMAGEN', async () => {
      const mockRespuesta = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.img.123' }],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockRespuesta)),
      } as any);

      const resultado = await adaptador.enviarImagen(
        '51987654321',
        'https://ejemplo.com/qr-pago.png',
        'Escanea este QR para pagar tu pedido',
        { pedidoId: '55' },
      );

      expect(resultado.exito).toBe(true);
      expect(resultado.waMessageId).toBe('wamid.img.123');
      expect(resultado.estado).toBe('ENVIADO');
      expect(mockPrisma.whatsappMensaje.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'IMAGEN',
            direccion: 'SALIENTE',
            estado: 'ENVIADO',
          }),
        }),
      );

      const bodyEnviado = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(bodyEnviado.type).toBe('image');
      expect(bodyEnviado.image.link).toBe('https://ejemplo.com/qr-pago.png');
      expect(bodyEnviado.image.caption).toBe('Escanea este QR para pagar tu pedido');
    });

    it('envía imagen con ID de archivo/media correctamente a Meta', async () => {
      const mockRespuesta = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.img.id.456' }],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(mockRespuesta)),
      } as any);

      const resultado = await adaptador.enviarImagen(
        '51987654321',
        'media_id_123456789',
      );

      expect(resultado.exito).toBe(true);
      const bodyEnviado = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(bodyEnviado.type).toBe('image');
      expect(bodyEnviado.image.id).toBe('media_id_123456789');
    });
  });
});
