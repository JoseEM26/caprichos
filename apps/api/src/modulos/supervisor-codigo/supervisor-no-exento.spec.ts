jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { HttpException } from '@nestjs/common';
import { SupervisorCodigoService } from './supervisor-codigo.service';
import { cifrarSecreto, derivarClaveCifrado } from './totp.util';

// Party 1 ADMIN, party 2 CAJERO (opera), party 3 SUPERVISOR (tiene el código en pantalla)
const ADMIN = 1n;
const CAJERO = 2n;
const SUPERVISOR = 3n;

const secretoFijo = Buffer.from('12345678901234567890', 'ascii');
const cifrado = cifrarSecreto(secretoFijo, derivarClaveCifrado());
const filaSecreto = { local_codigo: 'CAPRICHOS', secreto_cifrado: cifrado.secretoCifrado, iv: cifrado.iv, tag: cifrado.tag };

function montar() {
  const almacen = new Map<string, string>();
  const redis: any = {
    get: jest.fn(async (k: string) => almacen.get(k) ?? null),
    set: jest.fn(async (k: string, v: string, ...args: any[]) => {
      if (args.includes('NX') && almacen.has(k)) return null;
      almacen.set(k, String(v));
      return 'OK';
    }),
    incr: jest.fn(async (k: string) => {
      const n = parseInt(almacen.get(k) ?? '0', 10) + 1;
      almacen.set(k, String(n));
      return n;
    }),
    expire: jest.fn(async () => 1),
    del: jest.fn(async (k: string) => (almacen.delete(k) ? 1 : 0)),
    ttl: jest.fn(async () => 30),
  };
  const prisma: any = {
    supervisorSecreto: { findUnique: jest.fn(async () => filaSecreto) },
    userAccount: {
      // Respeta el where como Prisma: con party_id busca ese usuario y su rol; sin party_id es el respaldo del ADMIN activo
      findFirst: jest.fn(async ({ where }: any) => {
        const roles: string[] = where.rol?.in ?? [where.rol];
        if (where.party_id === undefined) return roles.includes('ADMIN') ? { party_id: ADMIN, id: 10n, rol: 'ADMIN' } : null;
        if (where.party_id === ADMIN && roles.includes('ADMIN')) return { party_id: ADMIN, id: 10n, rol: 'ADMIN' };
        if (where.party_id === SUPERVISOR && roles.includes('SUPERVISOR')) return { party_id: SUPERVISOR, id: 30n, rol: 'SUPERVISOR' };
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.party_id === SUPERVISOR) return { party_id: SUPERVISOR, id: 30n };
        if (where.party_id === ADMIN) return { party_id: ADMIN, id: 10n };
        return null;
      }),
    },
  };
  const auditoria: any = { registrar: jest.fn(async () => ({})) };
  const service = new SupervisorCodigoService(prisma, { obtenerCliente: () => redis } as any, auditoria);
  return { service, redis, prisma, auditoria };
}

const autorizaciones = (auditoria: any) =>
  auditoria.registrar.mock.calls.filter(([a]: any[]) => a.accion === 'AUTORIZACION_SUPERVISOR');

describe('SUPERVISOR se autoriza sola, como el ADMIN (no escribe el código)', () => {
  it('sin código: pasa, no cuenta intentos y queda auditada a su nombre', async () => {
    const { service, redis, auditoria } = montar();
    const r = await service.verificarYConsumirCodigo(undefined, SUPERVISOR, 'caja/cobrar');
    expect(r.party_id).toBe(SUPERVISOR);
    expect(redis.incr).not.toHaveBeenCalled();
    const [registro] = autorizaciones(auditoria);
    expect(registro[0].partyId).toBe(SUPERVISOR);
    expect(registro[0].motivo).toContain('rol SUPERVISOR');
  });

  it('el CAJERO sigue escribiendo el código: sin código 403 CODIGO_INVALIDO y cuenta el intento', async () => {
    const { service, redis, auditoria } = montar();
    await expect(service.verificarYConsumirCodigo(undefined, CAJERO, 'caja/cobrar')).rejects.toMatchObject({
      status: 403,
      response: { codigo: 'CODIGO_INVALIDO' },
    });
    expect(redis.incr).toHaveBeenCalled();
    expect(autorizaciones(auditoria)).toHaveLength(0);
  });

  it('ADMIN sigue exento: pasa sin código, no cuenta intentos y queda auditado', async () => {
    const { service, redis, auditoria } = montar();
    const r = await service.verificarYConsumirCodigo(undefined, ADMIN, 'caja/cobrar');
    expect(r.party_id).toBe(ADMIN);
    expect(redis.incr).not.toHaveBeenCalled();
    expect(autorizaciones(auditoria)).toHaveLength(1);
  });
});

describe('quién queda como autorizador', () => {
  it('con código válido, la autorización queda a nombre del SUPERVISOR que lo mostró en pantalla', async () => {
    const { service, auditoria } = montar();
    // El supervisor abre su pantalla: el servidor calcula el código y recuerda quién lo vio
    const { codigo } = await service.obtenerCodigoActual(SUPERVISOR);

    const r = await service.verificarYConsumirCodigo(codigo, CAJERO, 'caja/cobrar');
    expect(r.party_id).toBe(SUPERVISOR);
    expect(r.supervisorPartyId).toBe(SUPERVISOR);

    const [registro] = autorizaciones(auditoria).slice(-1).map(([a]: any[]) => a);
    expect(registro.partyId).toBe(CAJERO);
    expect(registro.motivo).toContain(`Autoriza el supervisor ${SUPERVISOR}`);
  });

  it('si nadie mostró el código en la ventana reciente, mantiene el respaldo del ADMIN activo', async () => {
    const { service, redis } = montar();
    const { codigo } = await service.obtenerCodigoActual(SUPERVISOR);
    await redis.del('supervisor:visor:CAPRICHOS');

    const r = await service.verificarYConsumirCodigo(codigo, CAJERO, 'caja/cobrar');
    expect(r.party_id).toBe(ADMIN);
  });

  it('la pantalla del supervisor no deja el código en Redis, solo quién lo vio', async () => {
    const { service, redis } = montar();
    const { codigo } = await service.obtenerCodigoActual(SUPERVISOR);
    const valores = [...(redis.set.mock.calls as any[][])].map((c) => String(c[1]));
    expect(valores).not.toContain(codigo);
    expect(await redis.get('supervisor:visor:CAPRICHOS')).toBe(String(SUPERVISOR));
  });

  it('una respuesta HTTP con código inválido sigue siendo HttpException', async () => {
    const { service } = montar();
    await expect(service.verificarYConsumirCodigo('000000', CAJERO, 'caja/cobrar')).rejects.toBeInstanceOf(HttpException);
  });
});
