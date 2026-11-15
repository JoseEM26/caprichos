jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_PERMISO } from '../../acceso/permiso.decorator';
import { ProductosAnalisisController } from './productos.controller';
import { clasificarMargen, costoDeReceta, diaSemana, elegirReceta, marcarExtremos, promedioPorDiaSemana, tendencia, type RecetaCosto } from './productos.calculo';
import { ProductosAnalisisService, armarProductos, type DatosProductos } from './productos.service';

const AHORA = new Date('2026-11-11T20:00:00Z');
const insumo = (nombre: string, costo: number | null, factor = 1, merma = 0) => ({ nombre, costo_unit: costo, factor_receta: factor, merma_pct: merma });
const receta = (lineas: Array<[ReturnType<typeof insumo>, number]>, extra: Partial<RecetaCosto> = {}): RecetaCosto => ({
  tamano_valor_id: null,
  es_produccion: false,
  rinde: null,
  lineas: lineas.map(([i, c]) => ({ cantidad: c, insumo: i })),
  ...extra,
});

describe('costo y margen', () => {
  it('costo = cantidad × costo_unit ÷ factor_receta, con merma y rinde', () => {
    // 1 kg a S/ 8 con factor 1000 g: 250 g = 2.00
    expect(costoDeReceta(receta([[insumo('Harina', 8, 1000), 250]])).costo).toBeCloseTo(2);
    // merma 20 %: 100 g netos consumen 125 g → 1.00
    expect(costoDeReceta(receta([[insumo('Queso', 8, 1000, 20), 100]])).costo).toBeCloseTo(1);
    // producción: rinde 10 porciones
    expect(costoDeReceta(receta([[insumo('Harina', 8, 1000), 1000]], { es_produccion: true, rinde: 10 })).costo).toBeCloseTo(0.8);
  });

  it('sin receta o con un insumo sin costo no inventa número y dice qué falta', () => {
    expect(costoDeReceta(null)).toEqual({ costo: null, motivos: ['Sin receta'] });
    const r = costoDeReceta(receta([[insumo('Harina', 8), 1], [insumo('Cacao', null), 1], [insumo('Sal', 0), 1]]));
    expect(r.costo).toBeNull();
    expect(r.motivos).toEqual(['Cacao sin costo', 'Sal sin costo']);
  });

  it('la receta del tamaño gana a la general; ignora recetas vacías', () => {
    const general = receta([[insumo('A', 1), 1]]);
    const grande = receta([[insumo('A', 1), 3]], { tamano_valor_id: 7n });
    expect(elegirReceta([general, grande], 7n)).toBe(grande);
    expect(elegirReceta([general, grande], 8n)).toBe(general);
    expect(elegirReceta([receta([])], null)).toBeNull();
  });

  it('clasifica: menos de 30 bajo, 30 a 70 medio, más de 70 alto', () => {
    expect([29.9, 30, 50, 70, 70.1].map(clasificarMargen)).toEqual(['BAJO', 'MEDIO', 'MEDIO', 'MEDIO', 'ALTO']);
  });
});

describe('marcas, tendencia y días', () => {
  it('marca 20 % de arriba (con ventas) y 20 % de abajo; con menos de 5 no marca', () => {
    const f = marcarExtremos([10, 8, 6, 4, 2, 1, 0, 0, 0, 0].map((unidades) => ({ unidades })));
    expect(f.map((x) => x.marca)).toEqual(['TOP', 'TOP', null, null, null, null, null, null, 'BAJO', 'BAJO']);
    expect(marcarExtremos([{ unidades: 3 }, { unidades: 0 }]).every((x) => x.marca == null)).toBe(true);
    expect(marcarExtremos([0, 0, 0, 0, 0].map((unidades) => ({ unidades }))).filter((x) => x.marca === 'TOP')).toHaveLength(0);
  });

  it('tendencia: null si antes no hubo ventas', () => {
    expect(tendencia(15, 10)).toBe(50);
    expect(tendencia(5, 10)).toBe(-50);
    expect(tendencia(5, 0)).toBeNull();
  });

  it('promedio por día de la semana solo sobre los días con ventas', () => {
    expect(diaSemana('2026-11-09')).toBe(0); // lunes
    const r = promedioPorDiaSemana([
      { fecha: '2026-11-02', pedidos: 10, c: 10000 },
      { fecha: '2026-11-09', pedidos: 20, c: 30000 },
      { fecha: '2026-11-10', pedidos: 4, c: 400 },
    ]);
    expect(r[0]).toMatchObject({ dia: 'Lunes', dias: 2, promedioPedidos: 15, promedioC: 20000 });
    expect(r[1]).toMatchObject({ dia: 'Martes', dias: 1, promedioPedidos: 4 });
    expect(r[2]).toMatchObject({ dia: 'Miércoles', dias: 0, promedioPedidos: null, promedioC: null });
  });
});

