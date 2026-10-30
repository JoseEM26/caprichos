jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VouchersIaService } from '../vouchers-ia.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { IaConsumoService } from '../../chatbot/ia/ia-consumo.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';

describe('VouchersIaService', () => {
  let service: VouchersIaService;
  let prismaMock: any;
  let redisMock: any;
  let iaConsumoMock: any;
  let configMock: any;
  let avisosMock: any;
  let fetchOriginal: any;

  beforeAll(() => {
    fetchOriginal = global.fetch;
  });

  afterAll(() => {
    global.fetch = fetchOriginal;
  });

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findUnique: jest.fn(),
      },
      iaConsumo: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { id: 0 },
          _sum: { tokens_entrada: 0, tokens_salida: 0, costo_usd_estimado: 0 },
        }),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };

    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      }),
    };

    iaConsumoMock = {
      registrarConsumo: jest.fn().mockResolvedValue(0.001),
      verificarTopeMensualAlcanzado: jest.fn().mockResolvedValue(true), // tope del chat: NO aplica a vouchers
      obtenerTopeMensualUsd: jest.fn().mockResolvedValue(20),
    };

    avisosMock = {
      enviarAvisoAdmin: jest.fn().mockResolvedValue({ omitido: true }),
    };

    configMock = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'OPENAI_API_KEY') return 'test-openai-key';
        if (key === 'OPENAI_VISION_MODEL') return 'gpt-4o-mini';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersIaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: IaConsumoService, useValue: iaConsumoMock },
        { provide: AvisosInternosService, useValue: avisosMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<VouchersIaService>(VouchersIaService);
  });

  it('retorna sinLectura=true si voucher_ia_activo es false', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_ia_activo', valor: false });

    const buffer = Buffer.from('fake-image-content');
    const res = await service.analizarVoucher(buffer, 'image/jpeg');

    expect(res.sinLectura).toBe(true);
    expect(res.extraido).toBeNull();
    expect(res.motivo).toMatch(/desactivada/i);
  });

  it('retorna sinLectura=true si OPENAI_API_KEY no está configurada', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_ia_activo', valor: true });
    // Crear instancia sin key
    configMock.get.mockImplementation((k: string) => (k === 'OPENAI_API_KEY' ? '' : 'gpt-4o-mini'));
    const moduleSinKey = await Test.createTestingModule({
      providers: [
        VouchersIaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: IaConsumoService, useValue: iaConsumoMock },
        { provide: AvisosInternosService, useValue: avisosMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    const serviceSinKey = moduleSinKey.get<VouchersIaService>(VouchersIaService);

    const buffer = Buffer.from('fake-image-content');
    const res = await serviceSinKey.analizarVoucher(buffer, 'image/jpeg');

    expect(res.sinLectura).toBe(true);
    expect(res.extraido).toBeNull();
    expect(res.motivo).toMatch(/no configurada/i);
  });

  it('solo envía la imagen a OpenAI (sin datos del cliente ni del pedido) y parsea el JSON estrictamente', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_ia_activo', valor: true });

    let requestBodyCapturado: any = null;

    global.fetch = jest.fn().mockImplementation(async (url: string, opts: any) => {
      requestBodyCapturado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  legible: true,
                  monto: 45.0,
                  moneda: 'PEN',
                  operacion: '98765432',
                  fecha: '2026-10-27',
                  hora: '15:20',
                  titular: 'Maria Jose Morillo Ruiz',
                  destinoNumero: '977503006',
                  medioDetectado: 'YAPE',
                  confianza: 0.95,
                  notas: 'Voucher nítido con logo de Yape',
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 350,
            completion_tokens: 65,
          },
        }),
      };
    }) as any;

    const buffer = Buffer.from('fake-image-bytes-123');
    const res = await service.analizarVoucher(buffer, 'image/jpeg', { conversacionId: 101n });

    expect(res.sinLectura).toBe(false);
    expect(res.extraido).toBeDefined();
    expect(res.extraido?.legible).toBe(true);
    expect(res.extraido?.monto).toBe(45.0);
    expect(res.extraido?.medioDetectado).toBe('YAPE');
    expect(res.extraido?.operacion).toBe('98765432');
    expect(res.extraido?.titular).toBe('Maria Jose Morillo Ruiz');

    // Verificar que solo se envió la imagen sin datos personales ni del pedido
    expect(requestBodyCapturado).toBeDefined();
    expect(requestBodyCapturado.temperature).toBe(0);
    expect(requestBodyCapturado.response_format).toEqual({ type: 'json_object' });

    const userMessage = requestBodyCapturado.messages.find((m: any) => m.role === 'user');
    expect(userMessage).toBeDefined();
    // Debe tener text y image_url solamente
    const imageUrlPart = userMessage.content.find((p: any) => p.type === 'image_url');
    expect(imageUrlPart.image_url.url).toContain('data:image/jpeg;base64,');

    // Comprobamos que no se incluyó texto con cliente, teléfono o pedido
    const textPart = userMessage.content.find((p: any) => p.type === 'text');
    expect(textPart.text).not.toContain('cliente');
    expect(textPart.text).not.toContain('telefono');
    expect(textPart.text).not.toContain('pedido');

    // Verificar que registró el consumo en IaConsumo con origen VOUCHER
    expect(iaConsumoMock.registrarConsumo).toHaveBeenCalledWith(
      expect.objectContaining({
        origen: 'VOUCHER',
        modelo: 'gpt-4o-mini',
        tokensEntrada: 350,
        tokensSalida: 65,
        resultado: 'EXITO',
      }),
    );
  });

  it('el tope mensual del chat no bloquea la lectura de vouchers (solo cuenta el gasto VOUCHER)', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_ia_activo', valor: true });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                legible: true,
                monto: 20.0,
                moneda: 'PEN',
                medioDetectado: 'PLIN',
                confianza: 0.9,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    }) as any;

    const buffer = Buffer.from('fake-image');
    const res = await service.analizarVoucher(buffer, 'image/png');

    // Debe procesar con éxito a pesar de que verificarTopeMensualAlcanzado devuelva true
    expect(res.sinLectura).toBe(false);
    expect(res.extraido?.monto).toBe(20.0);
  });

  it('controla el límite anti-abuso de Redis (máximo 10 por minuto)', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_ia_activo', valor: true });

    // Simulamos que superó 10 consultas en el minuto
    redisMock.obtenerCliente.mockReturnValue({
      incr: jest.fn().mockResolvedValue(11),
      expire: jest.fn().mockResolvedValue(1),
    });

    // Ponytail: no lanza. Sobre el límite devuelve SIN_LECTURA para que el voucher se guarde igual.
    const buffer = Buffer.from('fake-image');
    const res = await service.analizarVoucher(buffer, 'image/jpeg', {
      identificadorRateLimit: 'usuario_42',
    });
    expect(res.sinLectura).toBe(true);
    expect(res.extraido).toBeNull();
    expect(res.motivo).toMatch(/Límite de lecturas de vouchers por minuto excedido/i);
  });

  it('retorna sinLectura=true ante error en OpenAI y no propaga error no controlado', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_ia_activo', valor: true });

    global.fetch = jest.fn().mockRejectedValue(new Error('OpenAI timeout after 20s'));

    const buffer = Buffer.from('fake-image');
    const res = await service.analizarVoucher(buffer, 'image/jpeg');

    expect(res.sinLectura).toBe(true);
    expect(res.extraido).toBeNull();
    expect(res.motivo).toContain('OpenAI timeout');
  });
});
