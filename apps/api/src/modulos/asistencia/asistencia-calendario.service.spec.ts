jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} })); // evita cargar JwtService (ESM) en la prueba
import { BadRequestException } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaCorreccionesService } from './asistencia-correcciones.service';
import { AsistenciaCalendarioService } from './asistencia-calendario.service';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController, MiAsistenciaController } from './asistencia.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

// Datos inventados. 2026-11-06 es viernes (dia_semana 5); 2026-11-13 también.
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const hora = (h: string) => new Date(`1970-01-01T${h}:00Z`);
const lima = (fecha: string, hhmm: string) => new Date(Date.parse(`${fecha}T${hhmm}:00Z`) + 5 * 3_600_000);
const AHORA = new Date('2026-11-14T10:00:00Z'); // ya cerraron el 6 y el 13

let n = 1n;
const marca = (party: bigint, fecha: string, hhmm: string, tipo_marca: string | null, extra: Record<string, unknown> = {}) => ({
  id: n++, party_id: party, jornada: d(fecha), tipo: tipo_marca === 'SALIDA' ? 'SALIDA' : 'ENTRADA', tipo_marca, origen: 'CELULAR',
  momento: lima(fecha, hhmm), estado: 'VALIDA', motivo: null, motivos_revision: null, lat: -12.04, lng: -77.04, precision_m: 8, distancia_m: 3,
  dispositivo_hash: 'huella-secreta', ...extra,
});

function armar() {
  const marcas = [
    // Luis (7): día completo con almuerzo y 30 min extra el 6
    marca(7n, '2026-11-06', '09:00', 'ENTRADA'), marca(7n, '2026-11-06', '13:00', 'ALMUERZO_SALIDA'),
    marca(7n, '2026-11-06', '13:45', 'ALMUERZO_VUELTA'), marca(7n, '2026-11-06', '18:30', 'SALIDA'),
    // Ana (8): tardanza de 20 min el 6, con marcas viejas sin tipo
    marca(8n, '2026-11-06', '09:20', null), marca(8n, '2026-11-06', '18:00', null),
    // Luis el 13: puntual, sin almuerzo marcado
    marca(7n, '2026-11-13', '09:00', 'ENTRADA'), marca(7n, '2026-11-13', '18:00', 'SALIDA'),
    // Admin (10): no cuenta
    marca(10n, '2026-11-06', '09:00', 'ENTRADA'),
  ];
  const solicitudes: any[] = [
    { id: 1n, party_id: 9n, jornada: d('2026-11-06'), estado: 'PENDIENTE', motivo: 'Me olvidé de marcar', motivo_resolucion: null, creada_en: AHORA },
    { id: 2n, party_id: 7n, jornada: d('2026-11-13'), estado: 'RECHAZADA', motivo: 'Marqué tarde por el cierre', motivo_resolucion: 'No coincide con la cámara', creada_en: AHORA },
  ];
  const extras: any[] = [];
  const horario = (p: bigint) => ({ party_id: p, dia_semana: 5, entrada: hora('09:00'), salida: hora('18:00'), almuerzo_inicio: null, almuerzo_fin: null });
  const bd: any = {
    parametro: { findUnique: async () => null },
    horarioTrabajo: { findMany: async () => [7n, 8n, 9n].map(horario) },
    coberturaTurno: { findMany: async () => [] },
    reemplazoDia: { findMany: async () => [] },
    asistenciaMarca: {
      findMany: async ({ where }: any) =>
        marcas
          .filter((m) => (!where.party_id?.in || where.party_id.in.includes(m.party_id)) && m.jornada >= where.jornada.gte && m.jornada <= where.jornada.lte)
          .map((m) => ({ ...m, selfie: m.party_id === 7n && m.tipo_marca === 'ENTRADA' ? { marca_id: m.id } : null })),
    },
    feriado: { findMany: async () => [{ fecha: d('2026-11-13'), nombre: 'Día de prueba', activo: true }] },
    person: { findMany: async ({ where }: any) => ([[7n, 'Luis', 'Pérez'], [8n, 'Ana', 'Rojas'], [9n, 'Pedro', 'Díaz'], [10n, 'Jefa', 'Admin']] as Array<[bigint, string, string]>)
      .filter(([p]) => where.party_id.in.includes(p)).map(([p, a, b]) => ({ party_id: p, nombres: a, apellidos: b })) },
    userAccount: { findMany: async ({ where }: any) => ([[7n, 'MOZO'], [8n, 'COCINA'], [9n, 'COCINA'], [10n, 'ADMIN']] as Array<[bigint, string]>)
      .filter(([p]) => where.party_id.in.includes(p)).map(([p, r]) => ({ id: (p as bigint) * 10n, party_id: p, rol: r })) },
    userAccountRol: { findMany: async () => [] },
    asistenciaSolicitud: {
      findMany: async ({ where }: any) => solicitudes.filter((s) => (!where.party_id || s.party_id === where.party_id) && where.estado.in.includes(s.estado)),
    },
    planillaExtraAprobada: { findMany: async ({ where }: any) => extras.filter((e) => e.party_id === where.party_id) },
  };
  const asistencia = new AsistenciaService(bd, { get: (_k: string, def: string) => def } as any);
  const correcciones = new AsistenciaCorreccionesService(bd, asistencia);
  const cal = new AsistenciaCalendarioService(bd, asistencia, correcciones);
  return { cal, asistencia, correcciones, aprobarExtra: (p: bigint, f: string) => extras.push({ party_id: p, jornada: d(f) }), solicitudes };
}

