import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SaludController } from './salud.controller';
import { SaludService } from './salud.service';

describe('SaludController', () => {
  let controller: SaludController;
  let saludService: jest.Mocked<SaludService>;

  beforeEach(async () => {
    const mockSaludService = {
      verificarSalud: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaludController],
      providers: [
        {
          provide: SaludService,
          useValue: mockSaludService,
        },
      ],
    }).compile();

    controller = module.get<SaludController>(SaludController);
    saludService = module.get(SaludService);
  });

  const crearMockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  it('debe responder 200 OK cuando el estado es ok', async () => {
    const mockRespuestaOk = {
      estado: 'ok' as const,
      timestamp: new Date().toISOString(),
      detalles: {
        base: { estado: 'conectado' as const },
        redis: { estado: 'conectado' as const },
      },
    };
    saludService.verificarSalud.mockResolvedValue(mockRespuestaOk);
    const res = crearMockResponse();

    await controller.obtenerSalud(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith(mockRespuestaOk);
  });

  it('debe responder 503 SERVICE_UNAVAILABLE cuando el estado es error', async () => {
    const mockRespuestaError = {
      estado: 'error' as const,
      timestamp: new Date().toISOString(),
      detalles: {
        base: { estado: 'desconectado' as const, mensaje: 'Error de red' },
        redis: { estado: 'conectado' as const },
      },
    };
    saludService.verificarSalud.mockResolvedValue(mockRespuestaError);
    const res = crearMockResponse();

    await controller.obtenerSalud(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(mockRespuestaError);
  });
});
