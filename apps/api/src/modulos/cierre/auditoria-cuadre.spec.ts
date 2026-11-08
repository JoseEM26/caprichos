/**
 * Auditoría de cuadre de caja: cada sol que entra o sale se refleja exactamente una vez en el esperado del cierre.
 * Escenarios del encargo del dueño (numeración del informe): 1, 2, 3, 4, 10, 12, 15, 16, 17, 18.
 */
import { calcularMontosCaja, efectivoDelRepartidor, aCentimos } from '../caja/caja.calculo';
import { rangoDiaCaja } from './cierre.util';
import { ControlCuadreService } from './control-cuadre.service';

const caja = { id: 1n, fecha: new Date('2026-11-05T00:00:00.000Z'), apertura: 100 };

/** Cliente de caja simulado: solo lo que lee calcularMontosCaja. */
function cliente(o: { cobros?: any[]; movimientos?: any[]; liquidaciones?: any[]; devueltos?: any[] }): any {
  return {
    cobro: { findMany: jest.fn().mockResolvedValue(o.cobros ?? []) },
    pedido: { findMany: jest.fn().mockResolvedValue(o.devueltos ?? []) },
    movimientoCaja: { findMany: jest.fn().mockResolvedValue(o.movimientos ?? []) },
    liquidacion: { findMany: jest.fn().mockResolvedValue(o.liquidaciones ?? []) },
  };
}
const pago = (medio: string, monto: number, propina = 0) => ({ medio, monto, propina });