describe('calendario del admin: resumen por día', () => {
  it('un día: programadas, presentes, tardanzas, faltas, pendientes y feriado', async () => {
    const { cal } = armar();
    const r = await cal.resumen('2026-11-06', '2026-11-06', AHORA);
    expect(r.dias).toHaveLength(1);
    expect(r.dias[0]).toEqual({
      fecha: '2026-11-06', feriado: null, programadas: 3, presentes: 2, tardanzas: 1, faltas: 1, aRevisar: 0, solicitudesPendientes: 1, inconsistencias: 1,
    });
  });

  it('varios días y feriado; el administrador no cuenta', async () => {
    const { cal } = armar();
    const r = await cal.resumen('2026-11-05', '2026-11-07', AHORA);
    expect(r.dias.map((x) => x.fecha)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07']);
    expect(r.dias[0].programadas).toBe(0);
    expect(r.dias[1].programadas).toBe(3);
    const mes = await cal.resumen('2026-11-01', '2026-11-30', AHORA);
    expect(mes.dias).toHaveLength(30);
    expect(mes.dias.find((x) => x.fecha === '2026-11-13')).toMatchObject({ feriado: 'Día de prueba', programadas: 3, presentes: 1, faltas: 2 });
  });

  it('rango inválido o de más de 62 días se rechaza', async () => {
    const { cal } = armar();
    await expect(cal.resumen('2026-11-10', '2026-11-01', AHORA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(cal.resumen('2026-01-01', '2026-03-05', AHORA)).rejects.toMatchObject({ response: { codigo: 'RANGO_MUY_LARGO' } });
    await expect(cal.resumen('2026-01-01', '2026-03-03', AHORA)).resolves.toBeDefined(); // 62 días exactos
  });
});

describe('calendario del admin: filas', () => {
  it('una fila por persona y día con horas, almuerzo, extra, marcas y totales', async () => {
    const { cal } = armar();
    const r = await cal.filas({ desde: '2026-11-06', hasta: '2026-11-06' }, AHORA);
    expect(r.total).toBe(3);
    expect(r.pagina).toBe(1);
    const luis = r.filas.find((f) => f.nombre === 'Luis Pérez')!;
    expect(luis).toMatchObject({
      fecha: '2026-11-06', partyId: '7', rol: 'MOZO', turno: { entrada: '09:00', salida: '18:00' },
      entrada: '09:00', salida: '18:30', almuerzoSalida: '13:00', almuerzoVuelta: '13:45', almuerzoMin: 45,
      trabajadaMin: 570, tardanzaMin: 0, salioAntesMin: 0, extraMin: 30, estado: 'SALIO_DESPUES', inconsistencias: [],
    });
    expect(luis.marcas.map((m) => m.tipo)).toEqual(['ENTRADA', 'ALMUERZO_SALIDA', 'ALMUERZO_VUELTA', 'SALIDA']);
    expect(luis.marcas[0]).toMatchObject({ hora: '09:00', origen: 'CELULAR', estado: 'VALIDA', tieneSelfie: true });
    expect(luis.marcas[1].tieneSelfie).toBe(false);
    const ana = r.filas.find((f) => f.nombre === 'Ana Rojas')!;
    expect(ana).toMatchObject({ estado: 'TARDANZA', tardanzaMin: 20, almuerzoMin: null, trabajadaMin: 520 });
    expect(ana.marcas.every((m) => m.tipo === null)).toBe(true); // marcas viejas
    const pedro = r.filas.find((f) => f.nombre === 'Pedro Díaz')!;
    expect(pedro.estado).toBe('FALTA');
    expect(pedro.solicitudes).toEqual([{ id: 1, tipo: 'CORRECCION', estado: 'PENDIENTE' }]);
    expect(pedro.inconsistencias).toHaveLength(1);
    expect(r.totales).toEqual({ trabajadaMin: 570 + 520, tardanzaMin: 20, extraMin: 30, faltas: 1 });
    expect(r.filas.some((f) => f.partyId === '10')).toBe(false);
  });

  it('filtra por nombre, estado (lista), rol y persona', async () => {
    const { cal } = armar();
    const rango = { desde: '2026-11-06', hasta: '2026-11-13' };
    expect((await cal.filas({ ...rango, q: 'ana' }, AHORA)).filas.map((f) => f.nombre)).toEqual(['Ana Rojas', 'Ana Rojas']);
    expect((await cal.filas({ ...rango, estado: 'TARDANZA,FALTA' }, AHORA)).filas.every((f) => ['TARDANZA', 'FALTA'].includes(f.estado))).toBe(true);
    expect((await cal.filas({ ...rango, rol: 'MOZO' }, AHORA)).filas.every((f) => f.rol === 'MOZO')).toBe(true);
    expect((await cal.filas({ ...rango, rol: 'MOZO,COCINA' }, AHORA)).total).toBe(6);
    expect((await cal.filas({ ...rango, partyId: 8 }, AHORA)).filas.every((f) => f.partyId === '8')).toBe(true);
  });

  it('pagina y los totales cubren todo lo filtrado, no solo la página', async () => {
    const { cal } = armar();
    const rango = { desde: '2026-11-06', hasta: '2026-11-13' };
    const p1 = await cal.filas({ ...rango, limite: 4, pagina: 1 }, AHORA);
    const p2 = await cal.filas({ ...rango, limite: 4, pagina: 2 }, AHORA);
    expect(p1.total).toBe(6);
    expect(p1.filas).toHaveLength(4);
    expect(p2.filas).toHaveLength(2);
    expect(p1.totales).toEqual(p2.totales);
    expect((await cal.filas({ ...rango, limite: 'todas' }, AHORA)).limite).toBe(2000);
    expect((await cal.filas({ ...rango, limite: 9999 }, AHORA)).limite).toBe(500);
  });

  it('mes completo (30 días) funciona y más de 62 días se rechaza', async () => {
    const { cal } = armar();
    expect((await cal.filas({ desde: '2026-11-01', hasta: '2026-11-30' }, AHORA)).total).toBeGreaterThan(0);
    await expect(cal.filas({ desde: '2026-01-01', hasta: '2026-12-31' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('mi calendario (cuenta del token)', () => {
  it('devuelve el día propio: horas, almuerzo pagado, extra pendiente y resumen', async () => {
    const { cal } = armar();
    const r = await cal.miCalendario(7n, '2026-11-06', '2026-11-13', AHORA);
    expect(r.dias).toHaveLength(8);
    const dia = r.dias[0];
    expect(dia).toMatchObject({
      fecha: '2026-11-06', programado: { entrada: '09:00', salida: '18:00' }, estado: 'SALIO_DESPUES', entrada: '09:00', salida: '18:30',
      almuerzoSalida: '13:00', almuerzoVuelta: '13:45', almuerzoMin: 45, trabajadaMin: 570, extraMin: 30, extraEstado: 'PENDIENTE', solicitud: null,
    });
    expect(dia.marcas).toEqual([
      { tipo: 'ENTRADA', hora: '09:00', estado: 'VALIDA' }, { tipo: 'ALMUERZO_SALIDA', hora: '13:00', estado: 'VALIDA' },
      { tipo: 'ALMUERZO_VUELTA', hora: '13:45', estado: 'VALIDA' }, { tipo: 'SALIDA', hora: '18:30', estado: 'VALIDA' },
    ]);
    expect(r.resumen).toMatchObject({ diasTrabajados: 2, horasTrabajadasMin: 570 + 540, extraAprobadaMin: 0, extraPendienteMin: 30, faltas: 0 });
    expect(r.dias[7].feriado).toBe('Día de prueba');
  });

  it('extra aprobada pasa a APROBADA y suma en el resumen', async () => {
    const { cal, aprobarExtra } = armar();
    aprobarExtra(7n, '2026-11-06');
    const r = await cal.miCalendario(7n, '2026-11-06', '2026-11-06', AHORA);
    expect(r.dias[0].extraEstado).toBe('APROBADA');
    expect(r.resumen).toMatchObject({ extraAprobadaMin: 30, extraPendienteMin: 0 });
  });

  it('día sin extra deja extraEstado en null', async () => {
    const { cal } = armar();
    const r = await cal.miCalendario(7n, '2026-11-13', '2026-11-13', AHORA);
    expect(r.dias[0].extraEstado).toBeNull();
    expect(r.dias[0].almuerzoMin).toBeNull();
  });

  it('solicitud rechazada y aprobada: devuelve su estado, motivo y respuesta, nada más', async () => {
    const { cal, solicitudes } = armar();
    let r = await cal.miCalendario(7n, '2026-11-13', '2026-11-13', AHORA);
    expect(r.dias[0].solicitud).toEqual({ id: 2, tipo: 'CORRECCION', estado: 'RECHAZADA', motivo: 'Marqué tarde por el cierre', respuesta: 'No coincide con la cámara' });
    solicitudes[1].estado = 'APROBADA';
    solicitudes[1].motivo_resolucion = null;
    r = await cal.miCalendario(7n, '2026-11-13', '2026-11-13', AHORA);
    expect(r.dias[0].solicitud).toMatchObject({ estado: 'APROBADA', respuesta: null });
  });

  it('nunca incluye datos de otros ni campos sensibles', async () => {
    const { cal } = armar();
    const texto = JSON.stringify(await cal.miCalendario(7n, '2026-11-01', '2026-11-30', AHORA));
    for (const prohibido of ['selfie', 'lat', 'lng', 'precision', 'dispositivo', 'huella', 'distancia', 'url', 'party', 'Ana', 'Pedro', 'Me olvidé']) {
      expect(texto.toLowerCase()).not.toContain(prohibido.toLowerCase());
    }
  });

  it('por defecto devuelve el mes actual y valida el rango', async () => {
    const { cal } = armar();
    const r = await cal.miCalendario(7n, undefined, undefined, AHORA);
    expect(r.desde).toBe('2026-11-01');
    expect(r.hasta).toBe('2026-11-30');
    await expect(cal.miCalendario(7n, '2026-01-01', '2026-12-31', AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el controlador usa siempre el partyId del token, aunque llegue otro por query', async () => {
    const { cal, asistencia, correcciones } = armar();
    const espia = jest.spyOn(cal, 'miCalendario');
    const ctl = new MiAsistenciaController(asistencia, cal);
    const ctl2 = new AsistenciaController(asistencia, {} as any, {} as any, correcciones, cal);
    const req = { usuario: { partyId: 7n } };
    await ctl.calendarioPropio(req, { desde: '2026-11-06', hasta: '2026-11-06', partyId: 8 } as any);
    await ctl2.miCalendario(req, { desde: '2026-11-06', hasta: '2026-11-06', partyId: 8 } as any);
    expect(espia.mock.calls.map((c) => c[0])).toEqual([7n, 7n]);
  });
});

describe('permisos de los endpoints de calendario', () => {
  it('el calendario del admin exige asistencia/administrar y el propio asistencia/marcar', () => {
    const permiso = (clase: any, metodo: string) => {
      const p = Reflect.getMetadata(CLAVE_PERMISO, clase.prototype[metodo]);
      return [p.modulo, p.accion];
    };
    expect(permiso(AsistenciaAdminController, 'calendarioResumen')).toEqual(['asistencia', 'administrar']);
    expect(permiso(AsistenciaAdminController, 'calendarioFilas')).toEqual(['asistencia', 'administrar']);
    expect(permiso(AsistenciaController, 'miCalendario')).toEqual(['asistencia', 'marcar']);
    expect(permiso(MiAsistenciaController, 'calendarioPropio')).toEqual(['asistencia', 'marcar']);
    expect(permiso(MiAsistenciaController, 'hoy')).toEqual(['asistencia', 'marcar']);
  });
});
