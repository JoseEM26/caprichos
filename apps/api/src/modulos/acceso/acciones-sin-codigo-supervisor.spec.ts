jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
// Dependencias de PDF/QR que arrastra el controlador de pedidos: aquí no se usan
jest.mock('pdfkit', () => ({}), { virtual: true });
jest.mock('qrcode', () => ({}), { virtual: true });

import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccesoGuard } from './acceso.guard';
import { CLAVE_PERMISO } from './permiso.decorator';
import { MATRIZ, PERMISOS, ROLES } from './permisos';
import { CortesiasController, CortesiaLineaController } from '../cortesias/cortesias.controller';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { PedidosAdminController } from '../pedidos-admin/pedidos-admin.controller';
import { LocalController } from '../local/local.controller';
import { ConfiguracionController } from '../configuracion/configuracion.controller';
import { CocinaController } from '../cocina/cocina.controller';
import { CajaController } from '../caja/caja.controller';
import { AlmacenController } from '../almacen/almacen.controller';
import { SalonController } from '../salon/salon.controller';

/**
 * Decisión del dueño: el código del supervisor ya no existe. Estas acciones se protegen SOLO por su permiso
 * normal (@Permiso): con el permiso entran sin ningún código; sin él, 403. La auditoría de cada acción la
 * prueban los specs de su servicio (anular pedido, anular cobro, cierre, cortesías, etc.).
 */
const ACCIONES: Array<[string, any, string]> = [
  ['cortesía separada', CortesiasController, 'registrar'],
  ['cortesía en línea', CortesiaLineaController, 'darEnLinea'],
  ['cortesía al abrir pedido de mesa', SalonController, 'abrirPedido'],
  ['crear pedido (con cortesía)', PedidosAdminController, 'crear'],
  ['desactivar usuario', UsuariosController, 'desactivar'],
  ['cambiar rol de usuario', UsuariosController, 'editar'],
  ['devolución de pedido', PedidosAdminController, 'registrarDevolucion'],
  ['anular pedido / cambiar estado', PedidosAdminController, 'cambiarEstado'],
  ['horario del local', LocalController, 'actualizarHorario'],
  ['pausa por alta demanda (configuración)', ConfiguracionController, 'actualizarPausaAltaDemanda'],
  ['editar parámetro sensible', ConfiguracionController, 'actualizar'],
  ['pausa por alta demanda (cocina)', CocinaController, 'configurarAltaDemanda'],
  ['anular movimiento de caja', CajaController, 'anularMovimiento'],
  ['anular cobro', CajaController, 'anularCobro'],
  ['merma múltiple grande', AlmacenController, 'mermaMultiple'],
  ['anular producción', AlmacenController, 'anularProduccion'],
  ['anular movimiento de almacén', AlmacenController, 'anularMovimiento'],
];

const permisosDe = (ctrl: any, metodo: string): string[] => {
  const meta = Reflect.getMetadata(CLAVE_PERMISO, ctrl.prototype[metodo]);
  return (Array.isArray(meta) ? meta : [meta]).map((p: any) => `${p.modulo}/${p.accion}`);
};

describe('acciones antes protegidas por el código del supervisor: ahora solo por permiso', () => {
  const jwt: any = { verifyAsync: jest.fn(async () => ({ partyId: '7' })) };
  const config: any = { get: jest.fn(() => 'secreto-de-prueba') };
  let rolActual = 'ADMIN';

  // Simula rol_permiso a partir de la matriz real
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

  async function entra(rol: string, ctrl: any, metodo: string, req: any = {}): Promise<boolean> {
    rolActual = rol;
    const guard = new AccesoGuard(new Reflector(), jwt, config, prisma, auditoria);
    const r: any = { headers: { authorization: 'Bearer t' }, ip: '10.0.0.1', body: {}, ...req };
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => r }),
      getHandler: () => ctrl.prototype[metodo],
      getClass: () => ctrl,
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

  it.each(ACCIONES)('%s: ninguna guarda de código, solo @Permiso', (_n, ctrl, metodo) => {
    expect(Reflect.getMetadata('__guards__', ctrl.prototype[metodo])).toBeUndefined();
    expect(Reflect.getMetadata('requiere_codigo_supervisor', ctrl.prototype[metodo])).toBeUndefined();
    expect(permisosDe(ctrl, metodo).length).toBeGreaterThan(0);
  });

  it.each(ACCIONES)('%s: con el permiso entra sin código y sin él recibe 403', async (_n, ctrl, metodo) => {
    const requeridos = permisosDe(ctrl, metodo);
    const rolesCon = ROLES.map((r) => r.codigo).filter((r) => requeridos.some((p) => MATRIZ[r]?.includes(p)));
    const rolesSin = ROLES.map((r) => r.codigo).filter((r) => !requeridos.some((p) => MATRIZ[r]?.includes(p)));

    expect(rolesCon.length).toBeGreaterThan(0);
    for (const rol of rolesCon) {
      expect(await entra(rol, ctrl, metodo)).toBe(true);
    }
    // El ADMIN lo tiene todo: los roles sin permiso son los demás
    for (const rol of rolesSin) {
      expect(await entra(rol, ctrl, metodo)).toBe(false);
    }
  });

  it('el SUPERVISOR entra a cortesías, anular pedido y devolución sin código (ya no hay código)', async () => {
    expect(await entra('SUPERVISOR', CortesiasController, 'registrar')).toBe(true);
    expect(await entra('SUPERVISOR', PedidosAdminController, 'registrarDevolucion')).toBe(true);
    expect(await entra('SUPERVISOR', PedidosAdminController, 'cambiarEstado')).toBe(true);
  });

  it('no queda ningún permiso supervisor/* ni la ruta del código del supervisor', () => {
    expect(PERMISOS.filter((p) => p.modulo === 'supervisor')).toEqual([]);
  });
});
