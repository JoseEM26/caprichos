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
      sabor: { findUnique: jest.fn() },
      receta: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
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
          sabores: [],
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

  describe('receta por sabor', () => {
    const insumo = (costo: number) => ({
      nombre: 'Harina',
      unidad_receta: 'G',
      factor_receta: new Prisma.Decimal(1000),
      costo_unit: new Prisma.Decimal(costo),
    });
    const linea = (cant: number, costo: number) => ({ insumo_id: 1n, cantidad: new Prisma.Decimal(cant), insumo: insumo(costo) });
    const producto = (recetas: any[]) => ({
      id: 7n,
      nombre: 'DONA',
      categoria: null,
      tamanos: [{ tamano_valor_id: 1n, tamano_valor: { nombre: 'Unidad' }, precio: new Prisma.Decimal(10) }],
      recetas,
      sabores: [
        { id: 20n, nombre: 'Chocolate' },
        { id: 21n, nombre: 'Fresa' },
      ],
    });
    const general = { id: 1n, tamano_valor_id: null, sabor_id: null, es_produccion: false, rinde: null, lineas: [linea(100, 10)] };
    const propia = { id: 2n, tamano_valor_id: null, sabor_id: 20n, es_produccion: false, rinde: null, lineas: [linea(200, 10)] };

    it('sin receta propia el sabor usa la general y lo indica', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce(producto([general]));
      const r = await service.obtenerRecetaProducto('7', '20');
      expect(r.usaGeneral).toBe(true);
      expect(r.tamanos[0].lineas[0].cantidad).toBe(100);
      expect(r.sabores.map((s) => s.tieneRecetaPropia)).toEqual([false, false]);
    });

    it('con receta propia la usa, y el resumen da el costo por sabor', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce(producto([general, propia]));
      const r = await service.obtenerRecetaProducto('7', '20');
      expect(r.usaGeneral).toBe(false);
      expect(r.tamanos[0].lineas[0].cantidad).toBe(200);
      expect(r.sabores).toEqual([
        { id: '20', nombre: 'Chocolate', tieneRecetaPropia: true, costo: 2 },
        { id: '21', nombre: 'Fresa', tieneRecetaPropia: false, costo: 1 },
      ]);
    });

    it('sin sabor devuelve la general', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce(producto([general, propia]));
      const r = await service.obtenerRecetaProducto('7');
      expect(r.saborId).toBeNull();
      expect(r.tamanos[0].lineas[0].cantidad).toBe(100);
    });

    it('rechaza un sabor de otro producto', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce(producto([general]));
      await expect(service.obtenerRecetaProducto('7', '99')).rejects.toMatchObject({ response: { codigo: 'SABOR_INVALIDO' } });
    });

    it('quitar borra la receta del sabor, audita y vuelve a la general', async () => {
      prisma.sabor.findUnique.mockResolvedValueOnce({ producto_id: 7n });
      prisma.receta.findMany.mockResolvedValueOnce([propia]);
      prisma.producto.findUnique.mockResolvedValueOnce(producto([general]));
      const r = await service.quitarRecetaSabor('7', '20', mockUsuario);
      expect(prisma.recetaLinea.deleteMany).toHaveBeenCalledWith({ where: { receta_id: { in: [2n] } } });
      expect(prisma.receta.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [2n] } } });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'QUITAR_RECETA_SABOR' }));
      expect(r.usaGeneral).toBe(true);
    });

    it('quitar falla si el sabor no es del producto o no tiene receta propia', async () => {
      prisma.sabor.findUnique.mockResolvedValueOnce({ producto_id: 8n });
      await expect(service.quitarRecetaSabor('7', '20', mockUsuario)).rejects.toMatchObject({ response: { codigo: 'SABOR_INVALIDO' } });
      prisma.sabor.findUnique.mockResolvedValueOnce({ producto_id: 7n });
      prisma.receta.findMany.mockResolvedValueOnce([]);
      await expect(service.quitarRecetaSabor('7', '20', mockUsuario)).rejects.toMatchObject({ response: { codigo: 'RECETA_SABOR_NO_EXISTE' } });
      expect(prisma.receta.deleteMany).not.toHaveBeenCalled();
    });

    it('guardar con sabor ajeno se rechaza antes de escribir', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce({ id: 7n });
      prisma.sabor.findUnique.mockResolvedValueOnce({ producto_id: 8n });
      await expect(service.guardarReceta('7', { sabor_id: '20', lineas: [] }, mockUsuario)).rejects.toMatchObject({ response: { codigo: 'SABOR_INVALIDO' } });
      expect(prisma.receta.create).not.toHaveBeenCalled();
    });

    it('guardar con sabor propio crea la receta con sabor_id', async () => {
      prisma.producto.findUnique.mockResolvedValueOnce({ id: 7n }).mockResolvedValueOnce(producto([general, propia]));
      prisma.sabor.findUnique.mockResolvedValueOnce({ producto_id: 7n });
      prisma.receta.findFirst.mockResolvedValue(null);
      prisma.receta.create.mockResolvedValueOnce({ id: 2n });
      await service.guardarReceta('7', { sabor_id: '20', lineas: [{ insumo_id: '1', cantidad: 200 }] }, mockUsuario);
      expect(prisma.receta.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sabor_id: 20n }) });
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
