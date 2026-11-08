jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { EquipoConfigService } from './equipo-config.service';
import { clasificarEquipos, reconocerEquipo } from './identidad-equipo';

const hace = (s: number) => new Date(Date.now() - s * 1000);
const cfg = (configurado: boolean) => ({ device_key_id: 0n, configurado, ticketera: true, etiquetera: false, tamanos: { x: 1 } });

function fila(id: number, o: Record<string, any> = {}) {
  return {
    id: BigInt(id),
    tipo: 'AGENTE',
    nombre: 'Programa del local',
    activo: true,
    area_id: null,
    codigo_vinculo: null,
    ultimo_latido: hace(3600),
    equipo_uid: null,
    latido_hostname: 'CAJA-01',
    latido_sistema: 'win32 10.0.19045',
    latido_ip_local: '192.168.1.10',
    distinta_confirmada: false,
    archivada_en: null,
    reemplazada_por: null,
    configImpresion: cfg(true),
    ...o,
  } as any;
}

/** Prisma en memoria con lo mínimo que usa el reconocimiento de PC. */
function bd(filas: any[], trabajos: any[] = []) {
  const params: Record<string, any> = { impresion_seleccion_1: { valor: { TICKETERA: 'EPSON' } } };
  const p: any = {
    deviceKey: {
      findUnique: async ({ where }: any) => filas.find((f) => f.id === where.id) ?? null,
      findMany: async ({ where }: any) =>
        filas.filter(
          (f) =>
            (!where.id?.not || f.id !== where.id.not) &&
            (where.reemplazada_por === undefined || f.reemplazada_por === null) &&
            (where.archivada_en === undefined || f.archivada_en === null) &&
            f.ultimo_latido,
        ),
      update: async ({ where, data }: any) => Object.assign(filas.find((f) => f.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        const l = filas.filter((f) => where.id.in.includes(f.id) && (where.archivada_en === undefined || f.archivada_en === null));
        l.forEach((f) => Object.assign(f, data));
        return { count: l.length };
      },
    },
    equipoImpresionConfig: {
      upsert: async ({ where, create, update }: any) => {
        const f = filas.find((x) => x.id === where.device_key_id);
        f.configImpresion = f.configImpresion ? { ...f.configImpresion, ...update } : create;
      },
    },
    parametro: {
      findUnique: async ({ where }: any) => (params[where.clave] ? { valor: params[where.clave].valor } : null),
      upsert: async ({ where, create }: any) => {
        params[where.clave] = { valor: create.valor };
      },
    },
    printJob: {
      updateMany: async ({ where, data }: any) => {
        const l = trabajos.filter((j) => where.destino_equipo_id.in.includes(j.destino_equipo_id) && j.estado === where.estado);
        l.forEach((j) => Object.assign(j, data));
        return { count: l.length };
      },
      findMany: async () => [],
    },
    $transaction: async (fn: any) => fn(p),
  };
  return { p, params };
}
const aud = () => ({ registrar: jest.fn() });

describe('reconocerEquipo (criterio puro)', () => {
  it('por uid gana aunque el nombre cambie', () => {
    const r = reconocerEquipo({ uid: 'm-1', hostname: 'OTRO' }, [fila(1, { equipo_uid: 'm-1' }), fila(2)]);
    expect(r.base?.id).toBe(1n);
    expect(r.por).toBe('uid');
  });
  it('sin uid: hostname + familia del sistema, sin mayúsculas y sin la versión', () => {
    const r = reconocerEquipo({ hostname: 'caja-01', sistema: 'WIN32 10.0.22631' }, [fila(1)]);
    expect(r.base?.id).toBe(1n);
  });
  it('la IP sola no basta', () => {
    const r = reconocerEquipo({ hostname: 'OTRA', sistema: 'win32', ipLocal: ['192.168.1.10'] }, [fila(1)]);
    expect(r.base).toBeUndefined();
  });
  it('otra PC con ese nombre encendida y sin IP en común: ambiguo, no fusiona', () => {
    const r = reconocerEquipo({ hostname: 'CAJA-01', sistema: 'win32', ipLocal: ['10.0.0.5'] }, [fila(1, { ultimo_latido: hace(5) })]);
    expect(r.ambiguo).toBe(true);
    expect(r.base?.id).toBe(1n); // se reutiliza la más reciente, sin desactivarla
  });
  it('zombis apagados del mismo nombre: hereda de la más reciente y reemplaza a todas', () => {
    const r = reconocerEquipo({ hostname: 'CAJA-01', sistema: 'win32' }, [fila(1, { ultimo_latido: hace(9000) }), fila(2, { ultimo_latido: hace(4000) })]);
    expect(r.base?.id).toBe(2n);
    expect(r.otros.map((o) => o.id)).toEqual([1n]);
  });
});

describe('vincular de nuevo reutiliza la configuración', () => {
  it('uid conocido: hereda config, nombre, impresoras y trabajos; la llave vieja queda desactivada y auditada', async () => {
    const vieja = fila(1, { equipo_uid: 'm-1', nombre: 'Caja' });
    const nueva = fila(2, { ultimo_latido: null, configImpresion: null, latido_hostname: null });
    const trabajos = [
      { destino_equipo_id: 1n, estado: 'PENDIENTE' },
      { destino_equipo_id: 1n, estado: 'IMPRESO' },
    ];
    const { p, params } = bd([vieja, nueva], trabajos);
    const a = aud();
    const svc = new EquipoConfigService(p, a as any);
    const r = await svc.reconocerYReutilizar(2n, { uid: 'm-1' });
    expect(r.reutilizada).toBe(true);
    expect(nueva.configImpresion).toMatchObject({ configurado: true, ticketera: true });
    expect(nueva.nombre).toBe('Caja');
    expect(params.impresion_seleccion_2.valor).toEqual({ TICKETERA: 'EPSON' });
    expect(vieja).toMatchObject({ activo: false, reemplazada_por: 2n });
    expect(vieja.archivada_en).toBeInstanceOf(Date);
    expect(trabajos[0].destino_equipo_id).toBe(2n);
    expect(trabajos[1].destino_equipo_id).toBe(1n); // el historial no se toca
    expect(a.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'EQUIPO_IMPRESION_REEMPLAZADO' }));
  });

  it('programa viejo sin uid: por hostname + sistema', async () => {
    const vieja = fila(1);
    const nueva = fila(2, { ultimo_latido: null, configImpresion: null, latido_hostname: null });
    const { p } = bd([vieja, nueva]);
    const r = await new EquipoConfigService(p).reconocerYReutilizar(2n, { hostname: 'Caja-01', sistema: 'win32 11' });
    expect(r.reutilizada).toBe(true);
    expect(vieja.activo).toBe(false);
    expect(nueva.configImpresion.configurado).toBe(true);
  });

  it('ambiguo: reutiliza la más reciente con configuración, NO desactiva a la otra y marca posible duplicado', async () => {
    const vieja = fila(1, { ultimo_latido: hace(5) });
    const nueva = fila(2, { ultimo_latido: null, configImpresion: null });
    const { p } = bd([vieja, nueva]);
    const r = await new EquipoConfigService(p).reconocerYReutilizar(2n, { hostname: 'CAJA-01', sistema: 'win32', ipLocal: ['10.9.9.9'] });
    expect(r).toMatchObject({ reutilizada: true, ambiguo: true });
    expect(vieja.activo).toBe(true);
    expect(nueva.configImpresion.configurado).toBe(true);
    expect(clasificarEquipos([vieja, { ...nueva, ultimo_latido: hace(2), latido_hostname: 'CAJA-01', latido_sistema: 'win32' }]).get(2n)?.repetidaDe).toBe(1n);
  });

  it('PC realmente nueva: no hereda nada (nace configurado=false por la ruta normal)', async () => {
    const vieja = fila(1);
    const nueva = fila(2, { ultimo_latido: null, configImpresion: null, latido_hostname: null });
    const { p } = bd([vieja, nueva]);
    const r = await new EquipoConfigService(p).reconocerYReutilizar(2n, { uid: 'm-nuevo', hostname: 'COCINA', sistema: 'win32' });
    expect(r.reutilizada).toBe(false);
    expect(nueva.configImpresion).toBeNull();
    expect(vieja.activo).toBe(true);
  });
});

