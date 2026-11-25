import { PlanillaPropinasService } from './planilla-propinas.service';
import { lineasDePersona, repartirDias } from './planilla-propinas.calculo';

/** Servicio con BD y asistencia en memoria. `registros` = lo ya pagado en planilla; `repartosPagados` = reparto mensual antiguo. */
function montar(opts: {
  totales: Array<{ fecha: string; total: number }>;
  horas: Record<string, Array<{ partyId: number; horas: number }>>;
  cuentas?: Array<{ party_id: bigint; rol: string }>;
  personas?: Array<{ party_id: bigint; participa_propinas: boolean | null }>;
  registros?: Array<{ party_id: bigint; fecha: Date; monto_pagado: number; planilla_periodo_id: bigint }>;
  repartosPagados?: Array<{ anio: number; mes: number }>;
}) {
  const registros = opts.registros ?? [];
  const prisma: any = {
    person: { findMany: async () => opts.personas ?? [] },
    userAccount: { findMany: async () => (opts.cuentas ?? []).map((c) => ({ ...c, rolesExtra: [] })) },
    planillaPropinaDia: {
      findMany: async ({ where }: any) => registros.filter((r) => r.party_id === where.party_id),
      createMany: async ({ data }: any) => { registros.push(...data); return {}; },
      deleteMany: async ({ where }: any) => {
        for (let i = registros.length - 1; i >= 0; i--) if (registros[i].planilla_periodo_id === where.planilla_periodo_id) registros.splice(i, 1);
        return {};
      },
    },
    propinaRepartoDetalle: { findMany: async () => (opts.repartosPagados ?? []).map((reparto) => ({ reparto })) },
  };
  const propinas: any = { totalesPorDia: async (desde: string, hasta: string) => opts.totales.filter((t) => t.fecha >= desde && t.fecha <= hasta).map((t) => ({ ...t })) };
  const asistencia: any = {
    horasNetasPorDia: async (_d: string, _h: string, solo?: Set<string>) =>
      Object.fromEntries(Object.entries(opts.horas).filter(([f]) => !solo || solo.has(f))),
  };
  return { svc: new PlanillaPropinasService(prisma, propinas, asistencia), registros, tx: prisma };
}

const montoDe = (lineas: Array<{ fecha: string; monto: number }>, fecha: string) => lineas.find((l) => l.fecha === fecha)?.monto;

describe('repartirDias (propina de cada día según las horas de ese día)', () => {
  it('ejemplo del dueño: lunes S/ 10, A 8 h, B 4 h, C 8 h → 4.00, 2.00 y 4.00', () => {
    const dias = repartirDias([{ fecha: '2026-11-02', total: 10 }], { '2026-11-02': [{ partyId: 1, horas: 8 }, { partyId: 2, horas: 4 }, { partyId: 3, horas: 8 }] });
    const dia = dias.get('2026-11-02')!;
    expect(dia.filas.map((f) => [f.partyId, f.monto])).toEqual([[1, 4], [2, 2], [3, 4]]);
    expect(dia.horasTotales).toBe(20);
  });

  it('la suma del día es exacta en céntimos y un día sin nadie con horas queda sin repartir', () => {
    const dias = repartirDias(
      [{ fecha: '2026-11-02', total: 10 }, { fecha: '2026-11-03', total: 7 }],
      { '2026-11-02': [{ partyId: 1, horas: 1 }, { partyId: 2, horas: 1 }, { partyId: 3, horas: 1 }] },
    );
    expect(dias.get('2026-11-02')!.filas.reduce((a, f) => a + f.monto, 0)).toBeCloseTo(10, 2);
    expect(dias.get('2026-11-03')).toMatchObject({ sinRepartir: true, filas: [] });
  });
});

