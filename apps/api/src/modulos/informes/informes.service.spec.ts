import { Test, TestingModule } from '@nestjs/testing';
import { InformesService } from './informes.service';
import { PrismaService } from '../../comun/prisma/prisma.service';

describe('InformesService', () => {
  let service: InformesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      pedido: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101n,
            total: 35.5,
            estado: 'ENTREGADO',
            canal: 'LOCAL',
            modalidad: 'LOCAL',
            confirmado_en: new Date('2026-10-15T14:00:00Z'),
            entregado_en: new Date('2026-10-15T14:15:00Z'),
            creado_en: new Date('2026-10-15T14:00:00Z'),
            entrega_lat: -12.015,
            entrega_lng: -76.965,
            zona_id: 1n,
            zona: { codigo: 'Z2' },
            lineas: [
              {
                cantidad: 2,
                subtotal: 35.5,
                nombre: 'Frappe Oreo',
                producto: { categoria: { nombre: 'Frappes' } },
              },
            ],
          },
          {
            id: 102n,
            total: 28.0,
            estado: 'ENTREGADO',
            canal: 'CARTA',
            modalidad: 'DELIVERY',
            confirmado_en: new Date('2026-10-15T15:00:00Z'),
            despachado_en: new Date('2026-10-15T15:18:00Z'),
            creado_en: new Date('2026-10-15T15:00:00Z'),
            entrega_lat: -12.05,
            entrega_lng: -76.92,
            zona_id: null,
            zona: null,
            lineas: [
              {
                cantidad: 1,
                subtotal: 28.0,
                nombre: 'Waffle Nutella',
                producto: { categoria: { nombre: 'Waffles' } },
              },
            ],
          },
        ]),
        count: jest.fn().mockResolvedValue(2),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 63.5 } }),
        groupBy: jest.fn().mockResolvedValue([
          { estado: 'ENTREGADO', _count: { id: 2 }, _sum: { total: 63.5 } },
        ]),
      },
      pedidoLinea: {
        groupBy: jest.fn().mockResolvedValue([{ producto_id: 1n }, { producto_id: 2n }]),
        findMany: jest.fn().mockResolvedValue([
          {
            nombre: 'Combo Dúo',
            cantidad: 2,
            subtotal: 30,
            producto: { nombre: 'Frappe Oreo', categoria: { nombre: 'Frappes' } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      categoria: {
        count: jest.fn().mockResolvedValue(7),
      },
      cierreCaja: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cobroPago: {
        findMany: jest.fn().mockResolvedValue([
          { medio: 'EFECTIVO', monto: 35.5, cobro: { en: new Date() } },
          { medio: 'YAPE', monto: 28.0, cobro: { en: new Date() } },
          { medio: 'PLIN', monto: 15.0, cobro: { en: new Date() } },
          { medio: 'TARJETA', monto: 40.0, cobro: { en: new Date() } },
          { medio: 'TRANSFERENCIA', monto: 20.0, cobro: { en: new Date() } },
        ]),
      },
      stock: {
        count: jest.fn().mockResolvedValue(4),
        findMany: jest.fn().mockResolvedValue([]),
      },
      movimientoStock: {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([]),
      },
      produccion: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      compra: {
        count: jest.fn().mockResolvedValue(8),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customerAccount: {
        count: jest.fn().mockResolvedValue(12),
        findMany: jest.fn().mockResolvedValue([]),
      },
      person: {
        count: jest.fn().mockResolvedValue(6),
        findMany: jest.fn().mockResolvedValue([]),
      },
      consumoPersonal: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.clave === 'stock_control_activo'
            ? { valor: 'si' }
            : { valor: { lat: -12.02, lng: -76.96, nombre: 'Sede X' } },
        ),
      },
      zonaReparto: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([
          { codigo: 'Z2', activa: true, poligono: [[-12.01, -76.97], [-12.01, -76.96], [-12.02, -76.96]] },
          { codigo: 'Z3', activa: true },
          { codigo: 'Z4', activa: true },
          { codigo: 'Z5', activa: true },
          { codigo: 'Z7', activa: true },
        ]),
      },
      receta: {
        count: jest.fn().mockResolvedValue(12),
      },
      producto: {
        count: jest.fn().mockResolvedValue(58),
      },
      reclamo: {
        count: jest.fn().mockResolvedValue(1),
      },
      elementoPlano: {
        count: jest.fn().mockResolvedValue(10),
      },
      rankingMes: {
        findMany: jest.fn().mockResolvedValue([
          { anio_mes: '2026-09', puesto: 1, producto: { nombre: 'Frappe Oreo' } },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InformesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InformesService>(InformesService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('obtenerResumen', () => {
    it('calcula ventas, pedidos, ticket promedio y tiempo promedio correctamente', async () => {
      const resumen = await service.obtenerResumen({});
      expect(resumen.kpisS).toHaveLength(4);
      expect(resumen.kpisS[0].n).toBe('VENTAS');
      expect(resumen.kpisS[0].v).toContain('63.50');
      expect(resumen.kpisS[1].n).toBe('PEDIDOS');
      expect(resumen.kpisS[1].v).toBe('2');
      expect(resumen.kpisS[2].n).toBe('TICKET PROMEDIO');
      expect(resumen.kpisS[2].v).toContain('31.75');
      expect(resumen.kpisS[3].n).toBe('TIEMPO DE ENTREGA');
      expect(resumen.pending).toHaveLength(4);
      expect(resumen.hoursB.length).toBeGreaterThan(0);
      expect(resumen.legend.length).toBeGreaterThan(0);
      expect(resumen.tops2.length).toBeGreaterThan(0);
      expect(resumen.cats2.length).toBeGreaterThan(0);
    });

    it('el filtro de fechas es el día de Lima (venta de 20:00 Lima entra en su día) y trae Por cobrar y Rechazados', async () => {
      await service.obtenerResumen({ desde: '2026-10-05', hasta: '2026-10-05', pago: 'yape', modalidad: 'mesa' });
      const where = prisma.pedido.findMany.mock.calls[0][0].where;
      expect(where.creado_en.gte.toISOString()).toBe('2026-10-05T05:00:00.000Z');
      expect(where.creado_en.lte.toISOString()).toBe('2026-10-06T04:59:59.999Z');
      expect(where.pago_metodo).toBe('YAPE');
      expect(where.modalidad).toBe('MESA');
      const r = await service.obtenerResumen({});
      expect(typeof r.porCobrar).toBe('string');
      expect(typeof r.rechazados).toBe('number');
    });

    it('devuelve estado vacío y "Sin datos del período anterior" cuando no hay pedidos', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // sin pedidos actuales ni anteriores
      const resumen = await service.obtenerResumen({ desde: '2026-01-01', hasta: '2026-01-31' });
      expect(resumen.kpisS[0].v).toBe('s/ 0.00');
      expect(resumen.kpisS[0].dTxt).toBe('Sin datos del período anterior');
      expect(resumen.kpisS[1].v).toBe('0');
      expect(resumen.kpisS[2].v).toBe('s/ 0.00');
      expect(resumen.kpisS[3].v).toBe('- min');
      expect(resumen.tops2).toEqual([]);
      expect(resumen.cats2).toEqual([]);
      expect(resumen.peak).toBe('Sin ventas en el período');
    });

    it('calcula variación porcentual cuando existe un período anterior con ventas', async () => {
      // Pedidos actuales: 2 pedidos con total 63.5
      // Pedidos anteriores simulados: 1 pedido con total 50.0
      prisma.pedido.findMany
        .mockResolvedValueOnce([
          {
            id: 101n,
            total: 63.5,
            estado: 'ENTREGADO',
            canal: 'LOCAL',
            modalidad: 'LOCAL',
            confirmado_en: new Date('2026-10-15T14:00:00Z'),
            entregado_en: new Date('2026-10-15T14:15:00Z'),
            creado_en: new Date('2026-10-15T14:00:00Z'),
            lineas: [],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 99n,
            total: 50.0,
            estado: 'ENTREGADO',
            creado_en: new Date('2026-09-15T14:00:00Z'),
          },
        ]);

      const resumen = await service.obtenerResumen({ desde: '2026-10-01', hasta: '2026-10-15' });
      // (63.5 - 50.0) / 50.0 = +27.0%
      expect(resumen.kpisS[0].dTxt).toContain('+27.0%');
      expect(resumen.kpisS[0].dCol).toBe('var(--cp-ok)');
    });
  });

  describe('obtenerCatalogo', () => {
    it('devuelve los 23 reportes definidos en el catálogo', async () => {
      const catalogo = await service.obtenerCatalogo({});
      expect(catalogo).toHaveLength(23);
      expect(catalogo.map((c) => c.id)).toEqual(
        expect.arrayContaining([
          'resumen',
          'dia',
          'producto',
          'categoria',
          'canal',
          'modalidad',
          'pago',
          'rechazados',
          'cierres',
          'medios',
          'arqueo',
          'cobrar',
          'stockbajo',
          'kardex',
          'mermas',
          'produccion',
          'proveedor',
          'comprasestado',
          'topclientes',
          'cumple',
          'creditos',
          'repartidor',
          'zonas',
        ]),
      );
    });
  });

  describe('obtenerDetalle', () => {
    it('genera el detalle para el reporte de resumen con kpis y filas', async () => {
      const rep = await service.obtenerDetalle('resumen', {});
      expect(rep.id).toBe('resumen');
      expect(rep.kpis.length).toBeGreaterThan(0);
      expect(rep.cols).toEqual(['Estado', 'Pedidos', 'Monto']);
      expect(rep.rows.length).toBeGreaterThan(0);
    });

    it('genera el detalle para stock bajo marcándolo sinFecha', async () => {
      const rep = await service.obtenerDetalle('stockbajo', {});
      expect(rep.sinFecha).toBe(true);
      expect(rep.cols).toContain('Insumo');
    });

    it('genera el detalle para pagos con columnas y filas comparando caja', async () => {
      const rep = await service.obtenerDetalle('pago', {});
      expect(rep.cols).toContain('Medio de pago');
      expect(rep.rows.length).toBe(5);
    });
  });

  describe('obtenerIndicadores', () => {
    it('devuelve metas del negocio, más vendidos por categoría y promociones', async () => {
      const ind = await service.obtenerIndicadores();
      expect(ind.metas).toHaveLength(6);
      expect(ind.topActual.length).toBeGreaterThan(0);
      expect(ind.topHistorial.length).toBeGreaterThan(0);
      expect(Array.isArray(ind.promocionesVendidas)).toBe(true);
      expect(Array.isArray(ind.productosDescontados)).toBe(true);
    });
  });

  describe('obtenerMapaEntregas', () => {
    it('devuelve puntos con coordenadas, zonas, radios y conteos fuera de cobertura', async () => {
      const mapa = await service.obtenerMapaEntregas({});
      expect(mapa.puntos.length).toBeGreaterThan(0);
      expect(mapa.zonas.length).toBe(5);
      expect(mapa.radios.length).toBe(4);
      expect(mapa.radios[0].etiqueta).toBe('500 m');
      expect(mapa.sede.nombre).toBe('Sede X');
      expect(mapa.zonas[0].poligono.length).toBe(3);
      expect(mapa.kpis).toHaveLength(4);
      expect(mapa.fueraCoberturaConteo).toBeGreaterThan(0);
    });
  });
});
