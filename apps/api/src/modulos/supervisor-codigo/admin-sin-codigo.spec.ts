jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupervisorCodigoService, autorizarAdminSinCodigo, esOperadorSinCodigo } from './supervisor-codigo.service';
import { SupervisorCodigoGuard } from './supervisor-codigo.guard';
import { LocalController } from '../local/local.controller';
import { CobrosService } from '../caja/cobros.service';
import { CierreService } from '../cierre/cierre.service';
import { PedidosEstadoService } from '../pedidos-admin/pedidos-estado.service';

// Party 1 es ADMIN activo; party 2 es CAJERO. Sin party_id es la búsqueda del supervisor de auditoría.
const ADMIN = 1n;
const CAJERO = 2n;

function montar() {
  const prisma: any = {
    userAccount: {
      findFirst: jest.fn(async ({ where }: any) => {
        const roles: string[] = (where.OR ?? [where]).flatMap((c: any) => c.rol?.in ?? (c.rol ? [c.rol] : []));
        if (where.party_id === undefined) return roles.includes('ADMIN') ? { party_id: ADMIN, id: 10n, rol: 'ADMIN' } : null;
        if (where.party_id === ADMIN && roles.includes('ADMIN')) return { party_id: ADMIN, id: 10n, rol: 'ADMIN' };
        return null;
      }),
    },
    supervisorSecreto: { findUnique: jest.fn(async () => ({ secreto_cifrado: '', iv: '', tag: '' })) },
  };
  const redis: any = {
    get: jest.fn(async () => null),
    ttl: jest.fn(async () => 40),
    incr: jest.fn(async () => 1),
    expire: jest.fn(async () => 1),
    del: jest.fn(async () => 1),
    set: jest.fn(async () => 'OK'),
  };
  const redisService: any = { obtenerCliente: () => redis };
  const auditoria: any = { registrar: jest.fn(async () => ({})) };
  return { prisma, redis, redisService, auditoria };
}

const registrosAdmin = (auditoria: any) =>
  auditoria.registrar.mock.calls.filter(([a]: any[]) => a.accion === 'AUTORIZACION_SUPERVISOR');