describe('PlanillaPropinasService', () => {
  const PERIODO1 = { desde: '2026-11-02', hasta: '2026-11-08' };
  const PERIODO2 = { desde: '2026-11-09', hasta: '2026-11-15' };
  const horasLunes = { '2026-11-02': [{ partyId: 1, horas: 8 }, { partyId: 2, horas: 4 }, { partyId: 3, horas: 8 }] };

  it('solo reparte entre quienes trabajaron ese día: cada persona ve su parte', async () => {
    const { svc } = montar({ totales: [{ fecha: '2026-11-02', total: 10 }], horas: horasLunes });
    const b = await svc.dePersona(2n, PERIODO1);
    expect(b.total).toBe(2);
    expect(b.lineas[0]).toMatchObject({ fecha: '2026-11-02', totalLocal: 10, horas: 4, horasTotales: 20, porcentaje: 20, monto: 2, pendiente: false });
  });

  it('ADMIN queda fuera salvo excepción; el supervisor y los demás entran', async () => {
    const { svc } = montar({
      totales: [{ fecha: '2026-11-02', total: 10 }],
      horas: horasLunes,
      cuentas: [{ party_id: 1n, rol: 'ADMIN' }, { party_id: 2n, rol: 'SUPERVISOR' }, { party_id: 3n, rol: 'MOZO' }],
    });
    expect((await svc.dePersona(1n, PERIODO1)).total).toBe(0);
    expect((await svc.dePersona(2n, PERIODO1)).total).toBe(3.33); // 4 h de 12 h
    expect((await svc.dePersona(3n, PERIODO1)).total).toBe(6.67);
    const conExcepcion = montar({
      totales: [{ fecha: '2026-11-02', total: 10 }],
      horas: horasLunes,
      cuentas: [{ party_id: 1n, rol: 'ADMIN' }],
      personas: [{ party_id: 1n, participa_propinas: true }, { party_id: 3n, participa_propinas: false }],
    });
    expect((await conExcepcion.svc.dePersona(1n, PERIODO1)).total).toBe(6.67); // 8 de 12 h (sin C)
  });

  it('lo pagado no se paga dos veces; si entra más propina o una devolución, la diferencia sale en el siguiente período', async () => {
    const m = montar({ totales: [{ fecha: '2026-11-02', total: 10 }], horas: horasLunes });
    const p1 = await m.svc.dePersona(1n, PERIODO1);
    expect(p1.total).toBe(4);
    await m.svc.registrarPago(m.tx, 1n, 100n, PERIODO1, p1.lineas);
    expect(m.registros).toHaveLength(7); // un registro por cada día del período (con 0 los días sin propina)
    // el mismo período ya pagado no vuelve a dar nada
    expect((await m.svc.dePersona(1n, PERIODO1)).total).toBe(0);

    // el lunes entra una propina tardía de S/ 5 (total 15): A le toca 6.00 → 2.00 pendiente
    const mas = montar({ totales: [{ fecha: '2026-11-02', total: 15 }], horas: horasLunes, registros: m.registros });
    const p2 = await mas.svc.dePersona(1n, PERIODO2);
    expect(p2.lineas).toHaveLength(1);
    expect(p2.lineas[0]).toMatchObject({ fecha: '2026-11-02', monto: 2, pendiente: true });

    // devolución posterior: el total del lunes baja a S/ 5 → A recibiría 2.00, ya cobró 4.00 → se le resta 2.00
    const menos = montar({ totales: [{ fecha: '2026-11-02', total: 5 }], horas: horasLunes, registros: m.registros });
    expect(montoDe((await menos.svc.dePersona(1n, PERIODO2)).lineas, '2026-11-02')).toBe(-2);

    // y si la propina del día se devolvió toda (total 0), se resta lo pagado
    const cero = montar({ totales: [], horas: horasLunes, registros: m.registros });
    expect(montoDe((await cero.svc.dePersona(1n, PERIODO2)).lineas, '2026-11-02')).toBe(-4);
  });

  it('un día de un período ya pagado que no tenía propina y luego la recibe sale pendiente en el siguiente', async () => {
    const m = montar({ totales: [], horas: {} });
    await m.svc.registrarPago(m.tx, 1n, 100n, PERIODO1, []);
    const luego = montar({ totales: [{ fecha: '2026-11-04', total: 8 }], horas: { '2026-11-04': [{ partyId: 1, horas: 8 }] }, registros: m.registros });
    expect((await luego.svc.dePersona(1n, PERIODO2)).lineas).toEqual([expect.objectContaining({ fecha: '2026-11-04', monto: 8, pendiente: true })]);
  });

  it('un mes con reparto mensual ya pagado a la persona no se paga otra vez por planilla', async () => {
    const m = montar({ totales: [{ fecha: '2026-11-02', total: 10 }], horas: horasLunes, repartosPagados: [{ anio: 2026, mes: 11 }] });
    expect((await m.svc.dePersona(1n, PERIODO1)).total).toBe(0);
    // otro mes sin pago sí cuenta
    const otro = montar({ totales: [{ fecha: '2026-11-02', total: 10 }], horas: horasLunes, repartosPagados: [{ anio: 2026, mes: 10 }] });
    expect((await otro.svc.dePersona(1n, PERIODO1)).total).toBe(4);
  });

  it('reabrir el período libera sus días: vuelven a cobrarse en ese período', async () => {
    const m = montar({ totales: [{ fecha: '2026-11-02', total: 10 }], horas: horasLunes });
    const p1 = await m.svc.dePersona(1n, PERIODO1);
    await m.svc.registrarPago(m.tx, 1n, 100n, PERIODO1, p1.lineas);
    expect((await m.svc.dePersona(1n, PERIODO1)).total).toBe(0);
    await m.svc.liberarPago(m.tx, 100n);
    expect(m.registros).toHaveLength(0);
    expect((await m.svc.dePersona(1n, PERIODO1)).total).toBe(4);
  });
});

describe('lineasDePersona', () => {
  it('ignora los días posteriores al fin del período', () => {
    const dias = repartirDias([{ fecha: '2026-11-20', total: 10 }], { '2026-11-20': [{ partyId: 1, horas: 5 }] });
    expect(lineasDePersona(dias, 1, { desde: '2026-11-09', hasta: '2026-11-15' }, new Map(), new Set())).toEqual([]);
  });
});
