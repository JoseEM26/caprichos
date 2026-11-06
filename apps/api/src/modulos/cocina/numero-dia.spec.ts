import { ConflictException } from '@nestjs/common';
import { asignarNumeroDia } from './numero-dia';

/**
 * Fake de Prisma: `contador` simula la tabla contador_diario (INSERT ... ON CONFLICT ... RETURNING)
 * y `pedidos` la tabla pedido. Cada transacción se serializa con una cola, como lo hace la fila
 * bloqueada del contador en Postgres.
 */
function crearFake() {
  const contador = new Map<string, number>();
  const pedidos = new Map<string, { numero_dia: number | null; fecha_dia: Date | null }>();
  let cola: Promise<unknown> = Promise.resolve();

  const tx: any = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, fecha: string) => {
      expect(strings.join('?')).toContain('contador_diario');
      const ultimo = (contador.get(fecha) ?? 0) + 1;
      contador.set(fecha, ultimo);
      return [{ ultimo }];
    }),
    pedido: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const p = pedidos.get(String(where.id));
        if (!p || p.numero_dia !== null) return { count: 0 };
        Object.assign(p, data);
        return { count: 1 };
      }),
    },
  };

  /** Ejecuta una transacción en serie: la siguiente espera a que termine la anterior. */
  const transaccion = <T>(fn: (t: any) => Promise<T>): Promise<T> => {
    const r = cola.then(() => fn(tx));
    cola = r.catch(() => undefined);
    return r;
  };

  const crearPedido = (id: string) => pedidos.set(id, { numero_dia: null, fecha_dia: null });
  return { transaccion, crearPedido, pedidos, contador };
}

// 2026-11-06 12:00 en Lima (UTC-5) = 17:00Z
const MEDIODIA = new Date('2026-11-06T17:00:00Z');

describe('asignarNumeroDia', () => {
  it('numera 1, 2, 3 dentro del mismo día Lima y guarda la fecha', async () => {
    const f = crearFake();
    for (const id of ['1', '2', '3']) f.crearPedido(id);
    const nums: number[] = [];
    for (const id of ['1', '2', '3']) {
      nums.push(await f.transaccion((tx) => asignarNumeroDia(tx, BigInt(id), MEDIODIA)));
    }
    expect(nums).toEqual([1, 2, 3]);
    expect(f.pedidos.get('2')).toEqual({
      numero_dia: 2,
      fecha_dia: new Date('2026-11-06T00:00:00.000Z'),
    });
  });

  it('reinicia en 1 al cruzar la medianoche de Lima (23:59 sigue el día anterior; 00:00 es día nuevo)', async () => {
    const f = crearFake();
    ['a', 'b', 'c'].forEach((id) => f.crearPedido(id));
    const antesDeMedianoche = new Date('2026-11-06T04:59:59.000Z'); // 23:59:59 Lima del 05/11
    const medianoche = new Date('2026-11-06T05:00:00.000Z'); // 00:00 Lima del 06/11

    expect(await f.transaccion((tx) => asignarNumeroDia(tx, 'a' as any, antesDeMedianoche))).toBe(1);
    expect(await f.transaccion((tx) => asignarNumeroDia(tx, 'b' as any, antesDeMedianoche))).toBe(2);
    expect(await f.transaccion((tx) => asignarNumeroDia(tx, 'c' as any, medianoche))).toBe(1);
    expect(f.pedidos.get('c')?.fecha_dia).toEqual(new Date('2026-11-06T00:00:00.000Z'));
    expect(f.contador.get('2026-11-05')).toBe(2);
    expect(f.contador.get('2026-11-06')).toBe(1);
  });

  it('pedidos que llegan a la vez reciben números distintos y sin huecos', async () => {
    const f = crearFake();
    const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
    ids.forEach((id) => f.crearPedido(id));
    const nums = await Promise.all(
      ids.map((id) => f.transaccion((tx) => asignarNumeroDia(tx, BigInt(id), MEDIODIA))),
    );
    expect([...nums].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(new Set(nums).size).toBe(20);
  });

  it('un pedido ya numerado conserva su número y no consume otro (sin huecos)', async () => {
    const f = crearFake();
    f.crearPedido('7');
    expect(await f.transaccion((tx) => asignarNumeroDia(tx, BigInt(7), MEDIODIA))).toBe(1);
    await expect(
      f.transaccion((tx) => asignarNumeroDia(tx, BigInt(7), MEDIODIA)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.pedidos.get('7')?.numero_dia).toBe(1);
  });
});
