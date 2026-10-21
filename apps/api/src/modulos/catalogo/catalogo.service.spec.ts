import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CatalogoService, normalizarTexto, estaDisponible } from './catalogo.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('CatalogoService', () => {
  let service: CatalogoService;
  let prisma: any;
  let auditoria: any;

  beforeEach(async () => {
    prisma = {
      categoria: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      producto: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      opcion: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      areaCocina: {
        findUnique: jest.fn(),
      },
      archivo: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get<CatalogoService>(CatalogoService);
  });

  describe('Utilidades: normalizarTexto y estaDisponible', () => {
    it('debe normalizar textos eliminando tildes y mayúsculas', () => {
      expect(normalizarTexto('Café Frío')).toBe('cafe frio');
      expect(normalizarTexto('Frappé con Lúcuma')).toBe('frappe con lucuma');
      expect(normalizarTexto('Mousse de Maracuyá')).toBe('mousse de maracuya');
    });

    it('debe determinar disponibilidad según agotado_hasta', () => {
      // null o undefined -> disponible
      expect(estaDisponible(null)).toBe(true);
      expect(estaDisponible(undefined)).toBe(true);

      // 'infinity' -> no disponible
      expect(estaDisponible('infinity')).toBe(false);

      // Fecha pasada -> disponible
      const pasada = new Date(Date.now() - 60000);
      expect(estaDisponible(pasada)).toBe(true);

      // Fecha futura -> no disponible
      const futura = new Date(Date.now() + 60000);
      expect(estaDisponible(futura)).toBe(false);
    });
  });

  describe('1. Carta oculta lo oculto', () => {
    it('debe omitir categorías ocultas y productos ocultos en GET /carta', async () => {
      prisma.categoria.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          nombre: 'Bebidas Visibles',
          orden: 1,
          oculta: false,
          productos: [
            {
              id: BigInt(10),
              nombre: 'Café Americano',
              descripcion: 'Café negro caliente',
              precio: 8.5,
              oculto: false,
              agotado_hasta: null,
              no_suma_beneficios: false,
              foto_archivo: null,
              tamanos: [
                {
                  id: BigInt(101),
                  tamano_valor: { nombre: 'Regular' },
                  precio: 8.5,
                  activo: true,
                },
              ],
              grupos: [],
              sabores: [],
            },
          ],
        },
      ]);

      const carta = await service.obtenerCarta();

      expect(prisma.categoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { oculta: false },
          include: expect.objectContaining({
            productos: expect.objectContaining({
              where: { oculto: false },
            }),
          }),
        }),
      );

      expect(carta).toHaveLength(1);
      expect(carta[0].nombre).toBe('Bebidas Visibles');
      expect(carta[0].productos).toHaveLength(1);
      expect(carta[0].productos[0].nombre).toBe('Café Americano');
    });
  });

  describe('2. Agotado marcado', () => {
    it('debe marcar disponible: false y devolver fecha si agotado_hasta está en el futuro', async () => {
      const fechaFutura = new Date(Date.now() + 1000 * 60 * 60 * 24); // +24 horas

      prisma.categoria.findMany.mockResolvedValue([
        {
          id: BigInt(2),
          nombre: 'Postres',
          orden: 2,
          oculta: false,
          productos: [
            {
              id: BigInt(20),
              nombre: 'Torta de Chocolate',
              descripcion: 'Torta húmeda',
              precio: 15.0,
              oculto: false,
              agotado_hasta: fechaFutura,
              no_suma_beneficios: false,
              foto_archivo: null,
              tamanos: [],
              grupos: [
                {
                  grupo: {
                    id: BigInt(5),
                    nombre: 'Toppings',
                    obligatorio: false,
                    minimo: 0,
                    maximo: 2,
                    activo: true,
                    opciones: [
                      {
                        id: BigInt(501),
                        valor: { nombre: 'Fudge extra' },
                        precio_extra: 2.0,
                        activo: true,
                        agotado_hasta: fechaFutura, // Opción también agotada
                      },
                      {
                        id: BigInt(502),
                        valor: { nombre: 'Chispas' },
                        precio_extra: 1.0,
                        activo: true,
                        agotado_hasta: null, // Opción disponible
                      },
                    ],
                  },
                },
              ],
              sabores: [],
            },
          ],
        },
      ]);

      const carta = await service.obtenerCarta();
      const producto = carta[0].productos[0];

      expect(producto.disponible).toBe(false);
      expect(producto.agotadoHasta).toBe(fechaFutura.toISOString());

      const opcionAgotada = producto.grupos[0].opciones[0];
      const opcionDisponible = producto.grupos[0].opciones[1];

      expect(opcionAgotada.disponible).toBe(false);
      expect(opcionDisponible.disponible).toBe(true);
    });
  });

  describe('3. Búsqueda sin tildes ni mayúsculas', () => {
    it('debe encontrar productos sin importar tildes ni mayúsculas (RQ-CAR-01-03)', async () => {
      prisma.categoria.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          nombre: 'Cafetería',
          orden: 1,
          oculta: false,
          productos: [
            {
              id: BigInt(1),
              nombre: 'Frappé de Café Clásico',
              descripcion: 'Bebida helada con café expreso y crema chantilly',
              precio: 14.0,
              oculto: false,
              agotado_hasta: null,
              tamanos: [],
              grupos: [],
              sabores: [],
            },
            {
              id: BigInt(2),
              nombre: 'Waffle Tradicional',
              descripcion: 'Waffle caliente con miel de maple',
              precio: 12.0,
              oculto: false,
              agotado_hasta: null,
              tamanos: [],
              grupos: [],
              sabores: [],
            },
          ],
        },
      ]);

      // Búsqueda con "frappe cafe" sin tildes ni mayúsculas
      const res = await service.obtenerCarta('frappe cafe');

      expect(res).toHaveLength(1);
      expect(res[0].productos).toHaveLength(1);
      expect(res[0].productos[0].nombre).toBe('Frappé de Café Clásico');

      // Búsqueda por término en descripción "CHANTILLY"
      const resDesc = await service.obtenerCarta('chantilly');
      expect(resDesc).toHaveLength(1);
      expect(resDesc[0].productos[0].nombre).toBe('Frappé de Café Clásico');

      // Búsqueda sin coincidencias
      const resVacia = await service.obtenerCarta('pizza inexistente');
      expect(resVacia).toHaveLength(0);
    });
  });

  describe('4. Nombre repetido -> 409 NOMBRE_DUPLICADO', () => {
    it('debe lanzar 409 NOMBRE_DUPLICADO al crear un producto con nombre ya existente', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: BigInt(1),
        nombre: 'Capuchino Doble',
      });

      await expect(
        service.crearProducto({
          nombre: 'Capuchino Doble',
          categoriaId: '1',
          precio: 10,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'NOMBRE_DUPLICADO',
          }),
        }),
      );
    });

    it('debe lanzar 409 NOMBRE_DUPLICADO al editar un producto con nombre de otro producto existente', async () => {
      prisma.producto.findUnique
        .mockResolvedValueOnce({
          id: BigInt(1),
          nombre: 'Capuchino Simple',
          categoria_id: BigInt(1),
          precio: 8,
          oculto: false,
          foto_archivo_id: null,
        })
        .mockResolvedValueOnce({
          id: BigInt(2), // Otro producto ya tiene ese nombre
          nombre: 'Capuchino Doble',
        });

      await expect(
        service.editarProducto(BigInt(1), {
          nombre: 'Capuchino Doble',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'NOMBRE_DUPLICADO',
          }),
        }),
      );
    });
  });

  describe('5. Precio negativo -> 400 PRECIO_INVALIDO', () => {
    it('debe lanzar 400 PRECIO_INVALIDO al crear un producto con precio negativo', async () => {
      await expect(
        service.crearProducto({
          nombre: 'Producto Barato Negativo',
          categoriaId: '1',
          precio: -1.5,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PRECIO_INVALIDO',
          }),
        }),
      );
    });

    it('debe lanzar 400 PRECIO_INVALIDO al crear un producto con tamaño de precio negativo', async () => {
      await expect(
        service.crearProducto({
          nombre: 'Producto Con Tamano Negativo',
          categoriaId: '1',
          precio: 10,
          tamanos: [{ tamanoValorId: '1', precio: -0.5 }],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PRECIO_INVALIDO',
          }),
        }),
      );
    });

    it('debe lanzar 400 PRECIO_INVALIDO al editar un producto con precio negativo', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: BigInt(1),
        nombre: 'Capuchino',
        precio: 8,
      });

      await expect(
        service.editarProducto(BigInt(1), {
          precio: -10,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PRECIO_INVALIDO',
          }),
        }),
      );
    });
  });

  describe('6. Agotar audita', () => {
    it('debe actualizar agotado_hasta y registrar auditoría con acción AGOTAR_PRODUCTO', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: BigInt(15),
        nombre: 'Keke de Plátano',
        agotado_hasta: null,
      });
      prisma.producto.update.mockResolvedValue({
        id: BigInt(15),
        agotado_hasta: new Date('2026-12-31T23:59:59Z'),
      });

      const usuarioMock: any = { partyId: BigInt(99), rol: 'ADMIN', debeCambiar: false };
      const resultado = await service.agotarProducto(
        BigInt(15),
        { agotadoHasta: '2026-12-31T23:59:59Z' },
        usuarioMock,
        '192.168.1.50',
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.disponible).toBe(false);

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: BigInt(15) },
        data: { agotado_hasta: expect.any(Date) },
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'catalogo',
          accion: 'AGOTAR_PRODUCTO',
          resultado: 'OK',
          entidad: 'producto',
          entidadId: BigInt(15),
          partyId: BigInt(99),
          ip: '192.168.1.50',
        }),
      );
    });

    it('debe disponibilizar un producto y registrar auditoría con acción DISPONIBILIZAR_PRODUCTO', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: BigInt(15),
        nombre: 'Keke de Plátano',
        agotado_hasta: new Date(),
      });
      prisma.producto.update.mockResolvedValue({
        id: BigInt(15),
        agotado_hasta: null,
      });

      const usuarioMock: any = { partyId: BigInt(99) };
      const resultado = await service.disponibilizarProducto(
        BigInt(15),
        usuarioMock,
        '127.0.0.1',
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.disponible).toBe(true);

      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: BigInt(15) },
        data: { agotado_hasta: null },
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DISPONIBILIZAR_PRODUCTO',
          entidadId: BigInt(15),
        }),
      );
    });

    it('debe agotar una opción y registrar auditoría con acción AGOTAR_OPCION', async () => {
      prisma.opcion.findUnique.mockResolvedValue({
        id: BigInt(88),
        agotado_hasta: null,
      });
      prisma.opcion.update.mockResolvedValue({
        id: BigInt(88),
        agotado_hasta: new Date(),
      });

      const usuarioMock: any = { partyId: BigInt(99) };
      const resultado = await service.agotarOpcion(
        BigInt(88),
        { agotadoHasta: 'infinity' },
        usuarioMock,
        '127.0.0.1',
      );

      expect(resultado.ok).toBe(true);
      expect(resultado.disponible).toBe(false);

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'catalogo',
          accion: 'AGOTAR_OPCION',
          entidad: 'opcion',
          entidadId: BigInt(88),
        }),
      );
    });
  });
});
