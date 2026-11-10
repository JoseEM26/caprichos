import { BadRequestException, HttpException } from '@nestjs/common';
import { AsistenciaService, VERSION_CONSENTIMIENTO } from './asistencia.service';
import { payloadQr, secretoQr, slotDe, codigoCorto } from './asistencia.qr';
import { MarcarDto } from './dto/asistencia.dto';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import * as argon2 from 'argon2';
import { MOTIVO_MARCA_MANUAL } from './asistencia.service';

// Prueba del servicio con una BD en memoria mínima. Cubre reglas, no el SQL (eso lo prueba la migración en Postgres).

const JWT = 'secreto-prueba';
const SECRETO = secretoQr(JWT);
const LOCAL = { lat: -12.0464, lng: -77.0428 };
const SELFIE = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
const DISPOSITIVO = 'dispositivo-luis-1234';
let HASH = '';
beforeAll(async () => { HASH = await argon2.hash('clave-segura'); });
const LUIS: UsuarioAutenticado = { partyId: 7n, rol: 'MOZO', debeCambiar: false, roles: ['MOZO'] };

// 2026-11-06 08:00 Lima (13:00Z)
const AHORA = new Date('2026-11-06T13:00:10Z');
const SLOT = slotDe(AHORA.getTime());

type Fila = Record<string, any>;

function bdFalsa(opts: { parametro?: Record<string, unknown> | null; dispositivo?: string | null; consentimiento?: boolean; cuenta?: Fila } = {}) {
  const marcas: Fila[] = [];
  const selfies: Fila[] = [];
  let dispositivo: Fila | null = opts.dispositivo === undefined || opts.dispositivo === null
    ? null
    : { party_id: 7n, huella_hash: opts.dispositivo };
  let consentimiento: Fila | null = opts.consentimiento ? { party_id: 7n, version: VERSION_CONSENTIMIENTO, aceptado_en: AHORA } : null;
  let id = 1n;
  let upserts = 0;
  const parametro = opts.parametro === undefined
    ? { clave: 'asistencia.config', valor: { localLat: LOCAL.lat, localLng: LOCAL.lng } }
    : opts.parametro;

  const igual = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);
  const filtrar = (filas: Fila[], where: Fila = {}) =>
    filas.filter((f) => Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'in' in v) return (v.in as bigint[]).includes(f[k]);
      if (v && typeof v === 'object' && 'not' in v) return f[k] !== v.not;
      if (v && typeof v === 'object' && !(v instanceof Date) && ('gte' in v || 'lte' in v)) return true;
      return igual(f[k], v);
    }));

  const bd: any = {
    parametro: { findUnique: async () => parametro },
    asistenciaDispositivo: {
      findUnique: async () => dispositivo,
      create: async ({ data }: any) => (dispositivo = { ...data }),
      update: async () => dispositivo,
      deleteMany: async () => {
        const c = dispositivo ? 1 : 0;
        dispositivo = null;
        return { count: c };
      },
    },
    asistenciaConsentimiento: {
      findUnique: async () => consentimiento,
      create: async ({ data }: any) => (consentimiento = { ...data }),
      upsert: async ({ create, update }: any) => { upserts++; return (consentimiento = consentimiento ? { ...consentimiento, ...update } : { ...create }); },
    },
    partyIdentifier: { findFirst: async ({ where }: any) => (where.numero === '12345678' ? { party: { usuario: opts.cuenta ?? { id: 70n, party_id: 7n, hash: HASH, activo: true, rol: 'MOZO' } } } : null) },
    userAccountRol: { findMany: async () => [] },
    asistenciaMarca: {
      findUnique: async ({ where }: any) => marcas.find((m) => m.id === where.id) ?? null,
      update: async ({ where, data }: any) => { const m = marcas.find((x) => x.id === where.id)!; Object.assign(m, data); return m; },
      findFirst: async ({ where }: any) => filtrar(marcas, where)[0] ?? null,
      findMany: async ({ where = {} }: any) => {
        let res = filtrar(marcas, where);
        if (where.jornada && where.jornada.gte) res = marcas.filter((m) => m.jornada >= where.jornada.gte && m.jornada <= where.jornada.lte);
        return res.map((m) => ({ ...m, selfie: selfies.find((s) => s.marca_id === m.id) ? {} : null }));
      },
      create: async ({ data }: any) => {
        const fila = { id: id++, creado_en: AHORA, ...data };
        if (marcas.some((m) => igual(m.party_id, fila.party_id) && fila.qr_slot != null && igual(m.qr_slot, fila.qr_slot))) { // índice único (party_id, qr_slot); ya no hay unicidad por tipo
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        marcas.push(fila);
        return fila;
      },
    },
    asistenciaSelfie: {
      create: async ({ data }: any) => selfies.push(data),
      findUnique: async ({ where }: any) => selfies.find((s) => s.marca_id === where.marca_id) ?? null,
      deleteMany: async () => ({ count: 0 }),
    },
    horarioTrabajo: { findMany: async () => [] },
    coberturaTurno: { findMany: async () => [] },
    reemplazoDia: { findMany: async () => [] },
    person: { findMany: async () => [{ party_id: 7n, nombres: 'Luis', apellidos: 'Pérez' }] },
    party: { findUnique: async () => ({ id: 7n }) },
    $transaction: async (cb: (tx: any) => Promise<unknown>) => cb(bd),
  };
  return { bd, marcas, selfies, get dispositivo() { return dispositivo; }, get consentimiento() { return consentimiento; }, get upserts() { return upserts; } };
}

