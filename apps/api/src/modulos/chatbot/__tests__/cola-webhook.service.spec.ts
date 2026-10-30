jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ColaWebhookService } from '../servicios/cola-webhook.service';
import { WhatsappWebhookController } from '../controladores/whatsapp-webhook.controller';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import * as crypto from 'crypto';

describe('ColaWebhookService y WhatsappWebhookController (BullMQ)', () => {
  let colaService: ColaWebhookService;
  let mockWebhookService: Partial<WhatsappWebhookService>;
  let mockConfigService: Partial<ConfigService>;
  let controller: WhatsappWebhookController;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'REDIS_HOST') return '127.0.0.1';
        if (key === 'REDIS_PORT') return 6379;
        return defaultVal;
      }),
    };

    mockWebhookService = {
      validarFirma: jest.fn(),
      procesarPayload: jest.fn().mockResolvedValue({ idMensaje: 'msg-1' }),
    };

    colaService = new ColaWebhookService(
      mockConfigService as ConfigService,
      mockWebhookService as WhatsappWebhookService,
    );

    controller = new WhatsappWebhookController(
      mockWebhookService as WhatsappWebhookService,
      colaService,
    );
  });

  afterEach(async () => {
    await colaService.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('Deduplicación por sha256 de rawBody', () => {
    it('genera el mismo jobId a partir del mismo payload rawBody', () => {
      const rawBody1 = Buffer.from(JSON.stringify({ entry: [{ id: '123' }] }));
      const rawBody2 = Buffer.from(JSON.stringify({ entry: [{ id: '123' }] }));

      const jobId1 = colaService.calcularJobId(rawBody1);
      const jobId2 = colaService.calcularJobId(rawBody2);

      const esperado = crypto.createHash('sha256').update(rawBody1).digest('hex');
      expect(jobId1).toBe(esperado);
      expect(jobId2).toBe(jobId1);
    });

    it('genera jobIds distintos si el payload rawBody cambia', () => {
      const raw1 = Buffer.from('payload-uno');
      const raw2 = Buffer.from('payload-dos');

      expect(colaService.calcularJobId(raw1)).not.toBe(colaService.calcularJobId(raw2));
    });
  });

  describe('Encolado con BullMQ y Fallback en línea', () => {
    it('encola exitosamente cuando la cola está lista y retorna jobId', async () => {
      const mockCola: any = {
        add: jest.fn().mockResolvedValue({ id: 'hash-123' }),
        on: jest.fn(),
      };
      (colaService as any).cola = mockCola;
      (colaService as any).disponible = true;

      const rawBody = Buffer.from('{"test":true}');
      const body = { test: true };

      const resultado = await colaService.encolarOProcesar(rawBody, body);

      expect(resultado.encolado).toBe(true);
      expect(resultado.jobId).toBe(colaService.calcularJobId(rawBody));
      expect(mockCola.add).toHaveBeenCalledWith(
        'procesar-webhook',
        body,
        expect.objectContaining({
          jobId: colaService.calcularJobId(rawBody),
          attempts: 5,
        }),
      );
      // No debe llamar al procesamiento en línea porque fue encolado
      expect(mockWebhookService.procesarPayload).not.toHaveBeenCalled();
    });

    it('cae a procesamiento en línea si la cola no está disponible (resiliencia sin perder mensaje)', async () => {
      (colaService as any).disponible = false;

      const rawBody = Buffer.from('{"test":"offline"}');
      const body = { test: 'offline' };

      const resultado = await colaService.encolarOProcesar(rawBody, body);

      expect(resultado.encolado).toBe(false);
      expect(resultado.enLinea).toBe(true);
      expect(mockWebhookService.procesarPayload).toHaveBeenCalledWith(body);
    });

    it('cae a procesamiento en línea si cola.add arroja error', async () => {
      const mockCola: any = {
        add: jest.fn().mockRejectedValue(new Error('Redis cluster unreachable')),
      };
      (colaService as any).cola = mockCola;
      (colaService as any).disponible = true;

      const rawBody = Buffer.from('{"test":"error"}');
      const body = { test: 'error' };

      const resultado = await colaService.encolarOProcesar(rawBody, body);

      expect(resultado.encolado).toBe(false);
      expect(resultado.enLinea).toBe(true);
      expect(mockWebhookService.procesarPayload).toHaveBeenCalledWith(body);
    });
  });

  describe('Integración con WhatsappWebhookController', () => {
    it('encola y responde 200 de inmediato si la firma es válida', async () => {
      (mockWebhookService.validarFirma as jest.Mock).mockReturnValue(true);

      const mockCola: any = {
        add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      };
      (colaService as any).cola = mockCola;
      (colaService as any).disponible = true;

      const rawBody = Buffer.from('{"entry":[]}');
      const req: any = { rawBody };

      const respuesta: any = await controller.recibir(req, 'sha256=firma-valida', { entry: [] });

      expect(respuesta.status).toBe('ok');
      expect(respuesta.ok).toBe(true);
      expect(respuesta.encolado).toBe(true);
      expect(respuesta.jobId).toBe(colaService.calcularJobId(rawBody));
    });

    it('cae a procesamiento en línea y responde 200 si falla la cola con firma válida', async () => {
      (mockWebhookService.validarFirma as jest.Mock).mockReturnValue(true);
      (colaService as any).disponible = false;

      const rawBody = Buffer.from('{"entry":[]}');
      const req: any = { rawBody };

      const respuesta: any = await controller.recibir(req, 'sha256=firma-valida', { entry: [] });

      expect(respuesta.status).toBe('ok');
      expect(respuesta.ok).toBe(true);
      expect(respuesta.enLinea).toBe(true);
      expect(mockWebhookService.procesarPayload).toHaveBeenCalled();
    });

    it('rechaza 401 Unauthorized sin encolar ni procesar si la firma es inválida', async () => {
      (mockWebhookService.validarFirma as jest.Mock).mockReturnValue(false);

      const spyEncolar = jest.spyOn(colaService, 'encolarOProcesar');
      const req: any = { rawBody: Buffer.from('intruso') };

      await expect(
        controller.recibir(req, 'sha256=firma-falsa', { mensaje: 'hacked' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(spyEncolar).not.toHaveBeenCalled();
      expect(mockWebhookService.procesarPayload).not.toHaveBeenCalled();
    });
  });
});
