import { ConflictException } from '@nestjs/common';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { PropinasMiController, PropinasRepartoController } from './propinas-reparto.controller';
import { PropinasRepartoService, mesTerminado } from './propinas-reparto.service';

// El controlador importa el guard (que arrastra @nestjs/jwt, solo ESM): aquí solo se leen los metadatos.
jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class AccesoGuardFalso {} }));

const ADMIN: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
const AHORA = new Date('2026-12-02T15:00:00Z'); // 2 de diciembre en Lima: noviembre ya terminó

type Horas = { partyId: number; nombre: string; horasTrabajadas: number; horasProgramadas: number; diasTrabajados: number; jornadasIncompletas?: number; jornadasARevisar?: number };

/** Base de datos en memoria mínima: cubre las llamadas que hace el servicio. */
function crear(opts: {
  total?: number;
  horas?: Horas[];
  personas?: Array<{ party_id: bigint; nombres: string; apellidos?: string | null; participa_propinas?: boolean | null }>;
  cuentas?: Array<{ party_id: bigint; rol: string; rolesExtra?: Array<{ rol: string }> }>;
  vigente?: Record<string, any> | null;
  detalleMi?: Array<Record<string, any>>;
} = {}) {
  const prisma: any = {
    propinaReparto: {
      findFirst: jest.fn(async () => opts.vigente ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: 10n, detalle: [], ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ ...(opts.vigente ?? {}), id: where.id, ...data })),
    },
    propinaRepartoDetalle: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async ({ data }: any) => ({ count: data.length })),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => opts.detalleMi ?? []),
    },
    person: {
      findMany: jest.fn(async () => opts.personas ?? []),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async () => ({})),
    },
    userAccount: { findMany: jest.fn(async () => (opts.cuentas ?? []).map((c) => ({ rolesExtra: [], ...c }))) },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  const propinas: any = { resumenMes: jest.fn(async () => ({ total: opts.total ?? 0 })) };
  const asistencia: any = { horasTrabajadasDelMes: jest.fn(async () => opts.horas ?? []) };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  const servicio = new PropinasRepartoService(prisma, propinas, asistencia, auditoria);
  return { servicio, prisma, auditoria };
}

const persona = (id: number, nombre: string, extra: Partial<{ horas: number; inc: number; rev: number }> = {}): Horas => ({
  partyId: id,
  nombre,
  horasTrabajadas: extra.horas ?? 0,
  horasProgramadas: extra.horas ?? 0,
  diasTrabajados: 0,
  jornadasIncompletas: extra.inc ?? 0,
  jornadasARevisar: extra.rev ?? 0,
});

const personasDe = (ids: number[], nombres: string[]) =>
  ids.map((id, i) => ({ party_id: BigInt(id), nombres: nombres[i], apellidos: null, participa_propinas: null }));

describe('mesTerminado (día calendario de Lima)', () => {
  it('un mes termina a partir del día 1 del mes siguiente', () => {
    expect(mesTerminado(2026, 11, new Date('2026-12-01T04:59:00Z'))).toBe(false); // 30 nov 23:59 Lima: aún no
    expect(mesTerminado(2026, 11, new Date('2026-12-01T05:01:00Z'))).toBe(true); // 1 dic 00:01 Lima
    expect(mesTerminado(2026, 12, new Date('2026-12-02T15:00:00Z'))).toBe(false);
    expect(mesTerminado(2026, 11, new Date('2026-11-15T15:00:00Z'))).toBe(false);
  });
});

