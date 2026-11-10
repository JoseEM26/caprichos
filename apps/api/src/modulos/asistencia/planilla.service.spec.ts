jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { turnoDe } from './asistencia.calculo';
import { PlanillaService } from './planilla.service';
import { MiPlanillaController } from './planilla.controller';

// Servicio con BD en memoria mínima. Cubre reglas (congelar, consumos, ajustes), no el SQL.

const ADMIN: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
const LUIS = 7n;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AHORA = new Date('2026-12-05T15:00:00Z');
const NOV = new Date('2026-11-15T15:00:00Z');

type Fila = Record<string, any>;

function montar(opts: { estadoDia?: string; feriados?: Fila[]; sueldo?: Fila; vinculo?: Fila | null; cfg?: Fila; recurrentes?: Fila[] } = {}) {
  const sueldoFila = () => ({ party_id: LUIS, modalidad: 'MENSUAL', monto_semanal: 230.77, monto_mensual: 1000, ...opts.sueldo });
  const prestamos: Fila[] = [];
  const cuotas: Fila[] = [];
  const consumos: Fila[] = [
    { id: 1n, party_id: LUIS, fecha: d('2026-11-10'), pedido_id: 100n, monto: 40, pagado_en: null, pedido: { codigo: 'P-100' } },
    { id: 2n, party_id: LUIS, fecha: d('2026-11-20'), pedido_id: 101n, monto: 25.5, pagado_en: null, pedido: { codigo: 'P-101' } },
  ];
  const periodos: Fila[] = [];
  const ajustes: Fila[] = [];
  const vacaciones: Fila[] = [];
  let id = 1n;
  // 10 jornadas de 5 h programadas = 50 h; trabaja 30 h (6 jornadas)
  const dias = Array.from({ length: 30 }, (_, i) => {
    const jornada = `2026-11-${String(i + 1).padStart(2, '0')}`;
    if (i >= 10) return { jornada, estado: 'DESCANSO', turno: null, marcas: [] };
    const trabajo = i < 6;
    return {
      jornada,
      estado: trabajo ? 'CUMPLIO' : (i === 6 && opts.estadoDia) || 'FALTA',
      turno: turnoDe(780, 1080),
      marcas: trabajo ? [{ tipo: 'ENTRADA', minutos: 780, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1080, estado: 'VALIDA' }] : [],
    };
  });
  const prisma: any = {
    userAccount: { findUnique: async () => ({ party_id: LUIS, rol: 'MOZO' }), findMany: async () => [{ party_id: LUIS }] },
    sueldoPersonal: {
      findUnique: async () => sueldoFila(),
      findMany: async () => [sueldoFila()],
      upsert: async () => ({}),
    },
    person: { findUnique: async () => ({ nombres: 'Luis', apellidos: 'Pérez' }), findMany: async () => [{ party_id: LUIS, nombres: 'Luis', apellidos: 'Pérez' }] },
    planillaExtraAprobada: { findMany: async () => [] },
    feriado: { findMany: async () => opts.feriados ?? [] },
    vinculoPersonal: { findMany: async () => (opts.vinculo ? [opts.vinculo] : []) },
    descuentoRecurrentePersonal: { findMany: async () => opts.recurrentes ?? [] },
    prestamoPersonal: {
      findMany: async () => prestamos.filter((p) => p.estado === 'ACTIVO').map((p) => ({ ...p, cuotas: cuotas.filter((c) => c.prestamo_id === p.id) })),
      updateMany: async ({ where, data }: any) => {
        const sel = prestamos.filter((p) => (where.id.in ? where.id.in.includes(p.id) : p.id === where.id) && (!where.estado || p.estado === where.estado));
        sel.forEach((p) => Object.assign(p, data));
        return { count: sel.length };
      },
    },
    prestamoCuota: {
      update: async ({ where, data }: any) => Object.assign(cuotas.find((c) => c.id === where.id)!, data),
      findMany: async ({ where }: any) =>
        cuotas.filter((c) => (where.planilla_periodo_id === undefined || c.planilla_periodo_id === where.planilla_periodo_id) && (where.prestamo_id === undefined || c.prestamo_id === where.prestamo_id) && (where.reprogramada_de === undefined || where.reprogramada_de.in.includes(c.reprogramada_de))).sort((a, b) => b.numero - a.numero),
      create: async ({ data }: any) => { const f = { id: id++, estado: 'PENDIENTE', reprogramada_de: null, periodo_hasta: null, planilla_periodo_id: null, ...data }; cuotas.push(f); return f; },
      count: async ({ where }: any) => cuotas.filter((c) => c.prestamo_id === where.prestamo_id && c.estado === where.estado).length,
      deleteMany: async ({ where }: any) => { for (const i of where.id.in) cuotas.splice(cuotas.findIndex((c) => c.id === i), 1); return {}; },
      updateMany: async ({ where, data }: any) => { cuotas.filter((c) => c.planilla_periodo_id === where.planilla_periodo_id).forEach((c) => Object.assign(c, data)); return {}; },
    },
    vacacionMovimiento: { findMany: async () => vacaciones },
    planillaAjuste: {
      findMany: async () => ajustes,
      findUnique: async ({ where }: any) => ajustes.find((a) => a.id === where.id) ?? null,
      create: async ({ data }: any) => { const f = { id: id++, creado_en: AHORA, anulado_en: null, ...data }; ajustes.push(f); return f; },
      update: async ({ where, data }: any) => Object.assign(ajustes.find((a) => a.id === where.id)!, data),
    },
    consumoPersonal: {
      findMany: async () => consumos.filter((c) => !c.pagado_en),
      updateMany: async ({ where, data }: any) => {
        const sel = consumos.filter((c) => where.id.in.includes(c.id) && (where.pagado_en === null ? !c.pagado_en : true) && (!where.pago_modo || c.pago_modo === where.pago_modo));
        sel.forEach((c) => Object.assign(c, data));
        return { count: sel.length };
      },
    },
    planillaPeriodo: {
      findFirst: async ({ where }: any) => periodos.find((p) => p.estado === 'PAGADO' && p.party_id === where.party_id && (where.desde?.lte ? p.desde <= where.desde.lte && p.hasta >= where.hasta.gte : p.desde.getTime() === where.desde.getTime())) ?? null,
      findUnique: async ({ where }: any) => periodos.find((p) => p.id === where.id) ?? null,
      create: async ({ data }: any) => { const f = { id: id++, estado: 'PAGADO', pagado_en: AHORA, ...data }; periodos.push(f); return f; },
      update: async ({ where, data }: any) => Object.assign(periodos.find((p) => p.id === where.id)!, data),
    },
    $transaction: async (cb: any) => cb(prisma),
  };
  const asistencia: any = {
    diasDePersona: jest.fn(async () => ({ dias, cfg: { toleranciaMin: 5, ...opts.cfg } })),
  };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  const poner = (p: Fila, montos: number[]) => {
    prestamos.push(p);
    montos.forEach((m, i) => cuotas.push({ id: id++, prestamo_id: p.id, numero: i + 1, monto: m, estado: 'PENDIENTE', reprogramada_de: null, periodo_hasta: null, planilla_periodo_id: null }));
  };
  return { svc: new PlanillaService(prisma, asistencia, auditoria), consumos, periodos, auditoria, ajustes, vacaciones, prestamos, cuotas, poner, dias };
}

