import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AltaDemandaService } from './alta-demanda.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('AltaDemandaService', () => {
  let service: AltaDemandaService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;

  const mockUsuarioCocina: UsuarioAutenticado = {
    partyId: 50n,
    rol: 'COCINA',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      altaDemanda: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      parametro: {
        upsert: jest.fn(),
      },
      person: {
        findUnique: jest.fn(),
      },
      userAccount: {
        findUnique: jest.fn(),
      },
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(true),
    };

    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AltaDemandaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
      ],
    }).compile();

    service = module.get<AltaDemandaService>(AltaDemandaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validaciones de configuración', () => {
    it('lanza 400 MINUTOS_INVALIDOS si los minutos están fuera del rango [5, 180]', async () => {
      // Menos de 5
      await expect(
        service.configurar(
          { activa: true, minutos: 4, pausa: false },
          mockUsuarioCocina,
        ),
      ).rejects.toThrow(BadRequestException);

      // Más de 180
      await expect(
        service.configurar(
          { activa: true, minutos: 181, pausa: false },
          mockUsuarioCocina,
        ),
      ).rejects.toThrow(BadRequestException);

      // Minutos undefined al activar
      await expect(
        service.configurar(
          { activa: true, pausa: false } as any,
          mockUsuarioCocina,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 409 PAUSA_SIN_ALTA_DEMANDA si se intenta pausar sin activar alta demanda', async () => {
      await expect(
        service.configurar(
          { activa: false, pausa: true },
          mockUsuarioCocina,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.altaDemanda.create).not.toHaveBeenCalled();
    });
  });

  describe('activación y desactivación', () => {
    it('activa alta demanda, guarda registro, sincroniza parámetro y emite evento con «activó <nombre>»', async () => {
      prisma.person.findUnique.mockResolvedValue({
        nombres: 'José',
        apellidos: 'Espinoza',
      });
      prisma.altaDemanda.updateMany.mockResolvedValue({ count: 1 });
      prisma.altaDemanda.create.mockResolvedValue({
        id: 77n,
        minutos: 30,
        pausa: true,
        desde: new Date(),
        hasta: null,
        por: 50n,
      });
      prisma.parametro.upsert.mockResolvedValue({ clave: 'pausa_alta_demanda' });

      const res = await service.configurar(
        { activa: true, minutos: 30, pausa: true },
        mockUsuarioCocina,
      );

      expect(res.ok).toBe(true);
      expect(res.activa).toBe(true);
      expect(res.minutos).toBe(30);
      expect(res.pausa).toBe(true);
      expect(res.mensaje).toBe('activó José Espinoza');

      expect(prisma.altaDemanda.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minutos: 30,
          pausa: true,
          por: 50n,
        }),
      });

      expect(prisma.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'pausa_alta_demanda' },
        update: { valor: { activa: true, motivo: expect.any(String) } },
        create: { clave: 'pausa_alta_demanda', valor: { activa: true, motivo: expect.any(String) } },
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'cocina',
          accion: 'ALTA_DEMANDA',
        }),
      );

      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'cocina:alta-demanda',
        expect.objectContaining({
          activa: true,
          minutos: 30,
          pausa: true,
          mensaje: 'activó José Espinoza',
          activado_por: 'José Espinoza',
        }),
      );
    });

    it('apagar alta demanda quita los minutos y la pausa', async () => {
      prisma.person.findUnique.mockResolvedValue({
        nombres: 'Carla',
        apellidos: null,
      });
      prisma.altaDemanda.updateMany.mockResolvedValue({ count: 1 });
      prisma.parametro.upsert.mockResolvedValue({ clave: 'pausa_alta_demanda' });

      const res = await service.configurar(
        { activa: false },
        mockUsuarioCocina,
      );

      expect(res.ok).toBe(true);
      expect(res.activa).toBe(false);
      expect(res.minutos).toBe(0);
      expect(res.pausa).toBe(false);
      expect(res.mensaje).toBe('desactivó Carla');

      expect(prisma.altaDemanda.create).not.toHaveBeenCalled();
      expect(prisma.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'pausa_alta_demanda' },
        update: { valor: { activa: false } },
        create: { clave: 'pausa_alta_demanda', valor: { activa: false } },
      });
    });
  });

  describe('tiempoPrometido', () => {
    it('suma los minutos extra de alta demanda al rango base de texto', async () => {
      prisma.altaDemanda.findFirst.mockResolvedValue({
        id: 1n,
        minutos: 30,
        hasta: null,
      });

      const res = await service.tiempoPrometido('de 25 a 35 minutos');
      expect(res).toBe('de 55 a 65 minutos');
    });

    it('suma los minutos extra a un objeto con min y max', async () => {
      prisma.altaDemanda.findFirst.mockResolvedValue({
        id: 1n,
        minutos: 20,
        hasta: null,
      });

      const res = await service.tiempoPrometido({ min: 25, max: 35 });
      expect(res).toEqual({ min: 45, max: 55 });
    });

    it('si alta demanda está apagada, devuelve el rango base sin modificar', async () => {
      prisma.altaDemanda.findFirst.mockResolvedValue(null);

      const res = await service.tiempoPrometido('de 25 a 35 minutos');
      expect(res).toBe('de 25 a 35 minutos');
    });
  });
});
