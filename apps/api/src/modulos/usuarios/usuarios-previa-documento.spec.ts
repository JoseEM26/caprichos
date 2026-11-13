import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UsuariosCuentaClienteService } from './usuarios-cuenta-cliente.service';

const admin: any = { rol: 'ADMIN', partyId: 99n };
const cajero: any = { rol: 'CAJERO', partyId: 98n };
const json = (x: unknown) => JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? String(v) : v));

interface Opc {
  ids?: Array<{ party_id: bigint }>;
  usuarioDueno?: any;
  cuenta?: any;
  propia?: any;
  puntos?: number | null;
  pedidos?: number;
  nombreDueno?: any;
  nombreMio?: any;
  activo?: boolean;
  updateCount?: number;
}
function montar(o: Opc = {}) {
  const ultimo = new Date('2026-11-01T10:00:00Z');
  const prisma: any = {
    userAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 5n, party_id: 50n, activo: o.activo ?? true }),
      findFirst: jest.fn().mockResolvedValue(o.usuarioDueno ?? null),
    },
    partyIdentifier: { findMany: jest.fn().mockResolvedValue(o.ids ?? []) },
    person: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.party_id === 50n ? (o.nombreMio ?? { nombres: 'Ana', apellidos: 'Prueba' }) : (o.nombreDueno ?? { nombres: 'Ana', apellidos: 'Prueba' })),
      ),
    },
    customerAccount: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.party_id ? (o.cuenta ?? null) : (o.propia ?? null))),
      updateMany: jest.fn().mockResolvedValue({ count: o.updateCount ?? 1 }),
    },
    customerDetail: { findFirst: jest.fn().mockResolvedValue(o.puntos === null ? null : { puntos: o.puntos ?? 1234.5 }) },
    pedido: {
      count: jest.fn().mockResolvedValue(o.pedidos ?? 7),
      findFirst: jest.fn().mockResolvedValue({ creado_en: ultimo }),
    },
  };
  prisma.$transaction = jest.fn().mockImplementation((fn: any) => fn(prisma));
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { svc: new UsuariosCuentaClienteService(prisma, auditoria), prisma, auditoria };
}
const cuentaOk = { id: 8n, party_id: 80n, telefono: '900000123', usuario_party_id: null, activo: true, creado_en: new Date('2026-01-02T00:00:00Z') };
const dueno = [{ party_id: 80n }];

