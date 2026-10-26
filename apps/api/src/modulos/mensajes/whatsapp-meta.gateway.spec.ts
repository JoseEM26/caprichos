import { WhatsAppMetaGateway } from './whatsapp-meta.gateway';

describe('WhatsAppMetaGateway', () => {
  let prisma: any;
  let mensajeria: any;
  let gateway: WhatsAppMetaGateway;

  beforeEach(() => {
    prisma = {
      mensajeChat: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 999n,
            en: new Date('2026-10-25T18:00:00Z'),
            ...data,
          }),
        ),
      },
    };

    mensajeria = {
      estaConectado: jest.fn().mockReturnValue({ conectado: true, modo: 'meta' }),
      enviarTexto: jest.fn().mockResolvedValue({
        ok: true,
        id: '123',
        waMessageId: 'wamid.HBgLMTIzNDU2Nzg5MA==',
        estado: 'ENVIADO',
      }),
      enviarPlantilla: jest.fn().mockResolvedValue({
        ok: true,
        id: '124',
        waMessageId: 'wamid.HBgLMTIzNDU2Nzg5MQ==',
        estado: 'ENVIADO',
      }),
    };

    gateway = new WhatsAppMetaGateway(prisma, mensajeria);
  });

  it('reporta estado de conexión delegando en mensajeria', () => {
    expect(gateway.estaConectado()).toEqual({ conectado: true, modo: 'meta' });
    expect(mensajeria.estaConectado).toHaveBeenCalled();
  });

  describe('enviarTexto', () => {
    it('envía texto con modo Meta, guarda en mensaje_chat relacionando whatsapp_mensaje_id y devuelve metaId real', async () => {
      const res = await gateway.enviarTexto(1n, '999888777', 'Hola cliente', 'PERSONA');

      expect(mensajeria.enviarTexto).toHaveBeenCalledWith('999888777', 'Hola cliente', {
        conversacionId: 1n,
      });

      expect(prisma.mensajeChat.create).toHaveBeenCalledWith({
        data: {
          conversacion_id: 1n,
          direccion: 'SALE',
          autor: 'PERSONA',
          tipo: 'TEXTO',
          contenido: {
            texto: 'Hola cliente',
            estado: 'ENVIADO',
          },
          meta_id: 'wamid.HBgLMTIzNDU2Nzg5MA==',
          whatsapp_mensaje_id: 123n,
        },
      });

      expect(res).toEqual(
        expect.objectContaining({
          id: '999',
          autor: 'PERSONA',
          texto: 'Hola cliente',
          metaId: 'wamid.HBgLMTIzNDU2Nzg5MA==',
          estado: 'ENVIADO',
          modo: 'meta',
          whatsappMensajeId: 123n,
        }),
      );
    });

    it('en modo simulado guarda con estado SIMULADO y metaId null', async () => {
      mensajeria.estaConectado.mockReturnValue({ conectado: false, modo: 'simulado' });
      mensajeria.enviarTexto.mockResolvedValue({
        ok: true,
        id: '125',
        waMessageId: undefined,
        estado: 'SIMULADO',
      });

      const res = await gateway.enviarTexto(1n, '999888777', 'Prueba simulada', 'PERSONA');

      expect(res.estado).toBe('SIMULADO');
      expect(res.modo).toBe('simulado');
      expect(res.metaId).toBeNull();
      expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta_id: null,
            whatsapp_mensaje_id: 125n,
          }),
        }),
      );
    });

    it('cuando Meta rechaza el envío (ej. destinatario no verificado), guarda FALLIDO con errorCodigo', async () => {
      mensajeria.enviarTexto.mockResolvedValue({
        ok: false,
        id: '126',
        waMessageId: undefined,
        estado: 'FALLIDO',
        errorCodigo: 'DESTINATARIO_NO_VERIFICADO',
        errorDetalle: 'Recipient phone number not in allowed list',
      });

      const res = await gateway.enviarTexto(1n, '999888777', 'Mensaje a sandbox', 'PERSONA');

      expect(res.estado).toBe('FALLIDO');
      expect(res.errorCodigo).toBe('DESTINATARIO_NO_VERIFICADO');
      expect(res.errorDetalle).toBe('Recipient phone number not in allowed list');
      expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contenido: expect.objectContaining({
              estado: 'FALLIDO',
              errorCodigo: 'DESTINATARIO_NO_VERIFICADO',
            }),
          }),
        }),
      );
    });
  });

  describe('enviarPlantilla', () => {
    it('envía plantilla de WhatsApp y guarda mensaje_chat con la plantilla', async () => {
      const res = await gateway.enviarPlantilla(
        1n,
        '999888777',
        'caprichos_reabrir_conversacion',
        ['Juan'],
        'PERSONA',
      );

      expect(mensajeria.enviarPlantilla).toHaveBeenCalledWith(
        '999888777',
        'caprichos_reabrir_conversacion',
        'es',
        ['Juan'],
        { conversacionId: 1n },
      );

      expect(res.metaId).toBe('wamid.HBgLMTIzNDU2Nzg5MQ==');
      expect(res.estado).toBe('ENVIADO');
      expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'PLANTILLA',
            meta_id: 'wamid.HBgLMTIzNDU2Nzg5MQ==',
            whatsapp_mensaje_id: 124n,
          }),
        }),
      );
    });
  });
});