describe('PlanillaService', () => {
  it('calcula el ejemplo del dueño: 1000 mensual, 50 h programadas, 30 h trabajadas = 600 y resta consumos', async () => {
    const { svc } = montar();
    const r = await svc.detalle(7, '2026-11-15', [], AHORA);
    expect(r.resumen).toEqual({ programadasH: 50, trabajadasH: 30 });
    expect(r.resultado.ganado).toBe(600);
    expect(r.resultado.consumosCobrados).toBe(65.5);
    expect(r.resultado.neto).toBe(534.5);
    expect(r.periodo).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
  });

  it('vacación tomada paga la jornada programada normal (no es falta) y la pagada suma una línea', async () => {
    const { svc, vacaciones } = montar();
    // 11 al 12: eran faltas (índices 10 y 11 del mes... los días 7 al 10 son FALTA con turno)
    vacaciones.push({ id: 1n, tipo: 'TOMADAS', fecha_desde: d('2026-11-07'), fecha_hasta: d('2026-11-08'), dias: 2, monto: null });
    vacaciones.push({ id: 2n, tipo: 'PAGADAS', fecha_desde: d('2026-11-15'), fecha_hasta: d('2026-11-15'), dias: 1, monto: 50 });
    const r = await svc.detalle(7, '2026-11-15', [], AHORA);
    expect(r.vacaciones.diasTomados).toBe(2);
    expect(r.dias.filter((x: any) => x.estado === 'VACACIONES')).toHaveLength(2);
    // 1000 / 50 h = 20 por hora; 6 jornadas de 5 h + 2 de vacación = 40 h = 800, + 50 de vacaciones pagadas
    expect(r.resultado.pagoVacaciones).toBe(50);
    expect(r.resultado.ganado).toBe(850);
  });

  it('un consumo que pasa al siguiente período no se resta', async () => {
    const { svc } = montar();
    const r = await svc.detalle(7, '2026-11-15', ['2'], AHORA);
    expect(r.resultado.consumosCobrados).toBe(40);
    expect(r.resultado.consumosPendientes).toBe(25.5);
  });

  it('adelantos y descuentos se restan; anulado deja de restar y se conserva', async () => {
    const { svc, ajustes } = montar();
    await svc.crearAjuste('ADELANTO', { partyId: 7, fecha: '2026-11-12', monto: 100, motivo: 'Adelanto quincena' }, ADMIN);
    await svc.crearAjuste('DESCUENTO', { partyId: 7, fecha: '2026-11-13', monto: 30, motivo: 'Vaso roto' }, ADMIN);
    let r = await svc.detalle(7, '2026-11-15', ['1', '2'], AHORA);
    expect(r.resultado.neto).toBe(470);
    await svc.anularAjuste(Number(ajustes[1].id), 'Lo pagó él mismo', ADMIN);
    r = await svc.detalle(7, '2026-11-15', ['1', '2'], AHORA);
    expect(r.resultado.neto).toBe(500);
    expect(r.ajustes).toHaveLength(2);
    expect(r.ajustes[1]).toMatchObject({ anulado: true });
  });

  it('pagar congela: deja los consumos cobrados como PLANILLA sin caja y no recalcula', async () => {
    const { svc, consumos, periodos, auditoria } = montar();
    const r = await svc.pagar(7, '2026-11-15', ['2'], ADMIN, undefined, AHORA);
    expect(r.neto).toBe(560);
    expect(consumos[0]).toMatchObject({ pago_modo: 'PLANILLA', pago_medio: 'PLANILLA' });
    expect(consumos[0].movimiento_caja_id).toBeUndefined();
    expect(consumos[1].pagado_en).toBeNull(); // pasó al siguiente período
    expect(periodos).toHaveLength(1);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PAGAR_PLANILLA' }), expect.anything());

    const congelado = await svc.detalle(7, '2026-11-20', [], AHORA);
    expect(congelado.estado).toBe('PAGADO');
    expect(congelado.resultado.neto).toBe(560);
    await expect(svc.pagar(7, '2026-11-15', [], ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'YA_PAGADO' } });
  });

  it('un período pagado no admite adelantos, descuentos ni extras hasta reabrirlo', async () => {
    const { svc } = montar();
    await svc.pagar(7, '2026-11-15', [], ADMIN, undefined, AHORA);
    await expect(svc.crearAjuste('ADELANTO', { partyId: 7, fecha: '2026-11-12', monto: 10, motivo: 'Tarde' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'PERIODO_PAGADO' } });
    await expect(svc.aprobarExtra(7, '2026-11-12', true, ADMIN)).rejects.toMatchObject({ response: { codigo: 'PERIODO_PAGADO' } });
  });

  it('reabrir exige motivo, devuelve los consumos a pendientes y deja auditoría', async () => {
    const { svc, consumos, periodos, auditoria } = montar();
    const { periodoId } = await svc.pagar(7, '2026-11-15', [], ADMIN, undefined, AHORA);
    await expect(svc.reabrir(periodoId, 'corto', ADMIN)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
    await svc.reabrir(periodoId, 'Faltaba un descuento por producto roto', ADMIN);
    expect(periodos[0]).toMatchObject({ estado: 'REABIERTO', reabierto_motivo: 'Faltaba un descuento por producto roto' });
    expect(consumos.every((c) => c.pagado_en === null)).toBe(true);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REABRIR_PLANILLA' }), expect.anything());
    const r = await svc.detalle(7, '2026-11-15', [], AHORA);
    expect(r.estado).toBe('ABIERTO');
  });

  it('no se paga con jornadas incompletas o por revisar', async () => {
    const { svc, periodos } = montar({ estadoDia: 'INCOMPLETO' });
    await expect(svc.pagar(7, '2026-11-15', [], ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'JORNADAS_PENDIENTES' } });
    expect(periodos).toHaveLength(0);
  });

  it('feriado activo: 5 h del 02/11 se pagan ×2 (+100), el valor hora no cambia y Mi ganado lo marca', async () => {
    const { svc } = montar({ feriados: [{ fecha: d('2026-11-02'), nombre: 'Día de prueba', recargo: 2 }] });
    const r = await svc.detalle(7, '2026-11-15', [], AHORA);
    expect(r.resultado.valorHora).toBe(20);
    expect(r.resultado.ganado).toBe(700);
    expect(r.dias.find((x: any) => x.jornada === '2026-11-02')).toMatchObject({ feriado: 'Día de prueba', recargo: 2, ganado: 200 });
    const g: any = await svc.miGanado(LUIS, NOV);
    expect(g).toMatchObject({ conSueldo: true, estado: 'ESTIMADO', acumulado: 700, neto: null });
    expect(g.dias.find((x: any) => x.jornada === '2026-11-02')).toEqual({ jornada: '2026-11-02', trabajadaH: 5, ganado: 200, feriado: 'Día de prueba', recargo: 2 });
    expect(JSON.stringify(g)).not.toMatch(/consumo|ajuste|descuento|adelanto/i);
  });

  it('Mi ganado pagado devuelve el neto congelado y un feriado nuevo no recalcula', async () => {
    const m = montar();
    await m.svc.pagar(7, '2026-11-15', [], ADMIN, undefined, AHORA);
    const g: any = await m.svc.miGanado(LUIS, NOV);
    expect(g).toMatchObject({ estado: 'PAGADO', acumulado: 600, neto: 534.5 });
  });

  it('Mi ganado sin sueldo no es error', async () => {
    const m = montar();
    (m.svc as any).prisma.sueldoPersonal.findUnique = async () => null;
    expect(await m.svc.miGanado(LUIS, NOV)).toEqual({ conSueldo: false });
  });

  it('Mi resumen no lleva dinero', async () => {
    const { svc } = montar();
    const r = await svc.miResumen(LUIS, AHORA);
    expect(r).toMatchObject({ programadasH: 50, trabajadasH: 30 });
    expect(JSON.stringify(r)).not.toMatch(/sueldo|ganado|neto|monto/i);
  });

  // --- Planilla estilo Excel ---------------------------------------------------------------------------------------

  const sinConsumos = ['1', '2'];

  it('DIAS_HORAS: 1000 ÷ 24 ÷ 9 por hora, sin tope por el sueldo; 30 h = 138.89', async () => {
    const { svc } = montar({ sueldo: { metodo_valor_hora: 'DIAS_HORAS' }, cfg: { multiplicadorExtra: 1.25 } });
    const r = await svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.resultado.valorHora).toBe(4.63);
    expect(r.resultado.ganado).toBe(138.89);
    expect(r.excel).toMatchObject({ pagoPorDia: 41.67, horasLaboradas: 30, minutosLaborados: 0, total: 138.89, diferencia: 138.89 });
  });

  it('DIAS_HORAS por persona: días 26 y horas 8 propios', async () => {
    const { svc } = montar({ sueldo: { metodo_valor_hora: 'DIAS_HORAS', dias_mes: 26, horas_dia: 8 } });
    const r = await svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.resultado.ganado).toBe(144.23); // 30 h × 1000/26/8
  });

  it('TARIFA_HORA: 15 por hora sin sueldo mensual; 30 h = 450', async () => {
    const { svc } = montar({ sueldo: { metodo_valor_hora: 'TARIFA_HORA', tarifa_hora: 15, monto_mensual: 0, monto_semanal: 0 } });
    const r = await svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.resultado.ganado).toBe(450);
    expect(r.excel.pagoPorDia).toBeNull();
  });

  it('la hora extra aprobada se paga ×1.25 en DIAS_HORAS y ×1 en PROGRAMADAS', async () => {
    for (const [metodo, esperado] of [['DIAS_HORAS', 6.94], ['PROGRAMADAS', 5]] as const) {
      const m = montar({ sueldo: { metodo_valor_hora: metodo, monto_mensual: 1500 }, cfg: { multiplicadorExtra: 1.25 } });
      m.dias[0].marcas = [{ tipo: 'ENTRADA', minutos: 780, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1140, estado: 'VALIDA' }]; // 1 h extra
      (m.svc as any).prisma.planillaExtraAprobada.findMany = async () => [{ jornada: d('2026-11-01'), aprobado_por: 1n, aprobado_en: AHORA }];
      const r = await m.svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
      if (metodo === 'DIAS_HORAS') expect(r.resultado.pagoExtra).toBe(8.68); // 1500/24/9 × 1.25
      else expect(r.resultado.pagoExtra).toBe(esperado === 5 ? r.resultado.valorHora : 0);
    }
  });

  it('tercerizado (contrato temporal): sin feriado ×2 ni vacaciones', async () => {
    const m = montar({ vinculo: { tipo: 'CONTRATO_TEMPORAL', fecha_ingreso: d('2026-01-01'), fecha_fin: null }, feriados: [{ fecha: d('2026-11-02'), nombre: 'Día de prueba', recargo: 2 }] });
    m.vacaciones.push({ id: 1n, tipo: 'TOMADAS', fecha_desde: d('2026-11-07'), fecha_hasta: d('2026-11-08'), dias: 2, monto: null });
    const r = await m.svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.tercerizado).toBe(true);
    expect(r.resultado.ganado).toBe(600); // ni +100 de feriado ni días de vacación
    expect(r.vacaciones.diasTomados).toBe(0);
  });

  it('Netflix semanal ×1 y mensual ×4, con casilla para omitirlo, etiquetado', async () => {
    const rec = [{ id: 5n, tipo: 'NETFLIX', nombre: 'Netflix', monto: 1.64 }];
    const m = montar({ recurrentes: rec });
    let r = await m.svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.resultado.descuentosPorCategoria).toEqual({ NETFLIX: 6.56 });
    expect(r.recurrentes).toEqual([expect.objectContaining({ monto: 6.56, cobrar: true })]);
    r = await m.svc.detalle(7, '2026-11-15', sinConsumos, AHORA, { recurrentes: ['5'] });
    expect(r.resultado.descuentosPorCategoria).toEqual({});
    const sem = montar({ recurrentes: rec, sueldo: { modalidad: 'SEMANAL' } });
    r = await sem.svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.resultado.descuentos).toBe(1.64);
  });

  it('descuentos manuales con etiqueta se agrupan por categoría y el bono suma al neto', async () => {
    const { svc } = montar();
    await svc.crearAjuste('DESCUENTO', { partyId: 7, fecha: '2026-11-12', monto: 10, motivo: 'Vaso roto', categoria: 'DANO' }, ADMIN);
    await svc.crearAjuste('DESCUENTO', { partyId: 7, fecha: '2026-11-13', monto: 5, motivo: 'Merma de torta', categoria: 'MERMA' }, ADMIN);
    await svc.crearAjuste('DESCUENTO', { partyId: 7, fecha: '2026-11-14', monto: 2, motivo: 'Otro', categoria: 'MERMA' }, ADMIN);
    await svc.crearAjuste('BONO', { partyId: 7, fecha: '2026-11-14', monto: 20, motivo: 'Premio de puntualidad' }, ADMIN);
    await expect(svc.crearAjuste('DESCUENTO', { partyId: 7, fecha: '2026-11-14', monto: 2, motivo: 'x y z', categoria: 'RARA' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'CATEGORIA_INVALIDA' } });
    const r = await svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.resultado.descuentosPorCategoria).toEqual({ DANO: 10, MERMA: 7 });
    expect(r.resultado.adicional).toBe(20);
    expect(r.excel).toMatchObject({ netoAPagar: 603, diferencia: 603, adicional: 20 });
  });

  it('préstamo: la cuota entra como descuento etiquetado; omitirla recorre el plan; pagar descuenta y reabrir devuelve', async () => {
    const m = montar();
    m.poner({ id: 90n, party_id: LUIS, monto: 300, num_cuotas: 3, periodicidad: 'MENSUAL', fecha_inicio: d('2026-11-01'), estado: 'ACTIVO', motivo: null }, [100, 100, 100]);
    const r = await m.svc.detalle(7, '2026-11-15', sinConsumos, AHORA);
    expect(r.cuotas).toEqual([expect.objectContaining({ numero: 1, monto: 100, numCuotas: 3, cobrar: true })]);
    expect(r.resultado.descuentosPorCategoria).toEqual({ PRESTAMO: 100 });
    expect(r.resultado.neto).toBe(500);

    // omitir la cuota en este pago: no se descuenta y el plan se recorre
    const idCuota = r.cuotas[0].id;
    const pagoOmitido = await m.svc.pagar(7, '2026-11-15', sinConsumos, ADMIN, undefined, AHORA, { cuotas: [idCuota] });
    expect(pagoOmitido.neto).toBe(600);
    expect(m.cuotas.map((c) => c.estado)).toEqual(['OMITIDA', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE']);
    expect(m.cuotas[3]).toMatchObject({ numero: 4, reprogramada_de: m.cuotas[0].id });
    await m.svc.reabrir(pagoOmitido.periodoId, 'Se omitió por error la cuota', ADMIN);
    expect(m.cuotas.map((c) => c.estado)).toEqual(['PENDIENTE', 'PENDIENTE', 'PENDIENTE']);

    // pagar con la cuota: DESCONTADA; al reabrir vuelve a PENDIENTE
    const pago = await m.svc.pagar(7, '2026-11-15', sinConsumos, ADMIN, undefined, AHORA);
    expect(pago.neto).toBe(500);
    expect(m.cuotas[0]).toMatchObject({ estado: 'DESCONTADA', planilla_periodo_id: BigInt(pago.periodoId) });
    expect(m.prestamos[0].estado).toBe('ACTIVO');
    await m.svc.reabrir(pago.periodoId, 'Corrección del descuento', ADMIN);
    expect(m.cuotas[0].estado).toBe('PENDIENTE');
  });

  it('préstamo con la última cuota pagada queda SALDADO y vuelve a ACTIVO al reabrir', async () => {
    const m = montar();
    m.poner({ id: 91n, party_id: LUIS, monto: 50, num_cuotas: 1, periodicidad: 'SEMANAL', fecha_inicio: d('2026-11-01'), estado: 'ACTIVO', motivo: null }, [50]);
    const pago = await m.svc.pagar(7, '2026-11-15', sinConsumos, ADMIN, undefined, AHORA);
    expect(m.prestamos[0].estado).toBe('SALDADO');
    await m.svc.reabrir(pago.periodoId, 'Revisar el saldado', ADMIN);
    expect(m.prestamos[0].estado).toBe('ACTIVO');
  });

  it('guardar sueldo: persona nueva queda en DIAS_HORAS y el celular nunca va a la auditoría', async () => {
    const m = montar();
    const upsert = jest.fn(async () => ({}));
    (m.svc as any).prisma.sueldoPersonal.findUnique = async () => null;
    (m.svc as any).prisma.sueldoPersonal.upsert = upsert;
    const r = await m.svc.guardarSueldo(7, { modalidad: 'MENSUAL', monto: 1500, pagoCelular: '999 000 111', pagoMedio: 'YAPE' }, ADMIN);
    expect(r.metodo).toBe('DIAS_HORAS');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ pago_celular: '999000111', pago_medio: 'YAPE' }) }));
    expect(JSON.stringify(m.auditoria.registrar.mock.calls, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain('999000111');
  });
});

