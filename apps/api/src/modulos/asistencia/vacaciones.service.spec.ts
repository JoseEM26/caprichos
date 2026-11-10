import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { turnoDe } from './asistencia.calculo';
import { VacacionesService } from './vacaciones.service';

const ADMIN: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
const LUIS = 7n;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AHORA = new Date('2027-01-15T15:00:00Z');

type Fila = Record<string, any>;

function montar(opts: { periodoPagado?: boolean } = {}) {
  const vinculos: Fila[] = [];
  const movs: Fila[] = [];
  let id = 1n;
  const prisma: any = {
    userAccount: { findUnique: async () => ({ party_id: LUIS, rol: 'MOZO' }) },
    sueldoPersonal: { findUnique: async () => ({ party_id: LUIS }) },
    vinculoPersonal: {
      findFirst: async ({ where }: any) => vinculos.find((v) => (where.vigente_hasta === null ? !v.vigente_hasta : true) && (!where.id || v.id === where.id)) ?? null,
      findMany: async () => [...vinculos],
      create: async ({ data }: any) => { const f = { id: id++, vigente_desde: AHORA, vigente_hasta: null, contrato_archivo_id: null, ...data }; vinculos.push(f); return f; },
      update: async ({ where, data }: any) => Object.assign(vinculos.find((v) => v.id === where.id)!, data),
    },
    vacacionMovimiento: {
      findMany: async ({ where }: any) => movs.filter((m) => (!where.tipo || m.tipo === where.tipo) && (where.anulado_en !== null || !m.anulado_en) && (!where.vinculo_id || m.vinculo_id === where.vinculo_id)),
      findUnique: async ({ where }: any) => movs.find((m) => m.id === where.id) ?? null,
      create: async ({ data }: any) => { const f = { id: id++, creado_en: AHORA, anulado_en: null, ...data }; movs.push(f); return f; },
      update: async ({ where, data }: any) => Object.assign(movs.find((m) => m.id === where.id)!, data),
    },
    planillaPeriodo: { findFirst: async () => (opts.periodoPagado ? { id: 99n } : null) },
    $transaction: async (cb: any) => cb(prisma),
  };
  // Lunes a viernes con turno; sábado y domingo descanso
  const asistencia: any = {
    diasDePersona: jest.fn(async (_p: bigint, desde: string, hasta: string) => {
      const dias = [];
      for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += 86_400_000) {
        const dow = new Date(t).getUTCDay();
        dias.push({ jornada: new Date(t).toISOString().slice(0, 10), turno: dow === 0 || dow === 6 ? null : turnoDe(780, 1080) });
      }
      return { dias };
    }),
  };
  const archivos: any = { subirArchivo: jest.fn(async () => ({ id: '55', url: '/admin/archivos/55' })) };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  return { svc: new VacacionesService(prisma, asistencia, archivos, auditoria), vinculos, movs, archivos, auditoria };
}

const pdf = (extra: Partial<Express.Multer.File> = {}) => ({ buffer: Buffer.from('%PDF-1.4 x'), size: 10, mimetype: 'application/pdf', originalname: 'c.pdf', ...extra }) as Express.Multer.File;

