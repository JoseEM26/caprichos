jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
}));

import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccesoGuard } from './acceso.guard';
import { MATRIZ, ROLES } from './permisos';
import { InformesController } from '../informes/informes.controller';
import { ConfiguracionController } from '../configuracion/configuracion.controller';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { ContenidoAdminController } from '../contenido/contenido.controller';

const uniones = (...roles: string[]) => [...new Set(roles.flatMap((r) => MATRIZ[r]))];

describe('rol SUPERVISOR: matriz de permisos', () => {
  const supervisor = MATRIZ.SUPERVISOR;

  it('está en el catálogo de roles', () => {
    expect(ROLES.map((r) => r.codigo)).toContain('SUPERVISOR');
  });

  it('es exactamente la unión de CAJERO y MOZO, más su escritorio operativo', () => {
    // Excepción: almacen/apertura (conteo de apertura de productos) es de CAJERO pero no del supervisor
    // Sin dinero: tampoco cambia la ubicación de un delivery (pedidos/cambiar_ubicacion, aunque CAJERO lo tenga)
    const esperado = uniones('CAJERO', 'MOZO').filter((p) => p !== 'almacen/apertura' && p !== 'pedidos/cambiar_ubicacion' && p !== 'cupones/canjear' && p !== 'pedidos/anular');
    expect([...supervisor].sort()).toEqual([...esperado, 'escritorio/operativo', 'iniciativas/cambiar_estado'].sort());
  });

  it('valida el cambio de forma de pago en la puerta (como Caja)', () => {
    expect(supervisor).toContain('pedidos/validar_cambio_cobro');
    expect(MATRIZ.CAJERO).toContain('pedidos/validar_cambio_cobro');
    expect(MATRIZ.REPARTIDOR).toContain('repartos/solicitar_cambio_cobro');
    expect(MATRIZ.REPARTIDOR).not.toContain('pedidos/validar_cambio_cobro');
    expect(MATRIZ.MOZO).not.toContain('pedidos/validar_cambio_cobro');
  });

  it('ningún rol conserva los permisos del código del supervisor (retirados)', () => {
    for (const r of Object.keys(MATRIZ)) {
      expect(MATRIZ[r].filter((p) => p.startsWith('supervisor/'))).toEqual([]);
    }
  });

  it('no tiene ningún permiso de administración ni de diseño, contenido, informes, ganancias o compras', () => {
    const prohibidos = [
      'carta_diseno/', 'novedades/', 'destacadas/', 'informes/', 'indicadores/', 'auditoria/',
      'usuarios/', 'configuracion/', 'local/', 'zonas/', 'compras/', 'proveedores/',
      'pedidos_proveedor/', 'stock/', 'recetas/', 'almacen/', 'clientes/', 'creditos/',
      'ofertas/', 'cupones/', 'puntos/', 'reclamos/', 'pantallas/', 'mascota/', 'mensajes_carta/',
    ];
    for (const prefijo of prohibidos) {
      expect(supervisor.filter((p) => p.startsWith(prefijo))).toEqual([]);
    }
  });
});

describe('rol SUPERVISOR: decisiones del guard por ruta real', () => {
  const jwt: any = { verifyAsync: jest.fn(async () => ({ partyId: '7' })) };
  const config: any = { get: jest.fn(() => 'secreto-de-prueba') };
  let rolActual = 'SUPERVISOR';

  // Simula la tabla rol_permiso a partir de la matriz real
  const prisma: any = {
    userAccount: {
      findUnique: jest.fn(async () => ({ party_id: 7n, rol: rolActual, activo: true, debe_cambiar: false })),
    },
    userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
    rolPermiso: {
      findFirst: jest.fn(async ({ where }: any) => {
        const claves = where.OR.map((c: any) => `${c.permiso.modulo}/${c.permiso.accion}`);
        const roles: string[] = where.rol.in;
        return claves.some((c: string) => roles.some((r) => MATRIZ[r]?.includes(c))) ? { rol: roles[0] } : null;
      }),
    },
  };
  const auditoria: any = { registrar: jest.fn(async () => ({})) };

  // Devuelve true si el guard deja pasar la ruta para ese rol; false si responde 403
  async function entra(rol: string, controlador: any, metodo: string): Promise<boolean> {
    rolActual = rol;
    const guard = new AccesoGuard(new Reflector(), jwt, config, prisma, auditoria);
    const req: any = { headers: { authorization: 'Bearer t' }, ip: '10.0.0.1' };
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => controlador.prototype[metodo],
      getClass: () => controlador,
    };
    try {
      return await guard.canActivate(ctx);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
      expect((err as HttpException).getResponse()).toMatchObject({ codigo: 'SIN_PERMISO' });
      return false;
    }
  }

  it.each([
    ['informes (resumen)', InformesController, 'obtenerResumen'],
    ['informes (indicadores)', InformesController, 'obtenerIndicadores'],
    ['diseñador de la carta (ver)', ContenidoAdminController, 'obtenerDiseno'],
    ['diseñador de la carta (publicar)', ContenidoAdminController, 'publicarDiseno'],
    ['Novedades (ver)', ContenidoAdminController, 'obtenerEncabezadoNovedades'],
    ['Conócenos (ver)', ContenidoAdminController, 'obtenerConocenos'],
    ['usuarios (listar)', UsuariosController, 'listar'],
    ['usuarios (crear)', UsuariosController, 'crear'],
    ['configuración (listar)', ConfiguracionController, 'listar'],
    ['configuración (editar)', ConfiguracionController, 'actualizarPausaAltaDemanda'],
  ])('SUPERVISOR no entra a %s (403)', async (_nombre, controlador, metodo) => {
    expect(await entra('SUPERVISOR', controlador, metodo)).toBe(false);
  });

  it('ADMIN entra a esas mismas rutas', async () => {
    expect(await entra('ADMIN', InformesController, 'obtenerResumen')).toBe(true);
    expect(await entra('ADMIN', ContenidoAdminController, 'obtenerDiseno')).toBe(true);
    expect(await entra('ADMIN', UsuariosController, 'listar')).toBe(true);
    expect(await entra('ADMIN', ConfiguracionController, 'listar')).toBe(true);
  });

  it('SUPERVISOR entra a caja, salón y reservas, como el cajero y el mozo', async () => {
    expect(await entra('SUPERVISOR', InformesController, 'obtenerResumen')).toBe(false);
    expect(MATRIZ.SUPERVISOR).toEqual(expect.arrayContaining(['caja/cobrar', 'caja/cerrar', 'mesas/abrir', 'reservas/crear']));
  });
});