describe('penalidad por tardanza en la planilla', () => {
  const tarde = (m: ReturnType<typeof montar>, min: number, i = 0) => {
    m.dias[i] = { ...m.dias[i], estado: 'TARDANZA', marcas: [{ tipo: 'ENTRADA', minutos: 780 + min, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1080, estado: 'VALIDA' }] } as any;
  };
  it('60 min tarde con S/20/h: no se pagan S/20 y se descuentan S/20 de penalidad (por defecto 100 %)', async () => {
    const m = montar();
    tarde(m, 60);
    const r = await m.svc.detalle(7, '2026-11-15', [], AHORA);
    expect(r.resultado.pagoTrabajado).toBe(580); // 600 − 20 del tiempo no pagado
    expect(r.resultado.penalidadTardanza).toBe(20);
    expect(r.resultado.penalidadTardanzaDetalle).toEqual([{ fecha: '2026-11-01', minutos: 60, monto: 20 }]);
    expect(r.excel.penalidadTardanza).toBe(20);
    expect(r.resultado.consumosCobrados).toBe(65.5);
    expect(r.resultado.neto).toBe(494.5); // 580 − 20 − 65,5
    expect(r.penalidadTardanzaPct).toBe(100);
    expect(r).not.toHaveProperty('pctTardanza');
  });
  it('factor 0 = sin penalidad y 200 = el doble; dentro de la tolerancia no hay', async () => {
    const cero = montar({ cfg: { tardanzaPenalidadPct: 0 } });
    tarde(cero, 60);
    expect((await cero.svc.detalle(7, '2026-11-15', [], AHORA)).resultado.penalidadTardanza).toBe(0);
    const doble = montar({ cfg: { tardanzaPenalidadPct: 200 } });
    tarde(doble, 30);
    expect((await doble.svc.detalle(7, '2026-11-15', [], AHORA)).resultado.penalidadTardanza).toBe(20); // 30 min × 20/60 × 2
    const toler = montar();
    tarde(toler, 5);
    expect((await toler.svc.detalle(7, '2026-11-15', [], AHORA)).resultado.penalidadTardanza).toBe(0);
  });
  it('contrato temporal: el tiempo tarde no se paga pero no lleva penalidad', async () => {
    const m = montar({ vinculo: { party_id: LUIS, tipo: 'CONTRATO_TEMPORAL', vigente_hasta: null } });
    tarde(m, 60);
    const r = await m.svc.detalle(7, '2026-11-15', [], AHORA);
    expect(r.resultado.penalidadTardanza).toBe(0);
    expect(r.resultado.pagoTrabajado).toBe(580);
  });
  it('tarifa fija por hora: la penalidad usa esa tarifa', async () => {
    const m = montar({ sueldo: { metodo_valor_hora: 'TARIFA_HORA', tarifa_hora: 30 } });
    tarde(m, 60);
    expect((await m.svc.detalle(7, '2026-11-15', [], AHORA)).resultado.penalidadTardanza).toBe(30);
  });
});

