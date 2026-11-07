import { MATRIZ } from '../acceso/permisos';
import { EscritorioOperativoService } from './escritorio-operativo.service';

// Ningún campo de la respuesta puede llevar nombre de dinero (decisión del dueño: el supervisor no ve montos)
const PALABRAS_DE_DINERO = /monto|total|venta|ticket|ganan|pago|cobr|efectivo|soles|importe|precio|saldo|ingreso|egreso|medio|voucher|ajuste|sencillo/i;

function claves(obj: unknown, ruta = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => [`${ruta}${k}`, ...claves(v, `${ruta}${k}.`)]);
}

function montar(filasPedidos: Array<{ estado: string; n: number }>, caja: { estado: string } | null = { estado: 'ABIERTA' }) {
  const prisma: any = {
    pedido: {
      groupBy: jest.fn(async () => filasPedidos.map((f) => ({ estado: f.estado, _count: { _all: f.n } }))),
    },
    reserva: {
      count: jest.fn(async () => 3),
      findMany: jest.fn(async () => [
        { nombre: 'Ana', personas: 4, hora: new Date('2026-10-31T20:30:00-05:00') },
        { nombre: 'Luis', personas: 2, hora: new Date('2026-10-31T21:00:00-05:00') },
      ]),
    },
    elementoPlano: { count: jest.fn(async () => 10) },
    pedidoMesa: { findMany: jest.fn(async () => [{ mesa_id: 1n }, { mesa_id: 2n }, { mesa_id: 3n }]) },
    caja: { findUnique: jest.fn(async () => caja) },
  };
  return { service: new EscritorioOperativoService(prisma), prisma };
}

describe('Escritorio operativo del supervisor', () => {
  const ahora = new Date('2026-10-31T19:00:00-05:00');

  it('la respuesta no tiene ningún campo de dinero (ni en claves ni en valores de texto)', async () => {
    const { service } = montar([
      { estado: 'NUEVO', n: 2 },
      { estado: 'PREPARANDO', n: 4 },
      { estado: 'LISTO', n: 1 },
      { estado: 'EN_CAMINO', n: 3 },
      { estado: 'COLA', n: 5 },
    ]);
    const r = await service.obtener(ahora);
    const todas = claves(r);
    expect(todas.filter((k) => PALABRAS_DE_DINERO.test(k))).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(/S\/|\$|soles/i);
  });

  it('cuenta pedidos por estado y suma los que no llegaron al cliente', async () => {
    const { service } = montar([
      { estado: 'NUEVO', n: 2 },
      { estado: 'PREPARANDO', n: 4 },
      { estado: 'LISTO', n: 1 },
      { estado: 'EN_CAMINO', n: 3 },
      { estado: 'COLA', n: 5 },
    ]);
    const r = await service.obtener(ahora);
    expect(r.pedidos).toEqual({ porConfirmar: 2, enPreparacion: 4, enCola: 5, listos: 1, enReparto: 3, noEntregados: 15 });
  });

  it('reservas de hoy con la hora en Lima y las próximas', async () => {
    const { service } = montar([]);
    const r = await service.obtener(ahora);
    expect(r.reservas.cantidadHoy).toBe(3);
    expect(r.reservas.proximas).toEqual([
      { nombre: 'Ana', personas: 4, hora: '20:30' },
      { nombre: 'Luis', personas: 2, hora: '21:00' },
    ]);
  });

  it('mesas: cantidad, ocupadas y libres; caja solo como estado', async () => {
    const { service } = montar([], null);
    const r = await service.obtener(ahora);
    expect(r.mesas).toEqual({ cantidad: 10, ocupadas: 3, libres: 7 });
    expect(r.caja).toEqual({ estado: 'SIN_ABRIR' });
  });

  it('solo cuenta pedidos que no son de personal', async () => {
    const { service, prisma } = montar([]);
    await service.obtener(ahora);
    expect(prisma.pedido.groupBy.mock.calls[0][0].where.es_personal).toBe(false);
  });

  it('solo ADMIN y SUPERVISOR tienen el permiso del escritorio operativo', () => {
    expect(MATRIZ.SUPERVISOR).toContain('escritorio/operativo');
    expect(MATRIZ.ADMIN).toContain('escritorio/operativo');
    for (const rol of ['CAJERO', 'MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR']) {
      expect(MATRIZ[rol]).not.toContain('escritorio/operativo');
    }
  });
});
