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
        findMany: jest.fn(),
      },
      comboPrecio: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      comboParte: {
        create: jest.fn(),
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
    });
  });
});