describe('PropinasRepartoService: cálculo proporcional', () => {
  it('reparte en proporción a las horas (3, 5 y 7 días) y la suma es exacta', async () => {
    const { servicio } = crear({
      total: 150,
      horas: [persona(1, 'Luis', { horas: 24 }), persona(2, 'Ana', { horas: 40 }), persona(3, 'Rosa', { horas: 56 })],
      personas: personasDe([1, 2, 3], ['Luis', 'Ana', 'Rosa']),
    });
    const v = await servicio.vista(2026, 11, AHORA);
    expect(v.previa.error).toBeNull();
    expect(v.previa.totalHoras).toBe(120);
    expect(v.previa.filas.map((f) => [f.nombre, f.monto, f.porcentaje])).toEqual([
      ['Luis', 30, 20],
      ['Ana', 50, 33.3333],
      ['Rosa', 70, 46.6667],
    ]);
    expect(v.previa.filas.reduce((a, f) => a + Math.round(f.monto * 100), 0)).toBe(15000);
  });

  it('la vista previa no guarda nada', async () => {
    const { servicio, prisma } = crear({ total: 10, horas: [persona(1, 'Luis', { horas: 8 })], personas: personasDe([1], ['Luis']) });
    await servicio.vista(2026, 11, AHORA);
    expect(prisma.propinaReparto.create).not.toHaveBeenCalled();
    expect(prisma.propinaReparto.update).not.toHaveBeenCalled();
  });

  it('personas con 0 horas no reciben', async () => {
    const { servicio } = crear({
      total: 20,
      horas: [persona(1, 'Luis', { horas: 0 }), persona(2, 'Ana', { horas: 10 })],
      personas: personasDe([1, 2], ['Luis', 'Ana']),
    });
    const v = await servicio.vista(2026, 11, AHORA);
    expect(v.previa.filas.map((f) => f.partyId)).toEqual([2]);
    expect(v.previa.filas[0].monto).toBe(20);
  });

  it('ADMIN queda fuera; con excepción true entra; con excepción false un trabajador queda fuera', async () => {
    const { servicio } = crear({
      total: 60,
      horas: [persona(1, 'Jefe', { horas: 10 }), persona(2, 'Ana', { horas: 10 }), persona(3, 'Rosa', { horas: 10 }), persona(4, 'Eva', { horas: 10 })],
      personas: [
        { party_id: 1n, nombres: 'Jefe', apellidos: null, participa_propinas: null },
        { party_id: 2n, nombres: 'Ana', apellidos: null, participa_propinas: true },
        { party_id: 3n, nombres: 'Rosa', apellidos: null, participa_propinas: false },
        { party_id: 4n, nombres: 'Eva', apellidos: null, participa_propinas: null },
      ],
      cuentas: [
        { party_id: 1n, rol: 'ADMIN' },
        { party_id: 2n, rol: 'ADMIN' },
        { party_id: 3n, rol: 'CAJERO' },
        { party_id: 4n, rol: 'MOZO' },
      ],
    });
    const v = await servicio.vista(2026, 11, AHORA);
    expect(v.previa.filas.map((f) => f.partyId).sort()).toEqual([2, 4]);
    expect(v.previa.excluidos).toEqual([
      { partyId: 1, nombre: 'Jefe', motivo: 'ADMIN', participa: null },
      { partyId: 3, nombre: 'Rosa', motivo: 'EXCLUIDO_POR_ADMIN', participa: false },
    ]);
  });

  it('un ADMIN con rol extra también queda fuera', async () => {
    const { servicio } = crear({
      total: 10,
      horas: [persona(1, 'Jefe', { horas: 10 }), persona(2, 'Ana', { horas: 10 })],
      personas: personasDe([1, 2], ['Jefe', 'Ana']),
      cuentas: [{ party_id: 1n, rol: 'CAJERO', rolesExtra: [{ rol: 'ADMIN' }] }, { party_id: 2n, rol: 'MOZO' }],
    });
    const v = await servicio.vista(2026, 11, AHORA);
    expect(v.previa.excluidos.map((e) => e.partyId)).toEqual([1]);
    expect(v.previa.filas.map((f) => f.partyId)).toEqual([2]);
  });

  it('avisos por jornadas incompletas o a revisar de cada persona', async () => {
    const { servicio } = crear({
      total: 10,
      horas: [persona(2, 'Juan', { horas: 10, inc: 3, rev: 1 })],
      personas: personasDe([2], ['Juan']),
    });
    const v = await servicio.vista(2026, 11, AHORA);
    expect(v.previa.avisos).toEqual(['3 jornadas de Juan están INCOMPLETO', '1 jornada de Juan están A REVISAR']);
  });

  it('propinas sin horas trabajadas o sin participantes dan error claro y no se calcula', async () => {
    const sinHoras = crear({ total: 30, horas: [persona(2, 'Ana', { horas: 0 })], personas: personasDe([2], ['Ana']) });
    await expect(sinHoras.servicio.calcular(2026, 11, ADMIN, undefined, AHORA)).rejects.toMatchObject({
      response: { codigo: 'SIN_HORAS' },
    });
    const sinParticipantes = crear({
      total: 30,
      horas: [persona(1, 'Jefe', { horas: 10 })],
      personas: personasDe([1], ['Jefe']),
      cuentas: [{ party_id: 1n, rol: 'ADMIN' }],
    });
    await expect(sinParticipantes.servicio.calcular(2026, 11, ADMIN, undefined, AHORA)).rejects.toMatchObject({
      response: { codigo: 'SIN_PARTICIPANTES' },
    });
    expect(sinParticipantes.prisma.propinaReparto.create).not.toHaveBeenCalled();
  });
});

