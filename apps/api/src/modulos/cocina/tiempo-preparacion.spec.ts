import { minutosPreparacionDefecto, tiemposPreparacion } from './tiempo-preparacion';

const AHORA = new Date('2026-11-01T18:00:00Z');
const minAntes = (min: number) => new Date(AHORA.getTime() - min * 60000);

describe('minutosPreparacionDefecto', () => {
  it('acepta enteros de 1 a 120 y cae al defecto de 10 con cualquier otra cosa', () => {
    expect(minutosPreparacionDefecto(15)).toBe(15);
    expect(minutosPreparacionDefecto('12')).toBe(12);
    expect(minutosPreparacionDefecto(0)).toBe(10);
    expect(minutosPreparacionDefecto(121)).toBe(10);
    expect(minutosPreparacionDefecto(2.5)).toBe(10);
    expect(minutosPreparacionDefecto(undefined)).toBe(10);
  });
});

describe('tiemposPreparacion', () => {
  it('promedia listo menos llegada por producto y usa el defecto para los que no tienen datos', async () => {
    const prisma: any = {
      pedidoLinea: {
        findMany: jest.fn().mockResolvedValue([
          // 12 min y 8 min desde la llegada del área: promedio 10
          { listo_en: AHORA, area_id: 5n, producto_id: 101n, pedido: { creado_en: minAntes(60), comandas: [{ area_id: 5n, llego_en: minAntes(12) }] } },
          { listo_en: AHORA, area_id: 5n, producto_id: 101n, pedido: { creado_en: minAntes(60), comandas: [{ area_id: 5n, llego_en: minAntes(8) }] } },
        ]),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue({ clave: 'cocina_minutos_preparacion_defecto', valor: 7 }) },
    };

    const res = await tiemposPreparacion(prisma, ['101', '102'], AHORA);

    expect(res.porProducto.get('101')).toBe(10);
    expect(res.porProducto.has('102')).toBe(false);
    expect(res.defectoMin).toBe(7);
  });

  it('sin parámetro legible usa 10 minutos', async () => {
    const prisma: any = {
      pedidoLinea: { findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findUnique: jest.fn().mockRejectedValue(new Error('sin tabla')) },
    };
    const res = await tiemposPreparacion(prisma, ['201'], AHORA);
    expect(res.defectoMin).toBe(10);
  });

  it('guarda el promedio 10 minutos: la segunda lectura no vuelve a contar', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { listo_en: AHORA, area_id: 5n, producto_id: 301n, pedido: { creado_en: minAntes(60), comandas: [{ area_id: 5n, llego_en: minAntes(9) }] } },
    ]);
    const prisma: any = { pedidoLinea: { findMany }, parametro: { findUnique: jest.fn().mockResolvedValue(null) } };

    await tiemposPreparacion(prisma, ['301'], AHORA);
    const otra = new Date(AHORA.getTime() + 60_000);
    const res = await tiemposPreparacion(prisma, ['301'], otra);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(res.porProducto.get('301')).toBe(9);
  });
});