const prod = (id: bigint, nombre: string, recetas: RecetaCosto[] = [], extra: Record<string, unknown> = {}) => ({ id, nombre, precio: 10, categoria: { nombre: 'Postres' }, tamanos: [], recetas, ...extra });

function datos(extra: Partial<DatosProductos> = {}): DatosProductos {
  return {
    catalogo: [
      prod(1n, 'Torta', [receta([[insumo('Harina', 2), 1]])]), // costo 2
      prod(2n, 'Café', [receta([[insumo('Grano', 9), 1]])]), // costo 9
      prod(3n, 'Flan', []), // sin receta
      prod(4n, 'Dona', [receta([[insumo('Azúcar', null), 1]])]),
      prod(5n, 'Té', [receta([[insumo('Hoja', 1), 1]])]), // 0 ventas
    ] as never,
    lineas: [
      { producto_id: 1n, tamano: null, unidades: 4, venta: 40 },
      { producto_id: 2n, tamano: null, unidades: 2, venta: 20 },
      { producto_id: 3n, tamano: null, unidades: 1, venta: 10 },
      { producto_id: 4n, tamano: null, unidades: 1, venta: 10 },
    ],
    pedidosPorProducto: [
      { producto_id: 1n, pedidos: 3n },
      { producto_id: 2n, pedidos: 2n },
    ],
    anterior: [{ producto_id: 1n, unidades: 2 }],
    dias: [
      { fecha: '2026-11-09', pedidos: 3n, monto: 60 },
      { fecha: '2026-11-10', pedidos: 5n, monto: 20 },
    ],
    opciones: [
      { producto_id: 2n, grupo: 'Leche', opcion: 'Almendra', veces: 3n },
      { producto_id: 2n, grupo: 'Leche', opcion: 'Entera', veces: 1n },
      { producto_id: 1n, grupo: 'Leche', opcion: 'Almendra', veces: 2n },
    ],
    ...extra,
  };
}

