import { HttpException } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaCorreccionesService, momentoDeHora } from './asistencia-correcciones.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

// BD en memoria mínima: cubre las reglas de solicitudes, inconsistencias y cronograma (no el SQL).

type Fila = Record<string, any>;
const LUIS: UsuarioAutenticado = { partyId: 7n, rol: 'MOZO', debeCambiar: false, roles: ['MOZO'] };
const ANA: UsuarioAutenticado = { partyId: 8n, rol: 'MOZO', debeCambiar: false, roles: ['MOZO'] };
const ADMIN: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
const AHORA = new Date('2026-11-09T15:00:00Z'); // lunes 9, 10:00 Lima; la jornada del viernes 6 ya cerró
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const hora = (h: number) => new Date(Date.UTC(1970, 0, 1, h, 0));
/** Marca de celular de Luis el 6/11 a la hora Lima indicada. */
const celular = (id: number, h: number, min = 0): Fila => ({
  id: BigInt(id), party_id: 7n, jornada: dia('2026-11-06'), tipo: 'ENTRADA', origen: 'CELULAR', estado: 'VALIDA',
  momento: momentoDeHora('2026-11-06', `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`).momento, selfie: null,
});

function cumple(f: Fila, where: Fila = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return true;
    const x = f[k];
    if (v instanceof Date) return x instanceof Date && x.getTime() === v.getTime();
    if (v && typeof v === 'object') {
      if ('in' in v) return (v.in as unknown[]).includes(x);
      if ('not' in v) return x !== v.not;
      const t = (d: unknown) => (d instanceof Date ? d.getTime() : (d as number));
      if ('gte' in v && !(t(x) >= t(v.gte))) return false;
      if ('lte' in v && !(t(x) <= t(v.lte))) return false;
      return true;
    }
    return x === v;
  });
}

function montar(opts: { marcas?: Fila[]; pagado?: boolean } = {}) {
  const marcas: Fila[] = opts.marcas ?? [];
  const solicitudes: Fila[] = [];
  let id = 100n;
  const tabla = (filas: Fila[], extra: Fila = {}) => ({
    findMany: async ({ where = {} }: any = {}) => filas.filter((f) => cumple(f, where)),
    findFirst: async ({ where = {} }: any = {}) => filas.find((f) => cumple(f, where)) ?? null,
    findUnique: async ({ where }: any) => filas.find((f) => f.id === where.id) ?? null,
    update: async ({ where, data }: any) => Object.assign(filas.find((f) => f.id === where.id)!, data),
    create: async ({ data }: any) => {
      const fila = { id: id++, creada_en: AHORA, creado_en: AHORA, ...data };
      filas.push(fila);
      return fila;
    },
    count: async ({ where = {} }: any = {}) => filas.filter((f) => cumple(f, where)).length,
    ...extra,
  });
  const horarios = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ party_id: 7n, dia_semana: d, activo: true, entrada: hora(9), salida: hora(18), almuerzo_inicio: hora(13), almuerzo_fin: hora(14) }));
  const pagados: Fila[] = opts.pagado ? [{ id: 5n, party_id: 7n, estado: 'PAGADO', desde: dia('2026-11-02'), hasta: dia('2026-11-08') }] : [];
  const bd: any = {
    parametro: { findUnique: async () => null },
    horarioTrabajo: { findMany: async () => horarios },
    coberturaTurno: { findMany: async () => [] },
    reemplazoDia: { findMany: async () => [] },
    asistenciaMarca: tabla(marcas),
    asistenciaSolicitud: tabla(solicitudes),
    planillaPeriodo: tabla(pagados),
    vacacionMovimiento: { findMany: async () => [] },
    person: { findMany: async () => [{ party_id: 7n, nombres: 'Luis', apellidos: 'Pérez' }] },
    userAccount: { findMany: async () => [{ id: 70n, party_id: 7n, rol: 'MOZO' }] },
    userAccountRol: { findMany: async () => [] },
    $transaction: async (cb: (tx: any) => Promise<unknown>) => cb(bd),
  };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  const asistencia = new AsistenciaService(bd, { get: (_k: string, d: string) => d } as any, auditoria);
  const svc = new AsistenciaCorreccionesService(bd, asistencia, auditoria);
  return { svc, marcas, solicitudes, auditoria };
}

