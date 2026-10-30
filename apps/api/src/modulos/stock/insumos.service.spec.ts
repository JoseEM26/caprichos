import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InsumosService } from './insumos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Prisma } from '@prisma/client';

describe('InsumosService', () => {
  let service: InsumosService;
  let prisma: any;
  let auditoria: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      insumo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      lugarStock: {
        findMany: jest.fn(),
      },
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsumosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get<InsumosService>(InsumosService);
  });

  describe('validaciones de niveles', () => {
    it('lanza NIVELES_INVALIDOS si mínimo >= máximo', async () => {
      await expect(
        service.crear(
          {
            nombre: 'Harina',
            unidad_compra: 'SACO',
            unidad_almacen: 'KG',
            unidad_receta: 'G',
            factor_compra: 50,
            factor_receta: 1000,
            minimo: 50,
            maximo: 20, // mínimo > máximo
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NIVELES_INVALIDOS si mínimo >= intermedio o intermedio >= máximo', async () => {
      await expect(
        service.crear(
          {
            nombre: 'Harina',
            unidad_compra: 'SACO',
            unidad_almacen: 'KG',
            unidad_receta: 'G',
            factor_compra: 50,
            factor_receta: 1000,
            minimo: 30,
            intermedio: 20, // intermedio < mínimo
            maximo: 50,
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validaciones de proveedores', () => {
    it('lanza PROVEEDORES_DUPLICADOS si se elige el mismo proveedor para A y B', async () => {
      await expect(
        service.crear(
          {
            nombre: 'Leche',
            unidad_compra: 'CAJA',
            unidad_almacen: 'L',
            unidad_receta: 'ML',
            factor_compra: 12,
            factor_receta: 1000,
            minimo: 10,
            intermedio: 20,
            maximo: 50,
            proveedor_a: '10',
            proveedor_b: '10', // duplicado
          },
          mockUsuario,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('creación y desactivación de insumos', () => {
    it('crea un insumo válido y registra auditoría', async () => {
      prisma.insumo.findUnique
        .mockResolvedValueOnce(null) // no existe con ese nombre
        .mockResolvedValueOnce({
          id: 5n,
          nombre: 'Leche entera',
          unidad_compra: 'CAJA',
          unidad_almacen: 'L',
          unidad_receta: 'ML',
          factor_compra: new Prisma.Decimal(12),
          factor_receta: new Prisma.Decimal(1000),
          minimo: new Prisma.Decimal(10),
          intermedio: new Prisma.Decimal(25),
          maximo: new Prisma.Decimal(60),
          costo_unit: new Prisma.Decimal(4.5),
          lugar_consumo_id: 1n,
          lugarConsumo: { nombre: 'Barra' },
          proveedor_a: null,
          proveedor_b: null,
          proveedor_c: null,
          activo: true,
          stocks: [],
        });

      prisma.insumo.create.mockResolvedValue({
        id: 5n,
        nombre: 'Leche entera',
        minimo: new Prisma.Decimal(10),
        maximo: new Prisma.Decimal(60),
      });

      const res = await service.crear(
        {
          nombre: 'Leche entera',
          unidad_compra: 'CAJA',
          unidad_almacen: 'L',
          unidad_receta: 'ML',
          factor_compra: 12,
          factor_receta: 1000,
          minimo: 10,
          intermedio: 25,
          maximo: 60,
          costo_unit: 4.5,
          lugar_consumo_id: '1',
        },
        mockUsuario,
      );

      expect(res.id).toBe('5');
      expect(res.nombre).toBe('Leche entera');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CREAR_INSUMO',
          modulo: 'stock',
        }),
      );
    });

    it('un insumo no se elimina: se desactiva suavemente', async () => {
      prisma.insumo.update.mockResolvedValue({
        id: 5n,
        activo: false,
      });

      const res = await service.desactivar('5', mockUsuario);
      expect(res.activo).toBe(false);
      expect(prisma.insumo.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: { activo: false },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DESACTIVAR_INSUMO',
        }),
      );
    });
  });
});
