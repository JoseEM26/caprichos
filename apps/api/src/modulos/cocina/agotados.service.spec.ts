import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AgotadosService } from './agotados.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { FECHA_HASTA_REACTIVAR } from './cocina.util';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('AgotadosService', () => {
  let service: AgotadosService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;

  const mockAdmin: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  const mockCocina: UsuarioAutenticado = {
    partyId: 2n,
    rol: 'COCINA',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      producto: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      sabor: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      opcion: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      agotado: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
        AgotadosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
      ],
    }).compile();

    service = module.get<AgotadosService>(AgotadosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('agotar y valor escrito en agotado_hasta (con fake timers)', () => {
    it('HASTA_REACTIVAR sólo permitido para rol ADMIN; 403 ForbiddenException para otro rol', async () => {
      await expect(
        service.agotar(
          { tipo: 'PRODUCTO', id: 5, duracion: 'HASTA_REACTIVAR' },
          mockCocina,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
      expect(prisma.agotado.create).not.toHaveBeenCalled();
    });

    it('ADMIN agota con HASTA_REACTIVAR escribiendo new Date("9999-12-31T23:59:59Z") en agotado_hasta', async () => {
      jest.useFakeTimers();
      const fechaFija = new Date('2026-10-21T18:00:00.000Z');
      jest.setSystemTime(fechaFija);

      prisma.producto.findUnique.mockResolvedValue({ id: 5n, nombre: 'Capuccino' });
      prisma.producto.update.mockResolvedValue({ id: 5n, agotado_hasta: FECHA_HASTA_REACTIVAR });
      prisma.agotado.create.mockResolvedValue({
        id: 10n,
        producto_id: 5n,
        tipo: 'PRODUCTO',
        alcance: 'HASTA_REACTIVAR',
        desde: fechaFija,
        hasta: FECHA_HASTA_REACTIVAR,
        por: 1n,
      });

      const res = await service.agotar(
        { tipo: 'PRODUCTO', id: '5', duracion: 'HASTA_REACTIVAR' },
        mockAdmin,
      );

      expect(res.ok).toBe(true);
      expect(res.id).toBe('10');
      // Verifica que en producto se escribió exactamente la fecha de HASTA_REACTIVAR (9999-12-31)
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { agotado_hasta: new Date('9999-12-31T23:59:59Z'), agotado_origen: 'MANUAL' },
      });
      expect(prisma.agotado.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          producto_id: 5n,
          tipo: 'PRODUCTO',
          alcance: 'HASTA_REACTIVAR',
          hasta: new Date('9999-12-31T23:59:59Z'),
        }),
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'cocina',
          accion: 'AGOTAR',
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'carta:disponibilidad',
        expect.anything(),
      );
    });

    it('COCINA agota con duración HOY escribiendo el siguiente 00:00 en Lima (05:00 UTC) en agotado_hasta', async () => {
      jest.useFakeTimers();
      // 2026-10-21 15:00 UTC = 2026-10-21 10:00 en Lima
      const fechaFija = new Date('2026-10-21T15:00:00.000Z');
      jest.setSystemTime(fechaFija);

      // El siguiente 00:00 en Lima corresponde a 2026-10-22 05:00:00.000Z
      const esperadoAgotadoHasta = new Date('2026-10-22T05:00:00.000Z');

      prisma.opcion.findUnique.mockResolvedValue({ id: 20n });
      prisma.opcion.update.mockResolvedValue({ id: 20n, agotado_hasta: esperadoAgotadoHasta });
      prisma.agotado.create.mockResolvedValue({
        id: 11n,
        opcion_id: 20n,
        tipo: 'OPCION',
        alcance: 'HOY',
        desde: fechaFija,
        hasta: esperadoAgotadoHasta,
        por: 2n,
      });

      const res = await service.agotar(
        { tipo: 'OPCION', id: 20, duracion: 'HOY' },
        mockCocina,
      );

      expect(res.ok).toBe(true);
      // Verifica que en opcion se escribió exactamente el 00:00 de Lima (05:00 UTC del día siguiente)
      expect(prisma.opcion.update).toHaveBeenCalledWith({
        where: { id: 20n },
        data: { agotado_hasta: esperadoAgotadoHasta },
      });
      expect(prisma.agotado.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          opcion_id: 20n,
          tipo: 'OPCION',
          alcance: 'HOY',
          hasta: esperadoAgotadoHasta,
        }),
      });
    });

    it('agotar sabor con duración HOY en la noche (UTC siguiente día) sigue calculando correctamente la medianoche de Lima', async () => {
      jest.useFakeTimers();
      // 2026-10-22 02:00:00 UTC = 2026-10-21 21:00 en Lima (aún es 21 de octubre en Lima)
      const fechaNocheUtc = new Date('2026-10-22T02:00:00.000Z');
      jest.setSystemTime(fechaNocheUtc);

      // El siguiente 00:00 en Lima debe ser 2026-10-22 05:00:00.000Z, no el 23
      const esperadoAgotadoHasta = new Date('2026-10-22T05:00:00.000Z');

      prisma.sabor.findUnique.mockResolvedValue({ id: 8n, nombre: 'Fresa' });
      prisma.sabor.update.mockResolvedValue({ id: 8n, agotado_hasta: esperadoAgotadoHasta });
      prisma.agotado.create.mockResolvedValue({
        id: 12n,
        sabor_id: 8n,
        tipo: 'SABOR',
        alcance: 'HOY',
        desde: fechaNocheUtc,
        hasta: esperadoAgotadoHasta,
        por: 2n,
      });

      const res = await service.agotar(
        { tipo: 'SABOR', id: 8, duracion: 'HOY' },
        mockCocina,
      );

      expect(res.ok).toBe(true);
      expect(prisma.sabor.update).toHaveBeenCalledWith({
        where: { id: 8n },
        data: { agotado_hasta: esperadoAgotadoHasta, agotado_origen: 'MANUAL' },
      });
    });
  });

  describe('validación de existencia de entidad (404 específicos)', () => {
    it('lanza 404 PRODUCTO_NO_ENCONTRADO si el producto no existe', async () => {
      prisma.producto.findUnique.mockResolvedValue(null);

      await expect(
        service.agotar({ tipo: 'PRODUCTO', id: 999, duracion: 'HOY' }, mockCocina),
      ).rejects.toMatchObject({
        response: {
          codigo: 'PRODUCTO_NO_ENCONTRADO',
        },
      });
    });

    it('lanza 404 SABOR_NO_ENCONTRADO si el sabor no existe', async () => {
      prisma.sabor.findUnique.mockResolvedValue(null);

      await expect(
        service.agotar({ tipo: 'SABOR', id: 999, duracion: 'HOY' }, mockCocina),
      ).rejects.toMatchObject({
        response: {
          codigo: 'SABOR_NO_ENCONTRADO',
        },
      });
    });

    it('lanza 404 OPCION_NO_ENCONTRADA si la opción no existe', async () => {
      prisma.opcion.findUnique.mockResolvedValue(null);

      await expect(
        service.agotar({ tipo: 'OPCION', id: 999, duracion: 'HOY' }, mockCocina),
      ).rejects.toMatchObject({
        response: {
          codigo: 'OPCION_NO_ENCONTRADA',
        },
      });
    });
  });

  describe('reactivar', () => {
    it('pone agotado_hasta = null en la entidad y marca reactivado_en en el historial en la misma transacción', async () => {
      prisma.agotado.findUnique.mockResolvedValue({
        id: 200n,
        producto_id: 4n,
        tipo: 'PRODUCTO',
        alcance: 'HOY',
        reactivado_en: null,
      });
      prisma.producto.update.mockResolvedValue({ id: 4n, agotado_hasta: null });
      prisma.agotado.update.mockResolvedValue({
        id: 200n,
        reactivado_en: new Date(),
      });

      const res = await service.reactivar(200n, mockCocina);

      expect(res.ok).toBe(true);
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: 4n },
        data: { agotado_hasta: null, agotado_origen: null },
      });
      expect(prisma.agotado.update).toHaveBeenCalledWith({
        where: { id: 200n },
        data: { reactivado_en: expect.any(Date) },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'cocina',
          accion: 'REACTIVAR_AGOTADO',
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'carta:disponibilidad',
        expect.anything(),
      );
    });

    it('lanza 404 AGOTADO_NO_ENCONTRADO si no existe el registro', async () => {
      prisma.agotado.findUnique.mockResolvedValue(null);

      await expect(service.reactivar(999n, mockCocina)).rejects.toMatchObject({
        response: {
          codigo: 'AGOTADO_NO_ENCONTRADO',
        },
      });
    });
  });

  describe('activos()', () => {
    it('calcula desde agotado_hasta > ahora de las tres tablas con una consulta por tabla', async () => {
      prisma.producto.findMany.mockResolvedValue([{ id: 10n }, { id: 25n }]);
      prisma.sabor.findMany.mockResolvedValue([{ id: 3n }]);
      prisma.opcion.findMany.mockResolvedValue([{ id: 7n }, { id: 9n }]);

      const res = await service.activos();

      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: { agotado_hasta: { gt: expect.any(Date) } },
        select: { id: true },
      });
      expect(prisma.sabor.findMany).toHaveBeenCalledWith({
        where: { agotado_hasta: { gt: expect.any(Date) } },
        select: { id: true },
      });
      expect(prisma.opcion.findMany).toHaveBeenCalledWith({
        where: { agotado_hasta: { gt: expect.any(Date) } },
        select: { id: true },
      });

      expect(res.productos).toEqual(['10', '25']);
      expect(res.sabores).toEqual(['3']);
      expect(res.opciones).toEqual(['7', '9']);
    });
  });
});