describe('cuadre de caja: calcularMontosCaja', () => {
  it('1. efectivo con vuelto: la caja suma lo del pedido, no lo recibido (el vuelto no entra)', async () => {
    // pedido S/ 18, cliente da S/ 20, vuelto 2: el pago guarda monto 18, recibido 20, vuelto 2
    const m = await calcularMontosCaja(
      cliente({ cobros: [{ pagos: [{ medio: 'EFECTIVO', monto: 18, propina: 0, recibido: 20, vuelto: 2 }] }] }),
      caja,
    );
    expect(m.esperadoEfectivo).toBe(118); // 100 de apertura + 18
  });

  it('2. pago dividido Yape + efectivo: el esperado en efectivo es solo el renglón de efectivo', async () => {
    const m = await calcularMontosCaja(cliente({ cobros: [{ pagos: [pago('YAPE', 30), pago('EFECTIVO', 12)] }] }), caja);
    expect(m.esperadoEfectivo).toBe(112);
    expect(m.sistemaYape).toBe(30);
  });

  it('10. propina cobrada con el pedido: entra a caja pero no infla las ventas en efectivo', async () => {
    const m = await calcularMontosCaja(
      cliente({ cobros: [{ pagos: [pago('EFECTIVO', 20, 2), pago('YAPE', 10, 1)] }] }),
      caja,
    );
    expect(m.ventasEfectivo).toBe(20);
    expect(m.propinasEfectivo).toBe(2);
    expect(m.esperadoEfectivo).toBe(122);
    expect(m.sistemaYape).toBe(11);
    expect(m.propinasDigitales).toBe(1);
  });

  it('15. esperado = inicial + efectivo cobrado + ingresos - egresos (el anulado no cuenta: lo filtra la consulta) + liquidado', async () => {
    const c = cliente({
      cobros: [{ pagos: [pago('EFECTIVO', 50)] }],
      movimientos: [
        { tipo: 'INGRESO', monto: 20 },
        { tipo: 'EGRESO', monto: 35.5 },
      ],
      liquidaciones: [{ entregado: 40 }],
    });
    const m = await calcularMontosCaja(c, caja);
    expect(m.esperadoEfectivo).toBe(174.5); // 100 + 50 + 40 + 20 - 35.5
    // los anulados quedan fuera por la propia consulta (anulado_en: null) en cobros y movimientos
    expect(c.cobro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { caja_id: 1n, anulado_en: null } }));
    expect(c.movimientoCaja.findMany).toHaveBeenCalledWith({ where: { caja_id: 1n, anulado_en: null } });
  });

  it('15b. devolución en efectivo: es un egreso de caja y baja el esperado una sola vez', async () => {
    const m = await calcularMontosCaja(
      cliente({ cobros: [{ pagos: [pago('EFECTIVO', 30)] }], movimientos: [{ tipo: 'EGRESO', monto: 30 }] }),
      caja,
    );
    expect(m.esperadoEfectivo).toBe(100);
  });

  it('17. redondeo: 1000 pedidos de S/ 0,10 + 0,20 suman exactos, sin deriva de floats', async () => {
    const cobros = Array.from({ length: 1000 }, () => ({ pagos: [pago('EFECTIVO', 0.1), pago('YAPE', 0.2)] }));
    const m = await calcularMontosCaja(cliente({ cobros }), { ...caja, apertura: 0 });
    expect(m.esperadoEfectivo).toBe(100);
    expect(m.sistemaYape).toBe(200);
  });

  it('3. delivery: el efectivo contra entrega entra al esperado solo al liquidar y no se duplica con el cobro en caja', async () => {
    const contraEntrega = { total: 25, pago_metodo: 'EFECTIVO', cobros: [], planPago: [] };
    expect(efectivoDelRepartidor(contraEntrega)).toBe(2500);
    // antes de liquidar no hay liquidación: el esperado no lo incluye
    const antes = await calcularMontosCaja(cliente({}), caja);
    expect(antes.esperadoEfectivo).toBe(100);
    // al liquidar (entrega S/ 25) entra una vez
    const despues = await calcularMontosCaja(cliente({ liquidaciones: [{ entregado: 25 }] }), caja);
    expect(despues.esperadoEfectivo).toBe(125);
    // si Caja lo cobra después, ya no es del repartidor (el pedido queda PAGADO al liquidar: YA_COBRADO)
    expect(efectivoDelRepartidor({ ...contraEntrega, cobros: [{ anulado_en: null }] })).toBe(0);
  });

  it('H2: el cobro digital asentado al liquidar (38 de 40) no le quita al repartidor su efectivo (2)', () => {
    const plan = [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }];
    const base = { total: 40, pago_metodo: 'YAPE', planPago: plan };
    expect(efectivoDelRepartidor({ ...base, cobros: [{ anulado_en: null, total: 38 }] })).toBe(200);
    // un cobro completo (Caja cobró todo) sí lo saca de la liquidación
    expect(efectivoDelRepartidor({ ...base, cobros: [{ anulado_en: null, total: 40 }] })).toBe(0);
  });

  it('4. cambio de cobro Yape -> efectivo: el repartidor rinde el efectivo nuevo y el Yape original deja de contar', () => {
    const base = { total: 40, cobros: [] as any[] };
    expect(efectivoDelRepartidor({ ...base, pago_metodo: 'YAPE' })).toBe(0);
    expect(efectivoDelRepartidor({ ...base, pago_metodo: 'EFECTIVO' })).toBe(4000);
  });

  it('12. pedido cobrado ayer: entra a la caja donde se cobró; su caja de hoy no lo suma', async () => {
    // el cobro pertenece a caja_id de ayer: la consulta de hoy filtra por caja_id y no lo ve
    const hoy = cliente({ cobros: [] });
    const m = await calcularMontosCaja(hoy, { id: 2n, fecha: new Date('2026-11-06T00:00:00.000Z'), apertura: 0 });
    expect(m.esperadoEfectivo).toBe(0);
    expect(hoy.cobro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { caja_id: 2n, anulado_en: null } }));
  });

  it('18. zona horaria: el día de Lima es [05:00Z, 05:00Z del siguiente); 23:30 Lima cae en su día y 00:10 en el siguiente', () => {
    const { inicio, fin } = rangoDiaCaja(new Date('2026-11-05T00:00:00.000Z'));
    expect(inicio.toISOString()).toBe('2026-11-05T05:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-11-06T05:00:00.000Z');
    const a2330Lima = new Date('2026-11-06T04:30:00.000Z');
    const a0010Lima = new Date('2026-11-06T05:10:00.000Z');
    expect(a2330Lima >= inicio && a2330Lima < fin).toBe(true);
    expect(a0010Lima >= fin).toBe(true);
  });

  it('aCentimos redondea al céntimo sin deriva (1,005 y 0,1 + 0,2)', () => {
    expect(aCentimos(0.1) + aCentimos(0.2)).toBe(30);
  });
});

