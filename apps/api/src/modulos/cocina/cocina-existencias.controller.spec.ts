jest.mock('@nestjs/jwt', () => {
  return {
    JwtService: jest.fn().mockImplementation(() => ({
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    })),
    JwtModule: {
      registerAsync: jest.fn().mockReturnValue({
        module: class MockJwtModule {},
      }),
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { CocinaExistenciasController } from './cocina-existencias.controller';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AccesoGuard } from '../acceso/acceso.guard';

describe('CocinaExistenciasController', () => {
  let controller: CocinaExistenciasController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lugarStock: {
        findMany: jest.fn().mockResolvedValue([
          { id: BigInt(1), nombre: 'Almacén central', tipo: 'ALMACEN' },
          { id: BigInt(2), nombre: 'Salados', tipo: 'AREA' },
          { id: BigInt(3), nombre: 'Bebidas', tipo: 'AREA' },
        ]),
      },
      insumo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(10),
            nombre: 'Harina de trigo',
            unidad_almacen: 'kg',
            minimo: '5.000',
            costo_unit: '4.50',
            proveedor_a: BigInt(99),
            stocks: [
              { lugar_id: BigInt(1), cantidad: '20.000' },
              { lugar_id: BigInt(2), cantidad: '2.500' },
            ],
          },
          {
            id: BigInt(11),
            nombre: 'Café en grano',
            unidad_almacen: 'kg',
            minimo: '3.000',
            costo_unit: '25.00',
            proveedor_a: BigInt(99),
            stocks: [
              { lugar_id: BigInt(1), cantidad: '0.000' },
              { lugar_id: BigInt(2), cantidad: '6.000' },
            ],
          },
          {
            id: BigInt(12),
            nombre: 'Azúcar blanca',
            unidad_almacen: 'kg',
            minimo: '10.000',
            costo_unit: '3.20',
            stocks: [],
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CocinaExistenciasController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CocinaExistenciasController>(
      CocinaExistenciasController,
    );
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('devuelve stock de cocina, mínimo y stock de almacén sin exponer costos ni proveedores', async () => {
    const res = await controller.obtenerExistenciasParaPedir();

    expect(res).toHaveLength(3);

    // Harina de trigo: 2.5 en cocina, 5 min, 20 en almacén
    expect(res[0]).toEqual({
      insumoId: '10',
      nombre: 'Harina de trigo',
      unidad: 'kg',
      stockCocina: 2.5,
      stockMinimo: 5,
      stockAlmacen: 20,
    });
    expect((res[0] as any).costo_unit).toBeUndefined();
    expect((res[0] as any).proveedor_a).toBeUndefined();

    // Café en grano: 6 en cocina, 3 min, 0 en almacén
    expect(res[1]).toEqual({
      insumoId: '11',
      nombre: 'Café en grano',
      unidad: 'kg',
      stockCocina: 6,
      stockMinimo: 3,
      stockAlmacen: 0,
    });

    // Azúcar blanca: sin stock (0 cocina, 0 almacén, 10 min)
    expect(res[2]).toEqual({
      insumoId: '12',
      nombre: 'Azúcar blanca',
      unidad: 'kg',
      stockCocina: 0,
      stockMinimo: 10,
      stockAlmacen: 0,
    });
  });
});