describe('VacacionesService', () => {
  it('cambiar de tipo cierra el vínculo vigente y abre otro; mismo tipo solo corrige', async () => {
    const { svc, vinculos } = montar();
    await svc.guardarVinculo(7, { tipo: 'CONTRATO_TEMPORAL', fechaIngreso: '2026-06-01', fechaFin: '2026-12-31' }, ADMIN);
    await svc.guardarVinculo(7, { tipo: 'CONTRATO_TEMPORAL', fechaIngreso: '2026-06-01', fechaFin: '2027-03-31' }, ADMIN);
    expect(vinculos).toHaveLength(1);
    await svc.guardarVinculo(7, { tipo: 'PLANILLA', fechaIngreso: '2027-01-01' }, ADMIN);
    expect(vinculos).toHaveLength(2);
    expect(vinculos[0].vigente_hasta).toBeInstanceOf(Date);
    expect(vinculos[1]).toMatchObject({ tipo: 'PLANILLA', regimen_vacaciones: 30, fecha_fin: null });
  });

  it('sin vínculo de planilla no hay vacaciones', async () => {
    const { svc } = montar();
    await svc.guardarVinculo(7, { tipo: 'CONTRATO_TEMPORAL', fechaIngreso: '2026-06-01' }, ADMIN);
    await expect(svc.registrar({ partyId: 7, tipo: 'AJUSTE', desde: '2027-01-10', dias: 1, motivo: 'x y z' }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'VINCULO_NO_PLANILLA' } });
  });

  it('tomadas cuenta solo días con turno y descuenta saldo; anular lo devuelve', async () => {
    const { svc } = montar();
    await svc.guardarVinculo(7, { tipo: 'PLANILLA', fechaIngreso: '2026-07-15', regimenVacaciones: 30 }, ADMIN); // 6 meses al 15/01 = 15 días
    expect((await svc.obtener(7, AHORA)).vacaciones).toMatchObject({ ganados: 15, saldo: 15 });
    // lun 4 al dom 10 de enero de 2027: 5 hábiles
    const r = await svc.registrar({ partyId: 7, tipo: 'TOMADAS', desde: '2027-01-04', hasta: '2027-01-10' }, ADMIN, undefined, AHORA);
    expect(r.dias).toBe(5);
    expect((await svc.obtener(7, AHORA)).vacaciones).toMatchObject({ tomadas: 5, saldo: 10 });
    await expect(svc.registrar({ partyId: 7, tipo: 'TOMADAS', desde: '2027-01-08', hasta: '2027-01-08' }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'VACACION_CRUZADA' } });
    await svc.anular(Number(r.id), 'Se canceló el viaje', ADMIN);
    expect((await svc.obtener(7, AHORA)).vacaciones).toMatchObject({ tomadas: 0, saldo: 15 });
    await expect(svc.anular(Number(r.id), 'otra vez', ADMIN)).rejects.toMatchObject({ response: { codigo: 'YA_ANULADO' } });
  });

  it('pagadas y tomadas no pueden pasar del saldo; el ajuste sí corrige con motivo', async () => {
    const { svc } = montar();
    await svc.guardarVinculo(7, { tipo: 'PLANILLA', fechaIngreso: '2026-07-15' }, ADMIN);
    await expect(svc.registrar({ partyId: 7, tipo: 'PAGADAS', desde: '2027-01-12', dias: 20, monto: 500 }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'SALDO_INSUFICIENTE' } });
    await svc.registrar({ partyId: 7, tipo: 'PAGADAS', desde: '2027-01-12', dias: 5, monto: 150 }, ADMIN, undefined, AHORA);
    await expect(svc.registrar({ partyId: 7, tipo: 'AJUSTE', desde: '2027-01-12', dias: 2 }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
    await svc.registrar({ partyId: 7, tipo: 'AJUSTE', desde: '2027-01-12', dias: 2, motivo: 'Saldo de la empresa anterior' }, ADMIN, undefined, AHORA);
    expect((await svc.obtener(7, AHORA)).vacaciones).toMatchObject({ pagadas: 5, ajustes: 2, saldo: 12 });
  });

  it('un período pagado queda congelado', async () => {
    const { svc } = montar({ periodoPagado: true });
    await svc.guardarVinculo(7, { tipo: 'PLANILLA', fechaIngreso: '2026-07-15' }, ADMIN);
    await expect(svc.registrar({ partyId: 7, tipo: 'TOMADAS', desde: '2027-01-04', hasta: '2027-01-05' }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'PERIODO_PAGADO' } });
  });

  it('mi saldo no lleva dinero', async () => {
    const { svc } = montar();
    await svc.guardarVinculo(7, { tipo: 'PLANILLA', fechaIngreso: '2026-07-15' }, ADMIN);
    await svc.registrar({ partyId: 7, tipo: 'PAGADAS', desde: '2027-01-12', dias: 1, monto: 40 }, ADMIN, undefined, AHORA);
    const mi: any = await svc.miVacaciones(LUIS, AHORA);
    expect(mi.aplica).toBe(true);
    expect(JSON.stringify(mi)).not.toContain('monto');
    expect(mi.saldo).toBe(14);
  });

  it('contrato: solo PDF real y máximo 5 MB', async () => {
    const { svc, archivos } = montar();
    await svc.guardarVinculo(7, { tipo: 'CONTRATO_TEMPORAL', fechaIngreso: '2026-06-01' }, ADMIN);
    await expect(svc.subirContrato(7, pdf({ mimetype: 'image/png' }), ADMIN)).rejects.toMatchObject({ response: { codigo: 'TIPO_NO_PERMITIDO' } });
    await expect(svc.subirContrato(7, pdf({ buffer: Buffer.from('no soy pdf') }), ADMIN)).rejects.toMatchObject({ response: { codigo: 'TIPO_NO_PERMITIDO' } });
    await expect(svc.subirContrato(7, pdf({ size: 6 * 1024 * 1024 }), ADMIN)).rejects.toMatchObject({ response: { codigo: 'ARCHIVO_GRANDE' } });
    await svc.subirContrato(7, pdf(), ADMIN);
    expect(archivos.subirArchivo).toHaveBeenCalledWith(expect.anything(), true, ADMIN, undefined);
    expect((await svc.obtener(7, AHORA)).vigente?.tieneContrato).toBe(true);
  });
});
