jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({ signAsync: jest.fn(), verifyAsync: jest.fn() })),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import 'reflect-metadata';
import { CLAVE_PERMISO, PermisoRequerido } from './permiso.decorator';
import { MATRIZ, PERMISOS, ROLES } from './permisos';
import { errorCombinacionRoles } from './roles-usuario';
import { CATALOGO_PERMISOS } from './permisos-extra';
import { ContenidoAdminController } from '../contenido/contenido.controller';
import { ResenasAdminController } from '../resenas/resenas-admin.controller';
import { ArchivosController } from '../archivos/archivos.controller';

/** Lo ÚNICO que puede hacer Marketing y diseño (decisión del dueño): los seis módulos de contenido de la carta + lo personal. */
const ESPERADO_MARKETING = [
  'carta_diseno/ver', 'carta_diseno/editar', 'carta_diseno/publicar',
  'novedades/ver', 'novedades/crear', 'novedades/editar',
  'conocenos/ver', 'conocenos/editar', 'conocenos/publicar',
  'destacadas/ver', 'destacadas/crear', 'destacadas/editar', 'destacadas/archivar', 'destacadas/eliminar',
  'resenas/ver', 'resenas/editar',
  'paleta/ver', 'paleta/editar', 'paleta/publicar',
  'archivos/subir',
  'notificaciones/ver', 'notificaciones/marcar',
  'asistencia/marcar',
];

const exigidos = (ctrl: { prototype: any }): Array<{ metodo: string; permisos: string[] }> =>
  Object.getOwnPropertyNames(ctrl.prototype)
    .filter((m) => m !== 'constructor')
    .map((metodo) => {
      const meta = Reflect.getMetadata(CLAVE_PERMISO, ctrl.prototype[metodo]) as PermisoRequerido | PermisoRequerido[] | undefined;
      const lista = meta === undefined ? [] : Array.isArray(meta) ? meta : [meta];
      return { metodo, permisos: lista.map((p) => `${p.modulo}/${p.accion}`) };
    });

/** Misma regla del guard: basta uno de los permisos exigidos. */
const puede = (rol: string, permisos: string[]) => permisos.some((p) => MATRIZ[rol].includes(p));

