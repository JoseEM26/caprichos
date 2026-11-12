import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MATRIZ } from '../acceso/permisos';
import { UsuariosCuentaClienteService } from './usuarios-cuenta-cliente.service';

const admin: any = { rol: 'ADMIN', partyId: 99n };
const cajero: any = { rol: 'CAJERO', partyId: 98n };

function montar(o: { usuario?: any; cuenta?: any; cuentaEsUsuario?: boolean; propia?: any; updateCount?: number } = {}) {
  const usuario = o.usuario === undefined ? { id: 5n, party_id: 50n, activo: true } : o.usuario;
  const customerAccount = {
    // busca por celular (telefono) o por usuario vinculado (usuario_party_id)
    findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.telefono ? (o.cuenta ?? null) : (o.propia ?? null))),
    updateMany: jest.fn().mockResolvedValue({ count: o.updateCount ?? 1 }),
    update: jest.fn().mockResolvedValue({}),
  };
  const prisma: any = {
    userAccount: {
      findUnique: jest.fn().mockResolvedValue(usuario),
      findFirst: jest.fn().mockResolvedValue(o.cuentaEsUsuario ? { id: 1n } : null),
    },
    person: { findUnique: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Prueba' }) },
    customerAccount,
  };
  prisma.$transaction = jest.fn().mockImplementation((fn: any) => fn(prisma));
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { svc: new UsuariosCuentaClienteService(prisma, auditoria), prisma, auditoria };
}
const cuentaOk = { id: 8n, party_id: 80n, telefono: '900000123', usuario_party_id: null };

describe('Vincular cuenta de cliente a un usuario', () => {
  it('vincula: marca la cuenta, audita con ids y devuelve solo nombre y celular enmascarado', async () => {
    const { svc, prisma, auditoria } = montar({ cuenta: cuentaOk });
    const r = await svc.vincular(5n, '900000123', admin, '1.1.1.1');
    expect(r.vinculada).toEqual({ nombre: 'Ana Prueba', celular: '···123' });
    expect(prisma.customerAccount.updateMany).toHaveBeenCalledWith({ where: { id: 8n, usuario_party_id: null, activo: true }, data: { usuario_party_id: 50n } });
    const a = auditoria.registrar.mock.calls[0][0];
    expect(a.accion).toBe('USUARIO_VINCULAR_CUENTA_CLIENTE');
    expect(JSON.stringify(a, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain('900000123');
    expect(auditoria.registrar.mock.calls[0][1]).toBe(prisma); // misma transacción
  });

  it('no da permisos: solo escribe usuario_party_id en la cuenta, no toca usuarios ni roles', async () => {
    const { svc, prisma } = montar({ cuenta: cuentaOk });
    await svc.vincular(5n, '900000123', admin);
    expect(prisma.customerAccount.updateMany.mock.calls[0][0].data).toEqual({ usuario_party_id: 50n });
    expect(prisma.userAccount.update).toBeUndefined();
  });

  it('404 si no hay cuenta activa con ese celular', async () => {
    const { svc } = montar({ cuenta: null });
    await expect(svc.vincular(5n, '900000123', admin)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.buscar(5n, '900000123', admin)).rejects.toMatchObject({ response: { codigo: 'CUENTA_CLIENTE_NO_ENCONTRADA' } });
  });

  it('409 si la cuenta ya está vinculada, si ya es de un usuario, o si el usuario ya tiene una vinculada', async () => {
    await expect(montar({ cuenta: { ...cuentaOk, usuario_party_id: 7n } }).svc.vincular(5n, '900000123', admin)).rejects.toMatchObject({ response: { codigo: 'CUENTA_YA_VINCULADA' } });
    await expect(montar({ cuenta: cuentaOk, cuentaEsUsuario: true }).svc.vincular(5n, '900000123', admin)).rejects.toMatchObject({ response: { codigo: 'CUENTA_ES_USUARIO' } });
    await expect(montar({ cuenta: cuentaOk, propia: { id: 3n } }).svc.vincular(5n, '900000123', admin)).rejects.toMatchObject({ response: { codigo: 'USUARIO_YA_VINCULADO' } });
  });

  it('409 si otra petición la vinculó en medio (carrera) y si el usuario está inactivo', async () => {
    await expect(montar({ cuenta: cuentaOk, updateCount: 0 }).svc.vincular(5n, '900000123', admin)).rejects.toBeInstanceOf(ConflictException);
    await expect(montar({ usuario: { id: 5n, party_id: 50n, activo: false }, cuenta: cuentaOk }).svc.vincular(5n, '900000123', admin)).rejects.toMatchObject({ response: { codigo: 'USUARIO_DESACTIVADO' } });
  });

  it('solo el ADMIN: otro rol recibe 403 en todo, y el permiso del endpoint es de solo ADMIN', async () => {
    const { svc } = montar({ cuenta: cuentaOk });
    await expect(svc.vincular(5n, '900000123', cajero)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.buscar(5n, '900000123', cajero)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.desvincular(5n, cajero)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.estado(5n, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    const conPermiso = Object.entries(MATRIZ).filter(([, cs]) => cs.includes('usuarios/administrar_roles')).map(([r]) => r);
    expect(conPermiso).toEqual(['ADMIN']);
  });

  it('desvincula y audita; sin vínculo es 404', async () => {
    const { svc, prisma, auditoria } = montar({ propia: { id: 8n, party_id: 80n } });
    await svc.desvincular(5n, admin);
    expect(prisma.customerAccount.update).toHaveBeenCalledWith({ where: { id: 8n }, data: { usuario_party_id: null } });
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe('USUARIO_DESVINCULAR_CUENTA_CLIENTE');
    await expect(montar().svc.desvincular(5n, admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('estado: muestra la cuenta vinculada o null', async () => {
    expect((await montar({ propia: { id: 8n, party_id: 80n, telefono: '900000123' } }).svc.estado(5n, admin)).vinculada).toEqual({ nombre: 'Ana Prueba', celular: '···123' });
    expect((await montar().svc.estado(5n, admin)).vinculada).toBeNull();
  });
});