describe('PropinasRepartoService: estados', () => {
  it('calcular guarda un BORRADOR con su detalle y audita', async () => {
    const { servicio, prisma, auditoria } = crear({
      total: 150,
      horas: [persona(1, 'Luis', { horas: 24 }), persona(2, 'Ana', { horas: 40 })],
      personas: personasDe([1, 2], ['Luis', 'Ana']),
    });
    await servicio.calcular(2026, 11, ADMIN, undefined, AHORA);
    expect(prisma.propinaReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ anio: 2026, mes: 11, estado: 'BORRADOR', total_propinas: 150, calculado_por: 1n }),
    });
    expect(prisma.propinaRepartoDetalle.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'propinas', accion: 'CALCULAR_REPARTO' }));
  });

  it('un solo reparto vigente por mes: solo cuenta el que no está ANULADO', async () => {
    const { servicio, prisma } = crear({ total: 10, horas: [persona(1, 'Luis', { horas: 8 })], personas: personasDe([1], ['Luis']) });
    await servicio.calcular(2026, 11, ADMIN, undefined, AHORA);
    expect(prisma.propinaReparto.findFirst.mock.calls[0][0].where).toEqual({ anio: 2026, mes: 11, estado: { not: 'ANULADO' } });
  });

  it('recalcular un BORRADOR lo reemplaza (no crea otro)', async () => {
    const vigente = { id: 10n, estado: 'BORRADOR' };
    const { servicio, prisma } = crear({
      total: 10,
      horas: [persona(1, 'Luis', { horas: 8 })],
      personas: personasDe([1], ['Luis']),
      vigente,
    });
    await servicio.calcular(2026, 11, ADMIN, undefined, AHORA);
    expect(prisma.propinaReparto.create).not.toHaveBeenCalled();
    expect(prisma.propinaRepartoDetalle.deleteMany).toHaveBeenCalledWith({ where: { reparto_id: 10n } });
    expect(prisma.propinaReparto.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 10n } }));
  });

  it('un reparto aprobado o pagado no se vuelve a calcular', async () => {
    const { servicio } = crear({
      total: 10,
      horas: [persona(1, 'Luis', { horas: 8 })],
      personas: personasDe([1], ['Luis']),
      vigente: { id: 10n, estado: 'APROBADO', detalle: [] },
    });
    await expect(servicio.calcular(2026, 11, ADMIN, undefined, AHORA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('no se calcula ni aprueba el mes en curso', async () => {
    const { servicio } = crear({ total: 10, horas: [persona(1, 'Luis', { horas: 8 })], personas: personasDe([1], ['Luis']) });
    await expect(servicio.calcular(2026, 12, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'MES_EN_CURSO' } });
    await expect(servicio.aprobar(2026, 12, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'MES_EN_CURSO' } });
  });

  it('aprobar congela el borrador si las cifras no cambiaron, y rechaza si cambiaron', async () => {
    const detalle = [{ party_id: 1n, horas: 24, porcentaje: 20, monto: 30 }, { party_id: 2n, horas: 96, porcentaje: 80, monto: 120 }];
    const ok = crear({
      total: 150,
      horas: [persona(1, 'Luis', { horas: 24 }), persona(2, 'Ana', { horas: 96 })],
      personas: personasDe([1, 2], ['Luis', 'Ana']),
      vigente: { id: 10n, estado: 'BORRADOR', total_propinas: 150, detalle },
    });
    await ok.servicio.aprobar(2026, 11, ADMIN, undefined, AHORA);
    expect(ok.prisma.propinaReparto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'APROBADO', aprobado_por: 1n }) }),
    );

    const cambio = crear({
      total: 150,
      horas: [persona(1, 'Luis', { horas: 40 }), persona(2, 'Ana', { horas: 96 })],
      personas: personasDe([1, 2], ['Luis', 'Ana']),
      vigente: { id: 10n, estado: 'BORRADOR', total_propinas: 150, detalle },
    });
    await expect(cambio.servicio.aprobar(2026, 11, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'CIFRAS_CAMBIARON' } });
  });

  it('pagar: parcial deja el reparto aprobado; con todas las personas pasa a PAGADO', async () => {
    const detalle = [
      { party_id: 1n, horas: 24, porcentaje: 20, monto: 30, pagado_en: null },
      { party_id: 2n, horas: 96, porcentaje: 80, monto: 120, pagado_en: null },
    ];
    const { servicio, prisma } = crear({ vigente: { id: 10n, estado: 'APROBADO', detalle } });
    const parcial = await servicio.pagar(2026, 11, { medio: 'EFECTIVO', partyIds: [1] }, ADMIN, undefined, AHORA);
    expect(parcial).toMatchObject({ pagadas: 1, completo: false });
    expect(prisma.propinaReparto.update).not.toHaveBeenCalled();

    const resto = await servicio.pagar(2026, 11, { medio: 'YAPE', nota: 'lote 2' }, ADMIN, undefined, AHORA);
    expect(resto).toMatchObject({ pagadas: 2, completo: true });
    expect(prisma.propinaReparto.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'PAGADO' }) }));
  });

  it('pagar exige un reparto aprobado y un medio válido', async () => {
    const borrador = crear({ vigente: { id: 10n, estado: 'BORRADOR', detalle: [] } });
    await expect(borrador.servicio.pagar(2026, 11, { medio: 'EFECTIVO' }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'NO_APROBADO' } });
    const aprobado = crear({ vigente: { id: 10n, estado: 'APROBADO', detalle: [{ party_id: 1n, pagado_en: null }] } });
    await expect(aprobado.servicio.pagar(2026, 11, { medio: 'BITCOIN' }, ADMIN, undefined, AHORA)).rejects.toMatchObject({ response: { codigo: 'MEDIO_INVALIDO' } });
  });

  it('anular con motivo libera el mes; no se anula si ya hay pagos', async () => {
    const { servicio, prisma } = crear({ vigente: { id: 10n, estado: 'BORRADOR', detalle: [] } });
    await servicio.anular(2026, 11, 'Horas mal cargadas', ADMIN, undefined, AHORA);
    expect(prisma.propinaReparto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO', motivo_anulacion: 'Horas mal cargadas' }) }),
    );

    const pagado = crear({ vigente: { id: 10n, estado: 'APROBADO', detalle: [{ party_id: 1n, pagado_en: new Date() }] } });
    await expect(pagado.servicio.anular(2026, 11, 'motivo válido', ADMIN, undefined, AHORA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('CSV del reparto vigente con nombres y montos', async () => {
    const { servicio } = crear({
      vigente: {
        id: 10n,
        anio: 2026,
        mes: 11,
        estado: 'APROBADO',
        total_propinas: 150,
        total_horas: 120,
        calculado_en: AHORA,
        aprobado_en: AHORA,
        pagado_en: null,
        detalle: [{ party_id: 1n, horas: 24, porcentaje: 20, monto: 30, pagado_en: null, pagado_medio: null, nota: null }],
      },
      personas: personasDe([1], ['Luis']),
    });
    const r = await servicio.csv(2026, 11);
    expect(r.nombre).toBe('propinas-2026-11.csv');
    expect(r.csv.split('\n')[1]).toBe('Luis,24,20,30,,,');
  });
});

describe('PropinasRepartoService: trabajador y permisos', () => {
  it('«Mi asistencia» consulta solo las filas de la propia persona en repartos aprobados o pagados', async () => {
    const { servicio, prisma } = crear({
      detalleMi: [
        {
          party_id: 7n,
          horas: 24,
          porcentaje: 20,
          monto: 30,
          pagado_en: null,
          pagado_medio: null,
          reparto: { anio: 2026, mes: 10, estado: 'PAGADO' },
        },
      ],
    });
    const filas = await servicio.miPropinas(7n);
    const where = prisma.propinaRepartoDetalle.findMany.mock.calls[0][0].where;
    expect(where.party_id).toBe(7n);
    expect(where.reparto).toEqual({ estado: { in: ['APROBADO', 'PAGADO'] } });
    expect(filas).toEqual([
      { anio: 2026, mes: 10, estado: 'PAGADO', horas: 24, porcentaje: 20, monto: 30, pagadoEn: null, pagadoMedio: null },
    ]);
    expect(Object.keys(filas[0])).not.toEqual(expect.arrayContaining(['totalPropinas', 'filas']));
  });

  it('todos los endpoints del reparto exigen propinas/repartir (solo ADMIN); «mi propinas» exige asistencia/marcar', () => {
    const permisosDe = (clase: any) =>
      Object.getOwnPropertyNames(clase.prototype)
        .filter((m) => m !== 'constructor')
        .map((m) => Reflect.getMetadata(CLAVE_PERMISO, clase.prototype[m]));
    expect(permisosDe(PropinasRepartoController).every((p) => p.modulo === 'propinas' && p.accion === 'repartir')).toBe(true);
    expect(permisosDe(PropinasRepartoController)).toHaveLength(8);
    expect(permisosDe(PropinasMiController)).toEqual([{ modulo: 'asistencia', accion: 'marcar' }]);
  });
});

describe('PropinasRepartoService: fijar excepción por persona', () => {
  it('guarda la excepción (null vuelve a la regla por rol) y audita', async () => {
    const { servicio, prisma, auditoria } = crear();
    prisma.person.findUnique = jest.fn(async () => ({ participa_propinas: null }));
    await servicio.fijarParticipacion(5, true, ADMIN);
    expect(prisma.person.update).toHaveBeenCalledWith({ where: { party_id: 5n }, data: { participa_propinas: true } });
    await servicio.fijarParticipacion(5, null, ADMIN);
    expect(prisma.person.update).toHaveBeenLastCalledWith({ where: { party_id: 5n }, data: { participa_propinas: null } });
    expect(auditoria.registrar).toHaveBeenCalledTimes(2);
  });
});