describe('armarProductos', () => {
  it('lista TODO el catálogo (con 0 ventas), porcentaje, tendencia y marcas', () => {
    const r = armarProductos(datos(), true).productos;
    expect(r.total).toBe(5);
    expect(r.conVentas).toBe(4);
    expect(r.sinVentas).toBe(1);
    expect(r.filas[0]).toMatchObject({ nombre: 'Torta', unidades: 4, monto: 40, porcentaje: 50, pedidos: 3, tendencia: 100, marca: 'TOP' });
    const te = r.filas.find((f) => f.nombre === 'Té');
    expect(te).toMatchObject({ unidades: 0, monto: 0, pedidos: 0, porcentaje: 0, marca: 'BAJO' });
  });

  it('margen: clasifica, pondera por ventas solo con costo y explica los sin costo', () => {
    const m = armarProductos(datos(), true).margen!;
    expect(m.grupos).toEqual({ BAJO: 1, MEDIO: 0, ALTO: 2, SIN_COSTO: 2 });
    const por = (n: string) => m.filas.find((f) => f.nombre === n)!;
    expect(por('Torta')).toMatchObject({ grupo: 'ALTO', margen: 80, costo: 2, precio: 10 });
    expect(por('Café')).toMatchObject({ grupo: 'BAJO', margen: 10 });
    expect(por('Flan')).toMatchObject({ grupo: 'SIN_COSTO', margen: null, motivos: ['Sin receta'] });
    expect(por('Dona')).toMatchObject({ grupo: 'SIN_COSTO', motivos: ['Azúcar sin costo'] });
    // sin ventas: margen de catálogo (precio 10, costo 1), no entra en el ponderado
    expect(por('Té')).toMatchObject({ grupo: 'ALTO', margen: 90, base: 'catalogo', unidades: 0 });
    // ponderado: ingresos 60, costo 4×2 + 2×9 = 26 → 56.7 %
    expect(m.ponderado).toEqual({ margen: 56.7, ingresos: 60, costo: 26, productos: 2 });
  });

  it('con tamaños: cada tamaño vendido usa la receta de su tamaño', () => {
    const d = datos({
      catalogo: [
        prod(1n, 'Frappe', [receta([[insumo('Base', 1), 1]], { tamano_valor_id: 1n }), receta([[insumo('Base', 1), 3]], { tamano_valor_id: 2n })], {
          tamanos: [
            { precio: 10, tamano_valor_id: 1n, tamano_valor: { nombre: 'Chico' } },
            { precio: 20, tamano_valor_id: 2n, tamano_valor: { nombre: 'Grande' } },
          ],
        }),
      ] as never,
      lineas: [
        { producto_id: 1n, tamano: 'Chico', unidades: 2, venta: 20 },
        { producto_id: 1n, tamano: 'Grande', unidades: 1, venta: 20 },
      ],
    });
    const f = armarProductos(d, true).margen!.filas[0];
    expect(f).toMatchObject({ margen: 87.5, costo: 1.67 }); // costo 2×1 + 3 = 5 sobre 40
  });

  it('modificadores: por producto, tamaños incluidos, y ranking global', () => {
    const d = datos({ lineas: [{ producto_id: 2n, tamano: 'Grande', unidades: 6, venta: 60 }], catalogo: datos().catalogo });
    const m = armarProductos(d, true).modificadores;
    const cafe = m.porProducto.find((p) => p.nombre === 'Café')!;
    expect(cafe.opciones).toContainEqual({ grupo: 'Leche', opcion: 'Almendra', veces: 3 });
    expect(cafe.opciones).toContainEqual({ grupo: 'Tamaño', opcion: 'Grande', veces: 6 });
    expect(m.global[0]).toEqual({ grupo: 'Tamaño', opcion: 'Grande', veces: 6 });
    expect(m.global.find((o) => o.opcion === 'Almendra')!.veces).toBe(5);
  });

  it('días: promedio por día de semana y ranking de fechas por monto', () => {
    const d = armarProductos(datos(), true).dias;
    expect(d.masVentas[0]).toEqual({ fecha: '2026-11-09', pedidos: 3, monto: 60 });
    expect(d.menosVentas[0]).toEqual({ fecha: '2026-11-10', pedidos: 5, monto: 20 });
    expect(d.porSemana[1]).toMatchObject({ dia: 'Martes', promedioPedidos: 5, promedioMonto: 20 });
  });

  it('SUPERVISOR: sin montos ni margen; las fechas se ordenan por pedidos', () => {
    const r = armarProductos(datos(), false);
    expect(r.margen).toBeNull();
    expect(r.productos.monto).toBeNull();
    expect(r.productos.filas[0]).toMatchObject({ unidades: 4, monto: null });
    expect(r.dias.masVentas[0]).toEqual({ fecha: '2026-11-10', pedidos: 5, monto: null });
    expect(JSON.stringify(r)).not.toMatch(/"(monto|promedioMonto)":\d/);
  });
});

describe('ProductosAnalisisController', () => {
  it('exige analisis/ver', () => {
    expect(new Reflector().get(CLAVE_PERMISO, ProductosAnalisisController.prototype.resumen)).toEqual({ modulo: 'analisis', accion: 'ver' });
  });
});

describe('ProductosAnalisisService', () => {
  function servicio() {
    const sqls: string[] = [];
    const prisma: any = {
      producto: { findMany: jest.fn(async () => datos().catalogo) },
      $queryRaw: jest.fn(async (q: any) => {
        sqls.push(q.sql ?? String(q));
        return [];
      }),
    };
    return { s: new ProductosAnalisisService(prisma), prisma, sqls };
  }

  it('filtra como Ventas (sin anulados ni rechazados, sin cortesías ni partes de combo) y no falla sin ventas', async () => {
    const { s, sqls } = servicio();
    const r = await s.resumen({ desde: '2026-11-10', hasta: '2026-11-11', canal: 'caja', turno: 'tarde' }, true, AHORA);
    expect(r.productos.total).toBe(5);
    expect(r.productos.sinVentas).toBe(5);
    expect(r.margen!.ponderado.margen).toBeNull();
    expect(sqls).toHaveLength(5);
    expect(sqls[0]).toContain("NOT IN ('ANULADO', 'RECHAZADO')");
    expect(sqls[0]).toContain('l.es_cortesia = false');
    expect(sqls[0]).toContain('l.linea_combo_id IS NULL');
    expect(sqls[0]).toContain('p.canal =');
    expect(sqls[0]).toContain('EXTRACT(HOUR');
  });

  it('rechaza rangos inválidos como el resto de Análisis', async () => {
    await expect(servicio().s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, true, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });
});
