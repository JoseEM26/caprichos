jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ForbiddenException, HttpException } from '@nestjs/common';
import { NotificacionesService, visibleA } from './notificaciones.service';
import { CATALOGO_AVISOS, CLAVE_AVISOS_POR_ROL, ROLES_AVISO, defectoAvisos, rolesPorDefecto } from './avisos-por-rol';

const ADMIN = { partyId: 1n, rol: 'ADMIN', roles: ['ADMIN'], debeCambiar: false };
const CAJERO = { partyId: 3n, rol: 'CAJERO', roles: ['CAJERO'], debeCambiar: false };
const MOZO = { partyId: 2n, rol: 'MOZO', roles: ['MOZO'], debeCambiar: false };
const MOZO_CAJERO = { partyId: 5n, rol: 'MOZO', roles: ['MOZO', 'CAJERO'], debeCambiar: false };

// permisos inventados por rol
const PERMISOS: Record<string, string[]> = {
  CAJERO: ['caja/ver', 'pedidos/ver', 'mensajes/ver'],
  MOZO: ['mesas/ver'],
};
const tiene = (rol: string, p: string) => (PERMISOS[rol] ?? []).includes(p);

const armar = (guardado?: unknown) => {
  const prisma: any = {
    parametro: {
      findUnique: jest.fn().mockResolvedValue(guardado === undefined ? null : { valor: guardado }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    rolPermiso: {
      findMany: jest.fn().mockResolvedValue(
        Object.entries(PERMISOS).flatMap(([rol, ps]) =>
          ps.map((p) => ({ rol, permiso: { modulo: p.split('/')[0], accion: p.split('/')[1] } })),
        ),
      ),
    },
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const eventos: any = { emitirAdmin: jest.fn(), emitirAParty: jest.fn() };
  return { prisma, auditoria, eventos, servicio: new NotificacionesService(prisma, auditoria, eventos) };
};

const completa = (cambios: Record<string, string[]> = {}) => ({ ...defectoAvisos(tiene), ...cambios });

describe('Avisos por rol: valores por defecto', () => {
  it('ADMIN ve todos los tipos; MOZO solo mesa lista y mensajes internos; COCINA solo mensajes internos', () => {
    const de = (rol: string) => CATALOGO_AVISOS.map((a) => a.tipo).filter((t) => rolesPorDefecto(t, tiene).includes(rol));
    expect(de('ADMIN')).toHaveLength(CATALOGO_AVISOS.length);
    expect(de('MOZO')).toEqual(['MESA_LISTA', 'MENSAJE_INTERNO']);
    expect(de('COCINA')).toEqual(['MENSAJE_INTERNO']);
  });

  it('lo creado para Caja o para el ADMIN no llega a otros roles aunque tengan el permiso', () => {
    expect(rolesPorDefecto('WHATSAPP_CONSUMO', () => true)).toEqual(['ADMIN']);
    expect(rolesPorDefecto('VOUCHER_PENDIENTE_MOZO', () => true)).toEqual(['ADMIN', 'CAJERO', 'SUPERVISOR']);
    expect(rolesPorDefecto('PEDIDO_NUEVO', tiene)).toEqual(['ADMIN', 'CAJERO']);
  });

  it('sin parámetro guardado el servicio devuelve la tabla con esos valores', async () => {
    const { servicio } = armar();
    const r = await servicio.avisosPorRol(ADMIN);
    expect(r.roles).toEqual([...ROLES_AVISO]);
    expect(r.avisos.find((a) => a.tipo === 'PEDIDO_NUEVO')!.roles).toEqual(['ADMIN', 'CAJERO']);
    expect(r.avisos).toHaveLength(CATALOGO_AVISOS.length);
  });
});

describe('Avisos por rol: filtro en el servidor', () => {
  const claves = async (usuario: any, guardado?: unknown) => {
    const { servicio } = armar(guardado);
    return (servicio as any).clavesVisibles(usuario, (p: string) => usuario.roles.some((r: string) => tiene(r, p)));
  };

  it('sin configurar, cada rol ve lo de siempre', async () => {
    expect(await claves(MOZO)).toEqual(['MESA_LISTA', 'MENSAJE_INTERNO']);
    expect(await claves(CAJERO)).toContain('PEDIDO_NUEVO');
  });

  it('marcar una casilla le da el aviso al rol; desmarcarla se lo quita', async () => {
    const guardado = completa({ PEDIDO_NUEVO: ['ADMIN', 'MOZO'], ATENCION_WHATSAPP: ['ADMIN'] });
    expect(await claves(MOZO, guardado)).toContain('PEDIDO_NUEVO');
    expect(await claves(CAJERO, guardado)).not.toContain('PEDIDO_NUEVO');
    expect(await claves(CAJERO, guardado)).not.toContain('ATENCION_WHATSAPP');
  });

  it('una persona con varios roles ve la unión', async () => {
    const guardado = completa({ PEDIDO_NUEVO: ['CAJERO'], MESA_LISTA: ['MOZO'], STOCK_BAJO: ['ALMACEN'] });
    const c = await claves(MOZO_CAJERO, guardado);
    expect(c).toEqual(expect.arrayContaining(['PEDIDO_NUEVO', 'MESA_LISTA']));
    expect(c).not.toContain('STOCK_BAJO');
  });

  it('visibleA: lo desmarcado no pasa, un tipo desconocido solo lo ve el ADMIN, lo personal solo su dueño', () => {
    const cumple = (u: any, fila: any, cl: string[]) => {
      const w: any = visibleA(u, cl);
      const ev = (f: any, c: any): boolean => {
        return Object.entries(c).every(([k, v]: any) => {
          if (k === 'AND') return v.every((x: any) => ev(f, x));
          if (k === 'OR') return v.some((x: any) => ev(f, x));
          if (k === 'NOT') return !ev(f, v);
          if (v === null) return f[k] == null;
          if (typeof v === 'object' && typeof v !== 'bigint') {
            if ('in' in v) return v.in.includes(f[k]);
            if ('notIn' in v) return !v.notIn.includes(f[k]);
            if ('startsWith' in v) return String(f[k]).startsWith(v.startsWith);
          }
          return f[k] === v;
        });
      };
      return ev({ party_destino: null, rol_destino: null, ...fila }, w);
    };
    expect(cumple(CAJERO, { tipo: 'PEDIDO_NUEVO' }, [])).toBe(false);
    expect(cumple(CAJERO, { tipo: 'PEDIDO_NUEVO' }, ['PEDIDO_NUEVO'])).toBe(true);
    expect(cumple(CAJERO, { tipo: 'NUEVO_SIN_CATALOGO' }, ['PEDIDO_NUEVO'])).toBe(false);
    expect(cumple(ADMIN, { tipo: 'NUEVO_SIN_CATALOGO' }, [])).toBe(true);
    expect(cumple(ADMIN, { tipo: 'PEDIDO_NUEVO' }, [])).toBe(false); // el ADMIN también puede desmarcarse
    expect(cumple(ADMIN, { tipo: 'FACTURACION:x' }, [])).toBe(false);
    expect(cumple(ADMIN, { tipo: 'FACTURACION:x' }, ['FACTURACION:'])).toBe(true);
    expect(cumple(MOZO, { tipo: 'PEDIDO_NUEVO', party_destino: 2n }, [])).toBe(true);
    expect(cumple(ADMIN, { tipo: 'PEDIDO_NUEVO', party_destino: 2n }, ['PEDIDO_NUEVO'])).toBe(false);
  });
});

describe('Avisos por rol: guardar', () => {
  it('solo el ADMIN lee o edita', async () => {
    const { servicio, prisma } = armar();
    await expect(servicio.avisosPorRol(CAJERO)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.guardarAvisosPorRol(completa(), CAJERO)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.parametro.upsert).not.toHaveBeenCalled();
  });

  it('guarda la tabla completa, audita antes y después y avisa a las pantallas', async () => {
    const { servicio, prisma, auditoria, eventos } = armar();
    const nueva = completa({ PEDIDO_NUEVO: ['ADMIN', 'MOZO'] });
    await servicio.guardarAvisosPorRol(nueva, ADMIN, '1.2.3.4');
    expect(prisma.parametro.upsert.mock.calls[0][0].where).toEqual({ clave: CLAVE_AVISOS_POR_ROL });
    expect(prisma.parametro.upsert.mock.calls[0][0].update.valor.PEDIDO_NUEVO).toEqual(['ADMIN', 'MOZO']);
    const aud = auditoria.registrar.mock.calls[0][0];
    expect(aud.accion).toBe('AVISOS_POR_ROL');
    expect(aud.antes.valor.PEDIDO_NUEVO).toEqual(['ADMIN', 'CAJERO']);
    expect(aud.despues.valor.PEDIDO_NUEVO).toEqual(['ADMIN', 'MOZO']);
    expect(aud.partyId).toBe(1n);
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', {});
  });

  it('rechaza roles desconocidos o tipos faltantes', async () => {
    const { servicio, prisma } = armar();
    await expect(servicio.guardarAvisosPorRol(completa({ PEDIDO_NUEVO: ['CHEF'] }), ADMIN)).rejects.toBeInstanceOf(HttpException);
    const sinUno: any = completa();
    delete sinUno.STOCK_BAJO;
    await expect(servicio.guardarAvisosPorRol(sinUno, ADMIN)).rejects.toBeInstanceOf(HttpException);
    expect(prisma.parametro.upsert).not.toHaveBeenCalled();
  });
});