describe('mi planilla (el trabajador ve solo lo suyo)', () => {
  it('devuelve el contrato con horas extra aprobadas y pendientes, penalidad, préstamo con interés y servicios', async () => {
    const m = montar({ recurrentes: [{ id: 5n, party_id: LUIS, tipo: 'NETFLIX', nombre: 'Netflix', monto: 1.64, periodicidad: 'SEMANAL', activo: true }] });
    m.dias[0] = { ...m.dias[0], estado: 'TARDANZA', marcas: [{ tipo: 'ENTRADA', minutos: 840, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1080, estado: 'VALIDA' }] } as any;
    m.dias[1] = { ...m.dias[1], estado: 'SALIO_DESPUES', marcas: [{ tipo: 'ENTRADA', minutos: 780, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1140, estado: 'VALIDA' }] } as any; // 60 min extra
    m.dias[2] = { ...m.dias[2], estado: 'SALIO_DESPUES', marcas: [{ tipo: 'ENTRADA', minutos: 780, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1110, estado: 'VALIDA' }] } as any; // 30 min extra
    (m.svc as any).prisma.planillaExtraAprobada.findMany = async () => [{ jornada: d('2026-11-02'), aprobado_por: 1n, aprobado_en: AHORA }];
    m.poner({ id: 91n, party_id: LUIS, monto: 100, num_cuotas: 2, periodicidad: 'MENSUAL', fecha_inicio: d('2026-11-01'), estado: 'ACTIVO', motivo: 'nota interna', monto_cuota: 60, interes_pct_mensual: 10, interes_monto: 20 }, [60, 60]);
    m.ajustes.push({ id: 31n, party_id: LUIS, tipo: 'ADELANTO', fecha: d('2026-11-05'), monto: 50, motivo: 'Adelanto', categoria: null, anulado_en: null, creado_en: AHORA });
    const r: any = await m.svc.miPlanilla(LUIS, '2026-11-15', AHORA);
    expect(r.periodo).toEqual({ desde: '2026-11-01', hasta: '2026-11-30', tipo: 'MENSUAL' });
    expect(r.base).toEqual({ sueldo: 1000, tarifaHora: null, valorHora: 20 });
    expect(r.horas).toMatchObject({ extraAprobadaMin: 60, extraPendienteMin: 30, extraRechazadaMin: 0 });
    expect(r.penalidadTardanza).toEqual({ total: 20, detalle: [{ fecha: '2026-11-01', minutos: 60, monto: 20 }] });
    expect(r.adelantos).toEqual([{ id: 31, fecha: '2026-11-05', monto: 50, motivo: 'Adelanto' }]);
    expect(r.descuentos.map((x: any) => x.etiqueta).sort()).toEqual(['CONSUMO', 'CONSUMO', 'NETFLIX', 'PRESTAMO']);
    expect(r.descuentos.find((x: any) => x.etiqueta === 'NETFLIX').monto).toBe(6.56); // 1,64 × 4 en mensual
    expect(r.prestamos).toEqual([{ id: 91, capital: 100, interesPctMensual: 10, interes: 20, cuota: 60, saldo: 120, cuotasPagadas: 0, cuotasTotales: 2, estado: 'ACTIVO' }]);
    expect(r.serviciosExtra).toEqual([{ nombre: 'Netflix', monto: 1.64, periodicidad: 'SEMANAL', activo: true }]);
    expect(r.estadoPago).toBe('PENDIENTE');
    expect(r.pagadoEn).toBeNull();
    // nada ajeno ni interno
    const txt = JSON.stringify(r);
    expect(txt).not.toContain('nota interna');
    expect(txt).not.toContain('Pérez');
    expect(r).not.toHaveProperty('pago');
    expect(r).not.toHaveProperty('filas');
  });
  it('consulta SIEMPRE la cuenta del token: el controlador ignora cualquier partyId enviado', async () => {
    const mia = jest.fn(async () => ({ conSueldo: false }));
    const ctrl = new MiPlanillaController({ miPlanilla: mia } as any);
    await ctrl.mia({ usuario: { partyId: 7n } }, { periodo: '2026-10-15', partyId: 99 } as any);
    expect(mia).toHaveBeenCalledWith(7n, '2026-10-15');
  });
  it('período anterior pagado: cifras congeladas, estado PAGADO y fecha de pago', async () => {
    const m = montar();
    const sinConsumos = ['1', '2'];
    await m.svc.pagar(7, '2026-11-15', sinConsumos, ADMIN, undefined, AHORA);
    const r: any = await m.svc.miPlanilla(LUIS, '2026-11-02', AHORA);
    expect(r.estadoPago).toBe('PAGADO');
    expect(r.pagadoEn).toBe(AHORA.toISOString());
    expect(r.neto).toBe(600);
    expect((await m.svc.miPlanilla(LUIS, '2099-01-01', AHORA) as any).periodo.desde).toBe('2026-12-01'); // futuro = actual
  });
});
