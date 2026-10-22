import { Test, TestingModule } from '@nestjs/testing';
import { RecetasService } from './recetas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Prisma } from '@prisma/client';

describe('RecetasService', () => {
  let service: RecetasService;
  let prisma: any;
  let auditoria: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      producto: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      receta: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      recetaLinea: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      ajusteOpcion: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecetasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get<RecetasService>(RecetasService);
  });

  describe('listarProductosConMargen', () => {
    it('calcula S/ 2,44 de costo y 72,9 % de margen para Capuchino a S/ 9,00', async () => {
      // Café: 18g con factor 1000 y costo unitario 45 S/kg -> 0.045 S/g -> 18 * 0.045 = 0.81
      // O en el ejemplo del documento: café 18g a S/ 0.08 = 1.44, leche 200ml a S/ 0.005 = 1.00 -> costo 2.44
      prisma.producto.findMany.mockResolvedValueOnce([
        {
          id: 32n,
          nombre: 'CAPUCCINO',
          precio: new Prisma.Decimal(9.0),
          categoria_id: 1n,
          categoria: { nombre: 'Bebidas calientes' },
          tamanos: [
            {
              id: 101n,
              tamano_valor_id: 1n,
              precio: new Prisma.Decimal(9.0),
              tamano_valor: { nombre: 'Regular 12 oz' },
            },
          ],
          recetas: [
            {
              id: 501n,
              tamano_valor_id: 1n,
              lineas: [
                {
                  insumo_id: 1n,
                  cantidad: new Prisma.Decimal(18),
                  insumo: {
                    factor_receta: new Prisma.Decimal(1000),
                    costo_unit: new Prisma.Decimal(80.0), // 80 / 1000 = 0.08 S/g -> 18 * 0.08 = 1.44
                  },
                },
                {
                  insumo_id: 2n,
                  cantidad: new Prisma.Decimal(200),
                  insumo: {
                    factor_receta: new Prisma.Decimal(1000),
                    costo_unit: new Prisma.Decimal(5.0), // 5 / 1000 = 0.005 S/ml -> 200 * 0.005 = 1.00
                  },
                },
              ],
            },
          ],
        },
        {
          id: 50n,
          nombre: 'AGUA MINERAL',
          precio: new Prisma.Decimal(4.0),
          categoria_id: 1n,
          categoria: { nombre: 'Bebidas frías' },
          tamanos: [],
          recetas: [], // Sin receta
        },
      ]);

      const res = await service.listarProductosConMargen();
      expect(res.totalProductos).toBe(2);
      expect(res.platosSinMargen).toBe(1);

      const capuchino = res.productos.find((p) => p.id === '32');
      expect(capuchino).toBeDefined();
      expect(capuchino?.tieneReceta).toBe(true);
      expect(capuchino?.costo).toBe(2.44);
      expect(capuchino?.margenSoles).toBe(6.56);
      expect(capuchino?.margenPorcentaje).toBe(72.9);

      const agua = res.productos.find((p) => p.id === '50');
      expect(agua?.tieneReceta).toBe(false);
      expect(agua?.costo).toBeNull();
      expect(agua?.margenSoles).toBeNull();
    });
  });

  describe('guardarReceta', () => {
    it('reemplaza las líneas de la receta y registra auditoría', async () => {
      prisma.producto.findUnique
        .mockResolvedValueOnce({ id: 32n, nombre: 'CAPUCCINO' }) // validación
        .mockResolvedValueOnce({
          // obtención final
          id: 32n,
          nombre: 'CAPUCCINO',
          categoria: { nombre: 'Cafetería' },
          tamanos: [
            {
              tamano_valor_id: 1n,
              tamano_valor: { nombre: 'Regular' },
              precio: new Prisma.Decimal(9.0),
            },
          ],
          recetas: [
            {
              id: 99n,
              tamano_valor_id: 1n,
              lineas: [
                {
                  insumo_id: 1n,
                  cantidad: new Prisma.Decimal(18),
                  insumo: {
                    nombre: 'Café en grano',
                    unidad_receta: 'G',
                    factor_receta: new Prisma.Decimal(1000),
                    costo_unit: new Prisma.Decimal(45.0),
                  },
                },
              ],
            },
          ],
        });

      prisma.receta.findFirst
        .mockResolvedValueOnce(null) // previa
        .mockResolvedValueOnce(null); // en transacción

      prisma.receta.create.mockResolvedValueOnce({
        id: 99n,
        producto_id: 32n,
        tamano_valor_id: 1n,
      });

      const res = await service.guardarReceta(
        '32',
        {
          tamano_valor_id: '1',
          lineas: [{ insumo_id: '1', cantidad: 18 }],
        },
        mockUsuario,
      );

      expect(res.productoId).toBe('32');
      expect(prisma.recetaLinea.deleteMany).toHaveBeenCalledWith({
        where: { receta_id: 99n },
      });
      expect(prisma.recetaLinea.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          receta_id: 99n,
          insumo_id: 1n,
          cantidad: new Prisma.Decimal(18),
        }),
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'recetas',
          accion: 'GUARDAR_RECETA',
        }),
      );
    });
  });

  describe('ajustes de opciones', () => {
    it('guarda un ajuste de opción que reemplaza leche entera por almendras', async () => {
      prisma.ajusteOpcion.upsert.mockResolvedValueOnce({
        opcion_id: 15n,
        insumo_id: 2n,
        efecto: 'REEMPLAZA',
        reemplaza_insumo_id: 1n,
        cantidad: new Prisma.Decimal(200),
      });

      const res = await service.guardarAjusteOpcion(
        '15',
        {
          insumo_id: '2',
          efecto: 'REEMPLAZA',
          reemplaza_insumo_id: '1',
          cantidad: 200,
        },
        mockUsuario,
      );

      expect(res.ok).toBe(true);
      expect(res.efecto).toBe('REEMPLAZA');
      expect(prisma.ajusteOpcion.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            opcion_id_insumo_id: {
              opcion_id: 15n,
              insumo_id: 2n,
            },
          },
        }),
      );
    });
  });
});