async function error(p: Promise<unknown>): Promise<{ codigo: string }> {
  try {
    await p;
  } catch (e: any) {
    return (e instanceof HttpException ? e.getResponse() : e) as { codigo: string };
  }
  throw new Error('se esperaba un rechazo');
}

const inc = async (svc: AsistenciaCorreccionesService) => (await svc.inconsistencias(7n, AHORA)).filter((i) => i.jornada === '2026-11-06');
const pedir = (over: Fila = {}) => ({ jornada: '2026-11-06', items: [{ tipo: 'SALIDA' as const, hora: '18:00' }], motivo: 'Me olvidé de marcar', ...over });

describe('solicitudes de corrección: crear', () => {
  it('crea una solicitud PENDIENTE con la hora real y no toca las marcas ni el cálculo', async () => {
    const { svc, marcas, solicitudes, auditoria } = montar({ marcas: [celular(1, 9)] });
    const r = await svc.crearSolicitud(pedir(), LUIS, '1.1.1.1', AHORA);
    expect(r.ok).toBe(true);
    expect(solicitudes[0]).toMatchObject({ estado: 'PENDIENTE', party_id: 7n, motivo: 'Me olvidé de marcar' });
    expect(solicitudes[0].items[0]).toMatchObject({ tipo: 'SALIDA', hora: '18:00', momento: '2026-11-06T23:00:00.000Z' });
    expect(marcas).toHaveLength(1);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'SOLICITAR_CORRECCION' }));
  });

  it('rechaza hora futura, jornada futura, jornada muy antigua, motivo corto y al ADMIN', async () => {
    const { svc } = montar();
    expect(await error(svc.crearSolicitud(pedir({ jornada: '2026-11-09', items: [{ tipo: 'SALIDA', hora: '23:00' }] }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'HORA_FUTURA' });
    expect(await error(svc.crearSolicitud(pedir({ jornada: '2026-11-10' }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'JORNADA_FUTURA' });
    expect(await error(svc.crearSolicitud(pedir({ jornada: '2026-10-30' }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'JORNADA_MUY_ANTIGUA' });
    expect(await error(svc.crearSolicitud(pedir({ motivo: 'no' }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'MOTIVO_REQUERIDO' });
    expect(await error(svc.crearSolicitud(pedir(), ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'ADMIN_NO_MARCA' });
  });

  it('la hora de madrugada (02:00) pertenece al día siguiente de la jornada', () => {
    expect(momentoDeHora('2026-11-06', '02:00').momento.toISOString()).toBe('2026-11-07T07:00:00.000Z');
  });

  it('un período PAGADO no admite solicitudes', async () => {
    const { svc } = montar({ pagado: true });
    expect(await error(svc.crearSolicitud(pedir(), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'PERIODO_PAGADO' });
  });

  it('evita duplicadas pendientes para la misma jornada y hora', async () => {
    const { svc } = montar();
    await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    expect(await error(svc.crearSolicitud(pedir(), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'SOLICITUD_DUPLICADA' });
    await expect(svc.crearSolicitud(pedir({ items: [{ tipo: 'SALIDA', hora: '18:30' }] }), LUIS, undefined, AHORA)).resolves.toMatchObject({ ok: true });
  });
});

describe('solicitudes de corrección: cancelar', () => {
  it('la dueña cancela mientras esté pendiente; una ajena es denegada; ya cancelada no se repite', async () => {
    const { svc, solicitudes } = montar();
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    expect(await error(svc.cancelarSolicitud(id, ANA, undefined, AHORA))).toMatchObject({ codigo: 'SOLICITUD_AJENA' });
    await svc.cancelarSolicitud(id, LUIS, undefined, AHORA);
    expect(solicitudes[0].estado).toBe('CANCELADA');
    expect(await error(svc.cancelarSolicitud(id, LUIS, undefined, AHORA))).toMatchObject({ codigo: 'NO_ESTA_PENDIENTE' });
  });
});

describe('inconsistencias y solicitudes: ciclo completo', () => {
  it('detecta la entrada sin salida del viernes y la muestra como «sin corregir»', async () => {
    const { svc } = montar({ marcas: [celular(1, 9)] });
    const r = await inc(svc);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ jornada: '2026-11-06', tipo: 'SIN_SALIDA', falta: 'SALIDA', estado: 'SIN_CORREGIR', texto: 'No marcaste tu salida (viernes 6)' });
  });

  it('al enviar la solicitud pasa a «enviada» (no desaparece) y al aprobar desaparece, con marcas CORRECCION del admin', async () => {
    const { svc, marcas } = montar({ marcas: [celular(1, 9)] });
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    expect((await inc(svc))[0]).toMatchObject({ estado: 'ENVIADA', solicitudId: id });

    const r = await svc.aprobarSolicitud(id, 'Verificado con la cámara', ADMIN, undefined, AHORA);
    expect(r.marcas).toHaveLength(1);
    const nueva = marcas[marcas.length - 1];
    expect(nueva).toMatchObject({ origen: 'CORRECCION', tipo: 'SALIDA', estado: 'VALIDA', por_party_id: 1n, party_id: 7n });
    expect(nueva.motivo).toContain(`Solicitud #${id}`);
    expect(nueva.motivo).toContain('Verificado con la cámara');
    expect(await inc(svc)).toEqual([]);
    // y la jornada quedó interpretada e íntegra en el cronograma
    const c = await svc.cronograma({ desde: '2026-11-06', hasta: '2026-11-06' }, AHORA);
    const d = c.personas[0].dias[0];
    expect(d.estado).not.toBe('INCOMPLETO');
    expect(d.marcas.map((m) => m.rol)).toEqual(['ENTRADA', 'SALIDA']);
    expect(d.inconsistencia).toBeNull();
  });

  it('al rechazar (con motivo) la inconsistencia reaparece con el motivo', async () => {
    const { svc } = montar({ marcas: [celular(1, 9)] });
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    expect(await error(svc.rechazarSolicitud(id, 'no', ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'MOTIVO_REQUERIDO' });
    await svc.rechazarSolicitud(id, 'La cámara te ve salir a las 17:00', ADMIN, undefined, AHORA);
    expect((await inc(svc))[0]).toMatchObject({ estado: 'SIN_CORREGIR', rechazo: 'La cámara te ve salir a las 17:00' });
    expect((await svc.misSolicitudes(7n, AHORA))[0]).toMatchObject({ estado: 'RECHAZADA', motivoResolucion: 'La cámara te ve salir a las 17:00' });
  });

  it('no avisa ni deja aprobar en un período pagado', async () => {
    const { svc, solicitudes } = montar({ marcas: [celular(1, 9)] });
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA); // aún abierto
    const pagado = montar({ marcas: [celular(1, 9)], pagado: true });
    expect(await pagado.svc.inconsistencias(7n, AHORA)).toEqual([]);
    // el período se pagó después de pedirla: aprobar exige reabrir
    const otro = montar({ marcas: [celular(1, 9)], pagado: true });
    otro.solicitudes.push({ ...solicitudes[0], id: BigInt(id) });
    expect(await error(otro.svc.aprobarSolicitud(id, undefined, ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'PERIODO_PAGADO' });
  });

  it('solo ve las inconsistencias propias y una solicitud resuelta no se vuelve a resolver', async () => {
    const { svc } = montar({ marcas: [celular(1, 9)] });
    expect(await svc.inconsistencias(8n, AHORA)).toEqual([]);
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    await svc.aprobarSolicitud(id, undefined, ADMIN, undefined, AHORA);
    expect(await error(svc.aprobarSolicitud(id, undefined, ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'NO_ESTA_PENDIENTE' });
  });

  it('una jornada con horario y cero marcas se avisa como posible falta; fuera del plazo (7 días) no', async () => {
    const { svc } = montar();
    const r = await svc.inconsistencias(7n, AHORA);
    expect(r.every((i) => i.tipo === 'SIN_MARCAS')).toBe(true);
    expect(r.map((i) => i.jornada)).toContain('2026-11-08');
    expect(r.map((i) => i.jornada)).not.toContain('2026-11-01'); // 8 días atrás
  });
});

describe('cronograma (solo lectura)', () => {
  it('máximo 31 días y rango válido', async () => {
    const { svc } = montar();
    expect(await error(svc.cronograma({ desde: '2026-10-01', hasta: '2026-11-09' }, AHORA))).toMatchObject({ codigo: 'RANGO_MUY_LARGO' });
    expect(await error(svc.cronograma({ desde: '2026-11-09', hasta: '2026-11-01' }, AHORA))).toMatchObject({ codigo: 'RANGO_INVALIDO' });
  });

  it('devuelve por persona el horario, las marcas interpretadas (con doble marca tachada), los tramos y las solicitudes pendientes; una marca anulada no aparece', async () => {
    const anulada = { ...celular(4, 12), estado: 'ANULADA' };
    const { svc } = montar({ marcas: [celular(1, 9), celular(2, 9, 2), celular(3, 18), anulada] });
    await svc.crearSolicitud(pedir({ items: [{ tipo: 'SALIDA_ALMUERZO', hora: '13:00' }] }), LUIS, undefined, AHORA);
    const c = await svc.cronograma({ desde: '2026-11-06', hasta: '2026-11-06' }, AHORA);
    const d = c.personas[0].dias[0];
    expect(c.personas[0]).toMatchObject({ partyId: 7, nombre: 'Luis Pérez', roles: ['MOZO'] });
    expect(d.turnoTexto).toMatchObject({ entrada: '09:00', salida: '18:00' });
    expect(d.marcas).toHaveLength(3);
    expect(d.marcas.map((m) => [m.hora, m.rol, m.duplicada])).toEqual([['09:00', 'ENTRADA', false], ['09:02', 'ENTRADA', true], ['18:00', 'SALIDA', false]]);
    expect(d.tramos).toHaveLength(1);
    expect(d.solicitudes[0].items[0]).toMatchObject({ tipo: 'SALIDA_ALMUERZO', hora: '13:00' });
    expect(c.resumen['2026-11-06']).toMatchObject({ total: 1, solicitudes: 1 });
  });

  it('filtra por persona y por rol', async () => {
    const { svc } = montar({ marcas: [celular(1, 9), celular(3, 18)] });
    expect((await svc.cronograma({ desde: '2026-11-06', hasta: '2026-11-06', rol: 'COCINA' }, AHORA)).personas).toHaveLength(0);
    expect((await svc.cronograma({ desde: '2026-11-06', hasta: '2026-11-06', rol: 'MOZO', partyId: 7 }, AHORA)).personas).toHaveLength(1);
  });

  it('la bandeja del admin lista pendientes con nombre y las inconsistencias sin solicitud', async () => {
    const { svc } = montar({ marcas: [celular(1, 9)] });
    await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    const b = await svc.bandeja(AHORA);
    expect(b.solicitudes[0]).toMatchObject({ nombre: 'Luis Pérez', estado: 'PENDIENTE' });
    expect(b.sinSolicitud.map((x) => x.jornada)).not.toContain('2026-11-06'); // ya tiene solicitud
    expect(b.sinSolicitud.length).toBeGreaterThan(0); // los demás días con horario y sin marcas
    expect(await svc.contarPendientes()).toBe(1);
  });
});

describe('aprobar / rechazar en lote', () => {
  const web = (id: number, jornada: string, h: number, min = 0): Fila => ({
    id: BigInt(id), party_id: 7n, jornada: dia(jornada), tipo: 'ENTRADA', origen: 'WEB', estado: 'A_REVISAR', motivos_revision: 'web',
    momento: momentoDeHora(jornada, `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`).momento, selfie: null,
  });

  it('lote mixto: aprueba marcas y solicitudes y dice por qué falló cada ítem que no pudo (nada en silencio)', async () => {
    const { svc, marcas, solicitudes, auditoria } = montar({ marcas: [web(1, '2026-11-06', 9), web(2, '2026-11-06', 18)] });
    const { id } = await svc.crearSolicitud(pedir({ jornada: '2026-11-05' }), LUIS, undefined, AHORA);
    const r = await svc.lote(
      { accion: 'APROBAR', items: [{ tipo: 'MARCA', id: 1 }, { tipo: 'MARCA', id: 2 }, { tipo: 'SOLICITUD', id }, { tipo: 'MARCA', id: 999 }] },
      ADMIN, undefined, AHORA,
    );
    expect(r).toMatchObject({ total: 4, ok: 3, fallidas: 1 });
    expect(r.resultados[3]).toMatchObject({ ok: false, codigo: 'MARCA_NO_ENCONTRADA' });
    expect(marcas.filter((m) => m.estado === 'APROBADA')).toHaveLength(2);
    expect(solicitudes[0].estado).toBe('APROBADA');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'APROBAR_LOTE' })); // por lote
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'APROBAR_MARCA' })); // y por ítem
  });

  it('ya resueltas y período pagado se reportan por ítem', async () => {
    const { svc } = montar({ marcas: [web(1, '2026-11-06', 9)] });
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    await svc.lote({ accion: 'APROBAR', items: [{ tipo: 'MARCA', id: 1 }, { tipo: 'SOLICITUD', id }] }, ADMIN, undefined, AHORA);
    const otra = await svc.lote({ accion: 'APROBAR', items: [{ tipo: 'SOLICITUD', id }, { tipo: 'MARCA', id: 1 }] }, ADMIN, undefined, AHORA);
    expect(otra.resultados.map((x) => x.codigo)).toEqual(['NO_ESTA_PENDIENTE', 'NO_SE_PUEDE_SEPARAR']);

    const pagado = montar({ marcas: [web(1, '2026-11-06', 9)], pagado: true });
    const p = await pagado.svc.lote({ accion: 'APROBAR', items: [{ tipo: 'MARCA', id: 1 }] }, ADMIN, undefined, AHORA);
    expect(p).toMatchObject({ ok: 0, fallidas: 1 });
    expect(p.resultados[0].codigo).toBe('PERIODO_PAGADO');
  });

  it('rechazar exige un solo motivo para todas y anula/rechaza; el tope es de 200', async () => {
    const { svc, marcas, solicitudes } = montar({ marcas: [web(1, '2026-11-06', 9)] });
    const { id } = await svc.crearSolicitud(pedir(), LUIS, undefined, AHORA);
    const items = [{ tipo: 'MARCA' as const, id: 1 }, { tipo: 'SOLICITUD' as const, id }];
    expect(await error(svc.lote({ accion: 'RECHAZAR', items }, ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'MOTIVO_REQUERIDO' });
    const r = await svc.lote({ accion: 'RECHAZAR', motivo: 'Las cámaras no lo muestran', items }, ADMIN, undefined, AHORA);
    expect(r.ok).toBe(2);
    expect(marcas[0].estado).toBe('ANULADA');
    expect(solicitudes[0]).toMatchObject({ estado: 'RECHAZADA', motivo_resolucion: 'Las cámaras no lo muestran' });
    const muchas = Array.from({ length: 201 }, (_, i) => ({ tipo: 'MARCA' as const, id: i + 1 }));
    expect(await error(svc.lote({ accion: 'APROBAR', items: muchas }, ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'LOTE_MUY_GRANDE' });
    expect(await error(svc.lote({ accion: 'APROBAR', items: [] }, ADMIN, undefined, AHORA))).toMatchObject({ codigo: 'LOTE_VACIO' });
  });

  it('una doble marca aprobada en lote se «separa» y deja de unirse a la anterior', async () => {
    const { svc, marcas } = montar({ marcas: [celular(1, 9), celular(2, 9, 1), celular(3, 18)] });
    const b = await svc.bandeja(AHORA);
    expect(b.marcas.map((m) => [m.id, m.clase])).toEqual([[2, 'DOBLE']]);
    await svc.lote({ accion: 'APROBAR', items: [{ tipo: 'MARCA', id: 2 }] }, ADMIN, undefined, AHORA);
    expect(marcas[1].estado).toBe('APROBADA');
    const c = await svc.cronograma({ desde: '2026-11-06', hasta: '2026-11-06' }, AHORA);
    expect(c.personas[0].dias[0].marcas.some((m) => m.duplicada)).toBe(false);
  });

  it('«aprobar todas las dudosas del período»: solo las simples; las jornadas con cantidades raras se omiten', async () => {
    // 6/11: entrada y salida por web (simple). 5/11: 3 marcas con dos por revisar (rara).
    const tres = { ...celular(4, 13), jornada: dia('2026-11-05'), momento: momentoDeHora('2026-11-05', '13:00').momento };
    const { svc, marcas } = montar({ marcas: [web(1, '2026-11-06', 9), web(2, '2026-11-06', 18), web(3, '2026-11-05', 9), tres, web(5, '2026-11-05', 18)] });
    const r = await svc.aprobarSimples(7, '2026-11-02', '2026-11-08', ADMIN, undefined, AHORA);
    expect(r).toMatchObject({ ok: 2, omitidas: 2 });
    expect(marcas.filter((m) => m.estado === 'APROBADA').map((m) => Number(m.id))).toEqual([1, 2]);
    expect(marcas.find((m) => m.id === 3n)!.estado).toBe('A_REVISAR');
  });
});
