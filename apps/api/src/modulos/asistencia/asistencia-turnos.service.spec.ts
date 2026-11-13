jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ConflictException } from '@nestjs/common';
import { AsistenciaTurnosService } from './asistencia-turnos.service';
import { AsistenciaTurnosTarea } from './asistencia-turnos.tarea';

// Datos sintéticos. Hoy = viernes 13/11/2026 12:00 Lima (17:00Z). El turno a cubrir: lunes 16/11 09:00-17:00.
const AHORA = new Date('2026-11-13T17:00:00Z');
const LUNES = '2026-11-16';
const MARTES = '2026-11-17';
const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const A = 1n; // MOZO, pide
const B = 2n; // MOZO libre
const C = 3n; // CAJERO (otro rol)
const K1 = 10n; // COCINA Salado
const K2 = 11n; // COCINA Dulce
const K3 = 12n; // COCINA sin áreas (todas)
const K4 = 13n; // COCINA Salado + Dulce
const ADM = 99n;
const SUP = 50n;

const usuario = (partyId: bigint, rol = 'MOZO') => ({ partyId, rol, roles: [rol], debeCambiar: false }) as any;

function armar(opts: { extraCuentas?: any[] } = {}) {
  const cuentas: any[] = [
    { party_id: A, rol: 'MOZO', activo: true, rolesExtra: [], areasCocina: [] },
    { party_id: B, rol: 'MOZO', activo: true, rolesExtra: [], areasCocina: [] },
    { party_id: C, rol: 'CAJERO', activo: true, rolesExtra: [], areasCocina: [] },
    { party_id: K1, rol: 'COCINA', activo: true, rolesExtra: [], areasCocina: [{ area_id: 1n, area: { nombre: 'Salado' } }] },
    { party_id: K2, rol: 'COCINA', activo: true, rolesExtra: [], areasCocina: [{ area_id: 2n, area: { nombre: 'Dulce' } }] },
    { party_id: K3, rol: 'COCINA', activo: true, rolesExtra: [], areasCocina: [] },
    { party_id: K4, rol: 'COCINA', activo: true, rolesExtra: [], areasCocina: [{ area_id: 1n, area: { nombre: 'Salado' } }, { area_id: 2n, area: { nombre: 'Dulce' } }] },
    { party_id: ADM, rol: 'ADMIN', activo: true, rolesExtra: [], areasCocina: [] },
    { party_id: SUP, rol: 'SUPERVISOR', activo: true, rolesExtra: [], areasCocina: [] },
    ...(opts.extraCuentas ?? []),
  ];
  const bd = {
    cuentas,
    horarios: [
      { party_id: A, dia_semana: 1, entrada: t('09:00'), salida: t('17:00'), almuerzo_inicio: null, almuerzo_fin: null },
      { party_id: K1, dia_semana: 1, entrada: t('08:00'), salida: t('16:00'), almuerzo_inicio: null, almuerzo_fin: null },
      // B trabaja los martes (para el cambio de turno): 10:00-18:00
      { party_id: B, dia_semana: 2, entrada: t('10:00'), salida: t('18:00'), almuerzo_inicio: null, almuerzo_fin: null },
    ] as any[],
    coberturas: [] as any[],
    reemplazos: [] as any[],
    vacaciones: [] as any[],
    vinculos: [] as any[],
    solicitudes: [] as any[],
    marcas: [] as any[],
    notificaciones: [] as any[],
    coberturaSeq: 100n,
  };
  const cumple = (fila: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (k === 'OR') return true;
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(fila[k]);
      if (v === undefined) return true;
      if (v instanceof Date) return fila[k] instanceof Date && fila[k].getTime() === v.getTime();
      if (v && typeof v === 'object') return true; // rangos y not: la prueba fija el contexto
      return fila[k] === v;
    });
  const prisma: any = {
    userAccount: { findMany: jest.fn(async ({ where }: any) => bd.cuentas.filter((c) => c.activo && cumple(c, where?.party_id ? { party_id: where.party_id } : {}))) },
    person: { findMany: jest.fn(async ({ where }: any) => bd.cuentas.filter((c) => where.party_id.in.includes(c.party_id)).map((c) => ({ party_id: c.party_id, nombres: `P${c.party_id}`, apellidos: '' }))) },
    horarioTrabajo: { findMany: jest.fn(async () => bd.horarios) },
    coberturaTurno: {
      findMany: jest.fn(async () => bd.coberturas),
      create: jest.fn(async ({ data }: any) => { const c = { id: bd.coberturaSeq++, ...data }; bd.coberturas.push(c); return c; }),
    },
    reemplazoDia: { findMany: jest.fn(async () => bd.reemplazos) },
    vacacionMovimiento: { findMany: jest.fn(async () => bd.vacaciones) },
    vinculoPersonal: { findMany: jest.fn(async () => bd.vinculos) },
    asistenciaMarca: { findFirst: jest.fn(async ({ where }: any) => bd.marcas.find((m) => m.party_id === where.party_id) ?? null) },
    notificacion: { create: jest.fn(async ({ data }: any) => { bd.notificaciones.push(data); return { id: BigInt(bd.notificaciones.length) }; }) },
    solicitudTurno: {
      count: jest.fn(async ({ where }: any) => bd.solicitudes.filter((s) => s.solicitante_party_id === where.solicitante_party_id).length),
      findMany: jest.fn(async ({ where }: any) => bd.solicitudes.filter((s) => cumple(s, where))),
      findUnique: jest.fn(async ({ where }: any) => bd.solicitudes.find((s) => s.id === where.id) ?? null),
      create: jest.fn(async ({ data }: any) => { const s = { id: BigInt(bd.solicitudes.length + 1), aceptada_en: null, resuelta_por: null, resuelta_en: null, motivo_resolucion: null, cobertura_ids: null, sin_marca_en: null, creada_en: AHORA, fecha_devolucion: null, desde_devolucion: null, hasta_devolucion: null, ...data }; bd.solicitudes.push(s); return s; }),
      update: jest.fn(async ({ where, data }: any) => { const s = bd.solicitudes.find((x) => x.id === where.id); Object.assign(s, data); return s; }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = bd.solicitudes.filter((s) => s.id === where.id && (typeof where.estado === 'string' ? s.estado === where.estado : where.estado.in.includes(s.estado)));
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const asistencia = {
    obtenerConfig: jest.fn(async () => ({ toleranciaMin: 5 })),
    cuentas: jest.fn(async (ids: bigint[]) => new Map(ids.map((i) => [i, { nombre: `P${i}` }]))),
  };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const servicio = new AsistenciaTurnosService(prisma, asistencia as any, auditoria as any, undefined);
  return { servicio, prisma, bd, auditoria };
}

const dto = (extra: Record<string, unknown> = {}) => ({
  tipo: 'REEMPLAZO' as const, reemplazoPartyId: 2, fecha: LUNES, desde: '09:00', hasta: '17:00', motivo: 'Cita médica', ...extra,
});
const codigo = async (p: Promise<unknown>) => p.then(() => null, (e) => e.getResponse?.().codigo ?? e.message);

describe('elegibilidad (candidatos)', () => {
  const q = { fecha: LUNES, desde: '09:00', hasta: '17:00' };
  const ids = (r: any) => r.candidatos.map((c: any) => c.partyId);

  it('no cocina: solo quien comparte un rol y está libre; nunca ADMIN ni uno mismo', async () => {
    const { servicio } = armar();
    const r = await servicio.candidatos(A, q, AHORA);
    expect(ids(r)).toEqual([2]);
    expect(r.candidatos[0].motivos).toEqual(['Mismo rol: Mozo']);
    expect(r.descartados.find((x) => x.motivo === 'No comparte tu rol')?.cantidad).toBeGreaterThan(0);
  });

  it('un rol extra cuenta como rol en común', async () => {
    const { servicio, bd } = armar();
    bd.cuentas.find((c) => c.party_id === C)!.rolesExtra = [{ rol: 'MOZO' }];
    expect(ids(await servicio.candidatos(A, q, AHORA))).toEqual([2, 3]);
  });

  it('cocina con área: exige al menos un área en común (cocina sin áreas = todas)', async () => {
    const { servicio } = armar();
    const r = await servicio.candidatos(K1, { fecha: LUNES, desde: '08:00', hasta: '16:00' }, AHORA);
    expect(ids(r)).toEqual([12, 13]); // K3 (todas) y K4 (Salado+Dulce); K2 (solo Dulce), mozos y cajeros no
    expect(r.candidatos.find((c) => c.partyId === 13)!.motivos).toEqual(['Misma área: Salado']);
    expect(r.candidatos.find((c) => c.partyId === 12)!.motivos).toEqual(['Cocina: todas las áreas']);
    expect(r.descartados.map((x) => x.motivo)).toEqual(expect.arrayContaining(['No comparte tu área de cocina', 'No es de tu área de cocina']));
  });

  it('descarta a quien tiene turno propio ese día, vacaciones, otra cobertura, suplencia fija o un pedido solapado', async () => {
    const { servicio, bd } = armar();
    const motivos = async () => (await servicio.candidatos(A, q, AHORA)).descartados.map((x) => x.motivo);
    bd.horarios.push({ party_id: B, dia_semana: 1, entrada: t('18:00'), salida: t('22:00'), almuerzo_inicio: null, almuerzo_fin: null });
    expect(ids(await servicio.candidatos(A, q, AHORA))).toEqual([]);
    expect(await motivos()).toContain('Ya tiene turno ese día');
    bd.horarios.pop();

    bd.vacaciones.push({ party_id: B, fecha_desde: d(LUNES), fecha_hasta: d(LUNES) });
    expect(await motivos()).toContain('Está de vacaciones o licencia ese día');
    bd.vacaciones.pop();

    bd.coberturas.push({ id: 1n, fecha: d(LUNES), cubre_party_id: B, reemplaza_party_id: 77n, desde: t('09:00'), hasta: t('12:00') });
    expect(await motivos()).toContain('Ya tiene turno ese día');
    bd.coberturas.pop();

    bd.reemplazos.push({ party_id: 77n, dia_semana: 1, reemplaza_party_id: B });
    expect(await motivos()).toContain('Es suplente fijo ese día');
    bd.reemplazos.pop();

    bd.vinculos.push({ party_id: B, fecha_fin: d('2026-11-14') });
    expect(await motivos()).toContain('Ya no tiene vínculo vigente');
    bd.vinculos.pop();

    bd.solicitudes.push({ id: 9n, tipo: 'REEMPLAZO', estado: 'PENDIENTE_ACEPTA', solicitante_party_id: 77n, reemplazo_party_id: B, fecha: d(LUNES), desde: t('16:00'), hasta: t('20:00') });
    expect(await motivos()).toContain('Ya tiene otro pedido de turno en ese horario');
    // sin solape de horas sí está libre
    bd.solicitudes[0].desde = t('17:00');
    expect(ids(await servicio.candidatos(A, q, AHORA))).toEqual([2]);
  });

  it('ventana parcial: vale si toca el inicio o el final del turno; no en el medio ni fuera', async () => {
    const { servicio } = armar();
    expect(ids(await servicio.candidatos(A, { fecha: LUNES, desde: '13:00', hasta: '17:00' }, AHORA))).toEqual([2]);
    expect(ids(await servicio.candidatos(A, { fecha: LUNES, desde: '09:00', hasta: '12:00' }, AHORA))).toEqual([2]);
    expect((await servicio.candidatos(A, { fecha: LUNES, desde: '11:00', hasta: '14:00' }, AHORA)).aviso).toMatch(/inicio o hasta el final/);
    expect((await servicio.candidatos(A, { fecha: LUNES, desde: '08:00', hasta: '17:00' }, AHORA)).aviso).toMatch(/dentro del turno/);
  });

  it('si el solicitante no tiene turno ese día lo dice y no ofrece a nadie', async () => {
    const { servicio } = armar();
    const r = await servicio.candidatos(A, { fecha: MARTES, desde: '09:00', hasta: '17:00' }, AHORA);
    expect(r.candidatos).toEqual([]);
    expect(r.aviso).toMatch(/no tiene turno/);
  });
});

describe('crear', () => {
  it('guarda PENDIENTE_ACEPTA, avisa al elegido por campanita y audita solo ids', async () => {
    const { servicio, bd, auditoria } = armar();
    const r = await servicio.crear(dto(), usuario(A), '1.1.1.1', AHORA);
    expect(r.ok).toBe(true);
    expect(bd.solicitudes[0].estado).toBe('PENDIENTE_ACEPTA');
    expect(bd.notificaciones).toEqual([expect.objectContaining({ tipo: 'TURNO_PEDIDO', party_destino: B })]);
    const aud = (auditoria.registrar.mock.calls as any[][])[0][0];
    expect(aud).toMatchObject({ accion: 'SOLICITAR_TURNO', entidad: 'solicitud_turno', partyId: A });
    expect(JSON.stringify(aud.despues, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))).not.toMatch(/"P1|"P2/); // sin nombres
  });

  it('valida en el servidor: no elegible, fecha pasada, muy adelante, ADMIN, motivo corto, duplicado y tope diario', async () => {
    const { servicio, bd } = armar();
    expect(await codigo(servicio.crear(dto({ reemplazoPartyId: 3 }), usuario(A), undefined, AHORA))).toBe('REEMPLAZO_NO_ELEGIBLE');
    expect(await codigo(servicio.crear(dto({ fecha: '2026-11-12' }), usuario(A), undefined, AHORA))).toBe('FECHA_PASADA');
    expect(await codigo(servicio.crear(dto({ fecha: '2027-01-11' }), usuario(A), undefined, AHORA))).toBe('MUY_ADELANTE');
    expect(await codigo(servicio.crear(dto(), usuario(ADM, 'ADMIN'), undefined, AHORA))).toBe('ADMIN_NO_TURNOS');
    expect(await codigo(servicio.crear(dto({ motivo: 'no' }), usuario(A), undefined, AHORA))).toBe('MOTIVO_REQUERIDO');
    expect(await codigo(servicio.crear(dto({ reemplazoPartyId: 1 }), usuario(A), undefined, AHORA))).toBe('MISMA_PERSONA');
    expect(bd.solicitudes).toHaveLength(0);
    await servicio.crear(dto(), usuario(A), undefined, AHORA);
    expect(await codigo(servicio.crear(dto({ desde: '12:00' }), usuario(A), undefined, AHORA))).toBe('SOLICITUD_DUPLICADA');
    bd.solicitudes.length = 0;
    for (let i = 0; i < 10; i++) bd.solicitudes.push({ id: BigInt(i + 1), solicitante_party_id: A, estado: 'CANCELADA', fecha: d('2026-11-30'), desde: t('09:00'), hasta: t('10:00') });
    expect(await codigo(servicio.crear(dto(), usuario(A), undefined, AHORA))).toBe('DEMASIADOS_PEDIDOS');
  });

  it('cambio de turno: pide el turno de vuelta y valida las dos direcciones', async () => {
    const { servicio, bd } = armar();
    const cambio = dto({ tipo: 'CAMBIO_TURNO', fechaDevolucion: MARTES, desdeDevolucion: '10:00', hastaDevolucion: '18:00' });
    expect(await codigo(servicio.crear(dto({ tipo: 'CAMBIO_TURNO' }), usuario(A), undefined, AHORA))).toBe('DEVOLUCION_REQUERIDA');
    // A tiene turno el martes: no está libre para cubrir a B
    bd.horarios.push({ party_id: A, dia_semana: 2, entrada: t('09:00'), salida: t('17:00'), almuerzo_inicio: null, almuerzo_fin: null });
    expect(await codigo(servicio.crear(cambio, usuario(A), undefined, AHORA))).toBe('REEMPLAZO_NO_ELEGIBLE');
    bd.horarios.pop();
    // el martes B no tiene ese horario: no hay turno que devolver
    expect(await codigo(servicio.crear({ ...cambio, desdeDevolucion: '12:00', hastaDevolucion: '16:00' }, usuario(A), undefined, AHORA))).toBe('REEMPLAZO_NO_ELEGIBLE');
    expect(await codigo(servicio.crear(cambio, usuario(A), undefined, AHORA))).toBeNull();
    expect(bd.solicitudes[0]).toMatchObject({ tipo: 'CAMBIO_TURNO', estado: 'PENDIENTE_ACEPTA' });
  });
});

describe('flujo: aceptar, rechazar, cancelar, aprobar', () => {
  async function conPedido(extra: Record<string, unknown> = {}) {
    const ctx = armar();
    await ctx.servicio.crear(dto(extra), usuario(A), undefined, AHORA);
    ctx.bd.notificaciones.length = 0;
    return ctx;
  }

  it('solo el elegido acepta; pasa a PENDIENTE_APRUEBA y avisa a Supervisión', async () => {
    const { servicio, bd } = await conPedido();
    expect(await codigo(servicio.aceptar(1, usuario(C, 'CAJERO'), undefined, AHORA))).toBe('TURNO_AJENO');
    expect(await codigo(servicio.aceptar(1, usuario(A), undefined, AHORA))).toBe('TURNO_AJENO');
    expect(await codigo(servicio.aprobar(1, undefined, usuario(SUP, 'SUPERVISOR'), undefined, AHORA))).toBe('ESTADO_NO_PERMITIDO');
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    expect(bd.solicitudes[0].estado).toBe('PENDIENTE_APRUEBA');
    expect(bd.notificaciones).toEqual([expect.objectContaining({ tipo: 'TURNO_POR_APROBAR', rol_destino: 'SUPERVISOR' })]);
    expect(await codigo(servicio.aceptar(1, usuario(B), undefined, AHORA))).toBe('ESTADO_NO_PERMITIDO');
  });

  it('el elegido puede rechazar (avisa al solicitante) y nadie más', async () => {
    const { servicio, bd } = await conPedido();
    expect(await codigo(servicio.rechazar(1, usuario(A), undefined, AHORA))).toBe('TURNO_AJENO');
    await servicio.rechazar(1, usuario(B), undefined, AHORA);
    expect(bd.solicitudes[0].estado).toBe('RECHAZADA');
    expect(bd.notificaciones).toEqual([expect.objectContaining({ tipo: 'TURNO_RESUELTO', party_destino: A })]);
  });

  it('solo el solicitante cancela, y solo antes de la aprobación', async () => {
    const { servicio, bd } = await conPedido();
    expect(await codigo(servicio.cancelar(1, usuario(B), undefined, AHORA))).toBe('TURNO_AJENO');
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    await servicio.aprobar(1, undefined, usuario(SUP, 'SUPERVISOR'), undefined, AHORA);
    expect(await codigo(servicio.cancelar(1, usuario(A), undefined, AHORA))).toBe('ESTADO_NO_PERMITIDO');
    expect(bd.solicitudes[0].estado).toBe('APROBADA');
  });

  it('cancelar a tiempo avisa al elegido', async () => {
    const { servicio, bd } = await conPedido();
    await servicio.cancelar(1, usuario(A), undefined, AHORA);
    expect(bd.solicitudes[0].estado).toBe('CANCELADA');
    expect(bd.notificaciones[0]).toMatchObject({ party_destino: B });
  });

  it('aprobar crea UNA cobertura (cubre el reemplazo, reemplaza al solicitante) y avisa a ambos', async () => {
    const { servicio, bd } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    bd.notificaciones.length = 0;
    const r = await servicio.aprobar(1, 'ok', usuario(SUP, 'SUPERVISOR'), undefined, AHORA);
    expect(r.coberturas).toHaveLength(1);
    expect(bd.coberturas).toEqual([expect.objectContaining({ fecha: d(LUNES), cubre_party_id: B, reemplaza_party_id: A, por: SUP })]);
    expect(bd.solicitudes[0]).toMatchObject({ estado: 'APROBADA', resuelta_por: SUP, cobertura_ids: [100] });
    expect(bd.notificaciones.map((n) => n.party_destino).sort()).toEqual([A, B]);
  });

  it('un cambio de turno aprobado crea DOS coberturas, una en cada dirección', async () => {
    const { servicio, bd } = await conPedido({ tipo: 'CAMBIO_TURNO', fechaDevolucion: MARTES, desdeDevolucion: '10:00', hastaDevolucion: '18:00' });
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    await servicio.aprobar(1, undefined, usuario(ADM, 'ADMIN'), undefined, AHORA);
    expect(bd.coberturas).toHaveLength(2);
    expect(bd.coberturas[0]).toMatchObject({ fecha: d(LUNES), cubre_party_id: B, reemplaza_party_id: A });
    expect(bd.coberturas[1]).toMatchObject({ fecha: d(MARTES), cubre_party_id: A, reemplaza_party_id: B, desde: t('10:00'), hasta: t('18:00') });
  });

  it('rechazar por Supervisión exige motivo, avisa a los dos y no crea cobertura', async () => {
    const { servicio, bd } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    bd.notificaciones.length = 0;
    expect(await codigo(servicio.rechazarAdmin(1, 'no', usuario(SUP, 'SUPERVISOR'), undefined, AHORA))).toBe('MOTIVO_REQUERIDO');
    await servicio.rechazarAdmin(1, 'Falta personal ese día', usuario(SUP, 'SUPERVISOR'), undefined, AHORA);
    expect(bd.solicitudes[0]).toMatchObject({ estado: 'RECHAZADA', motivo_resolucion: 'Falta personal ese día' });
    expect(bd.coberturas).toHaveLength(0);
    expect(bd.notificaciones).toHaveLength(2);
  });

  it('quien participa no puede resolver su propio pedido', async () => {
    const { servicio } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    expect(await codigo(servicio.aprobar(1, undefined, usuario(B), undefined, AHORA))).toBe('TURNO_PROPIO');
    expect(await codigo(servicio.rechazarAdmin(1, 'motivo largo', usuario(A), undefined, AHORA))).toBe('TURNO_PROPIO');
  });

  it('carrera: si al aprobar el reemplazo ya no está libre, 409 y no se crea nada', async () => {
    const { servicio, bd } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    bd.vacaciones.push({ party_id: B, fecha_desde: d(LUNES), fecha_hasta: d(LUNES) });
    await expect(servicio.aprobar(1, undefined, usuario(SUP, 'SUPERVISOR'), undefined, AHORA)).rejects.toBeInstanceOf(ConflictException);
    expect(bd.coberturas).toHaveLength(0);
    expect(bd.solicitudes[0].estado).toBe('PENDIENTE_APRUEBA');
  });

  it('carrera: dos aprobaciones que chocan (P2034) responden CONDICIONES_CAMBIARON', async () => {
    const { servicio, prisma } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('serialización'), { code: 'P2034' }));
    expect(await codigo(servicio.aprobar(1, undefined, usuario(SUP, 'SUPERVISOR'), undefined, AHORA))).toBe('CONDICIONES_CAMBIARON');
  });

  it('aprobar usa una transacción serializable', async () => {
    const { servicio, prisma } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    await servicio.aprobar(1, undefined, usuario(SUP, 'SUPERVISOR'), undefined, AHORA);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('si el turno ya empezó, aceptar responde 409 y el pedido pasa a VENCIDA', async () => {
    const { servicio, bd } = await conPedido();
    const tarde = new Date('2026-11-16T15:00:00Z'); // 10:00 Lima del lunes
    expect(await codigo(servicio.aceptar(1, usuario(B), undefined, tarde))).toBe('SOLICITUD_VENCIDA');
    expect(bd.solicitudes[0].estado).toBe('VENCIDA');
  });

  it('mias y paraAprobar listan con nombres, área y la validación al día', async () => {
    const { servicio } = await conPedido();
    await servicio.aceptar(1, usuario(B), undefined, AHORA);
    const mias = await servicio.mias(B, AHORA);
    expect(mias[0]).toMatchObject({ id: 1, estado: 'PENDIENTE_APRUEBA', soyYoSolicitante: false, solicitante: { partyId: 1 }, area: 'Mozo' });
    const adm = await servicio.paraAprobar(undefined, AHORA);
    expect(adm.toleranciaMin).toBe(5);
    expect(adm.solicitudes[0].validacion).toEqual({ ok: true, problema: null, areaYRol: ['Mismo rol: Mozo'] });
  });
});

describe('tarea: vencimientos y reemplazo que no marcó', () => {
  async function aprobado(extra: Record<string, unknown> = {}) {
    const ctx = armar();
    await ctx.servicio.crear(dto(extra), usuario(A), undefined, AHORA);
    await ctx.servicio.aceptar(1, usuario(B), undefined, AHORA);
    await ctx.servicio.aprobar(1, undefined, usuario(SUP, 'SUPERVISOR'), undefined, AHORA);
    ctx.bd.notificaciones.length = 0;
    return ctx;
  }
  // El turno empieza 09:00 Lima = 14:00Z; tolerancia 5 min
  const A_LAS = (hhmmZ: string) => new Date(`2026-11-16T${hhmmZ}:00Z`);

  it('pasada la tolerancia sin marca: SIN_MARCA una sola vez y avisa a Supervisión y al solicitante (campanita)', async () => {
    const { servicio, bd } = await aprobado();
    expect(await servicio.procesarVencimientos(A_LAS('14:05'))).toEqual({ vencidas: 0, sinMarca: 0 }); // justo en la tolerancia
    expect(await servicio.procesarVencimientos(A_LAS('14:06'))).toEqual({ vencidas: 0, sinMarca: 1 });
    expect(bd.solicitudes[0]).toMatchObject({ estado: 'SIN_MARCA' });
    expect(bd.solicitudes[0].sin_marca_en).toBeInstanceOf(Date);
    expect(bd.notificaciones).toEqual([
      expect.objectContaining({ tipo: 'TURNO_SIN_MARCA', rol_destino: 'SUPERVISOR' }),
      expect.objectContaining({ tipo: 'TURNO_SIN_MARCA', party_destino: A, titulo: expect.stringContaining('El reemplazo no marcó') }),
    ]);
    // idempotente
    expect(await servicio.procesarVencimientos(A_LAS('15:00'))).toEqual({ vencidas: 0, sinMarca: 0 });
    expect(bd.notificaciones).toHaveLength(2);
  });

  it('si el reemplazo marcó no pasa nada', async () => {
    const { servicio, bd } = await aprobado();
    bd.marcas.push({ party_id: B });
    expect(await servicio.procesarVencimientos(A_LAS('15:00'))).toEqual({ vencidas: 0, sinMarca: 0 });
    expect(bd.solicitudes[0].estado).toBe('APROBADA');
  });

  it('en un cambio de turno revisa también a quien cubre el segundo turno (el solicitante)', async () => {
    const { servicio, bd } = await aprobado({ tipo: 'CAMBIO_TURNO', fechaDevolucion: MARTES, desdeDevolucion: '10:00', hastaDevolucion: '18:00' });
    bd.marcas.push({ party_id: B });
    expect((await servicio.procesarVencimientos(A_LAS('15:00'))).sinMarca).toBe(0);
    // martes 10:00 Lima = 15:00Z; tolerancia hasta 15:05
    expect((await servicio.procesarVencimientos(new Date('2026-11-17T15:06:00Z'))).sinMarca).toBe(1);
    expect(bd.notificaciones[0].titulo).toContain('P1 no marcó');
  });

  it('los pedidos sin aprobar cuyo turno ya empezó pasan a VENCIDA y avisan al solicitante', async () => {
    const ctx = armar();
    await ctx.servicio.crear(dto(), usuario(A), undefined, AHORA);
    ctx.bd.notificaciones.length = 0;
    expect(await ctx.servicio.procesarVencimientos(A_LAS('14:01'))).toEqual({ vencidas: 1, sinMarca: 0 });
    expect(ctx.bd.solicitudes[0].estado).toBe('VENCIDA');
    expect(ctx.bd.notificaciones).toEqual([expect.objectContaining({ party_destino: A })]);
  });

  it('la tarea toma un candado Redis y no corre si otra instancia lo tiene', async () => {
    const procesar = jest.fn(async () => ({ vencidas: 0, sinMarca: 0 }));
    const cliente = { set: jest.fn(async () => null), get: jest.fn(), eval: jest.fn(), del: jest.fn() };
    const tarea = new AsistenciaTurnosTarea({ obtenerCliente: () => cliente } as any, { procesarVencimientos: procesar } as any);
    expect(await tarea.revisar()).toEqual({ ejecutada: false });
    expect(procesar).not.toHaveBeenCalled();
    cliente.set.mockResolvedValueOnce('OK' as any);
    expect((await tarea.revisar()).ejecutada).toBe(true);
    expect(procesar).toHaveBeenCalledTimes(1);
  });
});