describe('previaDocumento', () => {
  it('solo ADMIN', async () => {
    await expect(montar().svc.previaDocumento(5n, 'CE', 'AB1234567', cajero)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('LIBRE si nadie lo tiene; ES_EL_MISMO si ya es del usuario', async () => {
    expect((await montar().svc.previaDocumento(5n, 'CE', 'ab1234567', admin)).estado).toBe('LIBRE');
    expect((await montar({ ids: [{ party_id: 50n }] }).svc.previaDocumento(5n, 'CE', 'AB1234567', admin)).estado).toBe('ES_EL_MISMO');
  });
  it('rechaza formato inválido', async () => {
    await expect(montar().svc.previaDocumento(5n, 'DNI', '123', admin)).rejects.toMatchObject({ response: { codigo: 'DOCUMENTO_INVALIDO' } });
  });
  it('OTRO_USUARIO: solo nombre de pila y rol, sin documento', async () => {
    const { svc } = montar({ ids: dueno, usuarioDueno: { rol: 'CAJERO' }, nombreDueno: { nombres: 'Luis Pedro', apellidos: 'Secreto' } });
    const r: any = await svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(r.estado).toBe('OTRO_USUARIO');
    expect(r.usuario.nombre).toBe('Luis');
    expect(json(r)).not.toContain('Secreto');
    expect(json(r)).not.toContain('AB1234567');
  });
  it('CLIENTE vinculable: puntos, pedidos, último pedido, celular enmascarado y sin datos completos', async () => {
    const { svc, prisma } = montar({ ids: dueno, cuenta: cuentaOk });
    const r: any = await svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(r).toMatchObject({ estado: 'CLIENTE', puedeVincular: true, pareceCelular: false });
    expect(r.cliente).toMatchObject({ nombre: 'Ana Prueba', puntos: 1234.5, pedidos: 7, celularEnmascarado: '···123', yaVinculadoA: null, mismoNombre: true, cuentaActiva: true });
    expect(prisma.pedido.count).toHaveBeenCalledWith({ where: { party_id: 80n, pago_estado: 'PAGADO', anulado_en: null } });
    const s = json(r);
    expect(s).not.toContain('900000123');
    expect(s).not.toContain('AB1234567');
  });
  it('CLIENTE sin pedidos ni detalle de puntos: ceros y sin consultar el último pedido', async () => {
    const { svc, prisma } = montar({ ids: dueno, cuenta: cuentaOk, puntos: null, pedidos: 0 });
    const r: any = await svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(r.cliente).toMatchObject({ puntos: 0, pedidos: 0, ultimoPedido: null });
    expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
  });
  it('CLIENTE ya vinculado a este usuario / a otro / usuario con otra vinculada / desactivada: no se puede vincular', async () => {
    const a: any = await montar({ ids: dueno, cuenta: { ...cuentaOk, usuario_party_id: 50n } }).svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(a).toMatchObject({ puedeVincular: false, cliente: { yaVinculadoA: 'ESTE_USUARIO' } });
    const b: any = await montar({ ids: dueno, cuenta: { ...cuentaOk, usuario_party_id: 77n } }).svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(b).toMatchObject({ puedeVincular: false, cliente: { yaVinculadoA: 'OTRO_USUARIO' } });
    const c: any = await montar({ ids: dueno, cuenta: cuentaOk, propia: { id: 1n } }).svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(c.puedeVincular).toBe(false);
    expect(c.motivo).toContain('otra cuenta');
    const d: any = await montar({ ids: dueno, cuenta: { ...cuentaOk, activo: false } }).svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(d).toMatchObject({ puedeVincular: false, cliente: { cuentaActiva: false } });
  });
  it('PERSONA_SIN_CUENTA: informativo y bloqueado', async () => {
    const r: any = await montar({ ids: dueno, cuenta: null, puntos: 40 }).svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(r).toMatchObject({ estado: 'PERSONA_SIN_CUENTA', puedeVincular: false, cliente: { tieneCuenta: false, puntos: 40 } });
  });
  it('PARECE_CELULAR: 9 dígitos que empiezan en 9 como CE, junto con el estado; no para DNI', async () => {
    expect(((await montar({ ids: dueno, cuenta: cuentaOk }).svc.previaDocumento(5n, 'CE', '907942491', admin)) as any).pareceCelular).toBe(true);
    expect(((await montar().svc.previaDocumento(5n, 'CEDULA', '907942491', admin)) as any)).toMatchObject({ estado: 'LIBRE', pareceCelular: true });
    expect(((await montar().svc.previaDocumento(5n, 'DNI', '90794249', admin)) as any).pareceCelular).toBe(false);
  });
  it('no escribe nada', async () => {
    const { svc, prisma, auditoria } = montar({ ids: dueno, cuenta: cuentaOk });
    await svc.previaDocumento(5n, 'CE', 'AB1234567', admin);
    expect(prisma.customerAccount.updateMany).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});

describe('vincularPorDocumento', () => {
  it('solo ADMIN', async () => {
    await expect(montar().svc.vincularPorDocumento(5n, 'CE', 'AB1234567', false, cajero)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('vincula (mismo nombre) y audita con origen DOCUMENTO sin datos personales', async () => {
    const { svc, prisma, auditoria } = montar({ ids: dueno, cuenta: cuentaOk });
    const r = await svc.vincularPorDocumento(5n, 'CE', 'AB1234567', undefined, admin, '1.1.1.1');
    expect(r.vinculada).toEqual({ nombre: 'Ana Prueba', celular: '···123' });
    expect(prisma.customerAccount.updateMany).toHaveBeenCalledWith({ where: { id: 8n, usuario_party_id: null, activo: true }, data: { usuario_party_id: 50n } });
    const a = auditoria.registrar.mock.calls[0][0];
    expect(a).toMatchObject({ accion: 'USUARIO_VINCULAR_CUENTA_CLIENTE', despues: { origen: 'DOCUMENTO' } });
    expect(json(a)).not.toContain('AB1234567');
    expect(json(a)).not.toContain('900000123');
  });
  it('nombres distintos: pide confirmación y con ella vincula', async () => {
    const o = { ids: dueno, cuenta: cuentaOk, nombreDueno: { nombres: 'Rosa', apellidos: 'Otra' } };
    await expect(montar(o).svc.vincularPorDocumento(5n, 'CE', 'AB1234567', false, admin)).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_VINCULO' } });
    const ok = montar(o);
    await ok.svc.vincularPorDocumento(5n, 'CE', 'AB1234567', true, admin);
    expect(ok.auditoria.registrar.mock.calls[0][0].despues.nombreCoincide).toBe(false);
  });
  it('seguridad: usuario desactivado, documento libre, de un usuario, sin cuenta, desactivada, ya vinculada, usuario con otra', async () => {
    const f = (o: Opc) => montar(o).svc.vincularPorDocumento(5n, 'CE', 'AB1234567', true, admin);
    await expect(f({ activo: false })).rejects.toMatchObject({ response: { codigo: 'USUARIO_DESACTIVADO' } });
    await expect(f({})).rejects.toMatchObject({ response: { codigo: 'CUENTA_CLIENTE_NO_ENCONTRADA' } });
    await expect(f({ ids: dueno, usuarioDueno: { rol: 'MOZO' } })).rejects.toMatchObject({ response: { codigo: 'CUENTA_ES_USUARIO' } });
    await expect(f({ ids: dueno, cuenta: null })).rejects.toMatchObject({ response: { codigo: 'CUENTA_CLIENTE_NO_ENCONTRADA' } });
    await expect(f({ ids: dueno, cuenta: { ...cuentaOk, activo: false } })).rejects.toMatchObject({ response: { codigo: 'CUENTA_DESACTIVADA' } });
    await expect(f({ ids: dueno, cuenta: { ...cuentaOk, usuario_party_id: 7n } })).rejects.toMatchObject({ response: { codigo: 'CUENTA_YA_VINCULADA' } });
    await expect(f({ ids: dueno, cuenta: cuentaOk, propia: { id: 3n } })).rejects.toMatchObject({ response: { codigo: 'USUARIO_YA_VINCULADO' } });
  });
  it('carrera: si otra petición la vinculó, 409 y sin auditoría', async () => {
    const { svc, auditoria } = montar({ ids: dueno, cuenta: cuentaOk, updateCount: 0 });
    await expect(svc.vincularPorDocumento(5n, 'CE', 'AB1234567', true, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});
