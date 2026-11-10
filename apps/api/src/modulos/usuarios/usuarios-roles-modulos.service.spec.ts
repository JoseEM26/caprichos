import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MODULOS_ROL, coincideMinimo, moduloRolVisible } from '@caprichos/compartido';
import { UsuariosRolesModulosService } from './usuarios-roles-modulos.service';
import { SincronizadorPermisosService } from '../acceso/sincronizador-permisos.service';
import { MATRIZ, PERMISOS } from '../acceso/permisos';

/** Base en memoria con lo justo de Prisma que usan el servicio y el sincronizador. */
function fakePrisma() {
  const permisos = PERMISOS.map((p, i) => ({ id: BigInt(i + 1), modulo: p.modulo, accion: p.accion }));
  const porId = new Map(permisos.map((p) => [p.id, p]));
  const vinculos = new Set<string>(); // rol|id
  for (const [rol, cs] of Object.entries(MATRIZ)) for (const c of cs) vinculos.add(`${rol}|${permisos.find((p) => `${p.modulo}/${p.accion}` === c)!.id}`);
  let ajustes: any[] = [];
  const filas = () => [...vinculos].map((v) => { const [rol, id] = v.split('|'); return { rol, permiso_id: BigInt(id), permiso: porId.get(BigInt(id))! }; });
  const coincide = (f: any, w: any): boolean => {
    if (!w) return true;
    if (w.rol !== undefined) {
      if (typeof w.rol === 'string' ? f.rol !== w.rol : w.rol.in ? !w.rol.in.includes(f.rol) : w.rol.notIn?.includes(f.rol)) return false;
    }
    if (w.permiso_id?.in && !w.permiso_id.in.includes(f.permiso_id)) return false;
    if (w.permiso) {
      const pp = w.permiso;
      if (pp.OR && !pp.OR.some((o: any) => o.modulo === f.permiso.modulo && o.accion === f.permiso.accion)) return false;
      if (pp.modulo !== undefined && (pp.modulo !== f.permiso.modulo || pp.accion !== f.permiso.accion)) return false;
    }
    return true;
  };
  const db: any = {
    permiso: { findMany: async () => permisos, createMany: async () => ({}), deleteMany: async () => ({}) },
    rolPermiso: {
      findMany: async ({ where }: any = {}) => filas().filter((f) => coincide(f, where)),
      createMany: async ({ data }: any) => { for (const d of data) vinculos.add(`${d.rol}|${d.permiso_id}`); return {}; },
      deleteMany: async ({ where }: any) => { for (const f of filas().filter((x) => coincide(x, where))) vinculos.delete(`${f.rol}|${f.permiso_id}`); return {}; },
    },
    rolPermisoAjuste: {
      findMany: async () => ajustes,
      deleteMany: async ({ where }: any) => { ajustes = ajustes.filter((a) => a.rol !== where.rol); return {}; },
      createMany: async ({ data }: any) => { ajustes.push(...data); return {}; },
    },
    $transaction: async (fn: any) => fn(db),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const claves = (rol: string) => filas().filter((f) => f.rol === rol).map((f) => `${f.permiso.modulo}/${f.permiso.accion}`);
  return { db, auditoria, claves, ajustes: () => ajustes, svc: new UsuariosRolesModulosService(db, auditoria), sync: new SincronizadorPermisosService(db) };
}

const admin: any = { rol: 'ADMIN', partyId: 7n };
const ve = (permisos: string[], clave: string) => moduloRolVisible(MODULOS_ROL.find((m) => m.clave === clave)!, permisos);
const modulosDe = (permisos: string[]) => MODULOS_ROL.filter((m) => moduloRolVisible(m, permisos)).map((m) => m.clave);

describe('catálogo de módulos por rol', () => {
  it('los mínimos y lecturas existen en PERMISOS y ninguna lectura abre otro módulo', () => {
    const todos = PERMISOS.map((p) => `${p.modulo}/${p.accion}`);
    for (const m of MODULOS_ROL) {
      expect(todos.some((c) => coincideMinimo(c, m.minimo))).toBe(true);
      for (const l of [m.otorga, ...(m.lecturas ?? [])].filter(Boolean) as string[]) expect(todos).toContain(l);
      for (const l of m.lecturas ?? []) expect(MODULOS_ROL.some((o) => coincideMinimo(l, o.minimo))).toBe(false);
    }
  });
  it('usuarios/administrar_roles solo lo tiene ADMIN', () => {
    expect(MATRIZ.ADMIN).toContain('usuarios/administrar_roles');
    for (const r of Object.keys(MATRIZ).filter((k) => k !== 'ADMIN')) expect(MATRIZ[r]).not.toContain('usuarios/administrar_roles');
  });
});

describe('UsuariosRolesModulosService', () => {
  it('conceder: MOZO recibe Informes con su permiso mínimo y la lectura, sin escritura', async () => {
    const { svc, claves, ajustes, auditoria } = fakePrisma();
    expect(ve(claves('MOZO'), 'informes')).toBe(false);
    const base = modulosDe(MATRIZ.MOZO);
    const r = await svc.guardarModulos('MOZO', [...base, 'informes'], admin, '1.1.1.1');
    expect(r.agregados).toEqual(expect.arrayContaining(['informes', 'historial', 'indicadores']));
    expect(claves('MOZO')).toEqual(expect.arrayContaining(['auditoria/ver', 'informes/ver']));
    expect(claves('MOZO')).not.toContain('informes/exportar');
    expect(ajustes().every((a) => a.efecto === 'CONCEDE')).toBe(true);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ROL_MODULOS_GUARDAR', partyId: 7n, despues: expect.objectContaining({ agregados: expect.any(Array) }) }),
      expect.anything(),
    );
  });

  it('quitar: CAJERO pierde Caja y Cierre (comparten mínimo) y queda como QUITA', async () => {
    const { svc, claves, ajustes } = fakePrisma();
    const base = modulosDe(MATRIZ.CAJERO).filter((c) => c !== 'caja' && c !== 'cierre');
    await svc.guardarModulos('CAJERO', base, admin);
    expect(claves('CAJERO')).not.toContain('caja/ver');
    expect(claves('CAJERO')).toContain('pedidos/ver'); // las lecturas compartidas no se quitan
    expect(ajustes()).toEqual([expect.objectContaining({ rol: 'CAJERO', modulo: 'caja', accion: 'ver', efecto: 'QUITA' })]);
  });

  it('un módulo conceder trae lo mínimo para cargar: Repartos da repartos/ver y pedidos/ver', async () => {
    const { svc, claves } = fakePrisma();
    await svc.guardarModulos('ALMACEN', [...modulosDe(MATRIZ.ALMACEN), 'repartos'], admin);
    expect(claves('ALMACEN')).toEqual(expect.arrayContaining(['repartos/ver', 'pedidos/ver']));
    expect(claves('ALMACEN')).not.toContain('repartos/liquidar');
  });

  it('restablecer borra los ajustes y vuelve a la base', async () => {
    const { svc, claves, ajustes } = fakePrisma();
    const antes = [...claves('MOZO')].sort();
    await svc.guardarModulos('MOZO', [...modulosDe(MATRIZ.MOZO), 'informes'], admin);
    await svc.guardarModulos('MOZO', modulosDe(MATRIZ.MOZO).filter((c) => c !== 'plano'), admin);
    const r = await svc.restablecer('MOZO', admin);
    expect(ajustes()).toHaveLength(0);
    expect(claves('MOZO').sort()).toEqual(antes);
    expect(r.ajustes).toBe(0);
  });

  it('guardar la misma lista que ya ve no crea ajustes', async () => {
    const { svc, ajustes } = fakePrisma();
    await svc.guardarModulos('COCINA', modulosDe(MATRIZ.COCINA), admin);
    expect(ajustes()).toHaveLength(0);
  });

  it('ADMIN intocable, solo ADMIN, rol inválido y módulos obligatorios', async () => {
    const { svc } = fakePrisma();
    await expect(svc.guardarModulos('ADMIN', [], admin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.restablecer('ADMIN', admin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.guardarModulos('MOZO', [], { rol: 'CAJERO', partyId: 1n } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.guardarModulos('CALLCENTER', [], admin)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.guardarModulos('MOZO', ['no-existe'], admin)).rejects.toBeInstanceOf(BadRequestException);
    // quitar «Mi asistencia» (marcar) a un rol que la tiene: rechazado y sin cambios
    const sinMarcar = modulosDe(MATRIZ.MOZO).filter((c) => c !== 'mi-asistencia');
    await expect(svc.guardarModulos('MOZO', sinMarcar, admin)).rejects.toMatchObject({ response: { codigo: 'MODULO_BLOQUEADO' } });
  });

  it('listar marca lo ajustado y ADMIN no es editable', async () => {
    const { svc } = fakePrisma();
    await svc.guardarModulos('MOZO', [...modulosDe(MATRIZ.MOZO), 'informes'], admin);
    const { roles } = await svc.listar();
    const mozo = roles.find((r) => r.rol === 'MOZO')!;
    expect(mozo.modulos.informes).toEqual({ ve: true, base: false, ajustado: true });
    expect(mozo.ajustes).toBeGreaterThan(0);
    const adm = roles.find((r) => r.rol === 'ADMIN')!;
    expect(adm.editable).toBe(false);
    expect(Object.values(adm.modulos).every((x: any) => x.ve)).toBe(true);
  });
});

describe('el sincronizador respeta los ajustes del dueño', () => {
  it('tras re-sincronizar (un despliegue) los CONCEDE y los QUITA siguen', async () => {
    const f = fakePrisma();
    await f.svc.guardarModulos('MOZO', [...modulosDe(MATRIZ.MOZO).filter((c) => c !== 'plano'), 'informes'], admin);
    await f.sync.sincronizar();
    expect(f.claves('MOZO')).toEqual(expect.arrayContaining(['auditoria/ver', 'informes/ver']));
    expect(f.claves('MOZO')).not.toContain('plano/ver');
  });

  it('si el sistema agrega un permiso nuevo a MATRIZ se suma sin revertir lo que el dueño quitó', async () => {
    const f = fakePrisma();
    await f.svc.guardarModulos('MOZO', modulosDe(MATRIZ.MOZO).filter((c) => c !== 'plano'), admin);
    MATRIZ.MOZO.push('catalogo/ver'); // permiso nuevo del sistema
    try {
      await f.sync.sincronizar();
      expect(f.claves('MOZO')).toContain('catalogo/ver');
      expect(f.claves('MOZO')).not.toContain('plano/ver');
    } finally {
      MATRIZ.MOZO.pop();
    }
  });

  it('un QUITA reaparecido por un estado anterior (vínculo suelto) se elimina; ADMIN conserva todo', async () => {
    const f = fakePrisma();
    await f.svc.guardarModulos('CAJERO', modulosDe(MATRIZ.CAJERO).filter((c) => c !== 'propinas'), admin);
    const id = PERMISOS.findIndex((p) => p.modulo === 'propinas' && p.accion === 'ver') + 1;
    await f.db.rolPermiso.createMany({ data: [{ rol: 'CAJERO', permiso_id: BigInt(id) }] });
    await f.sync.sincronizar();
    expect(f.claves('CAJERO')).not.toContain('propinas/ver');
    expect(f.claves('ADMIN')).toHaveLength(PERMISOS.length);
  });

  it('ajustes sobre ADMIN (de una base manipulada) se ignoran', async () => {
    const f = fakePrisma();
    f.ajustes().push({ rol: 'ADMIN', modulo: 'caja', accion: 'ver', efecto: 'QUITA' });
    await f.sync.sincronizar();
    expect(f.claves('ADMIN')).toContain('caja/ver');
  });
});
