import { MATRIZ, ROLES } from '../acceso/permisos';
import { EscritorioOperativoService } from './escritorio-operativo.service';

// Ningún campo de la respuesta puede llevar nombre de dinero (decisión del dueño: el supervisor no ve montos)
const PALABRAS_DE_DINERO = /monto|total|venta|ticket|ganan|pago|cobr|efectivo|soles|importe|precio|saldo|ingreso|egreso|medio|voucher|ajuste|sencillo/i;

function claves(obj: unknown, ruta = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => [`${ruta}${k}`, ...claves(v, `${ruta}${k}.`)]);
}

const permisosDe = (...roles: string[]) => new Set(roles.flatMap((r) => MATRIZ[r] ?? []));

function montar(filasPedidos: Array<{ estado: string; n: number }>, caja: { estado: string } | null = { estado: 'ABIERTA' }) {
  const prisma: any = {
    pedido: {
      groupBy: jest.fn(async () => filasPedidos.map((f) => ({ estado: f.estado, _count: { _all: f.n } }))),
      findMany: jest.fn(async () => [
        { creado_en: new Date('2026-10-31T14:10:00-05:00'), pasa_cocina_en: new Date('2026-10-31T14:12:00-05:00'), listo_en: new Date('2026-10-31T14:22:00-05:00') },
        { creado_en: new Date('2026-10-31T14:40:00-05:00'), pasa_cocina_en: null, listo_en: null },
        { creado_en: new Date('2026-10-31T16:05:00-05:00'), pasa_cocina_en: null, listo_en: null },
      ]),
      count: jest.fn(async () => 2),
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
    parametro: { findUnique: jest.fn(async () => ({ valor: 'si' })) },
    stock: {
      count: jest.fn(async () => 4),
      findMany: jest.fn(async () => [{ insumo: { nombre: 'Leche' } }, { insumo: { nombre: 'Azúcar' } }]),
    },
  };
  return { service: new EscritorioOperativoService(prisma), prisma };
}

const FILAS = [
  { estado: 'NUEVO', n: 2 },
  { estado: 'PREPARANDO', n: 4 },
  { estado: 'LISTO', n: 1 },
  { estado: 'EN_CAMINO', n: 3 },
  { estado: 'COLA', n: 5 },
];

describe('Escritorio del personal: solo lo operativo que su rol alcanza, sin dinero', () => {
  const ahora = new Date('2026-10-31T19:00:00-05:00');
  const supervisor = () => montar(FILAS).service.miEscritorio(permisosDe('SUPERVISOR'), ['SUPERVISOR'], 7n, ahora);

  it('para ningún rol ni combinación la respuesta lleva campos o textos de dinero', async () => {
    const combinaciones = [...ROLES.map((r) => [r.codigo]), ['CAJERO', 'COCINA'], ['MOZO', 'ALMACEN'], ['SUPERVISOR', 'COCINA', 'ALMACEN']];
    for (const roles of combinaciones) {
      const { service } = montar(FILAS);
      const r = await service.miEscritorio(permisosDe(...roles), roles, 7n, ahora);
      expect(claves(r).filter((k) => PALABRAS_DE_DINERO.test(k))).toEqual([]);
      expect(JSON.stringify(r)).not.toMatch(/S\/|\$|soles|telefono|cliente_/i);
    }
  });

  it('cuenta pedidos por estado, suma los que no llegaron al cliente y trae los atrasados', async () => {
    const r = await supervisor();
    expect(r.pedidos).toMatchObject({ porConfirmar: 2, enPreparacion: 4, enCola: 5, listos: 1, enReparto: 3, noEntregados: 15, atrasados: 2, metaCocinaMin: 13 });
  });

  it('pedidos por hora de hoy en Lima, con las horas vacías en medio, y tiempo de cocina', async () => {
    const r = await supervisor();
    expect(r.pedidos?.porHora).toEqual([
      { hora: 14, pedidos: 2 },
      { hora: 15, pedidos: 0 },
      { hora: 16, pedidos: 1 },
    ]);
    expect(r.pedidos?.tiempoCocinaMin).toBe(10);
  });

  it('reservas de hoy con la hora en Lima y las próximas', async () => {
    const r = await supervisor();
    expect(r.reservas?.cantidadHoy).toBe(3);
    expect(r.reservas?.proximas).toEqual([
      { nombre: 'Ana', personas: 4, hora: '20:30' },
      { nombre: 'Luis', personas: 2, hora: '21:00' },
    ]);
  });

  it('mesas: cantidad, ocupadas y libres; caja solo como estado', async () => {
    const { service } = montar([], null);
    const r = await service.miEscritorio(permisosDe('SUPERVISOR'), ['SUPERVISOR'], 7n, ahora);
    expect(r.mesas).toEqual({ cantidad: 10, ocupadas: 3, libres: 7 });
    expect(r.caja).toEqual({ estado: 'SIN_ABRIR' });
  });

  it('solo cuenta pedidos que no son de personal', async () => {
    const { service, prisma } = montar([]);
    await service.miEscritorio(permisosDe('SUPERVISOR'), ['SUPERVISOR'], 7n, ahora);
    expect(prisma.pedido.groupBy.mock.calls[0][0].where.es_personal).toBe(false);
  });

  it('cada rol recibe solo sus bloques', async () => {
    const bloques = async (roles: string[]) => {
      const r = await montar(FILAS).service.miEscritorio(permisosDe(...roles), roles, 7n, ahora);
      return Object.keys(r).filter((k) => k !== 'generadoEn' && (r as any)[k] !== undefined).sort();
    };
    expect(await bloques(['COCINA'])).toEqual(['pedidos', 'stockBajo']);
    expect(await bloques(['MOZO'])).toEqual(['pedidos']);
    expect(await bloques(['CAJERO'])).toEqual(['pedidos', 'reparto']);
    expect(await bloques(['ALMACEN'])).toEqual(['stockBajo']);
    expect(await bloques(['REPARTIDOR'])).toEqual(['reparto']);
    expect(await bloques(['MARKETING'])).toEqual([]);
    expect(await bloques(['SUPERVISOR'])).toEqual(['caja', 'mesas', 'pedidos', 'reparto', 'reservas']);
    // Roles combinados: unión de lo permitido (cocina + almacén no agrega nada sensible)
    expect(await bloques(['MOZO', 'ALMACEN'])).toEqual(['pedidos', 'stockBajo']);
  });

  it('el repartidor que solo es repartidor ve únicamente lo suyo; quien tiene más roles ve el conjunto', async () => {
    const solo = montar(FILAS);
    const r1 = await solo.service.miEscritorio(permisosDe('REPARTIDOR'), ['REPARTIDOR'], 9n, ahora);
    expect(r1.reparto?.propio).toBe(true);
    expect(solo.prisma.pedido.count.mock.calls.every(([a]: any) => a.where.repartidor_party_id === undefined || a.where.repartidor_party_id === null || a.where.repartidor_party_id === 9n)).toBe(true);
    expect(solo.prisma.pedido.count.mock.calls.filter(([a]: any) => a.where.estado === 'EN_CAMINO')[0][0].where.repartidor_party_id).toBe(9n);
    const r2 = await montar(FILAS).service.miEscritorio(permisosDe('CAJERO', 'REPARTIDOR'), ['CAJERO', 'REPARTIDOR'], 9n, ahora);
    expect(r2.reparto?.propio).toBe(false);
  });

  it('el stock bajo no se manda con el Control de almacén apagado', async () => {
    const { service, prisma } = montar(FILAS);
    prisma.parametro.findUnique.mockResolvedValue({ valor: 'no' });
    const r = await service.miEscritorio(permisosDe('ALMACEN'), ['ALMACEN'], 7n, ahora);
    expect(r.stockBajo).toBeUndefined();
  });

  it('mio() une los permisos de todos los roles de la cuenta', async () => {
    const { service, prisma } = montar(FILAS);
    prisma.userAccount = { findUnique: jest.fn(async () => ({ id: 1n })) };
    prisma.rolPermiso = { findMany: jest.fn(async () => [{ permiso: { modulo: 'stock', accion: 'ver' } }, { permiso: { modulo: 'pedidos', accion: 'ver' } }]) };
    prisma.userAccountPermiso = { findMany: jest.fn(async () => []) };
    const r = await service.mio({ partyId: 7n, rol: 'COCINA', debeCambiar: false, roles: ['COCINA', 'ALMACEN'] }, ahora);
    expect(prisma.rolPermiso.findMany.mock.calls[0][0].where.rol.in).toEqual(['COCINA', 'ALMACEN']);
    expect(r.pedidos).toBeDefined();
    expect(r.stockBajo?.insumos).toEqual(['Leche', 'Azúcar']);
    expect(r.reservas).toBeUndefined();
  });

  it('solo ADMIN y SUPERVISOR tienen el permiso del escritorio operativo', () => {
    expect(MATRIZ.SUPERVISOR).toContain('escritorio/operativo');
    expect(MATRIZ.ADMIN).toContain('escritorio/operativo');
    for (const rol of ['CAJERO', 'MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR']) {
      expect(MATRIZ[rol]).not.toContain('escritorio/operativo');
    }
  });
});
