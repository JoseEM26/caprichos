import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { PrestamosService } from './prestamos.service';

const ADMIN: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
const AHORA = new Date('2026-11-10T15:00:00Z');

function montar(rol = 'MOZO') {
  const prestamos: any[] = [];
  const cuotas: any[] = [];
  const recurrentes: any[] = [];
  let id = 1n;
  const prisma: any = {
    userAccount: { findUnique: async () => ({ party_id: 7n, rol }) },
    prestamoPersonal: {
      create: async ({ data }: any) => { const f = { id: id++, estado: 'ACTIVO', ...data }; prestamos.push(f); return f; },
      findUnique: async ({ where }: any) => prestamos.find((p) => p.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(prestamos.find((p) => p.id === where.id), data),
    },
    prestamoCuota: { createMany: async ({ data }: any) => { cuotas.push(...data); return {}; } },
    descuentoRecurrentePersonal: {
      create: async ({ data }: any) => { const f = { id: id++, ...data }; recurrentes.push(f); return f; },
    },
    $transaction: async (cb: any) => cb(prisma),
  };
  const asistencia: any = { obtenerConfig: async () => ({ netflixSemanal: 1.64 }) };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  return { svc: new PrestamosService(prisma, asistencia, auditoria), prestamos, cuotas, recurrentes, auditoria };
}

describe('PrestamosService', () => {
  it('crea el préstamo con su plan de cuotas fijas y lo audita', async () => {
    const { svc, prestamos, cuotas, auditoria } = montar();
    const r = await svc.crear({ partyId: 7, monto: 100, numCuotas: 3, periodicidad: 'SEMANAL' }, ADMIN, undefined, AHORA);
    expect(r.cuotas).toEqual([33.33, 33.33, 33.34]);
    expect(prestamos[0]).toMatchObject({ monto: 100, num_cuotas: 3, monto_cuota: 33.33, periodicidad: 'SEMANAL' });
    expect(cuotas.map((c) => c.numero)).toEqual([1, 2, 3]);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CREAR_PRESTAMO' }), expect.anything());
  });

  it('rechaza al ADMIN, montos inválidos y cuotas menores a un céntimo', async () => {
    await expect(montar('ADMIN').svc.crear({ partyId: 7, monto: 100, numCuotas: 2, periodicidad: 'MENSUAL' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'ADMIN_SIN_PLANILLA' } });
    await expect(montar().svc.crear({ partyId: 7, monto: 0, numCuotas: 2, periodicidad: 'MENSUAL' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'MONTO_INVALIDO' } });
    await expect(montar().svc.crear({ partyId: 7, monto: 0.01, numCuotas: 5, periodicidad: 'MENSUAL' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'CUOTAS_INVALIDAS' } });
  });

  it('anular pide motivo, deja el préstamo ANULADO y no se anula dos veces', async () => {
    const { svc, prestamos, auditoria } = montar();
    await svc.crear({ partyId: 7, monto: 90, numCuotas: 3, periodicidad: 'SEMANAL' }, ADMIN, undefined, AHORA);
    await expect(svc.anular(1, 'x', ADMIN)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
    await svc.anular(1, 'Se perdonó la deuda', ADMIN);
    expect(prestamos[0]).toMatchObject({ estado: 'ANULADO', anulado_motivo: 'Se perdonó la deuda' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ANULAR_PRESTAMO' }), undefined);
    await expect(svc.anular(1, 'otra vez', ADMIN)).rejects.toMatchObject({ response: { codigo: 'YA_ANULADO' } });
  });

  it('Netflix toma el monto general de la configuración y otro descuento exige nombre y monto', async () => {
    const { svc, recurrentes } = montar();
    await svc.crearRecurrente({ partyId: 7, tipo: 'NETFLIX' }, ADMIN, undefined, AHORA);
    expect(recurrentes[0]).toMatchObject({ tipo: 'NETFLIX', nombre: 'Netflix', monto: 1.64 });
    await expect(svc.crearRecurrente({ partyId: 7, tipo: 'OTRO', monto: 5 }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'NOMBRE_REQUERIDO' } });
    await expect(svc.crearRecurrente({ partyId: 7, tipo: 'OTRO', nombre: 'Seguro' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'MONTO_INVALIDO' } });
  });

  it('préstamo sin interés: igual que antes (0 %, total = capital)', async () => {
    const { svc, prestamos } = montar();
    const r = await svc.crear({ partyId: 7, monto: 100, numCuotas: 4, periodicidad: 'MENSUAL' }, ADMIN, undefined, AHORA);
    expect(r).toMatchObject({ interes: 0, total: 100, cuotas: [25, 25, 25, 25] });
    expect(prestamos[0]).toMatchObject({ interes_pct_mensual: 0, interes_monto: 0 });
  });

  it('préstamo con interés simple mensual: 5 % × 4 meses sobre 100 = 20; cuotas de 30', async () => {
    const { svc, prestamos } = montar();
    const r = await svc.crear({ partyId: 7, monto: 100, numCuotas: 4, periodicidad: 'MENSUAL', interesPctMensual: 5 }, ADMIN, undefined, AHORA);
    expect(r).toMatchObject({ interes: 20, total: 120, cuotas: [30, 30, 30, 30] });
    expect(prestamos[0]).toMatchObject({ monto: 100, interes_pct_mensual: 5, interes_monto: 20, monto_cuota: 30 });
  });

  it('listar muestra capital, interés, cuota y saldo; los viejos quedan en 0 %', async () => {
    const { svc, prestamos, cuotas } = montar();
    await svc.crear({ partyId: 7, monto: 100, numCuotas: 4, periodicidad: 'MENSUAL', interesPctMensual: 5 }, ADMIN, undefined, AHORA);
    (svc as any).prisma.prestamoPersonal.findMany = async () => prestamos.map((p) => ({ ...p, creado_en: AHORA, fecha_inicio: AHORA, cuotas: cuotas.map((c, i) => ({ ...c, id: BigInt(i + 1), estado: i === 0 ? 'DESCONTADA' : 'PENDIENTE', periodo_desde: null, periodo_hasta: null, reprogramada_de: null })) }));
    (svc as any).prisma.descuentoRecurrentePersonal.findMany = async () => [{ id: 1n, tipo: 'OTRO', nombre: 'Seguro', monto: 10, periodicidad: 'MENSUAL', activo: true, desde: AHORA }];
    const r = await svc.listar(7);
    expect(r.prestamos[0]).toMatchObject({ monto: 100, interesPctMensual: 5, interes: 20, total: 120, montoCuota: 30, saldo: 90 });
    expect(r.prestamos[0].cuotas[0]).toMatchObject({ monto: 30, interesCuota: 5 });
    expect(r.recurrentes[0]).toMatchObject({ nombre: 'Seguro', periodicidad: 'MENSUAL', activo: true });
  });

  it('servicio extra con nombre, monto y periodicidad (semanal o mensual)', async () => {
    const { svc, recurrentes } = montar();
    await svc.crearRecurrente({ partyId: 7, tipo: 'OTRO', nombre: 'Seguro', monto: 12, periodicidad: 'MENSUAL' }, ADMIN, undefined, AHORA);
    await svc.crearRecurrente({ partyId: 7, tipo: 'NETFLIX' }, ADMIN, undefined, AHORA);
    expect(recurrentes[0]).toMatchObject({ nombre: 'Seguro', monto: 12, periodicidad: 'MENSUAL' });
    expect(recurrentes[1]).toMatchObject({ nombre: 'Netflix', periodicidad: 'SEMANAL' });
  });
});