describe('ADMIN sin código de supervisor', () => {
  describe('autorizarAdminSinCodigo (regla única)', () => {
    it('ADMIN: devuelve su identidad y audita con el motivo', async () => {
      const { prisma, auditoria } = montar();
      const r = await autorizarAdminSinCodigo(prisma, auditoria, ADMIN, 'local/horario', '10.0.0.1', 'local', 5n);
      expect(r).toEqual({ party_id: ADMIN, id: 10n });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUTORIZACION_SUPERVISOR',
          resultado: 'OK',
          entidad: 'local',
          entidadId: 5n,
          motivo: 'Acción local/horario: autorizado por rol ADMIN (sin código)',
        }),
      );
    });

    it('SUPERVISOR: se autoriza sola, queda auditada a su nombre con su rol', async () => {
      const { prisma, auditoria } = montar();
      prisma.userAccount.findFirst = jest.fn(async () => ({ party_id: 3n, id: 30n, rol: 'SUPERVISOR' }));
      const r = await autorizarAdminSinCodigo(prisma, auditoria, 3n, 'caja/cobrar', undefined, 'cobro', 9n);
      expect(r).toEqual({ party_id: 3n, id: 30n });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'AUTORIZACION_SUPERVISOR', partyId: 3n, motivo: 'Acción caja/cobrar: autorizado por rol SUPERVISOR (sin código)' }),
      );
    });

    it('CAJERO y operador ausente: null y sin auditoría de admin', async () => {
      const { prisma, auditoria } = montar();
      expect(await autorizarAdminSinCodigo(prisma, auditoria, CAJERO, 'caja/anular_cobro')).toBeNull();
      expect(await autorizarAdminSinCodigo(prisma, auditoria, undefined, 'caja/anular_cobro')).toBeNull();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('SupervisorCodigoService.verificarYConsumirCodigo', () => {
    it('ADMIN sin código: pasa, no toca Redis (no cuenta intentos) y audita', async () => {
      const { prisma, redis, redisService, auditoria } = montar();
      const service = new SupervisorCodigoService(prisma, redisService, auditoria);
      const r = await service.verificarYConsumirCodigo(undefined, ADMIN, 'configuracion/editar_parametro_sensible');
      expect(r.party_id).toBe(ADMIN);
      expect(redis.incr).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
      expect(registrosAdmin(auditoria)).toHaveLength(1);
    });

    it('CAJERO sin código: sigue exigiéndolo (CODIGO_INVALIDO 403) y cuenta el fallo', async () => {
      const { prisma, redisService, auditoria, redis } = montar();
      const service = new SupervisorCodigoService(prisma, redisService, auditoria);
      await expect(service.verificarYConsumirCodigo(undefined, CAJERO, 'local/horario')).rejects.toMatchObject({
        status: 403,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
      expect(redis.incr).toHaveBeenCalled();
      expect(registrosAdmin(auditoria)).toHaveLength(0);
    });
  });

  describe('SupervisorCodigoGuard (acción de horario)', () => {
    const ctx = (req: any) =>
      ({
        getHandler: () => LocalController.prototype.actualizarHorario,
        switchToHttp: () => ({ getRequest: () => req }),
      }) as any;

    it('ADMIN guardando el horario pasa sin código', async () => {
      const { prisma, redisService, auditoria } = montar();
      const guard = new SupervisorCodigoGuard(new Reflector(), new SupervisorCodigoService(prisma, redisService, auditoria));
      await expect(guard.canActivate(ctx({ headers: {}, body: [], usuario: { partyId: ADMIN, rol: 'ADMIN' } }))).resolves.toBe(true);
    });

    it('CAJERO guardando el horario sin código: 403 CODIGO_INVALIDO', async () => {
      const { prisma, redisService, auditoria } = montar();
      const guard = new SupervisorCodigoGuard(new Reflector(), new SupervisorCodigoService(prisma, redisService, auditoria));
      await expect(guard.canActivate(ctx({ headers: {}, body: [], usuario: { partyId: CAJERO, rol: 'CAJERO' } }))).rejects.toBeInstanceOf(HttpException);
    });
  });

  // Servicios que verifican el PIN por su cuenta cuando no tienen SupervisorCodigoService inyectado
  describe('verificadores propios (sin SupervisorCodigoService)', () => {
    it('CobrosService: ADMIN pasa y queda auditado; CAJERO sigue bloqueado por código', async () => {
      const { prisma, redisService, auditoria, redis } = montar();
      const s = new CobrosService(prisma, redisService, auditoria);
      await expect(s.verificarPinSupervisor(undefined, ADMIN, '1', 9n, 'caja/cobrar_sin_voucher')).resolves.toMatchObject({ party_id: ADMIN });
      expect(redis.incr).not.toHaveBeenCalled();
      expect(registrosAdmin(auditoria)).toHaveLength(1);
      await expect(s.verificarPinSupervisor(undefined, CAJERO, '1', 9n)).rejects.toMatchObject({ status: 403 });
      expect(redis.incr).toHaveBeenCalled();
    });

    it('CierreService: ADMIN pasa; CAJERO sigue bloqueado por código', async () => {
      const { prisma, redisService, auditoria, redis } = montar();
      const s = new CierreService(prisma, redisService, auditoria, undefined as any, undefined as any);
      await expect(s.verificarPinSupervisor(undefined, ADMIN, '1', 5n)).resolves.toMatchObject({ party_id: ADMIN });
      expect(redis.incr).not.toHaveBeenCalled();
      await expect(s.verificarPinSupervisor(undefined, CAJERO, '1', 5n)).rejects.toMatchObject({ status: 403 });
    });

    it('PedidosEstadoService: ADMIN pasa; CAJERO sigue bloqueado por código', async () => {
      const { prisma, redisService, auditoria, redis } = montar();
      const s = new PedidosEstadoService(prisma, redisService, auditoria);
      await expect(s.verificarPinSupervisor(undefined, ADMIN, '1', 7n)).resolves.toMatchObject({ party_id: ADMIN });
      expect(redis.incr).not.toHaveBeenCalled();
      await expect(s.verificarPinSupervisor(undefined, CAJERO, '1', 7n)).rejects.toMatchObject({ status: 403 });
    });
  });
});

describe('SUPERVISOR sin código de supervisor (misma regla que el ADMIN)', () => {
  const SUPERVISOR = 3n;
  const montarSupervisor = () => {
    const prisma: any = {
      userAccount: {
        findFirst: jest.fn(async ({ where }: any) =>
          where.party_id === SUPERVISOR ? { party_id: SUPERVISOR, id: 30n, rol: 'SUPERVISOR' } : null,
        ),
      },
    };
    const auditoria: any = { registrar: jest.fn(async () => ({})) };
    return { prisma, auditoria };
  };

  it('SUPERVISOR activo: devuelve su identidad y audita con el motivo de rol SUPERVISOR', async () => {
    const { prisma, auditoria } = montarSupervisor();
    const r = await autorizarAdminSinCodigo(prisma, auditoria, SUPERVISOR, 'cierre', '10.0.0.2', 'caja', 7n);
    expect(r).toEqual({ party_id: SUPERVISOR, id: 30n });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'AUTORIZACION_SUPERVISOR',
        resultado: 'OK',
        entidad: 'caja',
        entidadId: 7n,
        motivo: 'Acción cierre: autorizado por rol SUPERVISOR (sin código)',
      }),
    );
  });

  it('el operador sin rol de supervisor ni admin no se autoriza y no deja registro', async () => {
    const { prisma, auditoria } = montarSupervisor();
    const r = await autorizarAdminSinCodigo(prisma, auditoria, 2n, 'cierre');
    expect(r).toBeNull();
    expect(registrosAdmin(auditoria)).toHaveLength(0);
  });

  it('esOperadorSinCodigo: sin party no consulta nada', async () => {
    const { prisma } = montarSupervisor();
    expect(await esOperadorSinCodigo(prisma, undefined)).toBeNull();
    expect(prisma.userAccount.findFirst).not.toHaveBeenCalled();
  });
});
