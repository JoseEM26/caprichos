import { BadRequestException } from '@nestjs/common';
import { AlmacenAnalisisService, UMBRAL_POCAS_UNIDADES } from './almacen.service';

const AHORA = new Date('2026-11-11T20:00:00Z');

function servicio(opts: { activo?: boolean; mermas?: any[] } = {}) {
  const prisma: any = {
    parametro: { findUnique: jest.fn(async () => ({ valor: opts.activo === false ? 'no' : 'si' })) },
    insumo: {
      findMany: jest.fn(async (a: any) =>
        a.where.id
          ? [{ id: 1n, nombre: 'Leche', unidad_almacen: 'L', costo_unit: 4 }]
          : [
              { id: 1n, nombre: 'Leche', unidad_almacen: 'L', minimo: 10 },
              { id: 2n, nombre: 'Azúcar', unidad_almacen: 'kg', minimo: 2 },
              { id: 3n, nombre: 'Canela', unidad_almacen: 'kg', minimo: 1 },
              { id: 4n, nombre: 'Vainilla', unidad_almacen: 'L', minimo: 1 },
            ],
      ),
    },
    stock: {
      groupBy: jest.fn(async (a: any) => (a.by[0] === 'insumo_id' ? [{ insumo_id: 1n, _sum: { cantidad: 20 } }, { insumo_id: 2n, _sum: { cantidad: 30 } }, { insumo_id: 3n, _sum: { cantidad: 0 } }, { insumo_id: 4n, _sum: { cantidad: 5 } }] : [{ producto_id: 10n, _sum: { cantidad: 3 } }, { producto_id: 11n, _sum: { cantidad: 40 } }])),
    },
    movimientoStock: {
      groupBy: jest.fn(async (a: any) =>
        a.by.includes('insumo_id')
          ? [
              { insumo_id: 1n, tipo: 'CONSUMO_RECETA', _sum: { cantidad: -40 } }, // 4/día en 10 días → dura 5
              { insumo_id: 2n, tipo: 'VENTA', _sum: { cantidad: 10 } },
              { insumo_id: 2n, tipo: 'PRODUCCION_CONSUMO', _sum: { cantidad: 5 } }, // devolución neta: no consume
              { insumo_id: 3n, tipo: 'CONSUMO_RECETA', _sum: { cantidad: -10 } },
            ]
          : [{ producto_id: 10n, _sum: { cantidad: 20 } }],
      ),
      findMany: jest.fn(async () => opts.mermas ?? []),
    },
    producto: {
      findMany: jest.fn(async (a: any) =>
        a.where.controla_stock
          ? [
              { id: 10n, nombre: 'Dona', agotado_hasta: null, sabores: [] },
              { id: 11n, nombre: 'Galleta', agotado_hasta: null, sabores: [{ id: 100n }, { id: 101n }] },
            ]
          : [{ id: 10n, nombre: 'Dona' }],
      ),
    },
    stockSabor: { findMany: jest.fn(async () => [{ sabor_id: 100n, cantidad: 2 }, { sabor_id: 101n, cantidad: 1 }]) },
  };
  return { s: new AlmacenAnalisisService(prisma), prisma };
}

const RANGO = { desde: '2026-11-02', hasta: '2026-11-11' }; // 10 días

describe('Análisis › Almacén', () => {
  it('cuánto dura cada insumo y cuándo se acaba, lo más urgente primero', async () => {
    const { s } = servicio();
    const r = await s.resumen(RANGO, AHORA);
    expect(r.almacenActivo).toBe(true);
    const ins = r.insumos!.items;
    expect(ins.map((i) => i.nombre)).toEqual(['Canela', 'Leche', 'Azúcar', 'Vainilla']); // agotado, 5 d, 30 d, sin consumo
    expect(ins[0]).toMatchObject({ estado: 'AGOTADO', diasRestantes: 0, seAcabaEl: null });
    expect(ins[1]).toMatchObject({ consumoDiario: 4, diasRestantes: 5, seAcabaEl: '2026-11-16', estado: 'PRONTO' });
    expect(ins[2]).toMatchObject({ consumoRango: 10, diasRestantes: 30, estado: 'OK' }); // VENTA en valor absoluto; la devolución neta no suma
    expect(ins[3]).toMatchObject({ estado: 'SIN_CONSUMO', diasRestantes: null, seAcabaEl: null });
  });

  it('Control de almacén apagado: no calcula insumos (avisa) pero sí los productos terminados', async () => {
    const { s, prisma } = servicio({ activo: false });
    const r = await s.resumen(RANGO, AHORA);
    expect(r.almacenActivo).toBe(false);
    expect(r.insumos).toBeNull();
    expect(prisma.stock.groupBy).not.toHaveBeenCalledWith(expect.objectContaining({ by: ['insumo_id'] }));
    expect(r.terminados.items.length).toBeGreaterThan(0);
  });

  it('mermas: cantidad, costo (solo con costo guardado), motivos más repetidos', async () => {
    const mermas = [
      { insumo_id: 1n, producto_id: null, cantidad: 2, nota: 'Se venció' },
      { insumo_id: 1n, producto_id: null, cantidad: -1, nota: 'se venció ' },
      { insumo_id: 1n, producto_id: null, cantidad: 1, nota: null },
      { insumo_id: null, producto_id: 10n, cantidad: 3, nota: 'Se cayó' },
    ];
    const { s } = servicio({ mermas });
    const r = await s.resumen(RANGO, AHORA);
    const leche = r.mermas.items.find((m) => m.nombre === 'Leche')!;
    expect(leche).toMatchObject({ tipo: 'INSUMO', veces: 3, cantidad: 4, costo: 16 });
    expect(leche.motivos[0]).toEqual({ motivo: 'se venció', veces: 2 });
    const dona = r.mermas.items.find((m) => m.nombre === 'Dona')!;
    expect(dona).toMatchObject({ tipo: 'PRODUCTO', cantidad: 3, costo: null });
    expect(r.mermas.costoTotal).toBe(16);
  });

  it('sin mermas: lista vacía y costo total null', async () => {
    const { s } = servicio();
    const r = await s.resumen(RANGO, AHORA);
    expect(r.mermas).toMatchObject({ registros: 0, items: [], costoTotal: null });
  });

  it('terminados con pocas unidades (suma por sabor) primero y marcados', async () => {
    const { s } = servicio();
    const r = await s.resumen(RANGO, AHORA);
    const [b, a] = r.terminados.items; // empate en 3 unidades: por nombre
    expect(a).toMatchObject({ nombre: 'Galleta', unidades: 3, pocas: true }); // 2 + 1 de sus sabores; 3 ≤ umbral
    expect(b).toMatchObject({ nombre: 'Dona', unidades: 3 });
    expect(b.ventaDiaria).toBe(2);
    expect(b.diasRestantes).toBe(1.5);
    expect(UMBRAL_POCAS_UNIDADES).toBe(5);
  });

  it('rango inválido → 400', async () => {
    const { s } = servicio();
    await expect(s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });
});