describe('rol MARKETING (Marketing y diseño)', () => {
  it('existe en el catálogo con su nombre visible', () => {
    expect(ROLES).toContainEqual({ codigo: 'MARKETING', nombre: 'Marketing y diseño' });
  });

  it('tiene exactamente los permisos esperados y ninguno de otros módulos', () => {
    expect([...MATRIZ.MARKETING].sort()).toEqual([...ESPERADO_MARKETING].sort());
    const prohibidos = [
      'usuarios', 'configuracion', 'local', 'caja', 'pedidos', 'cocina', 'clientes', 'comprobantes', 'almacen', 'stock',
      'informes', 'indicadores', 'mensajes', 'mensajes_carta', 'creditos', 'planilla', 'auditoria', 'catalogo', 'ofertas', 'puntos',
    ];
    for (const modulo of prohibidos) {
      expect(MATRIZ.MARKETING.filter((p) => p.startsWith(`${modulo}/`))).toEqual([]);
    }
  });

  it('todo permiso del rol existe en el catálogo (sin erratas)', () => {
    for (const p of MATRIZ.MARKETING) expect(CATALOGO_PERMISOS.has(p)).toBe(true);
  });

  it('ADMIN conserva todo, incluidos los permisos nuevos', () => {
    expect(MATRIZ.ADMIN).toHaveLength(PERMISOS.length);
    for (const p of ['paleta/ver', 'paleta/editar', 'paleta/publicar', 'resenas/ver', 'resenas/editar', 'conocenos/ver', 'conocenos/editar', 'conocenos/publicar']) {
      expect(MATRIZ.ADMIN).toContain(p);
    }
  });

  it('los permisos nuevos solo los tienen ADMIN y MARKETING', () => {
    for (const rol of Object.keys(MATRIZ).filter((r) => r !== 'ADMIN' && r !== 'MARKETING')) {
      expect(MATRIZ[rol].filter((p) => /^(paleta|resenas|conocenos|carta_diseno|novedades|destacadas)\//.test(p))).toEqual([]);
    }
  });

  it('se combina con otros roles (no es exclusivo), salvo ADMIN y REPARTIDOR', () => {
    expect(errorCombinacionRoles('CAJERO', ['MARKETING'])).toBeNull();
    expect(errorCombinacionRoles('MARKETING', ['MOZO', 'APOYO_DELIVERY'])).toBeNull();
    expect(errorCombinacionRoles('MARKETING', ['ADMIN'])).not.toBeNull();
    expect(errorCombinacionRoles('MARKETING', ['REPARTIDOR'])).not.toBeNull();
  });

  it('marca asistencia como el resto del personal (todos menos ADMIN)', () => {
    expect(MATRIZ.MARKETING).toContain('asistencia/marcar');
  });
});

describe('controladores de los seis módulos: aceptan MARKETING y rechazan a CAJERO/MOZO', () => {
  const contenido = exigidos(ContenidoAdminController);
  const deMensajes = (m: { permisos: string[] }) => m.permisos.every((p) => p.startsWith('mensajes_carta/'));

  it('todos los endpoints de /admin/contenido y /admin/resenas declaran un permiso del catálogo', () => {
    for (const { metodo, permisos } of [...contenido, ...exigidos(ResenasAdminController)]) {
      expect(permisos.length).toBeGreaterThan(0);
      for (const p of permisos) expect(CATALOGO_PERMISOS.has(p)).toBe(true);
      expect(metodo).toBeTruthy();
    }
  });

  it('contenido (diseñador, novedades, conócenos, destacadas, paleta): MARKETING entra a todo salvo al buzón de mensajes de la carta', () => {
    for (const m of contenido) {
      expect(puede('MARKETING', m.permisos)).toBe(!deMensajes(m));
    }
  });

  it('reseñas: MARKETING y ADMIN entran; ya no hay comprobación manual de ADMIN', () => {
    for (const m of exigidos(ResenasAdminController)) {
      expect(puede('MARKETING', m.permisos)).toBe(true);
      expect(puede('ADMIN', m.permisos)).toBe(true);
    }
    expect(ResenasAdminController.toString()).not.toContain('soloAdmin');
  });

  it('CAJERO, MOZO, SUPERVISOR y los demás roles no entran a ningún endpoint de contenido ni de reseñas', () => {
    const todos = [...contenido, ...exigidos(ResenasAdminController)].filter((m) => !deMensajes(m));
    for (const rol of ['CAJERO', 'MOZO', 'SUPERVISOR', 'COCINA', 'ALMACEN', 'REPARTIDOR', 'APOYO_DELIVERY']) {
      for (const m of todos) expect(puede(rol, m.permisos)).toBe(false);
    }
  });

  it('paleta tiene permiso propio (ver, editar, publicar) y ya no cuelga de carta_diseno ni de local', () => {
    const porMetodo = Object.fromEntries(contenido.map((m) => [m.metodo, m.permisos]));
    expect(porMetodo.obtenerPaletas).toEqual(['paleta/ver']);
    expect(porMetodo.guardarBorradorPaleta).toEqual(['paleta/editar']);
    expect(porMetodo.descartarPaleta).toEqual(['paleta/editar']);
    expect(porMetodo.publicarPaleta).toEqual(['paleta/publicar']);
  });

  it('conócenos tiene permiso propio y ya no cuelga de novedades', () => {
    const porMetodo = Object.fromEntries(contenido.map((m) => [m.metodo, m.permisos]));
    expect(porMetodo.obtenerConocenos).toEqual(['conocenos/ver']);
    expect(porMetodo.guardarBorradorConocenos).toEqual(['conocenos/editar']);
    expect(porMetodo.publicarConocenos).toEqual(['conocenos/publicar']);
    expect(porMetodo.descartarConocenos).toEqual(['conocenos/editar']);
  });

  it('subir fotos (POST /admin/archivos) lo puede hacer MARKETING; leer archivos privados no', () => {
    const arch = Object.fromEntries(exigidos(ArchivosController).map((m) => [m.metodo, m.permisos]));
    expect(puede('MARKETING', arch.subir)).toBe(true);
    expect(puede('MARKETING', arch.servirPrivado)).toBe(false);
  });
});
