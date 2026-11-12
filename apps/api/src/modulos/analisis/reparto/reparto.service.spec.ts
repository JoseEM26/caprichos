jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }), registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { BadRequestException } from '@nestjs/common';
import { RepartoService } from './reparto.service';

const AHORA = new Date('2026-11-11T20:00:00Z'); // 15:00 Lima
const t = (min: number) => new Date(AHORA.getTime() + min * 60000);

const ped = (extra: Record<string, unknown> = {}) => ({
  zona_id: 1n,
  estado: 'ENTREGADO',
  creado_en: t(-90),
  entregado_en: t(-30),
  salio_en: t(-50),
  llego_en: t(-35),
  repartidor_party_id: 7n,
  ...extra,
});

function servicio(opts: { pedidos?: any[]; trabajadaMin?: number; pendientes?: any[]; liquidaciones?: any[] } = {}) {
  const prisma: any = {
    zonaReparto: {
      findMany: jest.fn(async () => [
        { id: 1n, codigo: 'Centro', tarifa: 5, minutos_max: 40, activa: true },
        { id: 2n, codigo: 'Norte', tarifa: 8, minutos_max: null, activa: true },
      ]),
    },
    pedido: { findMany: jest.fn(async (a: any) => (a.where.estado === 'ENTREGADO' ? (opts.pendientes ?? []) : (opts.pedidos ?? []))) },
    liquidacion: { findMany: jest.fn(async () => opts.liquidaciones ?? []) },
    person: { findMany: jest.fn(async () => [{ party_id: 7n, nombres: 'Rep', apellidos: 'Uno' }]) },
  };
  const asistencia: any = {
    obtenerConfig: jest.fn(async () => ({})),
    cargarContexto: jest.fn(async () => ({})),
    partesConActividad: jest.fn(() => new Set([7n])),
    evaluarDia: jest.fn(() => ({ turno: {}, interp: { marcas: [{}], entrada: {} }, resultado: { estado: 'CUMPLIO', tardanzaMin: 0, trabajadaMin: opts.trabajadaMin ?? 0 } })),
  };
  const correcciones: any = { rolesPorPersona: jest.fn(async () => new Map([[7n, ['REPARTIDOR']]])) };
  return { s: new RepartoService(prisma, asistencia, correcciones), prisma };
}

describe('Análisis › Reparto', () => {
  it('agrupa por zona, calcula el tiempo y el semáforo contra la promesa de la zona', async () => {
    const { s } = servicio({ pedidos: [ped(), ped({ zona_id: 2n, entregado_en: t(-20) }), ped({ zona_id: null }), ped({ estado: 'EN_CAMINO', entregado_en: null })] });
    const r = await s.resumen({ desde: '2026-11-11', hasta: '2026-11-11' }, true, AHORA);
    expect(r.totales).toEqual({ pedidos: 4, sinZona: 1, entregas: 3 });
    const centro = r.zonas.find((z) => z.zona === 'Centro')!;
    expect(centro.pedidos).toBe(2);
    expect(centro.entregados).toBe(1);
    expect(centro.minutosPromedio).toBe(60);
    expect(centro.semaforo).toBe('ambar'); // 60 = límite de 40 x 1,5
    expect(r.zonas.find((z) => z.zona === 'Norte')!.semaforo).toBe('sin_dato'); // sin promesa no hay meta
    expect(centro.porTurno).toEqual([0, 2, 0]); // 13:30 Lima = tarde
  });

  it('entregas por hora usa las horas de asistencia; sin horas dice null, no cero', async () => {
    const con = servicio({ pedidos: [ped(), ped()], trabajadaMin: 120 });
    const r = await con.s.resumen({}, true, AHORA);
    expect(r.productividad.horasTrabajadas).toBe(2);
    expect(r.productividad.entregasPorHora).toBe(1);
    expect(r.productividad.minutosPorEntrega).toBe(15);
    const sin = servicio({ pedidos: [ped()], trabajadaMin: 0 });
    const r2 = await sin.s.resumen({}, true, AHORA);
    expect(r2.productividad.entregasPorHora).toBeNull();
  });

  it('el supervisor no recibe filas por repartidor ni consulta nombres', async () => {
    const { s, prisma } = servicio({ pedidos: [ped()] });
    const r = await s.resumen({}, false, AHORA);
    expect(r.porPersonaVisible).toBe(false);
    expect(r.productividad.porPersona).toBeNull();
    expect(JSON.stringify(r)).not.toContain('Rep Uno');
    expect(prisma.person.findMany).not.toHaveBeenCalled();
  });

  it('el admin sí ve a cada repartidor', async () => {
    const { s } = servicio({ pedidos: [ped()] });
    const r = await s.resumen({}, true, AHORA);
    expect((r.productividad.porPersona as any[])[0]).toMatchObject({ nombre: 'Rep Uno', entregas: 1 });
  });

  it('sin pedidos: estructura vacía sin inventar ceros de promedio', async () => {
    const { s } = servicio();
    const r = await s.resumen({}, true, AHORA);
    expect(r.zonas).toEqual([]);
    expect(r.productividad.minutosPorEntrega).toBeNull();
  });

  it('rango de más de 92 días o futuro → 400', async () => {
    const { s } = servicio();
    await expect(s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, true, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.resumen({ desde: '2026-11-12', hasta: '2026-11-12' }, true, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('efectivo por rendir', () => {
    const entrega = (dias: number, total: number) => ({
      repartidor_party_id: 7n,
      entregado_en: new Date(AHORA.getTime() - dias * 86_400_000),
      total,
      pago_metodo: 'EFECTIVO',
      cobros: [],
      planPago: [],
    });

    it('resta lo liquidado desde lo más viejo y dice desde cuándo', async () => {
      const { s } = servicio({ pendientes: [entrega(3, 40), entrega(2, 30), entrega(1, 20)], liquidaciones: [{ repartidor_party_id: 7n, esperado: 50 }] });
      const r = await s.porRendir(true, AHORA);
      expect(r.total).toBe(40); // 90 - 50
      expect(r.pedidosPendientes).toBe(2);
      expect(r.desde).toEqual(new Date(AHORA.getTime() - 2 * 86_400_000));
      expect((r.porPersona as any[])[0]).toMatchObject({ nombre: 'Rep Uno', pendiente: 40 });
    });

    it('todo liquidado o ya cobrado en caja: nada por rendir', async () => {
      const cobrado = { ...entrega(1, 20), cobros: [{ anulado_en: null, total: 20 }] };
      const { s } = servicio({ pendientes: [entrega(2, 40), cobrado], liquidaciones: [{ repartidor_party_id: 7n, esperado: 40 }] });
      const r = await s.porRendir(true, AHORA);
      expect(r.total).toBe(0);
      expect(r.desde).toBeNull();
      expect(r.porPersona).toBeNull();
    });

    it('el supervisor ve el total pero no por repartidor', async () => {
      const { s } = servicio({ pendientes: [entrega(1, 25)] });
      const r = await s.porRendir(false, AHORA);
      expect(r.total).toBe(25);
      expect(r.porPersona).toBeNull();
    });
  });
});
