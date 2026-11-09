jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

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
      // Conteo de apertura del día (productos que controlan stock): sin aperturas en estos casos
      conteoApertura: { findMany: jest.fn().mockResolvedValue([]) },
      agotado: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      opcionRequiere: { findMany: jest.fn().mockResolvedValue([]) },
      categoria: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      producto: {
        // quedanProductos pide los productos que controlan stock: sin ninguno por defecto
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      oferta: { findMany: jest.fn().mockResolvedValue([]) },
      opcion: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      areaCocina: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      archivo: {
        findUnique: jest.fn(),
      },
      lista: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      listaValor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      grupoOpciones: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      productoGrupo: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
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
    it('omite grupos de opciones desactivados en GET /carta (carta, bot y mozo)', async () => {
      const grupo = (id: number, activo: boolean) => ({
        orden: id,
        grupo: { id: BigInt(id), nombre: `G${id}`, activo, obligatorio: false, minimo: 0, maximo: 1, opciones: [{ id: BigInt(id * 10), activo: true, valor: { nombre: 'Opción' }, precio_extra: 0, agotado_hasta: null }] },
      });
      prisma.categoria.findMany.mockResolvedValue([
        {
          id: BigInt(1), nombre: 'Bebidas', orden: 1, oculta: false,
          productos: [{
            id: BigInt(10), nombre: 'Latte', descripcion: null, precio: 8, oculto: false,
            agotado_hasta: null, no_suma_beneficios: false, foto_archivo: null,
            tamanos: [], sabores: [], grupos: [grupo(1, true), grupo(2, false)],
          }],
        },
      ]);
      const carta = await service.obtenerCarta();
      expect(carta[0].productos[0].grupos.map((g) => g.nombre)).toEqual(['G1']);
    });

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
        data: { agotado_hasta: expect.any(Date), agotado_origen: 'MANUAL', agotado_motivo: null },
      });
      // Si había un agotado automático abierto, pasa a MANUAL (no vuelve solo)
      expect(prisma.agotado.updateMany).toHaveBeenCalledWith({
        where: { producto_id: BigInt(15), reactivado_en: null },
        data: { origen: 'MANUAL' },
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
        data: { agotado_hasta: null, agotado_origen: null, agotado_motivo: null },
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

  describe('Listado admin y productos desactivados', () => {
    it('trae los ocultos por defecto y los excluye solo con incluyeOcultos=false', async () => {
      prisma.producto.findMany.mockResolvedValue([]);
      await service.listarProductosAdmin({} as any);
      expect(prisma.producto.findMany.mock.calls[0][0].where.oculto).toBeUndefined();
      await service.listarProductosAdmin({ incluyeOcultos: false } as any);
      expect(prisma.producto.findMany.mock.calls[1][0].where.oculto).toBe(false);
    });
  });

  describe('Promociones por producto en el listado admin', () => {
    const base = (id: number, cat: number) => ({
      id: BigInt(id), categoria_id: BigInt(cat), categoria: { id: BigInt(cat), nombre: 'C' }, nombre: 'P' + id,
      descripcion: null, precio: 10, orden: 0, oculto: false, agotado_hasta: null, no_suma_beneficios: false,
      foto_archivo: null, tamanos: [], grupos: [], sabores: [],
    });
    const oferta = (id: number, tipo: string, extra: any = {}) => ({
      id: BigInt(id), nombre: 'O' + id, tipo, activo: true, alcance_producto_id: null, alcance_categoria_id: null,
      dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: [],
      limite_usos: null, usos_actuales: 0, ...extra,
    });

    it('asigna por producto y categoria, separa las de toda la carta y consulta ofertas una sola vez', async () => {
      prisma.producto.findMany.mockResolvedValue([base(1, 5), base(2, 5), base(3, 6)]);
      prisma.oferta.findMany.mockResolvedValue([
        oferta(10, 'DESCUENTO', { alcance_producto_id: BigInt(1) }),
        oferta(11, 'LLEVA_PAGA', { alcance_categoria_id: BigInt(6) }),
        oferta(12, 'DESCUENTO'),
      ]);
      const r = await service.listarProductosAdmin({} as any);
      expect(prisma.oferta.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.oferta.findMany.mock.calls[0][0].where).toEqual({
        activo: true,
        tipo: { in: ['DESCUENTO', 'LLEVA_PAGA'] },
      });
      expect(r[0].promociones.map((x) => x.id)).toEqual(['10']);
      expect(r[1].promociones).toEqual([]);
      expect(r[2].promociones.map((x) => x.id)).toEqual(['11']);
      expect(r[0].promocionesGenerales.map((x) => x.id)).toEqual(['12']);
      expect(r[0].promociones[0].vigenteAhora).toBe(true);
    });

    it('marca programada y vencida segun fechas', async () => {
      prisma.producto.findMany.mockResolvedValue([base(1, 5)]);
      prisma.oferta.findMany.mockResolvedValue([
        oferta(10, 'DESCUENTO', { alcance_producto_id: BigInt(1), fecha_desde: new Date('2999-01-01') }),
        oferta(11, 'DESCUENTO', { alcance_producto_id: BigInt(1), fecha_hasta: new Date('2000-01-01') }),
      ]);
      const [p] = await service.listarProductosAdmin({} as any);
      expect(p.promociones.map((x) => [x.estado, x.vigenteAhora])).toEqual([
        ['PROGRAMADA', false],
        ['VENCIDA', false],
      ]);
    });
  });

  describe('Listas y grupos de opciones', () => {
    it('crea una categoría nueva correctamente', async () => {
      prisma.categoria.findFirst = jest.fn().mockResolvedValue(null);
      prisma.categoria.aggregate = jest.fn().mockResolvedValue({ _max: { orden: 5 } });
      prisma.categoria.create = jest.fn().mockResolvedValue({
        id: BigInt(10),
        nombre: 'PIZZAS',
        area_id: BigInt(2),
        orden: 6,
        lleva_opciones: true,
        oculta: false,
      });

      const res = await service.crearCategoria({
        nombre: 'PIZZAS',
        areaId: '2',
      });

      expect(res.nombre).toBe('PIZZAS');
      expect(res.orden).toBe(6);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'CREAR_CATEGORIA' }),
      );
    });

    it('lista las listas y valores con conteo de usos', async () => {
      prisma.lista.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          codigo: 'TAMANO',
          nombre: 'Tamaños',
          grupos: [],
          valores: [
            {
              id: BigInt(101),
              nombre: '12 oz',
              orden: 0,
              activo: true,
              _count: { productoTamanos: 5, opciones: 0 },
            },
          ],
        },
      ]);

      const res = await service.listarListasAdmin();
      expect(res).toHaveLength(1);
      expect(res[0].valores[0].usos).toBe(5);
    });

    it('agrega un valor a una lista y lo audita', async () => {
      prisma.lista.findUnique.mockResolvedValue({ id: BigInt(1), nombre: 'Tamaños' });
      prisma.listaValor.findFirst.mockResolvedValue(null);
      prisma.listaValor.aggregate.mockResolvedValue({ _max: { orden: 1 } });
      prisma.listaValor.create.mockResolvedValue({
        id: BigInt(202),
        lista_id: BigInt(1),
        nombre: '16 oz',
        orden: 2,
        activo: true,
      });
      prisma.grupoOpciones.findFirst.mockResolvedValue(null);

      const res = await service.agregarValorLista(1, { nombre: '16 oz' });
      expect(res.nombre).toBe('16 oz');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'AGREGAR_VALOR_LISTA' }),
      );
    });

    it('alterna el estado activo de un valor de lista', async () => {
      prisma.listaValor.findUnique.mockResolvedValue({
        id: BigInt(202),
        activo: true,
      });
      prisma.listaValor.update.mockResolvedValue({
        id: BigInt(202),
        activo: false,
      });

      const res = await service.alternarValorLista(202);
      expect(res.activo).toBe(false);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'DESACTIVAR_VALOR_LISTA' }),
      );
    });
  });

  describe('Opciones de grupo y vínculo producto-grupo', () => {
    it('crea una opción nueva con precio extra y la audita', async () => {
      prisma.grupoOpciones.findUnique.mockResolvedValue({ id: BigInt(5), nombre: 'Leche', lista_id: BigInt(9) });
      prisma.listaValor.findFirst.mockResolvedValue(null);
      prisma.listaValor.aggregate.mockResolvedValue({ _max: { orden: 2 } });
      prisma.listaValor.create.mockResolvedValue({ id: BigInt(70), nombre: 'Almendra', activo: true });
      prisma.opcion.findUnique.mockResolvedValue(null);
      prisma.opcion.upsert.mockResolvedValue({ id: BigInt(80), valor_id: BigInt(70), precio_extra: 2, activo: true, agotado_hasta: null });

      const res = await service.crearOpcionGrupo(5, { nombre: ' Almendra ', precioExtra: 2 });
      expect(res).toMatchObject({ id: '80', nombre: 'Almendra', precioExtra: 2 });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CREAR_OPCION' }));
    });

    it('rechaza una opción repetida y un precio extra negativo', async () => {
      prisma.grupoOpciones.findUnique.mockResolvedValue({ id: BigInt(5), nombre: 'Leche', lista_id: BigInt(9) });
      prisma.listaValor.findFirst.mockResolvedValue({ id: BigInt(70), nombre: 'Entera', activo: true });
      prisma.opcion.findUnique.mockResolvedValue({ id: BigInt(80), activo: true });
      await expect(service.crearOpcionGrupo(5, { nombre: 'Entera' })).rejects.toThrow(ConflictException);
      await expect(service.crearOpcionGrupo(5, { nombre: 'X', precioExtra: -1 })).rejects.toThrow(BadRequestException);
    });

    it('edita el precio extra de una opción y lo audita', async () => {
      prisma.opcion.findUnique.mockResolvedValue({
        id: BigInt(80), valor_id: BigInt(70), precio_extra: 1, activo: true,
        valor: { id: BigInt(70), lista_id: BigInt(9), nombre: 'Entera' },
      });
      prisma.opcion.update.mockResolvedValue({ id: BigInt(80), valor_id: BigInt(70), precio_extra: 3, activo: true, agotado_hasta: null });
      const res = await service.editarOpcion(80, { precioExtra: 3 });
      expect(res.precioExtra).toBe(3);
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'EDITAR_OPCION' }));
      await expect(service.editarOpcion(80, { precioExtra: -2 })).rejects.toThrow(BadRequestException);
    });

    it('editarOpcion guarda resaltarSiempre, lo devuelve y lo audita (antes/después)', async () => {
      prisma.opcion.findUnique.mockResolvedValue({
        id: BigInt(80), valor_id: BigInt(70), precio_extra: 0, activo: true, resaltar_siempre: false,
        valor: { id: BigInt(70), lista_id: BigInt(9), nombre: 'Sin lactosa' },
      });
      prisma.opcion.update.mockResolvedValue({ id: BigInt(80), valor_id: BigInt(70), precio_extra: 0, activo: true, resaltar_siempre: true, agotado_hasta: null });
      const res = await service.editarOpcion(80, { resaltarSiempre: true });
      expect(prisma.opcion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resaltar_siempre: true }) }));
      expect(res.resaltarSiempre).toBe(true);
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'EDITAR_OPCION',
        antes: expect.objectContaining({ resaltarSiempre: false }),
        despues: expect.objectContaining({ resaltarSiempre: true }),
      }));
    });

    it('editarProducto con sincronizarGrupos desliga los grupos que no vienen', async () => {
      prisma.producto.findUnique.mockResolvedValue({ id: BigInt(1), nombre: 'A', precio: 5, oculto: false, categoria_id: BigInt(1), tamanos: [], grupos: [], sabores: [] });
      jest.spyOn(service, 'obtenerProductoPorId').mockResolvedValue({} as any);
      await service.editarProducto(1, { grupos: [{ grupoId: 4 }], sincronizarGrupos: true } as any);
      expect(prisma.productoGrupo.deleteMany).toHaveBeenCalledWith({
        where: { producto_id: BigInt(1), grupo_id: { notIn: [BigInt(4)] } },
      });
    });
  });

  describe('Editar sabores y «Controlar stock» de un producto', () => {
    const actual = { id: BigInt(1), nombre: 'A', precio: 5, oculto: false, categoria_id: BigInt(1), tamanos: [], grupos: [], sabores: [] };
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue(actual);
      jest.spyOn(service, 'obtenerProductoPorId').mockResolvedValue({} as any);
      prisma.sabor = { updateMany: jest.fn(), upsert: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) };
    });

    it('apagar «Controlar stock» (true -> false) limpia el agotado AUTOMATICO y respeta el MANUAL', async () => {
      prisma.producto.findUnique.mockResolvedValue({ ...actual, controla_stock: true });
      prisma.producto.updateMany = jest.fn();
      prisma.agotado.updateMany = jest.fn();
      await service.editarProducto(1, { controlaStock: false } as any);
      expect(prisma.producto.updateMany).toHaveBeenCalledWith({
        where: { id: BigInt(1), agotado_origen: 'AUTOMATICO' },
        data: { agotado_hasta: null, agotado_origen: null },
      });
      expect(prisma.sabor.updateMany).toHaveBeenCalledWith({
        where: { producto_id: BigInt(1), agotado_origen: 'AUTOMATICO' },
        data: { agotado_hasta: null, agotado_origen: null },
      });
      // Nunca se limpia por una condición que incluya lo MANUAL
      for (const c of [...prisma.producto.updateMany.mock.calls, ...prisma.sabor.updateMany.mock.calls]) {
        expect(c[0].where.agotado_origen).toBe('AUTOMATICO');
      }
    });

    it('no limpia agotados si Controlar stock ya estaba apagado o se mantiene encendido', async () => {
      prisma.producto.updateMany = jest.fn();
      prisma.agotado.updateMany = jest.fn();
      prisma.producto.findUnique.mockResolvedValue({ ...actual, controla_stock: false });
      await service.editarProducto(1, { controlaStock: false } as any);
      prisma.producto.findUnique.mockResolvedValue({ ...actual, controla_stock: true });
      await service.editarProducto(1, { controlaStock: true } as any);
      expect(prisma.producto.updateMany).not.toHaveBeenCalled();
    });

    it('guarda controlaStock con el producto', async () => {
      await service.editarProducto(1, { controlaStock: true } as any);
      expect(prisma.producto.update.mock.calls[0][0].data.controla_stock).toBe(true);
      await service.editarProducto(1, { nombre: 'A' } as any);
      expect(prisma.producto.update.mock.calls[1][0].data.controla_stock).toBeUndefined();
    });

    it('marcar un sabor Disponible/Agotado cambia activo solo si el sabor es de este producto; el nuevo se crea sin stock', async () => {
      await service.editarProducto(1, { sabores: [{ id: '7', nombre: 'Fresa', activo: false }, { nombre: 'Oreo', activo: true }] } as any);
      expect(prisma.sabor.updateMany).toHaveBeenCalledWith({
        where: { id: BigInt(7), producto_id: BigInt(1) },
        data: { nombre: 'Fresa', activo: false },
      });
      expect(prisma.sabor.update).not.toHaveBeenCalled();
      expect(prisma.sabor.upsert.mock.calls[0][0].where).toEqual({ producto_id_nombre: { producto_id: BigInt(1), nombre: 'Oreo' } });
    });
  });

  describe('Anfitrión de combo (Dúo): sin mezcla de sabores propia', () => {
    beforeEach(() => {
      prisma.stockSabor = { findMany: jest.fn().mockResolvedValue([]) };
    });

    const duo = (conCombo: boolean) => ({
      id: BigInt(70),
      nombre: 'DÚO COMPARTIR',
      descripcion: null,
      precio: 30,
      oculto: false,
      agotado_hasta: null,
      no_suma_beneficios: false,
      controla_stock: false,
      foto_archivo: null,
      tamanos: [],
      ofertasAlcance: conCombo ? [{ id: BigInt(900) }] : [],
      sabores: [{ id: BigInt(701), nombre: 'Blanco', activo: true, agotado_hasta: null }],
      grupos: [
        { orden: 1, grupo: { id: BigInt(71), nombre: 'Galleta 1 · Sabor', activo: true, obligatorio: true, minimo: 1, maximo: 1, opciones: [] } },
        { orden: 2, grupo: { id: BigInt(72), nombre: 'Dona 1 · Sabor', activo: true, obligatorio: true, minimo: 1, maximo: 1, opciones: [{ id: BigInt(721), activo: true, valor: { nombre: 'Blanco' }, precio_extra: 0, agotado_hasta: null }] } },
      ],
    });

    it('un anfitrión de combo no lleva sabores en la carta y sus grupos sin opciones no aparecen', async () => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(7), nombre: 'Combos', orden: 1, oculta: false, productos: [duo(true)] }]);
      const carta = await (service as any).obtenerCarta();
      expect(carta[0].productos[0]).toMatchObject({ saboresConStock: false, sabores: [], disponible: true });
      expect(carta[0].productos[0].grupos.map((g: any) => g.nombre)).toEqual(['Dona 1 · Sabor']);
    });

    it('un producto por sabor normal (sin oferta COMBO) conserva sus sabores', async () => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(7), nombre: 'Donas', orden: 1, oculta: false, productos: [duo(false)] }]);
      const carta = await (service as any).obtenerCarta();
      expect(carta[0].productos[0].sabores.map((s: any) => s.nombre)).toEqual(['Blanco']);
    });
  });
  describe('7. Productos que controlan stock (quedan)', () => {
    const producto = (id: number, controla: boolean) => ({
      id: BigInt(id),
      nombre: `Dona ${id}`,
      descripcion: null,
      precio: 5.0,
      oculto: false,
      agotado_hasta: null,
      no_suma_beneficios: false,
      controla_stock: controla,
      foto_archivo: null,
      tamanos: [],
      grupos: [],
      sabores: [],
    });

    beforeEach(() => {
      prisma.categoria.findMany.mockResolvedValue([
        { id: BigInt(3), nombre: 'Donas', orden: 1, oculta: false, productos: [producto(30, true), producto(31, true), producto(32, false)] },
      ]);
      prisma.producto.findMany.mockResolvedValue([{ id: BigInt(30) }, { id: BigInt(31) }]);
      prisma.stock = {
        findMany: jest.fn().mockResolvedValue([
          { producto_id: BigInt(30), cantidad: 3.7 },
          { producto_id: BigInt(31), cantidad: 0 },
        ]),
      };
    });

    it('quedan es el saldo entero hacia abajo y se agota en 0 aunque no esté marcado', async () => {
      const carta = await (service as any).obtenerCarta();
      const [a, b, sinControl] = carta[0].productos;
      expect(a).toMatchObject({ controlaStock: true, quedan: 3, disponible: true });
      expect(b).toMatchObject({ controlaStock: true, quedan: 0, disponible: false });
      expect(sinControl).toMatchObject({ controlaStock: false, quedan: null, disponible: true });
    });

    it('sin apertura hoy el saldo sigue siendo el tope (quedan = saldo, 0 no se vende)', async () => {
      prisma.conteoApertura.findMany.mockResolvedValue([]);
      const carta = await (service as any).obtenerCarta();
      expect(carta[0].productos[0]).toMatchObject({ controlaStock: true, quedan: 3, disponible: true });
      expect(carta[0].productos[1]).toMatchObject({ controlaStock: true, quedan: 0, disponible: false });
    });
  });
  describe('8. Productos por sabor en la carta (stock por sabor)', () => {
    const donaSabor = (saboresAgotados: number[] = []) => ({
      id: BigInt(40),
      nombre: 'Dona por sabor',
      descripcion: null,
      precio: 3.0,
      oculto: false,
      agotado_hasta: null,
      no_suma_beneficios: false,
      controla_stock: true,
      foto_archivo: null,
      tamanos: [{ id: BigInt(9), tamano_valor_id: BigInt(7), precio: 18, activo: true, unidades: 6, tamano_valor: { nombre: '1/2 docena' } }],
      grupos: [],
      sabores: [
        { id: BigInt(401), nombre: 'Fresa', activo: true, agotado_hasta: saboresAgotados.includes(401) ? new Date('9999-12-31T23:59:59Z') : null },
        { id: BigInt(402), nombre: 'Oreo', activo: true, agotado_hasta: saboresAgotados.includes(402) ? new Date('9999-12-31T23:59:59Z') : null },
      ],
    });

    it('con apertura por sabor: quedan = suma de los disponibles y cada sabor lleva su quedan; unidades en el tamaño', async () => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(4), nombre: 'Donas', orden: 1, oculta: false, productos: [donaSabor()] }]);
      prisma.conteoApertura.findMany.mockImplementation(async ({ where }: any) =>
        where.sabor_id ? [{ sabor_id: BigInt(401), cantidad: 4 }, { sabor_id: BigInt(402), cantidad: 6 }] : [],
      );
      prisma.stockSabor = {
        findMany: jest.fn().mockResolvedValue([{ sabor_id: BigInt(401), cantidad: 3.5 }, { sabor_id: BigInt(402), cantidad: 6 }]),
      };
      const carta = await (service as any).obtenerCarta();
      const p = carta[0].productos[0];
      expect(p.tamanos[0]).toMatchObject({ nombre: '1/2 docena', unidades: 6 });
      expect(p.sabores).toEqual([
        { id: '401', nombre: 'Fresa', activo: true, disponible: true, quedan: 3 },
        { id: '402', nombre: 'Oreo', activo: true, disponible: true, quedan: 6 },
      ]);
      // quedan del producto = suma de los sabores disponibles (3 + 6)
      expect(p).toMatchObject({ controlaStock: true, saboresConStock: true, quedan: 9, disponible: true });
    });

    it('si todos los sabores están agotados o a 0 con apertura, el producto no está disponible', async () => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(4), nombre: 'Donas', orden: 1, oculta: false, productos: [donaSabor([401])] }]);
      prisma.conteoApertura.findMany.mockImplementation(async ({ where }: any) =>
        where.sabor_id ? [{ sabor_id: BigInt(401), cantidad: 4 }, { sabor_id: BigInt(402), cantidad: 6 }] : [],
      );
      prisma.stockSabor = {
        findMany: jest.fn().mockResolvedValue([{ sabor_id: BigInt(401), cantidad: 0 }, { sabor_id: BigInt(402), cantidad: 0 }]),
      };
      const carta = await (service as any).obtenerCarta();
      expect(carta[0].productos[0]).toMatchObject({ saboresConStock: false, quedan: 0, disponible: false });
    });

    it('sin apertura de los sabores: el saldo de cada sabor es el tope; sin filas de stock no hay disponibles', async () => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(4), nombre: 'Donas', orden: 1, oculta: false, productos: [donaSabor()] }]);
      prisma.conteoApertura.findMany.mockResolvedValue([]);
      prisma.stockSabor = { findMany: jest.fn().mockResolvedValue([{ sabor_id: BigInt(402), cantidad: 2 }]) };
      const carta = await (service as any).obtenerCarta();
      const p = carta[0].productos[0];
      expect(p.sabores).toEqual([
        { id: '401', nombre: 'Fresa', activo: true, disponible: false, quedan: 0 },
        { id: '402', nombre: 'Oreo', activo: true, disponible: true, quedan: 2 },
      ]);
      expect(p).toMatchObject({ saboresConStock: true, quedan: 2, disponible: true });
    });
  });

  describe('9. Stock y combo en el listado admin', () => {
    const prod = (extra: any = {}) => ({
      id: BigInt(50), categoria_id: BigInt(4), categoria: { id: BigInt(4), nombre: 'Donas' }, nombre: 'DONA', descripcion: null,
      precio: 4, orden: 0, oculto: false, agotado_hasta: null, no_suma_beneficios: false, controla_stock: true,
      foto_archivo: null, tamanos: [], grupos: [], sabores: [], ofertasAlcance: [], ...extra,
    });
    const sab = (id: number, activo = true) => ({ id: BigInt(id), nombre: 'S' + id, activo, agotado_hasta: null });

    it('un anfitrión de combo se marca esAnfitrionCombo (solo lectura); el resto no', async () => {
      prisma.producto.findMany.mockResolvedValue([prod({ controla_stock: false, ofertasAlcance: [{ id: BigInt(1) }] }), prod({ id: BigInt(51), controla_stock: false })]);
      const r = await service.listarProductosAdmin({} as any);
      expect(prisma.producto.findMany.mock.calls[0][0].include.ofertasAlcance).toEqual({ where: { tipo: 'COMBO' }, select: { id: true }, take: 1 });
      expect(r.map((x: any) => x.esAnfitrionCombo)).toEqual([true, false]);
    });

    it('sin sabores: quedan es el saldo, aperturaHoy refleja el conteo de hoy y saldo 0 sale NO disponible', async () => {
      prisma.producto.findMany.mockResolvedValue([prod()]);
      prisma.stock = { findMany: jest.fn().mockResolvedValue([{ producto_id: BigInt(50), cantidad: 0 }]) };
      prisma.conteoApertura.findMany.mockResolvedValue([]);
      const [p] = (await service.listarProductosAdmin({} as any)) as any[];
      expect(p).toMatchObject({ controlaStock: true, quedan: 0, aperturaHoy: false, disponible: false });

      prisma.stock.findMany.mockResolvedValue([{ producto_id: BigInt(50), cantidad: 5 }]);
      prisma.conteoApertura.findMany.mockResolvedValue([{ producto_id: BigInt(50) }]);
      const [q] = (await service.listarProductosAdmin({} as any)) as any[];
      expect(q).toMatchObject({ quedan: 5, aperturaHoy: true, disponible: true });
    });

    it('por sabor: con todos los sabores en 0 el admin muestra el producto no disponible; con saldo, disponible', async () => {
      prisma.producto.findMany.mockResolvedValue([prod({ sabores: [sab(501), sab(502)] })]);
      prisma.stockSabor = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.stock = { findMany: jest.fn().mockResolvedValue([]) };
      let [p] = (await service.listarProductosAdmin({} as any)) as any[];
      expect(p.disponible).toBe(false);
      expect(p.sabores.map((s: any) => [s.quedan, s.aperturaHoy])).toEqual([[0, false], [0, false]]);

      prisma.stockSabor.findMany.mockResolvedValue([{ sabor_id: BigInt(502), cantidad: 3 }]);
      [p] = (await service.listarProductosAdmin({} as any)) as any[];
      expect(p.disponible).toBe(true);
      expect(p.sabores[1]).toMatchObject({ quedan: 3, disponible: true });
    });

    it('un producto que no controla stock no se ve afectado', async () => {
      prisma.producto.findMany.mockResolvedValue([prod({ controla_stock: false })]);
      const [p] = (await service.listarProductosAdmin({} as any)) as any[];
      expect(p).toMatchObject({ disponible: true, quedan: null, aperturaHoy: null });
    });
  });

  describe('7. Opciones ligadas a stock (opcion_requiere) en el combo', () => {
    const grupoOpcion = (grupoId: bigint, nombre: string, opciones: any[]) => ({
      grupo: { id: grupoId, nombre, obligatorio: true, minimo: 1, maximo: 1, activo: true, opciones },
    });
    const opcion = (id: bigint, nombre: string, grupoId: bigint) => ({
      id, grupo_id: grupoId, valor_id: id, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id, nombre },
    });
    const dona = (stock: number) => ({
      id: BigInt(57), nombre: 'DONAS ARTESANALES', oculto: false, agotado_hasta: null, controla_stock: true,
      stocks: [], sabores: [{ id: BigInt(101), producto_id: BigInt(57), activo: true, agotado_hasta: null, stockSabor: { cantidad: stock } }],
    });
    const duo = (cPlanB: boolean) => ({
      id: BigInt(1), nombre: 'DÚO PARA COMPARTIR', descripcion: null, precio: 20, oculto: false, agotado_hasta: null,
      no_suma_beneficios: false, foto_archivo: null, tamanos: [], sabores: [],
      ofertasAlcance: [{ id: BigInt(1), combosParte: cPlanB ? [{ id: BigInt(9) }] : [] }],
      grupos: [
        grupoOpcion(BigInt(1), 'Complemento 1 · Complemento', [opcion(BigInt(11), '2 Donas', BigInt(1)), opcion(BigInt(12), '2 Galletas choco chips', BigInt(1))]),
        grupoOpcion(BigInt(2), 'Dona 1 · Sabor', [opcion(BigInt(21), 'Crema pastelera', BigInt(2))]),
      ],
    });
    const preparar = (d: any, stockDona: number) => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(2), nombre: 'Combos', orden: 1, oculta: false, productos: [d] }]);
      prisma.opcionRequiere.findMany.mockResolvedValue([
        { opcion_id: BigInt(11), producto_id: BigInt(57), sabor_id: null, cantidad: 2 },
        { opcion_id: BigInt(21), producto_id: BigInt(57), sabor_id: BigInt(101), cantidad: 1 },
      ]);
      prisma.producto.findMany.mockImplementation(({ select }: any) =>
        Promise.resolve(select?.stocks ? [dona(stockDona)] : []),
      );
    };

    it('donas sin stock: «2 Donas» y el sabor no se pueden elegir; la galleta sí', async () => {
      preparar(duo(false), 0);
      const producto = (await service.obtenerCarta())[0].productos[0];
      const [complemento, sabor] = producto.grupos as any[];
      expect(complemento.opciones.find((o: any) => o.nombre === '2 Donas')?.disponible).toBe(false);
      expect(complemento.opciones.find((o: any) => o.nombre === '2 Galletas choco chips')?.disponible).toBe(true);
      expect(sabor.opciones[0].disponible).toBe(false);
      expect(complemento.aviso).toBe('Se acabaron: 2 Donas. Elige entre: 2 Galletas choco chips');
    });

    it('sin plan B y un paso sin ninguna opción pedible: el combo sale no disponible', async () => {
      preparar(duo(false), 0);
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.disponible).toBe(false);
    });

    it('con alternativas configuradas en el combo, el combo sigue disponible', async () => {
      preparar(duo(true), 0);
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.disponible).toBe(true);
    });

    it('con stock de donas, todas las opciones se pueden elegir y no hay aviso', async () => {
      preparar(duo(false), 5);
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.grupos.flatMap((g: any) => g.opciones).every((o: any) => o.disponible)).toBe(true);
      expect(producto.grupos.every((g: any) => g.aviso === null)).toBe(true);
    });
  });

  describe('8. Enlace opción → stock (admin)', () => {
    const preparar = () => {
      prisma.opcion = { ...prisma.opcion, findUnique: jest.fn().mockResolvedValue({ id: BigInt(11), valor: { nombre: '2 Donas' } }) };
      prisma.opcionRequiere = {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      prisma.producto.findUnique = jest.fn().mockResolvedValue({ id: BigInt(57), nombre: 'DONAS ARTESANALES' });
      prisma.sabor = { findFirst: jest.fn().mockResolvedValue(null) };
      prisma.$transaction = jest.fn().mockResolvedValue([]);
      auditoria.registrar = jest.fn().mockResolvedValue(undefined);
    };

    it('cantidad fuera de 1..99 -> 400 CANTIDAD_INVALIDA', async () => {
      preparar();
      const err: any = await service.guardarRequisitosOpcion('11', [{ productoId: '57', cantidad: 0 }]).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'CANTIDAD_INVALIDA' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('el mismo producto dos veces -> 400 REQUISITO_REPETIDO', async () => {
      preparar();
      const err: any = await service.guardarRequisitosOpcion('11', [{ productoId: '57', cantidad: 1 }, { productoId: '57', cantidad: 2 }]).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'REQUISITO_REPETIDO' });
    });

    it('sabor que no es del producto -> 400 SABOR_INVALIDO', async () => {
      preparar();
      const err: any = await service.guardarRequisitosOpcion('11', [{ productoId: '57', saborId: '999', cantidad: 1 }]).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'SABOR_INVALIDO' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('guarda reemplazando los requisitos y deja rastro en auditoría', async () => {
      preparar();
      await service.guardarRequisitosOpcion('11', [{ productoId: '57', cantidad: 2 }], undefined, '1.2.3.4');
      expect(prisma.opcionRequiere.deleteMany).toHaveBeenCalledWith({ where: { opcion_id: BigInt(11) } });
      expect(prisma.opcionRequiere.createMany).toHaveBeenCalledWith({
        data: [{ opcion_id: BigInt(11), producto_id: BigInt(57), sabor_id: null, cantidad: 2 }],
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CAMBIAR_STOCK_OPCION', entidadId: BigInt(11) }));
    });

    it('opción inexistente -> 404 OPCION_NO_ENCONTRADA', async () => {
      preparar();
      prisma.opcion.findUnique = jest.fn().mockResolvedValue(null);
      const err: any = await service.guardarRequisitosOpcion('11', []).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'OPCION_NO_ENCONTRADA' });
    });
  });

  describe('9. Pasos opcionales y obligatorios con stock (Dúo)', () => {
    const grupoOpcion = (grupoId: bigint, nombre: string, opciones: any[], obligatorio: boolean, minimo: number) => ({
      grupo: { id: grupoId, nombre, obligatorio, minimo, maximo: 1, activo: true, opciones },
    });
    const opcion = (id: bigint, nombre: string, grupoId: bigint) => ({
      id, grupo_id: grupoId, valor_id: id, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id, nombre },
    });
    const dona = {
      id: BigInt(57), nombre: 'DONAS ARTESANALES', oculto: false, agotado_hasta: null, controla_stock: true,
      stocks: [], sabores: [{ id: BigInt(101), producto_id: BigInt(57), activo: true, agotado_hasta: null, stockSabor: { cantidad: 0 } }],
    };
    // Complemento obligatorio: «2 Donas» (sin donas) y galletas (con stock). Sabor de dona: opcional (minimo 0).
    const duo = (complementos: any[], saborObligatorio = false) => ({
      id: BigInt(1), nombre: 'DÚO PARA COMPARTIR', descripcion: null, precio: 20, oculto: false, agotado_hasta: null,
      no_suma_beneficios: false, foto_archivo: null, tamanos: [], sabores: [],
      ofertasAlcance: [{ id: BigInt(1), combosParte: [] }],
      grupos: [
        grupoOpcion(BigInt(1), 'Complemento 1 · Complemento', complementos, true, 1),
        grupoOpcion(BigInt(2), 'Dona 1 · Sabor', [opcion(BigInt(21), 'Crema pastelera', BigInt(2))], saborObligatorio, saborObligatorio ? 1 : 0),
      ],
    });
    const preparar = (d: any) => {
      prisma.categoria.findMany.mockResolvedValue([{ id: BigInt(2), nombre: 'Combos', orden: 1, oculta: false, productos: [d] }]);
      prisma.opcionRequiere.findMany.mockResolvedValue([
        { opcion_id: BigInt(11), producto_id: BigInt(57), sabor_id: null, cantidad: 2 },
        { opcion_id: BigInt(21), producto_id: BigInt(57), sabor_id: BigInt(101), cantidad: 1 },
      ]);
      prisma.producto.findMany.mockImplementation(({ select }: any) => Promise.resolve(select?.stocks ? [dona] : []));
    };
    const complementos = (conGalletas: boolean) => [
      opcion(BigInt(11), '2 Donas', BigInt(1)),
      ...(conGalletas ? [opcion(BigInt(12), 'Keke Marmoleado', BigInt(1))] : []),
    ];

    it('Dúo con donas en 0 sigue disponible con los complementos restantes; el paso de sabor opcional no se muestra', async () => {
      preparar(duo(complementos(true)));
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.disponible).toBe(true);
      expect(producto.grupos.map((g: any) => g.nombre)).toEqual(['Complemento 1 · Complemento']);
      const complemento = producto.grupos[0];
      expect(complemento.opciones.find((o: any) => o.nombre === '2 Donas')?.disponible).toBe(false);
      expect(complemento.opciones.find((o: any) => o.nombre === 'Keke Marmoleado')?.disponible).toBe(true);
    });

    it('Dúo con TODOS los complementos agotados (paso obligatorio sin opciones, sin alternativas) → no disponible', async () => {
      preparar(duo(complementos(false)));
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.disponible).toBe(false);
    });

    it('un paso OPCIONAL sin opciones pedibles no bloquea el producto', async () => {
      preparar(duo(complementos(true), false));
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.disponible).toBe(true);
    });

    it('un paso obligatorio de sabor sin opciones pedibles sí bloquea (regla obligatoria, sin alternativas)', async () => {
      preparar(duo(complementos(true), true));
      const producto = (await service.obtenerCarta())[0].productos[0];
      expect(producto.disponible).toBe(false);
    });
  });
});