function servicio(opts?: Parameters<typeof bdFalsa>[0]) {
  const b = bdFalsa(opts);
  const config: any = { get: (_k: string, def: string) => (_k === 'JWT_SECRET' ? JWT : def) };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  const svc = new AsistenciaService(b.bd, config, auditoria);
  return { svc, b, auditoria };
}

function dto(over: Partial<MarcarDto> = {}): MarcarDto {
  return {
    qr: payloadQr(SECRETO, SLOT),
    lat: LOCAL.lat + 0.00005,
    lng: LOCAL.lng,
    precision: 8,
    selfie: SELFIE,
    dispositivo: DISPOSITIVO,
    consentimiento: true,
    ...over,
  } as MarcarDto;
}

async function error(p: Promise<unknown>): Promise<{ codigo: string }> {
  try {
    await p;
  } catch (e: any) {
    const r = e instanceof HttpException ? e.getResponse() : e;
    return r as { codigo: string };
  }
  throw new Error('se esperaba un rechazo');
}

describe('AsistenciaService.marcar', () => {
  it('registra una entrada válida dentro del radio, con selfie y consentimiento', async () => {
    const { svc, b } = servicio();
    const r = await svc.marcar(dto(), LUIS, '1.2.3.4', AHORA);
    expect(r.ok).toBe(true);
    expect(r.marca.estado).toBe('VALIDA');
    expect(b.marcas).toHaveLength(1);
    expect(b.selfies).toHaveLength(1);
    expect(r.marca.tipo).toBe('ENTRADA');
    expect(r.mensaje).toBe('Marcaste tu entrada a las 08:00');
  });

  it('rechaza un QR ajeno (firmado con otro secreto)', async () => {
    const { svc } = servicio();
    const ajeno = payloadQr(secretoQr('otro'), SLOT);
    expect(await error(svc.marcar(dto({ qr: ajeno }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'QR_INVALIDO' });
  });

  it('rechaza un QR vencido (dos ranuras atrás)', async () => {
    const { svc } = servicio();
    expect(await error(svc.marcar(dto({ qr: payloadQr(SECRETO, SLOT - 2) }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'QR_INVALIDO' });
  });

  it('acepta el código corto de 6 dígitos de la ranura actual', async () => {
    const { svc } = servicio();
    const r = await svc.marcar(dto({ qr: undefined, codigo: codigoCorto(SECRETO, SLOT) }), LUIS, undefined, AHORA);
    expect(r.ok).toBe(true);
  });

  it('no reutiliza el mismo QR para otra marca', async () => {
    const { svc } = servicio();
    await svc.marcar(dto(), LUIS, undefined, AHORA);
    expect(await error(svc.marcar(dto({ tipo: 'SALIDA_ALMUERZO' }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'QR_YA_USADO' });
  });

  it('rechaza fuera del radio de 10 m (Haversine en el servidor)', async () => {
    const { svc } = servicio();
    const e = await error(svc.marcar(dto({ lat: LOCAL.lat + 0.0002 }), LUIS, undefined, AHORA));
    expect(e.codigo).toBe('FUERA_DE_RADIO');
  });

  it('una precisión GPS regular (más de 25 m) se acepta pero queda A_REVISAR con el motivo', async () => {
    const { svc, b } = servicio();
    const r = await svc.marcar(dto({ precision: 40 }), LUIS, undefined, AHORA);
    expect(r.marca.estado).toBe('A_REVISAR');
    expect(b.marcas[0].motivos_revision).toContain('Ubicación aproximada');
  });

  it('una precisión pésima (más de 300 m) se rechaza', async () => {
    const { svc } = servicio();
    expect(await error(svc.marcar(dto({ precision: 400 }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'PRECISION_BAJA' });
  });

  it('sin selfie porque la cámara no abrió: se acepta A_REVISAR; sin foto ni aviso se rechaza', async () => {
    const { svc, b } = servicio();
    const r = await svc.marcar(dto({ selfie: undefined, sinSelfie: true }), LUIS, undefined, AHORA);
    expect(r.marca.estado).toBe('A_REVISAR');
    expect(b.marcas[0].motivos_revision).toContain('Sin selfie');
    expect(b.selfies).toHaveLength(0);
    const otro = servicio();
    expect(await error(otro.svc.marcar(dto({ selfie: undefined }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'SELFIE_INVALIDA' });
  });

  it('marca con precisión 0 queda A_REVISAR en vez de válida', async () => {
    const { svc } = servicio();
    const r = await svc.marcar(dto({ precision: 0 }), LUIS, undefined, AHORA);
    expect(r.marca.estado).toBe('A_REVISAR');
    expect(r.marca.alertas.join(' ')).toMatch(/simulada/);
  });

  it('sin tipo: la primera marca se interpreta como entrada y tipo_marca queda NULL', async () => {
    const { svc, b } = servicio();
    const r = await svc.marcar(dto(), LUIS, undefined, AHORA);
    expect(r.marca.tipo).toBe('ENTRADA');
    expect(b.marcas[0].tipo).toBe('ENTRADA');
    expect(b.marcas[0].tipo_marca).toBeNull();
  });

  it('con tipo: se guarda lo que declaró (ALMUERZO_SALIDA) y manda sobre el orden', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto({ tipo: 'ENTRADA' }), LUIS, undefined, AHORA);
    const luego = new Date(AHORA.getTime() + 4 * 3_600_000);
    const r = await svc.marcar(dto({ tipo: 'ALMUERZO_SALIDA', qr: payloadQr(SECRETO, slotDe(luego.getTime())) }), LUIS, undefined, luego);
    expect(b.marcas[1].tipo_marca).toBe('ALMUERZO_SALIDA');
    expect(r.marca.tipo).toBe('SALIDA_ALMUERZO');
    expect(r.marca.estado).toBe('VALIDA');
  });

  it('acepta los nombres antiguos de tipo y los convierte', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto({ tipo: 'ENTRADA' as any }), LUIS, undefined, AHORA);
    const luego = new Date(AHORA.getTime() + 4 * 3_600_000);
    await svc.marcar(dto({ tipo: 'SALIDA_ALMUERZO' as any, qr: payloadQr(SECRETO, slotDe(luego.getTime())) }), LUIS, undefined, luego);
    expect(b.marcas[1].tipo_marca).toBe('ALMUERZO_SALIDA');
  });

  it('regreso de almuerzo sin salida a almorzar: se permite pero queda A_REVISAR con motivo', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto({ tipo: 'ENTRADA' }), LUIS, undefined, AHORA);
    const luego = new Date(AHORA.getTime() + 4 * 3_600_000);
    const r = await svc.marcar(dto({ tipo: 'ALMUERZO_VUELTA', qr: payloadQr(SECRETO, slotDe(luego.getTime())) }), LUIS, undefined, luego);
    expect(r.marca.estado).toBe('A_REVISAR');
    expect(b.marcas[1].motivos_revision).toMatch(/regreso del almuerzo sin haber marcado la salida/);
  });

  it('miHoy sugiere la siguiente marca y calcula el almuerzo marcado', async () => {
    const { svc } = servicio();
    expect((await svc.miHoy(7n, AHORA)).siguienteSugerido).toBe('ENTRADA');
    await svc.marcar(dto({ tipo: 'ENTRADA' }), LUIS, undefined, AHORA);
    const hoy = await svc.miHoy(LUIS.partyId, new Date(AHORA.getTime() + 60_000 * 5));
    expect(hoy.siguienteSugerido).toBe('ALMUERZO_SALIDA');
    expect(hoy.almuerzoMin).toBeNull();
    expect(hoy.marcas[0]).toMatchObject({ tipo: 'ENTRADA', hora: '08:00' });
  });

  it('marcas múltiples: se puede marcar varias veces; la 2.ª cuenta como salida y una a <3 min se une a la anterior', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto(), LUIS, undefined, AHORA);
    const luego = new Date(AHORA.getTime() + 60_000); // 1 min después: doble marca
    const r2 = await svc.marcar(dto({ qr: payloadQr(SECRETO, slotDe(luego.getTime())) }), LUIS, undefined, luego);
    expect(r2.interpretacion.duplicada).toBe(true);
    expect(r2.mensaje).toMatch(/se unió a la anterior/);
    const mas = new Date(AHORA.getTime() + 10 * 60_000);
    const r3 = await svc.marcar(dto({ qr: payloadQr(SECRETO, slotDe(mas.getTime())) }), LUIS, undefined, mas);
    expect(r3.marca.tipo).toBe('SALIDA');
    expect(b.marcas).toHaveLength(3); // nada se rechaza ni se borra
  });

  it('un solo celular por trabajador: otro dispositivo se rechaza', async () => {
    const { svc } = servicio({ dispositivo: 'huella-del-celular-viejo' });
    expect(await error(svc.marcar(dto(), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'DISPOSITIVO_DISTINTO' });
  });

  it('ya no pide consentimiento para marcar', async () => {
    const { svc } = servicio();
    const r = await svc.marcar(dto({ consentimiento: undefined }), LUIS, undefined, AHORA);
    expect(r.ok).toBe(true);
  });

  it('exige selfie JPEG', async () => {
    const { svc } = servicio();
    const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    expect(await error(svc.marcar(dto({ selfie: png }), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'SELFIE_INVALIDA' });
  });

  it('sin ubicación del local configurada no marca', async () => {
    const { svc } = servicio({ parametro: null });
    expect(await error(svc.marcar(dto(), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'LOCAL_SIN_UBICACION' });
  });

  it('bloquea temporalmente tras 5 intentos fallidos del mismo usuario', async () => {
    const { svc } = servicio();
    for (let i = 0; i < 5; i++) {
      await error(svc.marcar(dto({ lat: LOCAL.lat + 0.01 }), LUIS, undefined, AHORA));
    }
    expect(await error(svc.marcar(dto(), LUIS, undefined, AHORA))).toMatchObject({ codigo: 'ASISTENCIA_BLOQUEADA' });
  });

  it('deja auditoria de la marca y del rechazo', async () => {
    const { svc, auditoria } = servicio();
    await error(svc.marcar(dto({ precision: 500 }), LUIS, undefined, AHORA));
    await svc.marcar(dto(), LUIS, undefined, AHORA);
    const acciones = auditoria.registrar.mock.calls.map((c: any[]) => c[0].resultado);
    expect(acciones).toEqual(['RECHAZADO', 'OK']);
  });
});

describe('AsistenciaService: correcciones y reportes', () => {
  it('una corrección es una fila nueva con motivo; la marca original no cambia', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto(), LUIS, undefined, AHORA);
    const original = { ...b.marcas[0] };
    const r = await svc.corregir(
      {
        partyId: 7,
        jornada: '2026-11-06',
        tipo: 'SALIDA',
        momento: '2026-11-06T23:00:00.000Z', // 18:00 Lima
        motivo: 'Se olvidó marcar la salida',
      } as any,
      { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as UsuarioAutenticado,
    );
    expect(r.ok).toBe(true);
    expect(b.marcas).toHaveLength(2);
    expect(b.marcas[1]).toMatchObject({ origen: 'CORRECCION', motivo: 'Se olvidó marcar la salida', por_party_id: 1n });
    expect(b.marcas[0]).toEqual(original);
  });

  it('una corrección fuera de su jornada se rechaza', async () => {
    const { svc } = servicio();
    await expect(
      svc.corregir({ partyId: 7, jornada: '2026-11-05', tipo: 'SALIDA', momento: '2026-11-06T23:00:00.000Z', motivo: 'Motivo de prueba' } as any, { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as UsuarioAutenticado),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('horasTrabajadasDelMes suma horas del turno completo (el almuerzo se paga)', async () => {
    const { svc, b } = servicio();
    // Horario de lunes a viernes 09:00-18:00 con almuerzo 13:00-14:00 (una sola fila para el día 6, viernes)
    b.bd.horarioTrabajo.findMany = async () => [{
      party_id: 7n, dia_semana: 5, entrada: new Date('1970-01-01T09:00:00Z'), salida: new Date('1970-01-01T18:00:00Z'),
      almuerzo_inicio: new Date('1970-01-01T13:00:00Z'), almuerzo_fin: new Date('1970-01-01T14:00:00Z'),
    }];
    const ts = (iso: string) => new Date(iso);
    b.marcas.push(
      { id: 1n, party_id: 7n, jornada: ts('2026-11-06T00:00:00Z'), tipo: 'ENTRADA', origen: 'CELULAR', momento: ts('2026-11-06T14:00:00Z'), estado: 'VALIDA' },
      { id: 2n, party_id: 7n, jornada: ts('2026-11-06T00:00:00Z'), tipo: 'SALIDA', origen: 'CELULAR', momento: ts('2026-11-06T23:00:00Z'), estado: 'VALIDA' },
    );
    const res = await svc.horasTrabajadasDelMes(2026, 11, new Date('2026-11-30T12:00:00Z'));
    const luis = res.find((r) => r.partyId === 7)!;
    expect(luis.nombre).toBe('Luis Pérez');
    // 09:00-18:00 = 9 h; el almuerzo se paga, no se descuenta
    // Solo el 6 tiene marcas; los otros viernes de noviembre (13, 20, 27) son FALTA y cuentan como programados
    expect(luis.horasTrabajadas).toBe(9);
    expect(luis.horasProgramadas).toBe(36);
    expect(luis.diasTrabajados).toBe(1);
  });
});

describe('AsistenciaService.qrPantalla', () => {
  it('devuelve un QR que cambia en la siguiente ranura de 30 s y un código de 6 dígitos', async () => {
    const { svc } = servicio();
    const q = await svc.qrPantalla(AHORA);
    expect(q.slot).toBe(SLOT);
    expect(q.cambiaEn - AHORA.getTime()).toBeGreaterThan(0);
    expect(q.cambiaEn - AHORA.getTime()).toBeLessThanOrEqual(30_000);
    expect(q.codigo).toMatch(/^\d{3} \d{3}$/);
    expect(q.qr.startsWith('data:image/png')).toBe(true);
  });
});

describe('AsistenciaService.miHoy: localConUbicacion', () => {
  it('con ubicación configurada es true y no expone coordenadas', async () => {
    const { svc } = servicio();
    const r = await svc.miHoy(LUIS.partyId, AHORA);
    expect(r.localConUbicacion).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/localLat|localLng|lat"|lng"/);
  });

  it('sin ubicación configurada es false', async () => {
    const { svc } = servicio({ parametro: null });
    expect((await svc.miHoy(LUIS.partyId, AHORA)).localConUbicacion).toBe(false);
  });
});

describe('AsistenciaService: ADMIN no marca', () => {
  it('rechaza la marca por celular de un ADMIN', async () => {
    const { svc, b } = servicio();
    const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
    expect(await error(svc.marcar(dto(), admin, undefined, AHORA))).toMatchObject({ codigo: 'ADMIN_NO_MARCA' });
    expect(b.marcas).toHaveLength(0);
  });
});

describe('AsistenciaService.marcar manual (solo GPS, sin QR ni selfie)', () => {
  const manual = (over: Partial<MarcarDto> = {}) => dto({ qr: undefined, selfie: undefined as any, dispositivo: undefined as any, ...over });

  it('guarda una marca MANUAL A_REVISAR con motivo, sin selfie ni QR ni vínculo de celular', async () => {
    const { svc, b } = servicio();
    const r = await svc.marcar(manual(), LUIS, '1.1.1.1', AHORA, true);
    expect(r.marca.estado).toBe('A_REVISAR');
    expect(r.mensaje).toContain('pendiente de revisión');
    expect(b.marcas[0]).toMatchObject({ origen: 'MANUAL', estado: 'A_REVISAR', tipo: 'ENTRADA' });
    expect(b.marcas[0].motivos_revision).toContain(MOTIVO_MARCA_MANUAL);
    expect(b.marcas[0].qr_slot).toBeNull();
    expect(b.selfies).toHaveLength(0);
  });

  it('fuera del radio o con GPS impreciso se rechaza', async () => {
    const { svc, b } = servicio();
    expect(await error(svc.marcar(manual({ lat: LOCAL.lat + 0.0002 }), LUIS, undefined, AHORA, true))).toMatchObject({ codigo: 'FUERA_DE_RADIO' });
    expect(await error(svc.marcar(manual({ precision: 400 }), LUIS, undefined, AHORA, true))).toMatchObject({ codigo: 'PRECISION_BAJA' });
    expect(b.marcas).toHaveLength(0);
  });

  it('el ADMIN no puede marcar manualmente', async () => {
    const { svc, b } = servicio();
    const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
    expect(await error(svc.marcar(manual(), admin, undefined, AHORA, true))).toMatchObject({ codigo: 'ADMIN_NO_MARCA' });
    expect(b.marcas).toHaveLength(0);
  });

  it('un rechazo cuenta para el bloqueo por intentos', async () => {
    const { svc } = servicio();
    for (let i = 0; i < 5; i++) await error(svc.marcar(manual({ lat: LOCAL.lat + 0.0002 }), LUIS, undefined, AHORA, true));
    expect(await error(svc.marcar(manual(), LUIS, undefined, AHORA, true))).toMatchObject({ codigo: 'ASISTENCIA_BLOQUEADA' });
  });
});

describe('AsistenciaService.revisarMarca', () => {
  const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };

  it('aprobar una marca MANUAL la deja APROBADA con quién y por qué; la fila se conserva', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto({ qr: undefined, selfie: undefined as any, dispositivo: undefined as any }), LUIS, undefined, AHORA, true);
    await svc.revisarMarca(Number(b.marcas[0].id), 'APROBAR', { motivo: 'Estaba en el local' }, admin);
    expect(b.marcas[0]).toMatchObject({ estado: 'APROBADA', revisado_por: 1n, revisado_motivo: 'Estaba en el local' });
  });

  it('una marca anulada no cuenta para el orden: se puede volver a marcar la entrada', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto({ qr: undefined, selfie: undefined as any, dispositivo: undefined as any }), LUIS, undefined, AHORA, true);
    await svc.revisarMarca(Number(b.marcas[0].id), 'ANULAR', { motivo: 'Marcó por error' }, admin);
    const r = await svc.marcar(dto({ qr: undefined, selfie: undefined as any, dispositivo: undefined as any }), LUIS, undefined, AHORA, true);
    expect(r.marca.tipo).toBe('ENTRADA');
    expect(b.marcas).toHaveLength(2);
  });

  it('no se aprueba una marca que no está por revisar ni se anula dos veces', async () => {
    const { svc, b } = servicio();
    await svc.marcar(dto(), LUIS, undefined, AHORA);
    expect(await error(svc.revisarMarca(Number(b.marcas[0].id), 'APROBAR', { motivo: 'No hace falta' }, admin))).toMatchObject({ codigo: 'NO_ESTA_POR_REVISAR' });
    await svc.revisarMarca(Number(b.marcas[0].id), 'ANULAR', { motivo: 'Marca duplicada' }, admin);
    expect(await error(svc.revisarMarca(Number(b.marcas[0].id), 'ANULAR', { motivo: 'Marca duplicada' }, admin))).toMatchObject({ codigo: 'MARCA_ANULADA' });
  });
});
