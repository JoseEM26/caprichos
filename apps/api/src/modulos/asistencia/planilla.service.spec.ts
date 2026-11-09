import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { turnoDe } from './asistencia.calculo';
import { PlanillaService } from './planilla.service';

// Servicio con BD en memoria mínima. Cubre reglas (congelar, consumos, ajustes), no el SQL.

const ADMIN: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
const LUIS = 7n;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AHORA = new Date('2026-12-05T15:00:00Z');

type Fila = Record<string, any>;

function montar(opts: { estadoDia?: string } = {}) {
  const consumos: Fila[] = [
    { id: 1n, party_id: LUIS, fecha: d('2026-11-10'), pedido_id: 100n, monto: 40, pagado_en: null, pedido: { codigo: 'P-100' } },
    { id: 2n, party_id: LUIS, fecha: d('2026-11-20'), pedido_id: 101n, monto: 25.5, pagado_en: null, pedido: { codigo: 'P-101' } },
  ];
  const periodos: Fila[] = [];
  const ajustes: Fila[] = [];
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
      findUnique: async () => ({ party_id: LUIS, modalidad: 'MENSUAL', monto_semanal: 230.77, monto_mensual: 1000 }),
      findMany: async () => [{ party_id: LUIS, modalidad: 'MENSUAL', monto_semanal: 230.77, monto_mensual: 1000 }],
      upsert: async () => ({}),
    },
    person: { findUnique: async () => ({ nombres: 'Luis', apellidos: 'Pérez' }), findMany: async () => [{ party_id: LUIS, nombres: 'Luis', apellidos: 'Pérez' }] },
    planillaExtraAprobada: { findMany: async () => [] },
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
    diasDePersona: jest.fn(async () => ({ dias, cfg: { toleranciaMin: 5, pagoTardanzaPct: 50 } })),
  };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  return { svc: new PlanillaService(prisma, asistencia, auditoria), consumos, periodos, auditoria, ajustes };
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

  it('Mi resumen no lleva dinero', async () => {
    const { svc } = montar();
    const r = await svc.miResumen(LUIS, AHORA);
    expect(r).toMatchObject({ programadasH: 50, trabajadasH: 30 });
    expect(JSON.stringify(r)).not.toMatch(/sueldo|ganado|neto|monto/i);
  });
});
