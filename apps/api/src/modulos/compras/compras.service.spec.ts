import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComprasService } from './compras.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { StockService } from '../stock/stock.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Prisma } from '@prisma/client';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('ComprasService', () => {
  let service: ComprasService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;
  let stockService: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMINISTRADOR',
    debeCambiar: false,
  };

  beforeEach(async () => {
    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    stockService = {
      obtenerOcrearLugarAlmacen: jest.fn().mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' }),
      obtenerOcrearLugarCocina: jest.fn().mockResolvedValue({ id: 11n, nombre: 'Cocina' }),
      ajustarStockPorCompra: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      party: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      partyIdentifier: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      partyRole: {
        create: jest.fn(),
      },
      supplierDetail: {
        create: jest.fn(),
        upsert: jest.fn(),
      },
      organization: {
        update: jest.fn(),
      },
      contactMechanism: {
        create: jest.fn(),
        update: jest.fn(),
      },
      pedidoProveedor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      compra: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      compraLinea: {
        create: jest.fn(),
      },
      insumo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      lugarStock: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' }),
        create: jest.fn(),
      },
      stock: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      movimientoStock: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComprasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
        { provide: StockService, useValue: stockService },
      ],
    }).compile();

    service = module.get<ComprasService>(ComprasService);
  });

  describe('crearProveedor', () => {
    it('debe registrar un proveedor exitosamente', async () => {
      prisma.partyIdentifier.findUnique.mockResolvedValue(null);
      prisma.party.create.mockResolvedValue({ id: 100n });
      prisma.partyRole.create.mockResolvedValue({ id: 200n });
      prisma.supplierDetail.create.mockResolvedValue({ id: 300n });

      const dto = {
        razonSocial: 'Distribuidora Lácteos SAC',
        nombreComercial: 'Lácteos del Sur',
        ruc: '20123456789',
        telefono: '987654321',
        diasCredito: 15,
        cuentaPago: '191-12345678-0-99 BCP',
      };

      const result = await service.crearProveedor(dto, mockUsuario);

      expect(result).toHaveProperty('id', '100');
      expect(result.razonSocial).toBe(dto.razonSocial);
      expect(prisma.party.create).toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CREAR_PROVEEDOR',
          entidad: 'party',
        }),
      );
    });

    it('debe lanzar ConflictException si el RUC ya existe', async () => {
      prisma.partyIdentifier.findUnique.mockResolvedValue({ id: 5n, party_id: 20n });

      await expect(
        service.crearProveedor({ razonSocial: 'Test SAC', ruc: '20123456789' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('crearPedidoProveedor', () => {
    it('debe registrar un pedido a proveedor', async () => {
      prisma.pedidoProveedor.create.mockResolvedValue({
        id: 50n,
        proveedor_party_id: 100n,
        estado: 'POR_RECIBIR',
        enviado_en: new Date(),
        lineas: [
          {
            insumo_id: 1n,
            cantidad_compra: new Prisma.Decimal('50'),
            recibido: new Prisma.Decimal('0'),
            insumo: { id: 1n, nombre: 'Harina Especial', unidad: 'KG' },
          },
        ],
        proveedor: {
          organizacion: { razon_social: 'Molitalia SA' },
        },
      });

      const res = await service.crearPedidoProveedor(
        {
          proveedorPartyId: 100,
          lineas: [{ insumoId: 1, cantidadCompra: 50 }],
        },
        mockUsuario,
      );

      expect(res).toHaveProperty('id', '50');
      expect(res.estado).toBe('POR_RECIBIR');
      expect(prisma.pedidoProveedor.create).toHaveBeenCalled();
    });
  });

  describe('registrarCompra', () => {
    it('debe registrar compra, aumentar stock en almacén central y actualizar costo de insumo', async () => {
      prisma.party.findUnique.mockResolvedValue({
        id: 100n,
        organizacion: { razon_social: 'Distribuidora San Jorge' },
        roles: [{ rol: 'PROVEEDOR' }],
      });
      prisma.insumo.findUnique.mockResolvedValue({
        id: 2n,
        nombre: 'Queso Mozzarella',
        unidad_almacen: 'KG',
        unidad_compra: 'KG',
        factor_conversion: new Prisma.Decimal('1'),
        costo_unitario: new Prisma.Decimal('18.00'),
      });
      prisma.lugarStock.findFirst.mockResolvedValue({ id: 10n, nombre: 'Almacén Principal' });
      prisma.stock.findFirst.mockResolvedValue({
        id: 1n,
        insumo_id: 2n,
        lugar_id: 10n,
        cantidad: new Prisma.Decimal('10.00'),
      });
      prisma.compra.create.mockResolvedValue({
        id: 10n,
        comprobante_numero: 'F001-000123',
        proveedor_party_id: 100n,
        estado: 'RECIBIDO',
        subtotal: new Prisma.Decimal('100.00'),
        igv: new Prisma.Decimal('18.00'),
        monto_total: new Prisma.Decimal('118.00'),
        estado_pago: 'PAGADA',
        fecha_emision: new Date(),
        creado_en: new Date(),
        lineas: [
          {
            insumo_id: 2n,
            cantidad_compra: new Prisma.Decimal('5'),
            costo_unit: new Prisma.Decimal('20.00'),
            insumo: { id: 2n, nombre: 'Queso Mozzarella', unidad_almacen: 'KG' },
          },
        ],
        proveedor: {
          organizacion: { razon_social: 'Distribuidora San Jorge' },
        },
      });

      const res = await service.registrarCompra(
        {
          proveedorPartyId: 100,
          comprobanteTipo: 'FACTURA',
          comprobanteNumero: 'F001-000123',
          condicion: 'CONTADO',
          lineas: [{ insumoId: 2, cantidadCompra: 5, costoUnit: 20 }],
        },
        mockUsuario,
      );

      expect(res).toHaveProperty('id', '10');
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ENTRADA',
            compra_id: 10n,
          }),
        }),
      );
      expect(prisma.insumo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2n },
          data: expect.objectContaining({
            costo_unit: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('anularCompra', () => {
    it('debe revertir movimientos de stock y marcar compra como ANULADA', async () => {
      prisma.compra.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'RECIBIDO',
        monto_total: new Prisma.Decimal('118.00'),
        lineas: [
          {
            insumo_id: 2n,
            cantidad_compra: new Prisma.Decimal('5'),
            cantidad_almacen: new Prisma.Decimal('5'),
            insumo: { id: 2n, nombre: 'Queso Mozzarella', factor_conversion: new Prisma.Decimal('1') },
          },
        ],
      });
      prisma.compra.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.stock.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.movimientoStock.findMany = jest.fn().mockResolvedValue([
        { insumo_id: 2n, lugar_id: 10n, tipo: 'ENTRADA', cantidad: new Prisma.Decimal('5') },
      ]);

      const res = await service.anularCompra(10, { motivo: 'Error en factura del proveedor' }, mockUsuario);

      expect(res.ok).toBe(true);
      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ANULACION',
            nota: expect.stringContaining('Anulación compra'),
          }),
        }),
      );
      expect(prisma.compra.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n, anulada_en: null },
          data: expect.objectContaining({
            motivo_anulacion: 'Error en factura del proveedor',
          }),
        }),
      );
    });

    it('quita del stock EXACTAMENTE lo que entró (compra en unidad de almacén con factor 25) y no dos veces', async () => {
      prisma.compra.findUnique.mockResolvedValue({
        id: 11n,
        lineas: [{ insumo_id: 2n, cantidad_compra: new Prisma.Decimal('50'), insumo: { id: 2n, factor_compra: new Prisma.Decimal('25') } }],
      });
      prisma.compra.updateMany = jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
      prisma.stock.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.movimientoStock.findMany = jest.fn().mockResolvedValue([
        { insumo_id: 2n, lugar_id: 10n, tipo: 'ENTRADA', cantidad: new Prisma.Decimal('50') }, // entró 50 kg, no 1250
      ]);
      await service.anularCompra(11, { motivo: 'Error en la compra' }, mockUsuario);
      const dec = prisma.stock.updateMany.mock.calls[0][0].data.cantidad.decrement;
      expect(Number(dec)).toBe(50);
      await expect(service.anularCompra(11, { motivo: 'Error en la compra' }, mockUsuario)).rejects.toMatchObject({
        response: { codigo: 'COMPRA_YA_ANULADA' },
      });
      expect(prisma.stock.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('obtenerResumen', () => {
    it('debe excluir compras anuladas de porPagar y compradoMes, y excluir pedidos anulados de pedidosPorRecibir', async () => {
      // Mock pedidos: 1 POR_RECIBIR, 1 ANULADO (count solo cuenta POR_RECIBIR y PARCIAL)
      prisma.pedidoProveedor.count.mockImplementation(async ({ where }: any) => {
        const allowed = where?.estado?.in || [];
        // Simular que en la BD hay 1 POR_RECIBIR, 1 PARCIAL y 2 ANULADOS
        if (allowed.includes('POR_RECIBIR') && allowed.includes('PARCIAL')) {
          return 2; // solo POR_RECIBIR y PARCIAL
        }
        return 0;
      });

      // Mock compras credito pendientes (where condicion: CREDITO, pagada_en: null, anulada_en: null)
      // Debe retornar solo las no anuladas
      prisma.compra.findMany.mockImplementation(async ({ where }: any) => {
        if (where?.condicion === 'CREDITO' && where?.pagada_en === null && where?.anulada_en === null) {
          // Conocido: 2 compras a crédito no anuladas de 150 y 250 (total 400).
          // Las compras anuladas quedan excluidas por where.anulada_en: null
          return [{ total: new Prisma.Decimal('150.00') }, { total: new Prisma.Decimal('250.00') }];
        }
        if (where?.anulada_en === null && where?.fecha_compra) {
          // Compras del mes no anuladas: 150 + 250 + 100 = 500
          return [
            { total: new Prisma.Decimal('150.00') },
            { total: new Prisma.Decimal('250.00') },
            { total: new Prisma.Decimal('100.00') },
          ];
        }
        return [];
      });

      // Mock insumos bajo mínimo: 1 bajo mínimo
      prisma.insumo.findMany.mockResolvedValue([
        {
          id: 1n,
          minimo: new Prisma.Decimal('10'),
          stocks: [{ cantidad: new Prisma.Decimal('4') }],
        },
        {
          id: 2n,
          minimo: new Prisma.Decimal('10'),
          stocks: [{ cantidad: new Prisma.Decimal('25') }],
        },
      ]);

      const resumen = await service.obtenerResumen();

      // Verificaciones con datos conocidos:
      expect(resumen.pedidosPorRecibir).toBe(2);
      expect(resumen.porPagar).toBe(400); // Excluyó compras anuladas
      expect(resumen.compradoMes).toBe(500); // Excluyó compras anuladas
      expect(resumen.listaPedir).toBe(1);

      // Verificar que los queries a Prisma filtraron explícitamente anulada_en: null
      expect(prisma.compra.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            condicion: 'CREDITO',
            pagada_en: null,
            anulada_en: null,
          }),
        }),
      );
      expect(prisma.compra.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            anulada_en: null,
          }),
        }),
      );
    });
  });

  describe('listarCompras', () => {
    it('debe marcar compras anuladas con estado "Anulada" y no incluirlas como pedidos por recibir', async () => {
      prisma.compra.findMany.mockResolvedValue([
        {
          id: 1n,
          proveedor_party_id: 10n,
          comprobante_tipo: 'FACTURA',
          comprobante_numero: 'F001-00045',
          condicion: 'CREDITO',
          total: new Prisma.Decimal('180.00'),
          fecha_compra: new Date(),
          pagada_en: null,
          anulada_en: new Date(), // Anulada
          motivo_anulacion: 'Proveedor duplicó pedido',
          proveedor: { organizacion: { razon_social: 'Distribuidora Lácteos' } },
          lineas: [],
        },
        {
          id: 2n,
          proveedor_party_id: 11n,
          comprobante_tipo: 'FACTURA',
          comprobante_numero: 'F001-00046',
          condicion: 'CONTADO',
          total: new Prisma.Decimal('120.00'),
          fecha_compra: new Date(),
          pagada_en: new Date(),
          anulada_en: null,
          proveedor: { organizacion: { razon_social: 'Molitalia' } },
          lineas: [],
        },
      ]);

      prisma.pedidoProveedor.findMany.mockResolvedValue([
        {
          id: 5n,
          proveedor_party_id: 10n,
          estado: 'POR_RECIBIR',
          enviado_en: new Date(),
          proveedor: { organizacion: { razon_social: 'Panificadora Central' } },
          lineas: [],
        },
      ]);

      const lista = await service.listarCompras({});

      // La primera compra debe ser identificada como 'Anulada'
      const compraAnulada = lista.find((x) => x.id === 'OC-1');
      expect(compraAnulada).toBeDefined();
      expect(compraAnulada?.estado).toBe('Anulada');
      expect(compraAnulada?.anuladaEn).toBeDefined();

      // La segunda compra debe ser 'Pagada'
      const compraPagada = lista.find((x) => x.id === 'OC-2');
      expect(compraPagada).toBeDefined();
      expect(compraPagada?.estado).toBe('Pagada');

      // El pedido por recibir es 'Por recibir'
      const pedido = lista.find((x) => x.id === 'PED-5');
      expect(pedido).toBeDefined();
      expect(pedido?.estado).toBe('Por recibir');
      expect(pedido?.esPedidoPorRecibir).toBe(true);
    });
  });

  describe('registrarCompraRapida', () => {
    it('registra una compra rápida suelta, actualiza costo unitario, incrementa stock en Almacén y audita', async () => {
      prisma.insumo.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Huevos de granja',
        unidad_almacen: 'UNIDAD',
        unidad_compra: 'BANDEJA',
        factor_compra: new Prisma.Decimal(30),
      });

      prisma.party.findFirst.mockResolvedValue({
        id: 999n,
        organizacion: { razon_social: 'Compras varias (sin proveedor)' },
      });

      prisma.lugarStock.findFirst.mockResolvedValue({
        id: 10n,
        nombre: 'Almacén central',
      });

      prisma.stock.findFirst.mockResolvedValue({
        id: 50n,
        insumo_id: 1n,
        lugar_id: 10n,
        cantidad: new Prisma.Decimal('10.00'),
      });

      prisma.compra.create.mockResolvedValue({
        id: 77n,
        proveedor_party_id: 999n,
        comprobante_tipo: 'TICKET',
        comprobante_numero: 'CR-001',
        total: new Prisma.Decimal('45.00'),
      });

      prisma.compraLinea.create.mockResolvedValue({ id: 101n });
      prisma.insumo.update.mockResolvedValue({ id: 1n });
      prisma.stock.update.mockResolvedValue({ id: 50n, cantidad: new Prisma.Decimal('13.00') });
      prisma.movimientoStock.create.mockResolvedValue({ id: 801n });

      const res = await service.registrarCompraRapida(
        {
          insumoId: '1',
          cantidad: 3,
          costoTotal: 45,
          medioPago: 'EFECTIVO',
          nota: 'Comprado en bodega de la esquina',
        },
        mockUsuario,
        '127.0.0.1',
      );

      expect(res.ok).toBe(true);
      expect(res.id).toBe('77');
      expect(res.costoTotal).toBe(45);
      expect(res.nuevoStock).toBe(13);

      expect(prisma.compra.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proveedor_party_id: 999n,
            total: new Prisma.Decimal(45),
            condicion: 'CONTADO',
          }),
        }),
      );

      expect(prisma.insumo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1n },
          data: { costo_unit: new Prisma.Decimal(15) },
        }),
      );

      expect(prisma.movimientoStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ENTRADA',
            insumo_id: 1n,
            lugar_id: 10n,
            cantidad: new Prisma.Decimal(3),
          }),
        }),
      );

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'compras',
          accion: 'COMPRA_RAPIDA',
        }),
      );

      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('stock:cambio', expect.anything());
    });
  });
});
