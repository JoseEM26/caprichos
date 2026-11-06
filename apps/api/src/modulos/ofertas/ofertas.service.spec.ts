jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CrearOfertaDto } from './dto/crear-oferta.dto';

describe('OfertasService', () => {
  let service: OfertasService;
  let prismaMock: any;
  let redisMock: any;
  let auditoriaMock: any;
  let redisStore: Map<string, string>;

  beforeEach(async () => {
    redisStore = new Map();
    redisMock = {
      obtenerCliente: () => ({
        get: jest.fn().mockImplementation((k: string) => Promise.resolve(redisStore.get(k) || null)),
        set: jest.fn().mockImplementation((k: string, v: string) => {
          redisStore.set(k, v);
          return Promise.resolve('OK');
        }),
        del: jest.fn().mockImplementation((k: string) => {
          redisStore.delete(k);
          return Promise.resolve(1);
        }),
        incr: jest.fn().mockImplementation((k: string) => {
          const val = (parseInt(redisStore.get(k) || '0', 10) + 1).toString();
          redisStore.set(k, val);
          return Promise.resolve(parseInt(val, 10));
        }),
        expire: jest.fn().mockResolvedValue(1),
      }),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    prismaMock = {
      oferta: {
        // Por defecto no hay combos; cada prueba sobreescribe la respuesta con mockResolvedValueOnce.
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      producto: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      comboParteReemplazo: { createMany: jest.fn() },
      comboPrecio: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      comboParte: {
        create: jest.fn().mockResolvedValue({ id: 100n }),
        deleteMany: jest.fn(),
      },
      reglaAcumulacion: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      cupon: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cuponEmitido: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cuponCanjeCompartido: {
        count: jest.fn(),
        create: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();

    service = module.get<OfertasService>(OfertasService);
  });

  describe('Ofertas y Combos', () => {
    it('rechaza crear combo si el nombre repite el de un producto (RN-CAP-085 2.ª / RQ-OFE-01-03)', async () => {
      prismaMock.producto.findFirst.mockResolvedValueOnce({
        id: 10n,
        nombre: 'Frappé Oreo',
      });

      await expect(
        service.crearOferta({
          tipo: 'COMBO',
          nombre: 'Frappé Oreo',
          tamanos: [{ tamanoValorId: '1', precio: 25 }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('crea combo con precios y partes asociadas', async () => {
      prismaMock.producto.findFirst.mockResolvedValueOnce(null);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(null);
      const mockCreada = {
        id: 1n,
        tipo: 'COMBO',
        nombre: 'Dúo Especial',
        descripcion: '2 bebidas',
        lleva: null,
        paga: null,
        alcance_categoria_id: null,
        alcance_producto_id: null,
        descuento_tipo: null,
        descuento_valor: null,
        compra_minima: null,
        dias: [],
        hora_desde: null,
        hora_hasta: null,
        fecha_desde: null,
        fecha_hasta: null,
        canales: ['CARTA', 'ADMIN'],
        limite_usos: null,
        usos_actuales: 0,
        no_suma_beneficios: false,
        orden: 1,
        activo: true,
        creado_en: new Date(),
        combosPrecio: [{ tamano_valor_id: 10n, tamano_valor: { nombre: '12 oz' }, precio: new Prisma.Decimal(25) }],
        combosParte: [{ id: 100n, tipo: 'A_ELECCION', cantidad: 2, categorias: [1n], productos: [] }],
      };
      prismaMock.oferta.create.mockResolvedValueOnce(mockCreada);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(mockCreada);

      const res = await service.crearOferta({
        tipo: 'COMBO',
        nombre: 'Dúo Especial',
        tamanos: [{ tamanoValorId: '10', precio: 25 }],
        partes: [{ tipo: 'A_ELECCION', cantidad: 2, categorias: ['1'] }],
      });

      expect(res.id).toBe('1');
      expect(res.nombre).toBe('Dúo Especial');
      expect(prismaMock.comboPrecio.create).toHaveBeenCalled();
      expect(prismaMock.comboParte.create).toHaveBeenCalled();
    });

    describe('reemplazos de la parte FIJO (plan B, C...)', () => {
      const comboBase = {
        id: 1n, tipo: 'COMBO', nombre: 'Dúo', descripcion: null, lleva: null, paga: null,
        alcance_categoria_id: null, alcance_producto_id: null, descuento_tipo: null, descuento_valor: null,
        compra_minima: null, dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null,
        canales: ['CARTA'], limite_usos: null, usos_actuales: 0, no_suma_beneficios: false, orden: 1,
        activo: true, creado_en: new Date(), combosPrecio: [],
      };
      const crear = (ids: (string | number)[]) =>
        service.crearOferta({
          tipo: 'COMBO', nombre: 'Dúo', tamanos: [{ tamanoValorId: '10', precio: 25 }],
          partes: [{ tipo: 'FIJO', cantidad: 1, productos: ['5'], alternativas: ids.map((productoId) => ({ productoId })) }],
        });

      beforeEach(() => {
        prismaMock.producto.findFirst.mockResolvedValue(null);
        prismaMock.oferta.findUnique.mockResolvedValue(null);
        prismaMock.oferta.create.mockResolvedValue({ ...comboBase });
      });

      it('guarda los reemplazos en el orden recibido', async () => {
        prismaMock.producto.findMany.mockResolvedValueOnce([{ id: 7n }, { id: 8n }]);
        prismaMock.oferta.findUnique.mockResolvedValueOnce(null);
        prismaMock.oferta.findUnique.mockResolvedValue({
          ...comboBase,
          combosParte: [{ id: 100n, tipo: 'FIJO', cantidad: 1, categorias: [], productos: [5n],
            reemplazos: [{ producto_id: 8n, producto: { nombre: 'Empanada' } }, { producto_id: 7n, producto: { nombre: 'Wrap' } }] }],
        });
        const res = await crear(['8', 7]);
        expect(prismaMock.comboParteReemplazo.createMany).toHaveBeenCalledWith({
          data: [
            { combo_parte_id: 100n, producto_id: 8n, orden: 0, cantidad: 1 },
            { combo_parte_id: 100n, producto_id: 7n, orden: 1, cantidad: 1 },
          ],
        });
        expect(res.combosParte![0].alternativas!.map((a) => a.id)).toEqual(['8', '7']);
      });

      it('rechaza repetidos y el producto principal como reemplazo', async () => {
        await expect(crear(['8', '8'])).rejects.toThrow(BadRequestException);
        await expect(crear(['5'])).rejects.toThrow(BadRequestException);
      });

      it('guarda la cantidad de cada alternativa (2 galletas, 1 carrot cake)', async () => {
        prismaMock.producto.findMany.mockResolvedValueOnce([{ id: 7n }, { id: 8n }]);
        prismaMock.oferta.findUnique.mockResolvedValueOnce(null);
        prismaMock.oferta.findUnique.mockResolvedValue({ ...comboBase, combosParte: [] });
        await service.crearOferta({
          tipo: 'COMBO', nombre: 'Dúo', tamanos: [{ tamanoValorId: '10', precio: 25 }],
          partes: [{ tipo: 'A_ELECCION', cantidad: 2, categorias: ['3'], productos: [], alternativas: [
            { productoId: '7', cantidad: 2 }, { productoId: '8' },
          ] }],
        });
        expect(prismaMock.comboParteReemplazo.createMany).toHaveBeenCalledWith({
          data: [
            { combo_parte_id: 100n, producto_id: 7n, orden: 0, cantidad: 2 },
            { combo_parte_id: 100n, producto_id: 8n, orden: 1, cantidad: 1 },
          ],
        });
      });

      it('rechaza una cantidad de alternativa menor a 1', async () => {
        await expect(service.crearOferta({
          tipo: 'COMBO', nombre: 'Dúo', tamanos: [{ tamanoValorId: '10', precio: 25 }],
          partes: [{ tipo: 'A_ELECCION', cantidad: 2, categorias: ['3'], productos: [], alternativas: [{ productoId: '7', cantidad: 0 }] }],
        })).rejects.toMatchObject({ response: { codigo: 'COMBO_REEMPLAZO_INVALIDO' } });
      });
    });

    describe('validarEleccionesCombo (pedido)', () => {
      const comboConParte = (agotadoPrincipal: boolean) => {
        const ahora = Date.now();
        prismaMock.oferta.findUnique.mockResolvedValue({
          id: 1n, tipo: 'COMBO', nombre: 'Combo Dúo Irresistible', dias: [], canales: [], creado_en: new Date(),
          combosPrecio: [],
          combosParte: [{ id: 100n, tipo: 'FIJO', cantidad: 1, categorias: [], productos: [5n],
            reemplazos: [{ producto_id: 7n, producto: { nombre: 'Empanada' } }] }],
        });
        prismaMock.producto.findMany.mockImplementation(async (args: any) =>
          args.select?.categoria_id
            ? [
                { id: 5n, nombre: 'Club Sandwich', categoria_id: 1n, oculto: false, agotado_hasta: agotadoPrincipal ? new Date(ahora + 3600000) : null },
                { id: 7n, nombre: 'Empanada', categoria_id: 1n, oculto: false, agotado_hasta: null },
              ]
            : [{ id: 5n, nombre: 'Club Sandwich' }, { id: 7n, nombre: 'Empanada' }],
        );
      };

      it('con el principal disponible acepta el principal sin nota', async () => {
        comboConParte(false);
        await expect(service.validarEleccionesCombo(1, [{ parteId: '100', productoId: '5' }])).resolves.toBe('');
      });

      it('con el principal agotado acepta el reemplazo y lo anota', async () => {
        comboConParte(true);
        await expect(service.validarEleccionesCombo(1, [{ parteId: '100', productoId: '7' }])).resolves.toBe(
          'Combo Dúo Irresistible · Empanada (en lugar de Club Sandwich)',
        );
      });

      it('con el principal agotado rechaza el principal con 409 COMBO_PARTE_NO_DISPONIBLE', async () => {
        comboConParte(true);
        await expect(service.validarEleccionesCombo(1, [{ parteId: '100', productoId: '5' }])).rejects.toMatchObject({
          response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje: 'Club Sandwich se acaba de agotar; elige otro reemplazo' },
          status: 409,
        });
      });

      it('rechaza un producto que no es reemplazo de la parte', async () => {
        comboConParte(true);
        await expect(service.validarEleccionesCombo(1, [{ parteId: '100', productoId: '99' }])).rejects.toThrow(ConflictException);
      });
    });

    describe('resolverPartesCombo: elecciones A_ELECCION con lista de productos (juguetes)', () => {
      const cajita = (agotadoBurbujas: boolean) => {
        const ahora = Date.now();
        prismaMock.oferta.findUnique.mockResolvedValue({
          id: 9n, tipo: 'COMBO', nombre: 'COMBO CAJITA CAPRIKIDS', dias: [], canales: [], creado_en: new Date(),
          combosPrecio: [],
          combosParte: [{ id: 200n, tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: [30n, 31n, 32n], reemplazos: [] }],
        });
        const juguete = (id: bigint, nombre: string, agotado: Date | null = null) => ({
          id, nombre, categoria_id: 8n, oculto: false, agotado_hasta: agotado,
          categoria: { nombre: 'JUGUETES', area_id: 4n, area: { nombre: 'Salados' } },
        });
        prismaMock.producto.findMany.mockResolvedValue([
          juguete(30n, 'Pistola de burbujas'),
          juguete(31n, 'Burbujas'),
          juguete(32n, 'Squishy', agotadoBurbujas ? new Date(ahora + 3600000) : null),
        ]);
      };

      it('dos juguetes distintos: una línea hija por juguete, en el área de su categoría, sin cobro', async () => {
        cajita(false);
        const res = await service.resolverPartesCombo(9, [{ parteId: '200', productoId: '30' }, { parteId: '200', productoId: '31' }]);
        expect(res.partes).toEqual([
          expect.objectContaining({ parteId: 200n, tipo: 'A_ELECCION', productoId: 30n, nombre: 'Pistola de burbujas', cantidad: 1, areaId: 4n, areaNombre: 'Salados' }),
          expect.objectContaining({ parteId: 200n, tipo: 'A_ELECCION', productoId: 31n, nombre: 'Burbujas', cantidad: 1, areaId: 4n }),
        ]);
        expect(res.partes[0].nota).toBe('Combo: COMBO CAJITA CAPRIKIDS');
      });

      it('el mismo juguete repetido suma unidades en una sola línea hija', async () => {
        cajita(false);
        const res = await service.resolverPartesCombo(9, [{ parteId: '200', productoId: '32' }, { parteId: '200', productoId: '32' }]);
        expect(res.partes).toEqual([expect.objectContaining({ productoId: 32n, cantidad: 2 })]);
      });

      it('con unidades del combo, exige cantidad × elecciones por parte (2 cajitas = 4 juguetes)', async () => {
        cajita(false);
        const dos = [{ parteId: '200', productoId: '30' }, { parteId: '200', productoId: '31' }];
        await expect(service.resolverPartesCombo(9, dos, 2)).rejects.toMatchObject({
          response: { codigo: 'COMBO_ELECCION_INCOMPLETA' },
          status: 400,
        });
        const cuatro = [...dos, { parteId: '200', productoId: '30' }, { parteId: '200', productoId: '31' }];
        const res = await service.resolverPartesCombo(9, cuatro, 2);
        expect(res.partes.map((p) => p.cantidad)).toEqual([2, 2]);
      });

      it('sin elegir juguetes rechaza con 400 COMBO_ELECCION_INCOMPLETA (la parte tiene lista)', async () => {
        cajita(false);
        await expect(service.resolverPartesCombo(9, [])).rejects.toMatchObject({
          response: { codigo: 'COMBO_ELECCION_INCOMPLETA' },
        });
      });

      it('un juguete agotado no se puede elegir: 409 COMBO_PARTE_NO_DISPONIBLE', async () => {
        cajita(true);
        await expect(service.resolverPartesCombo(9, [{ parteId: '200', productoId: '32' }, { parteId: '200', productoId: '31' }])).rejects.toMatchObject({
          response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE' },
          status: 409,
        });
      });

      it('un producto fuera de la lista de la parte rechaza con 400 COMBO_PARTE_NO_PERMITIDA', async () => {
        cajita(false);
        await expect(service.resolverPartesCombo(9, [{ parteId: '200', productoId: '99' }, { parteId: '200', productoId: '31' }])).rejects.toMatchObject({
          response: { codigo: 'COMBO_PARTE_NO_PERMITIDA' },
        });
      });
    });

    it('cambia estado de oferta con Sí/No (activar/desactivar)', async () => {
      prismaMock.oferta.update.mockResolvedValueOnce({
        id: 1n,
        tipo: 'DESCUENTO',
        nombre: '10% Waffles',
        descripcion: null,
        lleva: null,
        paga: null,
        alcance_categoria_id: null,
        alcance_producto_id: null,
        descuento_tipo: 'PORCENTAJE',
        descuento_valor: new Prisma.Decimal(10),
        compra_minima: null,
        dias: [2],
        hora_desde: null,
        hora_hasta: null,
        fecha_desde: null,
        fecha_hasta: null,
        canales: ['CARTA'],
        limite_usos: null,
        usos_actuales: 0,
        no_suma_beneficios: false,
        orden: 0,
        activo: false,
        creado_en: new Date(),
        combosPrecio: [],
        combosParte: [],
      });

      const res = await service.cambiarEstadoOferta('1', false);
      expect(res.activo).toBe(false);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'desactivar' }),
      );
    });

    it('rechaza crear oferta con porcentaje mayor a 100 (150%) (RN-OFE-PCT-MAX)', async () => {
      prismaMock.producto.findFirst.mockResolvedValueOnce(null);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.crearOferta({
          tipo: 'DESCUENTO',
          nombre: 'Descuento Loco',
          descuentoTipo: 'PORCENTAJE',
          descuentoValor: 150,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza crear oferta con porcentaje negativo o 0 (-5% o 0%)', async () => {
      prismaMock.producto.findFirst.mockResolvedValueOnce(null);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.crearOferta({
          tipo: 'DESCUENTO',
          nombre: 'Descuento Negativo',
          descuentoTipo: 'PORCENTAJE',
          descuentoValor: -5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza crear oferta con monto de descuento negativo (-5) o cero', async () => {
      prismaMock.producto.findFirst.mockResolvedValueOnce(null);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.crearOferta({
          tipo: 'DESCUENTO',
          nombre: 'Descuento Monto Negativo',
          descuentoTipo: 'MONTO',
          descuentoValor: -5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza crear oferta con compra mínima negativa (-5)', async () => {
      prismaMock.producto.findFirst.mockResolvedValueOnce(null);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.crearOferta({
          tipo: 'DESCUENTO',
          nombre: 'Descuento Minima Negativa',
          descuentoTipo: 'PORCENTAJE',
          descuentoValor: 10,
          compraMinima: -5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza actualizar oferta con porcentaje mayor a 100 (150%) o compra mínima negativa (-5)', async () => {
      prismaMock.oferta.findUnique.mockResolvedValueOnce({
        id: 1n,
        tipo: 'DESCUENTO',
        nombre: 'Descuento Base',
        descuento_tipo: 'PORCENTAJE',
      });

      await expect(
        service.actualizarOferta('1', {
          descuentoValor: 150,
        }),
      ).rejects.toThrow(BadRequestException);

      prismaMock.oferta.findUnique.mockResolvedValueOnce({
        id: 1n,
        tipo: 'DESCUENTO',
        nombre: 'Descuento Base',
        descuento_tipo: 'PORCENTAJE',
      });

      await expect(
        service.actualizarOferta('1', {
          compraMinima: -5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('el DTO CrearOfertaDto rechaza mediante class-validator valores 150% y -5', async () => {
      const dto1 = plainToInstance(CrearOfertaDto, {
        tipo: 'DESCUENTO',
        nombre: 'Oferta 150',
        descuentoTipo: 'PORCENTAJE',
        descuentoValor: 150,
      });
      const errors1 = await validate(dto1);
      expect(errors1.some((e) => e.property === 'descuentoValor')).toBe(true);

      const dto2 = plainToInstance(CrearOfertaDto, {
        tipo: 'DESCUENTO',
        nombre: 'Oferta -5',
        descuentoTipo: 'PORCENTAJE',
        descuentoValor: -5,
      });
      const errors2 = await validate(dto2);
      expect(errors2.some((e) => e.property === 'descuentoValor')).toBe(true);

      const dto3 = plainToInstance(CrearOfertaDto, {
        tipo: 'DESCUENTO',
        nombre: 'Oferta Compra Minima -5',
        compraMinima: -5,
      });
      const errors3 = await validate(dto3);
      expect(errors3.some((e) => e.property === 'compraMinima')).toBe(true);
    });
  });

  describe('resolverPartesCombo: alternativas de la parte (si no hay stock, elige)', () => {
    const alt = (productoId: bigint, nombre: string, cantidad: number) => ({ producto_id: productoId, cantidad, producto: { nombre } });
    const cat = { nombre: 'DONAS', area_id: 2n, area: { nombre: 'Dulces' } };
    const catGalletas = { nombre: 'GALLETAS', area_id: 2n, area: { nombre: 'Dulces' } };
    // Complemento «2 donas» (A_ELECCION de la categoría DONAS) con alternativas: 2 galletas, 1 carrot cake, 1 queque
    const combo = (saldoGlaseada: number, saldoFresa: number) => {
      prismaMock.oferta.findUnique.mockResolvedValue({
        id: 9n, tipo: 'COMBO', nombre: 'Combo Dúo Para Compartir', dias: [], canales: [], creado_en: new Date(),
        combosPrecio: [],
        combosParte: [{ id: 300n, tipo: 'A_ELECCION', cantidad: 2, categorias: [7n], productos: [],
          reemplazos: [alt(50n, 'GALLETA CHOCO CHIPS', 2), alt(51n, 'CARROT CAKE', 1), alt(52n, 'QUEQUE', 1)] }],
      });
      prismaMock.producto.findMany.mockResolvedValue([
        { id: 40n, nombre: 'DONA GLASEADA', categoria_id: 7n, oculto: false, agotado_hasta: null, categoria: cat, controla_stock: true, stocks: [{ cantidad: saldoGlaseada }], sabores: [] },
        { id: 41n, nombre: 'DONA ARTESANAL', categoria_id: 7n, oculto: false, agotado_hasta: null, categoria: cat, controla_stock: true, stocks: [],
          sabores: [{ id: 501n, nombre: 'Fresa', activo: true, agotado_hasta: null, stockSabor: { cantidad: saldoFresa } }] },
        { id: 50n, nombre: 'GALLETA CHOCO CHIPS', categoria_id: 8n, oculto: false, agotado_hasta: null, categoria: catGalletas, controla_stock: true, stocks: [{ cantidad: 5 }], sabores: [] },
        { id: 51n, nombre: 'CARROT CAKE', categoria_id: 8n, oculto: false, agotado_hasta: null, categoria: catGalletas, controla_stock: true, stocks: [{ cantidad: 0 }], sabores: [] },
        { id: 52n, nombre: 'QUEQUE', categoria_id: 8n, oculto: false, agotado_hasta: null, categoria: catGalletas, controla_stock: true, stocks: [],
          sabores: [
            { id: 601n, nombre: 'Marmoleado', activo: true, agotado_hasta: null, stockSabor: { cantidad: 4 } },
            { id: 602n, nombre: 'Vainilla', activo: true, agotado_hasta: null, stockSabor: { cantidad: 0 } },
          ] },
      ]);
    };

    it('el combo no sale «No disponible» mientras una alternativa tenga stock; las agotadas salen con «No hay stock»', async () => {
      combo(0, 0);
      const oferta = await service.obtenerOfertaPorId(9);
      expect(oferta.disponible).toBe(true);
      expect(oferta.sinStock).toBeFalsy();
      const parte = oferta.combosParte![0];
      expect(parte.alternativasActivas).toBe(true);
      expect(parte.alternativas!.find((a) => a.id === '50')).toMatchObject({ cantidad: 2, disponible: true });
      expect(parte.alternativas!.find((a) => a.id === '51')).toMatchObject({ disponible: false, sinStock: true });
    });

    it('sin donas: 2 galletas por la parte, con su cantidad, sin precio extra y con nota', async () => {
      combo(0, 0);
      const res = await service.resolverPartesCombo(9, [{ parteId: '300', productoId: '50' }, { parteId: '300', productoId: '50' }]);
      expect(res.partes).toEqual([expect.objectContaining({ productoId: 50n, cantidad: 2, tipo: 'A_ELECCION', areaId: 2n })]);
      expect(res.nota).toBe('Combo Dúo Para Compartir · GALLETA CHOCO CHIPS (en lugar de las opciones de la parte)');
    });

    it('con donas en stock la alternativa se rechaza: 409 COMBO_ALTERNATIVA_NO_APLICA', async () => {
      combo(3, 0);
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '50' }, { parteId: '300', productoId: '50' }])).rejects.toMatchObject({
        response: { codigo: 'COMBO_ALTERNATIVA_NO_APLICA' },
        status: 409,
      });
    });

    it('con donas en stock pero no bastan para 2 (1 sola): la alternativa sí se acepta', async () => {
      combo(1, 0);
      const res = await service.resolverPartesCombo(9, [{ parteId: '300', productoId: '50' }, { parteId: '300', productoId: '50' }]);
      expect(res.partes[0]).toEqual(expect.objectContaining({ productoId: 50n, cantidad: 2 }));
    });

    it('la alternativa exige su cantidad exacta: 1 galleta cuando son 2 responde 400 COMBO_ELECCION_INCOMPLETA', async () => {
      combo(0, 0);
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '50' }])).rejects.toMatchObject({
        response: { codigo: 'COMBO_ELECCION_INCOMPLETA' },
        status: 400,
      });
    });

    it('una sola alternativa por parte: dos distintas responden 400 COMBO_PARTE_NO_PERMITIDA', async () => {
      combo(0, 0);
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '51' }, { parteId: '300', productoId: '52' }])).rejects.toMatchObject({
        response: { codigo: 'COMBO_PARTE_NO_PERMITIDA' },
      });
    });

    it('una alternativa agotada sale bloqueada: 409 COMBO_PARTE_NO_DISPONIBLE «No hay stock»', async () => {
      combo(0, 0);
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '51' }])).rejects.toMatchObject({
        response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje: 'No hay stock de CARROT CAKE; elige otro' },
        status: 409,
      });
    });

    it('alternativa por sabor: el queque Marmoleado lleva su sabor para descontar', async () => {
      combo(0, 0);
      const res = await service.resolverPartesCombo(9, [{ parteId: '300', productoId: '52', saborId: '601' }]);
      expect(res.partes).toEqual([expect.objectContaining({ productoId: 52n, cantidad: 1, sabores: [{ saborId: 601n, nombre: 'Marmoleado', cantidad: 1 }] })]);
    });

    it('alternativa por sabor sin sabor elegido: 400 SABORES_INVALIDOS', async () => {
      combo(0, 0);
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '52' }])).rejects.toMatchObject({
        response: { codigo: 'SABORES_INVALIDOS' },
        status: 400,
      });
    });

    it('alternativa por sabor sin saldo: 409 STOCK_INSUFICIENTE con el sabor', async () => {
      combo(0, 0);
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '52', saborId: '602' }])).rejects.toMatchObject({
        response: { codigo: 'STOCK_INSUFICIENTE', saborNombre: 'Vainilla', quedan: 0 },
        status: 409,
      });
    });
  });

  describe('resolverPartesCombo: stock heredado (donas y sabores del Dúo)', () => {
    const combo = () => {
      prismaMock.oferta.findUnique.mockResolvedValue({
        id: 9n, tipo: 'COMBO', nombre: 'Combo Dúo Para Compartir', dias: [], canales: [], creado_en: new Date(),
        combosPrecio: [],
        combosParte: [{ id: 300n, tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: [40n, 41n, 42n], reemplazos: [] }],
      });
      const cat = { nombre: 'DONAS', area_id: 2n, area: { nombre: 'Dulces' } };
      prismaMock.producto.findMany.mockResolvedValue([
        // sin sabores: saldo del producto
        { id: 40n, nombre: 'DONA GLASEADA', categoria_id: 7n, oculto: false, agotado_hasta: null, categoria: cat, controla_stock: true, stocks: [{ cantidad: 0 }], sabores: [] },
        { id: 42n, nombre: 'KEKE', categoria_id: 7n, oculto: false, agotado_hasta: null, categoria: cat, controla_stock: true, stocks: [{ cantidad: 1 }], sabores: [] },
        // con sabores: el saldo vive en cada sabor
        {
          id: 41n, nombre: 'DONA ARTESANAL', categoria_id: 7n, oculto: false, agotado_hasta: null, categoria: cat, controla_stock: true, stocks: [],
          sabores: [
            { id: 501n, nombre: 'Fresa', activo: true, agotado_hasta: null, stockSabor: { cantidad: 3 } },
            { id: 502n, nombre: 'Oreo', activo: true, agotado_hasta: null, stockSabor: { cantidad: 0 } },
          ],
        },
      ]);
    };

    it('una dona con saldo 0 no se puede elegir: 409 COMBO_PARTE_NO_DISPONIBLE «No hay stock»', async () => {
      combo();
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '40' }, { parteId: '300', productoId: '42' }])).rejects.toMatchObject({
        response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje: 'No hay stock de DONA GLASEADA; elige otro' },
        status: 409,
      });
    });

    it('producto sin sabores: dos unidades con saldo 1 responde 409 STOCK_INSUFICIENTE (suma de las partes)', async () => {
      combo();
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '42' }, { parteId: '300', productoId: '42' }])).rejects.toMatchObject({
        response: { codigo: 'STOCK_INSUFICIENTE', quedan: 1 },
        status: 409,
      });
    });

    it('producto por sabor sin sabor elegido: 400 SABORES_INVALIDOS', async () => {
      combo();
      await expect(service.resolverPartesCombo(9, [{ parteId: '300', productoId: '41' }, { parteId: '300', productoId: '41' }])).rejects.toMatchObject({
        response: { codigo: 'SABORES_INVALIDOS' },
        status: 400,
      });
    });

    it('sabor sin saldo no se puede repartir: 409 STOCK_INSUFICIENTE con el sabor', async () => {
      combo();
      await expect(
        service.resolverPartesCombo(9, [{ parteId: '300', productoId: '41', saborId: '502' }, { parteId: '300', productoId: '41', saborId: '501' }]),
      ).rejects.toMatchObject({ response: { codigo: 'STOCK_INSUFICIENTE', saborNombre: 'Oreo', quedan: 0 }, status: 409 });
    });

    it('dos donas del mismo sabor (2 de 3 Fresa) se aceptan y el sabor sale en la línea hija', async () => {
      combo();
      const res = await service.resolverPartesCombo(9, [
        { parteId: '300', productoId: '41', saborId: '501' },
        { parteId: '300', productoId: '41', saborId: '501' },
      ]);
      expect(res.partes).toEqual([expect.objectContaining({ productoId: 41n, cantidad: 2, sabores: [{ saborId: 501n, nombre: 'Fresa', cantidad: 2 }] })]);
    });

    it('elegir dos Fresa cuando solo hay 1 responde 409 STOCK_INSUFICIENTE', async () => {
      combo();
      prismaMock.producto.findMany.mockResolvedValue([
        {
          id: 41n, nombre: 'DONA ARTESANAL', categoria_id: 7n, oculto: false, agotado_hasta: null,
          categoria: { nombre: 'DONAS', area_id: 2n, area: { nombre: 'Dulces' } }, controla_stock: true, stocks: [],
          sabores: [{ id: 501n, nombre: 'Fresa', activo: true, agotado_hasta: null, stockSabor: { cantidad: 1 } }],
        },
      ]);
      await expect(
        service.resolverPartesCombo(9, [{ parteId: '300', productoId: '41', saborId: '501' }, { parteId: '300', productoId: '41', saborId: '501' }]),
      ).rejects.toMatchObject({ response: { codigo: 'STOCK_INSUFICIENTE', quedan: 1, saborNombre: 'Fresa' }, status: 409 });
    });
  });

  describe('tamaño de la parte FIJO (combo con tamaño)', () => {
    const tamanoRow = { id: 77n, producto_id: 5n, unidades: 1, tamano_valor: { nombre: 'Regular 12 oz' } };
    const combo = (tamano: unknown) => {
      prismaMock.oferta.findUnique.mockResolvedValue({
        id: 9n, tipo: 'COMBO', nombre: 'COMBO CAJITA CAPRIKIDS', dias: [], canales: [], creado_en: new Date(),
        combosPrecio: [],
        combosParte: [{ id: 100n, tipo: 'FIJO', cantidad: 1, categorias: [], productos: [5n], reemplazos: [], tamano }],
      });
      prismaMock.producto.findMany.mockResolvedValue([
        { id: 5n, nombre: 'FRAPPE OREO', categoria_id: 3n, oculto: false, agotado_hasta: null,
          categoria: { nombre: 'BEBIDAS', area_id: 1n, area: { nombre: 'Bebidas' } }, controla_stock: false, stocks: [], sabores: [] },
      ]);
    };

    it('la línea de la parte sale con el tamaño y sus unidades', async () => {
      combo({ ...tamanoRow });
      const res = await service.resolverPartesCombo(9, [{ parteId: '100', productoId: '5' }]);
      expect(res.partes).toEqual([expect.objectContaining({ productoId: 5n, tamano: 'Regular 12 oz', unidadesTamano: 1 })]);
    });

    it('una parte sin tamaño no lleva tamaño en la línea', async () => {
      combo(null);
      const res = await service.resolverPartesCombo(9, [{ parteId: '100', productoId: '5' }]);
      expect(res.partes[0].tamano).toBeUndefined();
    });

    it('guardar: el tamaño tiene que ser del producto de la parte FIJO', async () => {
      prismaMock.producto.findFirst.mockResolvedValue(null);
      prismaMock.oferta.findUnique.mockResolvedValue(null);
      prismaMock.oferta.create.mockResolvedValue({ id: 9n, tipo: 'COMBO', nombre: 'X', combosParte: [] });
      prismaMock.productoTamano = { findUnique: jest.fn().mockResolvedValue({ producto_id: 6n }) };
      await expect(service.crearOferta({
        tipo: 'COMBO', nombre: 'X', tamanos: [{ tamanoValorId: '10', precio: 25 }],
        partes: [{ tipo: 'FIJO', cantidad: 1, productos: ['5'], tamanoId: '77' }],
      })).rejects.toMatchObject({ response: { codigo: 'COMBO_TAMANO_INVALIDO' } });
    });

    it('guardar: una parte FIJO del producto correcto guarda tamano_id; A_ELECCION con tamaño se rechaza', async () => {
      prismaMock.producto.findFirst.mockResolvedValue(null);
      prismaMock.oferta.findUnique.mockResolvedValueOnce(null);
      prismaMock.oferta.findUnique.mockResolvedValue({ id: 9n, tipo: 'COMBO', nombre: 'X', dias: [], canales: [], creado_en: new Date(), combosPrecio: [], combosParte: [] });
      prismaMock.oferta.create.mockResolvedValue({ id: 9n, tipo: 'COMBO', nombre: 'X', combosParte: [] });
      prismaMock.productoTamano = { findUnique: jest.fn().mockResolvedValue({ producto_id: 5n }) };
      await service.crearOferta({
        tipo: 'COMBO', nombre: 'X', tamanos: [{ tamanoValorId: '10', precio: 25 }],
        partes: [{ tipo: 'FIJO', cantidad: 1, productos: ['5'], tamanoId: '77' }],
      });
      expect(prismaMock.comboParte.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'FIJO', tamano_id: 77n }),
      });
      prismaMock.oferta.findUnique.mockResolvedValue(null);
      await expect(service.crearOferta({
        tipo: 'COMBO', nombre: 'Y', tamanos: [{ tamanoValorId: '10', precio: 25 }],
        partes: [{ tipo: 'A_ELECCION', cantidad: 1, categorias: ['3'], productos: [], tamanoId: '77' }],
      })).rejects.toMatchObject({ response: { codigo: 'COMBO_TAMANO_INVALIDO' } });
    });
  });

  describe('Cupones', () => {
    it('exige tope de usos obligatorio si el modo es COMPARTIDO (RN-CAP-134 / RQ-OFE-03-02)', async () => {
      await expect(
        service.crearCupon({
          modo: 'COMPARTIDO',
          codigoBase: 'VERANO2026',
          descuentoTipo: 'PORCENTAJE',
          descuentoValor: 10,
          // topeUsos no enviado
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea cupón compartido con tope de usos', async () => {
      prismaMock.cupon.findUnique.mockResolvedValueOnce(null);
      const mockCupon = {
        id: 5n,
        modo: 'COMPARTIDO',
        codigo_base: 'VERANO10',
        descripcion: '10% de descuento',
        descuento_tipo: 'PORCENTAJE',
        descuento_valor: new Prisma.Decimal(10),
        compra_minima: new Prisma.Decimal(20),
        categoria_id: null,
        producto_id: null,
        canales: ['CARTA'],
        requiere_cuenta: false,
        dias_validez: null,
        tope_usos: 100,
        usos_actuales: 0,
        max_por_cliente: 1,
        orden: 1,
        activo: true,
        creado_en: new Date(),
      };
      prismaMock.cupon.create.mockResolvedValueOnce(mockCupon);

      const res = await service.crearCupon({
        modo: 'COMPARTIDO',
        codigoBase: 'VERANO10',
        descuentoTipo: 'PORCENTAJE',
        descuentoValor: 10,
        compraMinima: 20,
        topeUsos: 100,
      });

      expect(res.id).toBe('5');
      expect(res.codigoBase).toBe('VERANO10');
      expect(res.topeUsos).toBe(100);
    });

    it('emite cupones al azar para comprobante y es idempotente al reimprimir (RN-CAP-135)', async () => {
      // 1. Si no hay cupones emitidos para el pedido, busca UNICO_COMPROBANTE activos y sortea N
      prismaMock.cuponEmitido.findMany.mockResolvedValueOnce([]); // no hay existentes
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({
        id: 1,
        cupones_por_comprobante: 2,
        cupon_con_descuento: false,
        promo_con_descuento: false,
        texto_pie: 'Pie',
      });
      prismaMock.cupon.findMany.mockResolvedValueOnce([
        { id: 10n, codigo_base: 'DESC15', dias_validez: 15, descuento_tipo: 'PORCENTAJE', descuento_valor: new Prisma.Decimal(15) },
        { id: 11n, codigo_base: 'DESC5', dias_validez: 10, descuento_tipo: 'MONTO', descuento_valor: new Prisma.Decimal(5) },
      ]);
      prismaMock.cuponEmitido.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 100n,
          cupon_id: data.cupon_id,
          codigo: data.codigo,
          pedido_origen_id: data.pedido_origen_id,
          vence_en: data.vence_en,
          estado: 'VIGENTE',
          canjeado_en: null,
          pedido_canje_id: null,
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date(),
          cupon: { codigo_base: 'BASE', descripcion: 'Desc', descuento_tipo: 'MONTO', descuento_valor: new Prisma.Decimal(5) },
        }),
      );

      const emitidos = await service.emitirCuponesParaPedido(50n);
      expect(emitidos.length).toBe(2);
      expect(emitidos[0].codigo).toContain('-');

      // 2. Reimprimir pedido devuelve los mismos ya emitidos (idempotencia)
      prismaMock.cuponEmitido.findMany.mockResolvedValueOnce([
        {
          id: 100n,
          cupon_id: 10n,
          codigo: emitidos[0].codigo,
          pedido_origen_id: 50n,
          vence_en: new Date(),
          estado: 'VIGENTE',
          canjeado_en: null,
          pedido_canje_id: null,
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date(),
          cupon: { codigo_base: 'DESC15', descripcion: 'Desc', descuento_tipo: 'PORCENTAJE', descuento_valor: new Prisma.Decimal(15) },
        },
      ]);

      const reimpresos = await service.emitirCuponesParaPedido(50n);
      expect(reimpresos.length).toBe(1);
      expect(reimpresos[0].codigo).toBe(emitidos[0].codigo);
    });

    it('anula un cupón emitido solo si está vigente (RQ-OFE-03-11)', async () => {
      prismaMock.cuponEmitido.findUnique.mockResolvedValueOnce({
        id: 100n,
        estado: 'VIGENTE',
        cupon: { codigo_base: 'BASE', descripcion: null, descuento_tipo: 'MONTO', descuento_valor: new Prisma.Decimal(5) },
      });
      prismaMock.cuponEmitido.update.mockResolvedValueOnce({
        id: 100n,
        cupon_id: 1n,
        codigo: 'BASE-XXXX',
        estado: 'ANULADO',
        motivo_anulacion: 'Impresión borrosa',
        anulado_en: new Date(),
        creado_en: new Date(),
        cupon: { codigo_base: 'BASE', descripcion: null, descuento_tipo: 'MONTO', descuento_valor: new Prisma.Decimal(5) },
      });

      const res = await service.anularCuponEmitido('100', { motivo: 'Impresión borrosa' });
      expect(res.estado).toBe('ANULADO');
      expect(res.motivoAnulacion).toBe('Impresión borrosa');
    });
  });

  describe('Cálculo de Descuentos y Acumulación', () => {
    it('aplica el mejor descuento automático si hay varios que califican (RQ-OFE-02-05)', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({
        id: 1,
        cupon_con_descuento: false,
        promo_con_descuento: false,
      });

      // 2 descuentos automáticos vigentes: uno de 10% en toda la carta y otro de 20% en Frappés (cat 1)
      prismaMock.oferta.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          tipo: 'DESCUENTO',
          nombre: '10% en toda la carta',
          descuento_tipo: 'PORCENTAJE',
          descuento_valor: new Prisma.Decimal(10),
          alcance_categoria_id: null,
          alcance_producto_id: null,
          compra_minima: null,
          dias: [],
          hora_desde: null,
          hora_hasta: null,
          fecha_desde: null,
          fecha_hasta: null,
          canales: ['CARTA'],
          limite_usos: null,
          usos_actuales: 0,
          activo: true,
        },
        {
          id: 2n,
          tipo: 'DESCUENTO',
          nombre: '20% en Frappés',
          descuento_tipo: 'PORCENTAJE',
          descuento_valor: new Prisma.Decimal(20),
          alcance_categoria_id: 1n,
          alcance_producto_id: null,
          compra_minima: null,
          dias: [],
          hora_desde: null,
          hora_hasta: null,
          fecha_desde: null,
          fecha_hasta: null,
          canales: ['CARTA'],
          limite_usos: null,
          usos_actuales: 0,
          activo: true,
        },
      ]);

      const res = await service.calcularDescuentosParaPedido({
        subtotal: 50.0,
        lineas: [
          { productoId: 10n, categoriaId: 1n, cantidad: 2, subtotal: 30.0, precioUnitario: 15.0 }, // Frappé
          { productoId: 20n, categoriaId: 2n, cantidad: 1, subtotal: 20.0, precioUnitario: 20.0 }, // Sándwich
        ],
        canal: 'CARTA',
      });

      // 20% en Frappés da 6.00 soles. 10% en toda la carta da 5.00 soles. Mejor descuento = 6.00 (RQ-OFE-02-05)
      expect(res.descuentoTotal).toBe(6.0);
      expect(res.ofertaId).toBe('2');
      expect(res.detalles[0].nombre).toBe('20% en Frappés');
    });

    it('excluye productos con no_suma_beneficios = true (DT-65)', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({
        id: 1,
        cupon_con_descuento: false,
      });

      prismaMock.oferta.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          tipo: 'DESCUENTO',
          nombre: '10% en todo',
          descuento_tipo: 'PORCENTAJE',
          descuento_valor: new Prisma.Decimal(10),
          alcance_categoria_id: null,
          alcance_producto_id: null,
          compra_minima: null,
          dias: [],
          hora_desde: null,
          hora_hasta: null,
          fecha_desde: null,
          fecha_hasta: null,
          canales: ['CARTA'],
          limite_usos: null,
          usos_actuales: 0,
          activo: true,
        },
      ]);

      const res = await service.calcularDescuentosParaPedido({
        subtotal: 50.0,
        lineas: [
          { productoId: 10n, cantidad: 1, subtotal: 20.0, precioUnitario: 20.0, noSumaBeneficios: false },
          { productoId: 20n, cantidad: 1, subtotal: 30.0, precioUnitario: 30.0, noSumaBeneficios: true }, // Excluido
        ],
        canal: 'CARTA',
      });

      // Solo aplica 10% sobre los 20 soles elegibles -> 2.00
      expect(res.descuentoTotal).toBe(2.0);
    });

    it('aplica promoción automática LLEVA_PAGA (2x1) descontando la unidad correspondiente', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({
        id: 1,
        cupon_con_descuento: true,
        promo_con_descuento: true,
      });
      prismaMock.producto.findMany.mockResolvedValueOnce([
        { id: 20n, categoria_id: 3n, no_suma_beneficios: false },
      ]);
      prismaMock.oferta.findMany.mockResolvedValueOnce([
        {
          id: 8n,
          tipo: 'LLEVA_PAGA',
          nombre: '2x1 ICED COFFE',
          lleva: 2,
          paga: 1,
          alcance_categoria_id: null,
          alcance_producto_id: 20n,
          descuento_tipo: null,
          descuento_valor: new Prisma.Decimal(9.0),
          compra_minima: null,
          dias: [],
          hora_desde: null,
          hora_hasta: null,
          fecha_desde: null,
          fecha_hasta: null,
          canales: ['CARTA'],
          limite_usos: null,
          usos_actuales: 0,
          activo: true,
        },
      ]);

      const res = await service.calcularDescuentosParaPedido({
        subtotal: 18.0,
        lineas: [
          { productoId: 20n, cantidad: 2, subtotal: 18.0, precioUnitario: 9.0, noSumaBeneficios: false },
        ],
        canal: 'CARTA',
      });

      // 2 unidades de 9.00 -> 1 unidad gratis = 9.00 de descuento
      expect(res.descuentoTotal).toBe(9.0);
      expect(res.detalles.some((d) => d.nombre === '2x1 ICED COFFE')).toBe(true);
    });

    it('sigue bonificando el 2x1 de un producto normal aunque exista un combo en la base', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({ id: 1, cupon_con_descuento: false });
      prismaMock.oferta.findMany
        .mockResolvedValueOnce([
          {
            id: 8n, tipo: 'LLEVA_PAGA', nombre: '2x1 ICED COFFE', lleva: 2, paga: 1,
            alcance_categoria_id: null, alcance_producto_id: 20n, descuento_tipo: null,
            descuento_valor: null, compra_minima: null, dias: [], hora_desde: null, hora_hasta: null,
            fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null, usos_actuales: 0, activo: true,
          },
        ])
        .mockResolvedValueOnce([{ alcance_producto_id: 99n }]); // combo de otro producto

      const res = await service.calcularDescuentosParaPedido({
        subtotal: 18.0,
        lineas: [{ productoId: 20n, cantidad: 2, subtotal: 18.0, precioUnitario: 9.0 }],
        canal: 'CARTA',
      });

      expect(res.descuentoTotal).toBe(9.0);
    });

    it('una linea de producto de combo no recibe el descuento de toda la carta', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({ id: 1, cupon_con_descuento: false });
      prismaMock.oferta.findMany
        .mockResolvedValueOnce([
          {
            id: 1n, tipo: 'DESCUENTO', nombre: '10% en toda la carta', descuento_tipo: 'PORCENTAJE',
            descuento_valor: new Prisma.Decimal(10), alcance_categoria_id: null, alcance_producto_id: null,
            compra_minima: null, dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null,
            fecha_hasta: null, canales: ['CARTA'], limite_usos: null, usos_actuales: 0, activo: true,
          },
        ])
        .mockResolvedValueOnce([{ alcance_producto_id: 10n }]); // producto 10 es el articulo de un combo

      const res = await service.calcularDescuentosParaPedido({
        subtotal: 50.0,
        lineas: [
          { productoId: 10n, cantidad: 1, subtotal: 20.0, precioUnitario: 20.0, noSumaBeneficios: false }, // combo
          { productoId: 20n, cantidad: 1, subtotal: 30.0, precioUnitario: 30.0, noSumaBeneficios: false },
        ],
        canal: 'CARTA',
      });

      // Solo el producto 20 es elegible: 10% de 30.00 = 3.00 (no 5.00)
      expect(res.descuentoTotal).toBe(3.0);
    });

    it('el 2x1 de toda la carta ignora la linea del combo al elegir las unidades bonificadas', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({ id: 1, cupon_con_descuento: false });
      prismaMock.oferta.findMany
        .mockResolvedValueOnce([
          {
            id: 9n, tipo: 'LLEVA_PAGA', nombre: '2x1 general', lleva: 2, paga: 1,
            alcance_categoria_id: null, alcance_producto_id: null, descuento_tipo: null,
            descuento_valor: null, compra_minima: null, dias: [], hora_desde: null, hora_hasta: null,
            fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null, usos_actuales: 0, activo: true,
          },
        ])
        .mockResolvedValueOnce([{ alcance_producto_id: 10n }]);

      const res = await service.calcularDescuentosParaPedido({
        subtotal: 73.0,
        lineas: [
          { productoId: 20n, cantidad: 2, subtotal: 18.0, precioUnitario: 9.0 },
          { productoId: 30n, cantidad: 2, subtotal: 50.0, precioUnitario: 25.0 },
          { productoId: 10n, cantidad: 1, subtotal: 5.0, precioUnitario: 5.0 }, // combo: precio barato que no debe contar
        ],
        canal: 'CARTA',
      });

      // Unidades elegibles: 9, 9, 25, 25 -> 2 grupos de 2 -> se bonifican las 2 mas baratas: 9 + 9 = 18
      expect(res.descuentoTotal).toBe(18.0);
      expect(res.detalles).toHaveLength(1);
      expect(res.detalles[0].tipo).toBe('PROMO');
    });
  });

  describe('Bot de WhatsApp: solo promociones con la casilla «Vale también por WhatsApp»', () => {
    const oferta = (canales: string[], extra: Record<string, unknown> = {}) => ({
      id: 1n,
      tipo: 'DESCUENTO',
      nombre: '10% en toda la carta',
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: new Prisma.Decimal(10),
      alcance_categoria_id: null,
      alcance_producto_id: null,
      compra_minima: null,
      dias: [],
      hora_desde: null,
      hora_hasta: null,
      fecha_desde: null,
      fecha_hasta: null,
      canales,
      limite_usos: null,
      usos_actuales: 0,
      activo: true,
      solo_primera_compra: false,
      ...extra,
    });
    const lineas = [{ productoId: 10n, categoriaId: 1n, cantidad: 2, subtotal: 30.0, precioUnitario: 15.0 }];

    beforeEach(() => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false });
    });

    it('promoción sin la casilla de WhatsApp: el bot no aplica descuento', async () => {
      prismaMock.oferta.findMany.mockResolvedValue([oferta(['CARTA'])]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 30, lineas, canal: 'BOT' });
      expect(res.descuentoTotal).toBe(0);
      expect(res.ofertaId).toBeNull();
      expect(res.detalles).toEqual([]);
    });

    it('promoción sin canales marcados no vale por WhatsApp', async () => {
      prismaMock.oferta.findMany.mockResolvedValue([oferta([])]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 30, lineas, canal: 'WHATSAPP' });
      expect(res.descuentoTotal).toBe(0);
    });

    it('promoción con la casilla de WhatsApp: el bot aplica el descuento del servidor', async () => {
      prismaMock.oferta.findMany.mockResolvedValue([oferta(['BOT'])]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 30, lineas, canal: 'BOT' });
      expect(res.descuentoTotal).toBe(3.0);
      expect(res.ofertaId).toBe('1');
      expect(res.detalles[0].nombre).toBe('10% en toda la carta');
    });

    it('el valor WHATSAPP del editor viejo también cuenta como casilla de bot', async () => {
      prismaMock.oferta.findMany.mockResolvedValue([oferta(['WHATSAPP'])]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 30, lineas, canal: 'WHATSAPP' });
      expect(res.descuentoTotal).toBe(3.0);
    });

    it('el mismo pedido por CARTA lleva el descuento de la promoción de carta', async () => {
      prismaMock.oferta.findMany.mockResolvedValue([oferta(['CARTA'])]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 30, lineas, canal: 'CARTA' });
      expect(res.descuentoTotal).toBe(3.0);
    });

    it('los cupones nunca se aplican por el bot', async () => {
      await expect(
        service.calcularDescuentosParaPedido({ subtotal: 30, lineas, canal: 'BOT', cuponCodigo: 'PROMO10' }),
      ).rejects.toMatchObject({ response: { codigo: 'CUPON_NO_APLICA_CANAL' } });
      expect(prismaMock.cupon.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('visible en la carta (diseñador)', () => {
    const fila = (visible: boolean) => ({
      id: 1n, tipo: 'DESCUENTO', nombre: 'Martes 2x1', descripcion: null, lleva: null, paga: null,
      alcance_categoria_id: null, alcance_producto_id: null, descuento_tipo: 'PORCENTAJE', descuento_valor: 10,
      compra_minima: null, dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null,
      canales: ['CARTA'], limite_usos: null, usos_actuales: 0, no_suma_beneficios: false, orden: 2, activo: true,
      creado_en: new Date(), categoria: null, producto: null, imagen_archivo_id: null, imagen_archivo: null,
      combosPrecio: [], combosParte: [], mostrar_en_saludo_bot: false, solo_primera_compra: false, visible_carta: visible,
    });

    it('ocultar en la carta cambia solo visible_carta: el descuento y activo no se tocan', async () => {
      prismaMock.oferta.findUnique.mockResolvedValue(fila(false));
      await service.actualizarOferta('1', { visibleCarta: false }, { partyId: 1n });
      expect(prismaMock.oferta.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { visible_carta: false } });
    });

    it('la carta pública trae activas y desactivadas con visible_carta; las desactivadas ocultas no salen', async () => {
      const filas = [
        { ...fila(false), id: 1n, activo: true },
        { ...fila(true), id: 2n, activo: false },
        { ...fila(false), id: 3n, activo: false },
      ];
      // Evalúa el OR del where igual que Prisma: basta para comprobar la condición que se envía
      prismaMock.oferta.findMany.mockImplementationOnce(({ where }: any) =>
        Promise.resolve(filas.filter((f) => !where.OR || where.OR.some((c: any) => Object.entries(c).every(([k, v]) => (f as any)[k] === v)))),
      );
      const lista = await service.listarOfertas(undefined, false, 'CARTA', true);
      expect(lista.map((o) => [o.id, o.activo, o.visibleCarta])).toEqual([
        ['1', true, false],
        ['2', false, true],
      ]);
    });

    it('desactivar con visibleCarta guarda visible_carta junto con activo y lo audita', async () => {
      prismaMock.oferta.update.mockResolvedValueOnce({ ...fila(true), activo: false });
      await service.cambiarEstadoOferta('1', false, { partyId: 1n }, true);
      expect(prismaMock.oferta.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { activo: false, visible_carta: true } }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'desactivar', despues: { activo: false, visibleCarta: true } }),
      );
    });

    it('activar sin visibleCarta no toca visible_carta', async () => {
      prismaMock.oferta.update.mockResolvedValueOnce(fila(false));
      await service.cambiarEstadoOferta('1', true, { partyId: 1n });
      expect(prismaMock.oferta.update).toHaveBeenCalledWith(expect.objectContaining({ data: { activo: true } }));
    });

    it('el saludo del bot no usa una promoción oculta en la carta', async () => {
      prismaMock.oferta.findMany.mockResolvedValueOnce([]);
      await service.promoParaSaludo(new Date('2026-12-12T15:00:00Z'));
      expect(prismaMock.oferta.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ visible_carta: true }) }));
    });
  });

  describe('soporte de imagen en oferta', () => {
    it('mapea correctamente imagenArchivoId e imagenUrl si la oferta tiene archivo', async () => {
      prismaMock.oferta.findUnique.mockResolvedValueOnce({
        id: 10n,
        tipo: 'COMBO',
        nombre: 'Combo Especial',
        descripcion: 'Con foto',
        lleva: null,
        paga: null,
        alcance_categoria_id: null,
        alcance_producto_id: null,
        descuento_tipo: null,
        descuento_valor: null,
        compra_minima: null,
        dias: [],
        hora_desde: null,
        hora_hasta: null,
        fecha_desde: null,
        fecha_hasta: null,
        canales: ['CARTA'],
        limite_usos: null,
        usos_actuales: 0,
        noSumaBeneficios: false,
        orden: 1,
        activo: true,
        creado_en: new Date(),
        categoria: null,
        producto: null,
        imagen_archivo_id: 42n,
        imagen_archivo: {
          id: 42n,
          ruta: 'publico/ofertas/combo.webp',
        },
        combosPrecio: [],
        combosParte: [],
      });

      const oferta = await service.obtenerOfertaPorId(10n);
      expect(oferta.imagenArchivoId).toBe('42');
      expect(oferta.imagenUrl).toBe('/archivos/publico/ofertas/combo.webp');
    });
  });

  describe('vistaPreviaDescuentos (montoCanjeable)', () => {
    it('devuelve como canjeable solo lo que no tiene descuento ni está marcado sin beneficios', async () => {
      prismaMock.reglaAcumulacion.upsert.mockResolvedValueOnce({
        id: 1,
        cupon_con_descuento: false,
        promo_con_descuento: false,
      });
      prismaMock.producto.findMany.mockResolvedValueOnce([
        { id: 10n, categoria_id: 1n, no_suma_beneficios: false },
        { id: 20n, categoria_id: 2n, no_suma_beneficios: true },
        { id: 30n, categoria_id: 2n, no_suma_beneficios: false },
      ]);
      prismaMock.oferta.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          tipo: 'DESCUENTO',
          nombre: '10% en Frappés',
          descuento_tipo: 'PORCENTAJE',
          descuento_valor: new Prisma.Decimal(10),
          alcance_categoria_id: 1n,
          alcance_producto_id: null,
          compra_minima: null,
          dias: [],
          hora_desde: null,
          hora_hasta: null,
          fecha_desde: null,
          fecha_hasta: null,
          canales: ['CARTA'],
          limite_usos: null,
          usos_actuales: 0,
          activo: true,
        },
      ]);

      const res = await service.vistaPreviaDescuentos([
        { productoId: '10', cantidad: 1, subtotal: 20.0, precioUnitario: 20.0 }, // con descuento de 10%
        { productoId: '20', cantidad: 1, subtotal: 30.0, precioUnitario: 30.0 }, // no suma puntos
        { productoId: '30', cantidad: 1, subtotal: 25.0, precioUnitario: 25.0 }, // elegible
      ]);

      expect(res.descuentoTotal).toBe(2.0);
      expect(res.montoCanjeable).toBe(25.0);
      // 5 % por defecto de lo elegible
      expect(res.puntosEstimados).toBe(1.25);
      expect(res.puntosPorcentaje).toBe(5);
    });
  });
});