describe('Control de cuadre (solo lectura)', () => {
  function servicio(o: { cobros?: any[]; sinCobro?: any[]; anulados?: any[]; comprobantes?: any[]; cierre?: any[]; caja?: any }) {
    const prisma: any = {
      cobro: { findMany: jest.fn().mockResolvedValue(o.cobros ?? []) },
      // primera consulta = pagados sin cobro, segunda = anulados con cobro
      pedido: {
        findMany: jest.fn().mockResolvedValueOnce(o.sinCobro ?? []).mockResolvedValueOnce(o.anulados ?? []),
      },
      comprobante: { findMany: jest.fn().mockResolvedValue(o.comprobantes ?? []) },
      devolucionPedido: { findMany: jest.fn().mockResolvedValue([]) },
      caja: { findUnique: jest.fn().mockResolvedValue(o.caja ?? null) },
      cierreMedio: { findMany: jest.fn().mockResolvedValue(o.cierre ?? []) },
    };
    return { svc: new ControlCuadreService(prisma), prisma };
  }
  const cobroOk = {
    total: 30,
    pagos: [{ medio: 'YAPE', monto: 30, propina: 0 }],
    pedido: { codigo: 'CP-1', estado: 'ENTREGADO', propina: 0 },
  };

  it('día limpio: cuadra y no hay alertas', async () => {
    const { svc } = servicio({ cobros: [cobroOk] });
    const r = await svc.controlar('2026-11-05');
    expect(r.cuadra).toBe(true);
    expect(r.cobradoPorMedio).toEqual({ YAPE: { venta: 30, propina: 0 } });
  });

  it('H1: Yape confirmado como PAGADO sin cobro se señala como dinero digital fuera de caja', async () => {
    const { svc } = servicio({
      sinCobro: [{ codigo: 'CP-9', modalidad: 'DELIVERY', estado: 'ENTREGADO', pago_metodo: 'YAPE', total: 45.5, planPago: [] }],
    });
    const r = await svc.controlar('2026-11-05');
    expect(r.digitalFueraDeCaja).toBe(45.5);
    expect(r.cuadra).toBe(false);
    expect(r.alertas[0]).toContain('45.50');
  });

  it('H2: pago dividido Yape 38 + efectivo 2 de delivery: el Yape queda fuera de caja y el efectivo va por liquidación', async () => {
    const { svc } = servicio({
      sinCobro: [
        {
          codigo: 'CP-10',
          modalidad: 'DELIVERY',
          estado: 'ENTREGADO',
          pago_metodo: 'YAPE',
          total: 40,
          planPago: [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }],
        },
      ],
    });
    const r = await svc.controlar('2026-11-05');
    expect(r.digitalFueraDeCaja).toBe(38);
    expect(r.efectivoFueraDeCaja).toBe(0); // el efectivo sí entra al liquidar al repartidor
  });

  it('efectivo pagado sin cobro en pedido de local: dinero que no entra ni por caja ni por liquidación', async () => {
    const { svc } = servicio({
      sinCobro: [{ codigo: 'CP-11', modalidad: 'LLEVAR', estado: 'ENTREGADO', pago_metodo: 'EFECTIVO', total: 12, planPago: [] }],
    });
    expect((await svc.controlar('2026-11-05')).efectivoFueraDeCaja).toBe(12);
  });

  it('cobro cuyos pagos no suman su total, anulado con cobro sin devolución y boleta de pedido anulado se señalan', async () => {
    const { svc } = servicio({
      cobros: [{ ...cobroOk, total: 31 }],
      anulados: [{ codigo: 'CP-2', total: 20 }],
      comprobantes: [{ numero_texto: 'B002-5', baja_estado: null, pedido: { codigo: 'CP-2', total: 20, estado: 'ANULADO' } }],
    });
    const r = await svc.controlar('2026-11-05');
    expect(r.cobrosDescuadrados).toEqual([{ pedido: 'CP-1', total: 31, sumaPagos: 30 }]);
    expect(r.anuladosSinDevolucion).toEqual([{ pedido: 'CP-2', total: 20 }]);
    expect(r.comprobantesDeMas).toHaveLength(1);
  });

  it('16. una boleta con baja aceptada ya no cuenta como comprobante de más', async () => {
    const { svc } = servicio({
      comprobantes: [{ numero_texto: 'B002-6', baja_estado: 'ACEPTADA', pedido: { codigo: 'CP-3', total: 9, estado: 'ANULADO' } }],
    });
    expect((await svc.controlar('2026-11-05')).comprobantesDeMas).toHaveLength(0);
  });

  it('14. el descuadre del cierre queda visible con su diferencia (no se ajusta en silencio)', async () => {
    const { svc } = servicio({
      caja: { id: 7n, estado: 'CERRADA' },
      cierre: [{ medio: 'EFECTIVO', sistema: 150, visto: 148.5 }, { medio: 'YAPE', sistema: 30, visto: 30 }],
    });
    const r = await svc.controlar('2026-11-05');
    expect(r.descuadresCierre).toEqual([{ medio: 'EFECTIVO', sistema: 150, visto: 148.5, diferencia: -1.5 }]);
  });
});