describe('eliminar PC', () => {
  const adm: any = { partyId: 1n, rol: 'ADMIN', roles: ['ADMIN'] };
  it('soft-delete: archiva, descarta lo pendiente, audita y no borra; sin rol permitido se rechaza', async () => {
    const pc = fila(1, { ultimo_latido: hace(5) });
    const jobs = [
      { destino_equipo_id: 1n, estado: 'PENDIENTE' },
      { destino_equipo_id: 1n, estado: 'IMPRESO' },
    ];
    const { p } = bd([pc], jobs);
    p.printJob.updateMany = async ({ where, data }: any) => {
      const l = jobs.filter((j) => j.destino_equipo_id === where.destino_equipo_id && where.estado.in.includes(j.estado));
      l.forEach((j) => Object.assign(j, data));
      return { count: l.length };
    };
    const a = aud();
    const svc = new EquipoConfigService(p, a as any);
    await expect(svc.eliminar('1', 'x', { rol: 'MOZO', roles: ['MOZO'] } as any)).rejects.toMatchObject({ response: { codigo: 'SIN_PERMISO_ELIMINAR_PC' } });
    expect(pc.activo).toBe(true);
    const r = await svc.eliminar('1', 'repetida', adm);
    expect(r.descartados).toBe(1);
    expect(pc).toMatchObject({ activo: false });
    expect(pc.eliminada_en).toBeInstanceOf(Date);
    expect(jobs.map((j) => j.estado)).toEqual(['DESCARTADO', 'IMPRESO']);
    expect(a.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ELIMINAR_PC', motivo: 'repetida' }));
  });

  it('revincular la misma PC eliminada: hereda su configuración en una sola fila activa', async () => {
    const pc = fila(1, { nombre: 'Cocina', activo: false, archivada_en: hace(10), eliminada_en: hace(10) });
    const nueva = fila(2, { ultimo_latido: null, configImpresion: null, latido_hostname: null });
    const { p } = bd([pc, nueva]);
    const r = await new EquipoConfigService(p).reconocerYReutilizar(2n, { hostname: 'caja-01', sistema: 'win32' });
    expect(r.reutilizada).toBe(true);
    expect(nueva).toMatchObject({ nombre: 'Cocina', activo: true });
    expect(nueva.configImpresion.configurado).toBe(true);
  });
});

describe('panel: antiguas, repetidas y limpieza', () => {
  it('apagada con otra más nueva del mismo nombre = antigua; la nueva sin configurar pregunta si es la misma', () => {
    const vieja = fila(1, { ultimo_latido: hace(5000) });
    const nueva = fila(2, { ultimo_latido: hace(5), configImpresion: cfg(false) });
    const c = clasificarEquipos([vieja, nueva]);
    expect(c.get(1n)?.antigua).toBe(true);
    expect(c.get(2n)).toEqual({ antigua: false, repetidaDe: 1n });
  });
  it('«No, es otra PC» (distinta_confirmada) las separa', () => {
    const c = clasificarEquipos([fila(1, { distinta_confirmada: true }), fila(2, { ultimo_latido: hace(5), distinta_confirmada: true })]);
    expect(c.get(1n)?.antigua).toBe(false);
    expect(c.get(2n)?.repetidaDe).toBeNull();
  });

  it('«Sí, es la misma» traspasa y audita', async () => {
    const vieja = fila(1, { nombre: 'Caja' });
    const nueva = fila(2, { ultimo_latido: hace(5), configImpresion: cfg(false) });
    const { p } = bd([vieja, nueva]);
    const a = aud();
    const svc = new EquipoConfigService(p, a as any);
    await svc.fusionar('2', '1');
    expect(nueva.configImpresion.configurado).toBe(true);
    expect(vieja.activo).toBe(false);
    expect(a.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'EQUIPO_IMPRESION_REEMPLAZADO' }));
  });

  it('limpiar exige motivo y es soft-delete (archiva, no borra); la nueva hereda la config', async () => {
    const vieja = fila(1, { ultimo_latido: hace(5000) });
    const nueva = fila(2, { ultimo_latido: hace(5), configImpresion: cfg(false) });
    const desactivada = fila(3, { activo: false, latido_hostname: 'X', ultimo_latido: hace(99999) });
    const todas = [vieja, nueva, desactivada];
    const { p } = bd(todas);
    p.deviceKey.findMany = async () => todas.filter((f) => !f.archivada_en);
    const a = aud();
    const svc = new EquipoConfigService(p, a as any);
    await expect(svc.limpiarAntiguas('  ')).rejects.toMatchObject({ response: { codigo: 'MOTIVO_OBLIGATORIO' } });
    expect(vieja.activo).toBe(true);
    const r = await svc.limpiarAntiguas('PCs repetidas');
    expect(r.archivadas).toBe(2);
    expect(vieja.archivada_en).toBeInstanceOf(Date);
    expect(desactivada.archivada_en).toBeInstanceOf(Date);
    expect(nueva.activo).toBe(true);
    expect(nueva.configImpresion.configurado).toBe(true);
    expect(a.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'LIMPIAR_EQUIPOS_IMPRESION_ANTIGUOS' }));
  });
});
