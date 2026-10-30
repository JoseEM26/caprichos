jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WhatsappWebhookController } from '../controladores/whatsapp-webhook.controller';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('WhatsappWebhookController y Service', () => {
  let controller: WhatsappWebhookController;
  let service: WhatsappWebhookService;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockMensajeria: any;
  let mockArchivos: any;
  let mockMotor: any;

  const TEST_VERIFY_TOKEN = 'mi_token_verificacion_seguro_123';
  const TEST_APP_SECRET = 'secreto_app_meta_para_firmas_32_bytes_hex';

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'WHATSAPP_VERIFY_TOKEN') return TEST_VERIFY_TOKEN;
        if (key === 'WHATSAPP_APP_SECRET') return TEST_APP_SECRET;
        if (key === 'WHATSAPP_API_VERSION') return 'v20.0';
        if (key === 'WHATSAPP_TOKEN') return 'token-wa-123';
        return def;
      }),
    };

    mockPrisma = {
      whatsappMensaje: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ conversacion_id: BigInt(42) }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: BigInt(1), ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clienteWhatsappConsentimiento: {
        upsert: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      pedido: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      conversacion: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: BigInt(42), duenio: 'BOT', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where?.id || BigInt(42), duenio: 'BOT', ...data })),
      },
      mensajeChat: {
        create: jest.fn().mockResolvedValue({ id: BigInt(99) }),
      },
      encuestaPosventa: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      quejaWhatsapp: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      parametro: {
        findUnique: jest.fn().mockResolvedValue({ clave: 'encuesta_puntaje_queja', valor: 2 }),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: BigInt(10) }),
      },
    };

    mockMensajeria = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
    };

    mockArchivos = {
      subirArchivo: jest.fn().mockResolvedValue({ id: 'arch-1', url: '/admin/archivos/1' }),
    };

    mockMotor = {
      procesarMensajeEntrante: jest.fn().mockResolvedValue(true),
    };

    service = new WhatsappWebhookService(
      mockConfigService as ConfigService,
      mockPrisma as PrismaService,
      mockMensajeria as WhatsAppMensajeriaPuerto,
      mockArchivos as ArchivosService,
      undefined,
      mockMotor as any,
    );

    controller = new WhatsappWebhookController(service);
  });

  describe('GET /whatsapp/webhook (Verificación)', () => {
    it('responde 200 con challenge cuando token y mode coinciden', () => {
      const mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockImplementation((val) => val),
      } as any;

      controller.verificar('subscribe', TEST_VERIFY_TOKEN, 'CHALLENGE_12345', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('CHALLENGE_12345');
    });

    it('lanza 403 Forbidden cuando el token es incorrecto', () => {
      const mockRes = { setHeader: jest.fn(), status: jest.fn(), send: jest.fn() } as any;

      expect(() => {
        controller.verificar('subscribe', 'token_invalido', 'CHALLENGE_12345', mockRes);
      }).toThrow(ForbiddenException);
    });

    it('lanza 403 Forbidden cuando el mode no es subscribe', () => {
      const mockRes = { setHeader: jest.fn(), status: jest.fn(), send: jest.fn() } as any;

      expect(() => {
        controller.verificar('invalid_mode', TEST_VERIFY_TOKEN, 'CHALLENGE_12345', mockRes);
      }).toThrow(ForbiddenException);
    });
  });

  describe('POST /whatsapp/webhook (Validación de firma HMAC-SHA256)', () => {
    function generarFirma(cuerpo: Buffer, secreto: string): string {
      const hmac = crypto.createHmac('sha256', secreto);
      hmac.update(cuerpo);
      return `sha256=${hmac.digest('hex')}`;
    }

    it('acepta el webhook cuando la firma HMAC-SHA256 es válida', async () => {
      const body = {
        object: 'whatsapp_business_account',
        entry: [],
      };
      const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
      const signature = generarFirma(rawBody, TEST_APP_SECRET);

      const req: any = { rawBody, headers: { 'x-hub-signature-256': signature } };
      const res = await controller.recibir(req, signature, body);

      expect(res).toMatchObject({ status: 'ok' });
    });

    it('rechaza 401 si la cabecera X-Hub-Signature-256 falta o es inválida', async () => {
      const body = { object: 'whatsapp_business_account' };
      const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
      const firmaInvalida = 'sha256=firma_completamente_falsa_e_invalida';

      const req: any = { rawBody, headers: { 'x-hub-signature-256': firmaInvalida } };

      await expect(controller.recibir(req, firmaInvalida, body)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza 401 si la firma se calculó con otro secreto', async () => {
      const body = { object: 'whatsapp_business_account' };
      const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
      const firmaOtroSecreto = generarFirma(rawBody, 'otro_secreto_distinto');

      const req: any = { rawBody, headers: { 'x-hub-signature-256': firmaOtroSecreto } };

      await expect(controller.recibir(req, firmaOtroSecreto, body)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Procesamiento de eventos en service', () => {
    it('es IDEMPOTENTE por wa_message_id: no duplica mensajes ya procesados', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue({ id: BigInt(99) }); // Ya procesado

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.duplicado123',
                      from: '51987654321',
                      type: 'text',
                      text: { body: 'Hola' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const resultado = await service.procesarPayload(payload);

      expect(resultado.procesados).toBe(0);
      expect(mockPrisma.whatsappMensaje.create).not.toHaveBeenCalled();
    });

    it('registra mensaje entrante y lo asocia a conversacion y mensaje_chat', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.nuevoMsg',
                      from: '51987654321',
                      type: 'text',
                      text: { body: 'Buenas tardes' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const resultado = await service.procesarPayload(payload);

      expect(resultado.procesados).toBe(1);
      expect(mockPrisma.whatsappMensaje.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direccion: 'ENTRANTE',
            wa_message_id: 'wamid.nuevoMsg',
            telefono_enmascarado: '+51 9*** ***21',
            estado: 'ENTREGADO',
          }),
        }),
      );
      expect(mockPrisma.mensajeChat.create).toHaveBeenCalled();
    });

    it('detecta palabra BAJA / STOP y registra revocación de consentimiento (Ley 29733)', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.baja',
                      from: '51987654321',
                      type: 'text',
                      text: { body: 'BAJA' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await service.procesarPayload(payload);

      expect(mockPrisma.clienteWhatsappConsentimiento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ acepta: false, origen: 'WEBHOOK_BAJA' }),
          update: expect.objectContaining({ acepta: false, origen: 'WEBHOOK_BAJA' }),
        }),
      );
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledWith(
        '51987654321',
        expect.stringContaining('baja'),
      );
    });

    it('actualiza estados de entrega (sent/delivered/read/failed)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    { id: 'wamid.msg1', status: 'delivered' },
                    { id: 'wamid.msg2', status: 'read' },
                    {
                      id: 'wamid.msg3',
                      status: 'failed',
                      errors: [{ code: 131047, title: '24 hours passed' }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const resultado = await service.procesarPayload(payload);

      expect(resultado.estados).toBe(3);
      expect(mockPrisma.whatsappMensaje.updateMany).toHaveBeenCalledWith({
        where: { wa_message_id: 'wamid.msg1' },
        data: { estado: 'ENTREGADO' },
      });
      expect(mockPrisma.whatsappMensaje.updateMany).toHaveBeenCalledWith({
        where: { wa_message_id: 'wamid.msg2' },
        data: { estado: 'LEIDO' },
      });
      expect(mockPrisma.whatsappMensaje.updateMany).toHaveBeenCalledWith({
        where: { wa_message_id: 'wamid.msg3' },
        data: expect.objectContaining({
          estado: 'FALLIDO',
          error_codigo: '131047',
        }),
      });
    });

    it('emite el evento mensajes:actualizado al recibir un cambio de estado para refrescar en vivo', async () => {
      const mockEventos = { emitirAdmin: jest.fn() };
      const serviceConEventos = new WhatsappWebhookService(
        mockConfigService as ConfigService,
        mockPrisma as PrismaService,
        mockMensajeria as WhatsAppMensajeriaPuerto,
        mockArchivos as ArchivosService,
        mockEventos as any,
        mockMotor as any,
      );

      mockPrisma.whatsappMensaje.findFirst = jest.fn().mockResolvedValue({ conversacion_id: 42n });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: 'wamid.live_status', status: 'read' }],
                },
              },
            ],
          },
        ],
      };

      await serviceConEventos.procesarPayload(payload);

      expect(mockEventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', {
        id: '42',
      });
    });

    it('identificación con teléfono y sin teléfono: dos remitentes distintos sin mezclarse', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);
      mockPrisma.conversacion.findUnique.mockResolvedValue(null);

      // 1. Remitente con teléfono normal
      const payloadConTel = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: 'Rosa E2E' }, wa_id: '51987654321' }],
                  messages: [{ id: 'wamid.conTel', from: '51987654321', type: 'text', text: { body: 'Hola' } }],
                },
              },
            ],
          },
        ],
      };
      await service.procesarPayload(payloadConTel);

      expect(mockPrisma.conversacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telefono: '51987654321',
            identificador_tipo: 'TELEFONO',
            nombre_contacto: 'Rosa E2E',
          }),
        }),
      );

      // 2. Remitente 1 sin teléfono (BSUID / user_id)
      const payloadSinTel1 = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: 'Remitente Anonimo 1' }, user_id: 'usr_meta_001' }],
                  messages: [{ id: 'wamid.sinTel1', from_user_id: 'usr_meta_001', type: 'text', text: { body: 'Mensaje 1' } }],
                },
              },
            ],
          },
        ],
      };
      await service.procesarPayload(payloadSinTel1);

      expect(mockPrisma.conversacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telefono: 'wa-user:usr_meta_001',
            identificador_tipo: 'USUARIO_WA',
            nombre_contacto: 'Remitente Anonimo 1',
          }),
        }),
      );

      // 3. Remitente 2 sin teléfono (otro BSUID distinto)
      const payloadSinTel2 = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: 'Remitente Anonimo 2' }, user_id: 'usr_meta_002' }],
                  messages: [{ id: 'wamid.sinTel2', from_user_id: 'usr_meta_002', type: 'text', text: { body: 'Mensaje 2' } }],
                },
              },
            ],
          },
        ],
      };
      await service.procesarPayload(payloadSinTel2);

      expect(mockPrisma.conversacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telefono: 'wa-user:usr_meta_002',
            identificador_tipo: 'USUARIO_WA',
            nombre_contacto: 'Remitente Anonimo 2',
          }),
        }),
      );
    });

    it('guarda y actualiza nombre_contacto con contacts[].profile.name limpio', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);

      // Conversación existente sin editar
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: BigInt(50),
        telefono: '51987654321',
        nombre_contacto: 'Nombre Viejo',
        nombre_editado: false,
        flujo: {},
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: '  Carlos \n\r WhatsApp Nuevo  ' }, wa_id: '51987654321' }],
                  messages: [{ id: 'wamid.updateName', from: '51987654321', type: 'text', text: { body: 'Hola' } }],
                },
              },
            ],
          },
        ],
      };

      await service.procesarPayload(payload);

      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(50) },
          data: expect.objectContaining({
            nombre_contacto: 'Carlos WhatsApp Nuevo',
          }),
        }),
      );
    });

    it('nombre editado a mano NO se pisa cuando nombre_editado = true', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);

      // Conversación existente con nombre editado a mano
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: BigInt(51),
        telefono: '51987654321',
        nombre_contacto: 'Don Pepe Manual',
        nombre_editado: true,
        flujo: { nombre_perfil_wa: 'Pepe WA' },
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: 'Pepe WhatsApp Diferente' }, wa_id: '51987654321' }],
                  messages: [{ id: 'wamid.noPisar', from: '51987654321', type: 'text', text: { body: 'Hola' } }],
                },
              },
            ],
          },
        ],
      };

      await service.procesarPayload(payload);

      // Se verifica que nombre_contacto NO esté en data del update
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(51) },
          data: expect.not.objectContaining({
            nombre_contacto: expect.anything(),
          }),
        }),
      );
    });

    it('invoca al motor de conversación cuando la conversación está en manos del bot (duenio = BOT)', async () => {
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: BigInt(60),
        telefono: '51987654321',
        duenio: 'BOT',
        tomado_por: null,
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.motor.activo',
                      from: '51987654321',
                      type: 'text',
                      text: { body: 'Hola' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await service.procesarPayload(payload);

      expect(mockMotor.procesarMensajeEntrante).toHaveBeenCalledWith(
        BigInt(60),
        expect.objectContaining({
          texto: 'Hola',
          waMessageId: 'wamid.motor.activo',
        }),
      );
    });

    it('NO invoca al motor de conversación si la conversación pertenece a PERSONA', async () => {
      mockMotor.procesarMensajeEntrante.mockClear();
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: BigInt(61),
        telefono: '51987654321',
        duenio: 'PERSONA',
        tomado_por: BigInt(2),
      });
      mockPrisma.conversacion.update.mockResolvedValueOnce({
        id: BigInt(61),
        telefono: '51987654321',
        duenio: 'PERSONA',
        tomado_por: BigInt(2),
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.motor.persona',
                      from: '51987654321',
                      type: 'text',
                      text: { body: 'Hola asesor' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await service.procesarPayload(payload);

      expect(mockMotor.procesarMensajeEntrante).not.toHaveBeenCalled();
    });

    it('NO invoca al motor de conversación ante comandos de baja o alta (BAJA/STOP)', async () => {
      mockMotor.procesarMensajeEntrante.mockClear();
      mockPrisma.whatsappMensaje.findUnique.mockResolvedValue(null);
      mockPrisma.conversacion.findUnique.mockResolvedValue({
        id: BigInt(62),
        telefono: '51987654321',
        duenio: 'BOT',
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.motor.baja',
                      from: '51987654321',
                      type: 'text',
                      text: { body: 'BAJA' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await service.procesarPayload(payload);

      expect(mockMotor.procesarMensajeEntrante).not.toHaveBeenCalled();
    });
  });
});
