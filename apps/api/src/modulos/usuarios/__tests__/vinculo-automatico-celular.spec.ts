jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test } from '@nestjs/testing';
import { UsuariosService } from '../usuarios.service';
import { UsuariosCuentaClienteService } from '../usuarios-cuenta-cliente.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';

const admin: any = { rol: 'ADMIN', partyId: 99n };
const CEL = '900000123';

/** Un celular de cliente y un usuario del panel: vinculación automática al guardar (datos inventados). */
describe('Vinculación automática del celular del usuario con su cuenta de cliente', () => {
  let service: UsuariosService;
  let cuentaSvc: UsuariosCuentaClienteService;
  let tx: any;
  let prismaMock: any;
  let auditoria: any;
  // Estado de la BD simulada
  let contactos: any[];
  let cuentas: any[];
  let usuariosDePartys: Set<bigint>;
  let personas: Record<string, any>;

  beforeEach(async () => {
    contactos = [{ party_id: 80n }];
    cuentas = [{ id: 8n, party_id: 80n, telefono: CEL, usuario_party_id: null, activo: true }];
    usuariosDePartys = new Set();
    personas = { '80': { nombres: 'Ana', apellidos: 'Prueba' }, '20': { nombres: 'Ana', apellidos: 'Prueba' } };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const customerAccount = {
      findMany: jest.fn(async ({ where }: any) => cuentas.filter((c) => c.activo && where.telefono.in.includes(c.telefono))),
      findFirst: jest.fn(async ({ where }: any) =>
        cuentas.find((c) => (where.party_id === undefined || c.party_id === where.party_id) && (where.activo === undefined || c.activo === where.activo) && (where.usuario_party_id === undefined || c.usuario_party_id === where.usuario_party_id)) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        if (cuentas.some((c) => c.party_id === data.party_id)) throw { code: 'P2002' };
        const n = { id: 50n, ...data };
        cuentas.push(n);
        return n;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const c = cuentas.find((x) => x.id === where.id && x.usuario_party_id === null && x.activo);
        if (c) c.usuario_party_id = data.usuario_party_id;
        return { count: c ? 1 : 0 };
      }),
    };
    const base = {
      customerAccount,
      contactMechanism: {
        findMany: jest.fn(async () => contactos),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      userAccount: {
        findFirst: jest.fn(async ({ where }: any) => (usuariosDePartys.has(where.party_id) ? { id: 1n } : null)),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 5n, party_id: 10n, rol: 'MOZO', activo: true, debe_cambiar: true }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
      },
      person: {
        findUnique: jest.fn(async ({ where }: any) => personas[String(where.party_id)] ?? null),
        create: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Prueba' }),
        update: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Prueba' }),
      },
      party: { create: jest.fn().mockResolvedValue({ id: 10n }), findUnique: jest.fn(async () => ({ tipo: 'PERSONA' })) },
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }) },
      partyRole: { create: jest.fn().mockResolvedValue({ id: 70n }), findFirst: jest.fn().mockResolvedValue(null) },
      customerDetail: { create: jest.fn() },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
    };
    tx = base;
    const prisma: any = { ...base, $transaction: jest.fn((cb: any) => cb(tx)) };
    prismaMock = prisma;
    const mod = await Test.createTestingModule({
      providers: [
        UsuariosService,
        UsuariosCuentaClienteService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
        { provide: AvisosInternosService, useValue: { enviarPruebaAlertas: jest.fn() } },
      ],
    }).compile();
    service = mod.get(UsuariosService);
    cuentaSvc = mod.get(UsuariosCuentaClienteService);
    prisma.userAccount.findUnique.mockImplementation(async ({ where }: any) => where.party_id !== undefined ? null : ({
      id: where.id, party_id: 20n, activo: true, rol: 'MOZO', avisos_correo: false, debe_cambiar: false,
      party: { persona: { nombres: 'Ana', apellidos: 'Prueba', correo: null }, documentos: [{ tipo: 'DNI', numero: '12345678' }] },
      rolesExtra: [],
    }));
  });

  const crearBase = { nombres: 'Ana', apellidos: 'Prueba', dni: '12345678', rol: 'MOZO', celular: CEL };

  it('previa: LIBRE si nadie tiene el celular', async () => {
    contactos = [];
    cuentas = [];
    await expect(cuentaSvc.previaCelular(7n, CEL, undefined, admin)).resolves.toEqual({ estado: 'LIBRE' });
  });

  it('previa: VINCULARA_CUENTA con nombre y celular enmascarado, sin cambiar nada', async () => {
    const r: any = await cuentaSvc.previaCelular(7n, CEL, undefined, admin);
    expect(r).toEqual({ estado: 'VINCULARA_CUENTA', cuenta: { nombre: 'Ana Prueba', celularEnmascarado: '···123' }, mismoNombre: true });
    expect(cuentas[0].usuario_party_id).toBeNull();
  });

  it('previa: solo ADMIN', async () => {
    await expect(cuentaSvc.previaCelular(7n, CEL, undefined, { rol: 'CAJERO' } as any)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
  });

  it('previa de alta (sin id): compara con el nombre escrito', async () => {
    const r: any = await cuentaSvc.previaCelular(null, CEL, { nombres: 'Rosa', apellidos: 'Otra' }, admin);
    expect(r.estado).toBe('VINCULARA_CUENTA');
    expect(r.mismoNombre).toBe(false);
  });

  it('previa: celular de otro usuario del equipo -> OTRA_PERSONA con mensaje claro', async () => {
    usuariosDePartys.add(80n);
    const r: any = await cuentaSvc.previaCelular(7n, CEL, undefined, admin);
    expect(r).toMatchObject({ estado: 'OTRA_PERSONA', motivo: 'USUARIO', mensaje: expect.stringContaining('Ese celular ya lo usa otro usuario del equipo') });
  });

  it('previa: cuenta ya vinculada a otro usuario -> OTRA_PERSONA', async () => {
    cuentas[0].usuario_party_id = 55n;
    const r: any = await cuentaSvc.previaCelular(7n, CEL, undefined, admin);
    expect(r).toMatchObject({ estado: 'OTRA_PERSONA', motivo: 'CUENTA_VINCULADA', mensaje: expect.stringContaining('ya vinculada a otra persona') });
  });

  it('previa: cuenta inactiva -> OTRA_PERSONA que dice reactivarla en Clientes', async () => {
    cuentas[0].activo = false;
    const r: any = await cuentaSvc.previaCelular(7n, CEL, undefined, admin);
    expect(r).toMatchObject({ estado: 'OTRA_PERSONA', motivo: 'CUENTA_DESACTIVADA', mensaje: expect.stringContaining('Reactívala primero en Clientes') });
  });

  // Invitado: party con el celular pero sin usuario ni cuenta de cliente
  const invitado = () => {
    cuentas = [];
    contactos = [{ party_id: 80n }];
  };

  it('previa: celular de un invitado -> CREARA_CUENTA con nombre y celular enmascarado, sin escribir', async () => {
    invitado();
    const r: any = await cuentaSvc.previaCelular(7n, CEL, undefined, admin);
    expect(r).toEqual({ estado: 'CREARA_CUENTA', cuenta: { nombre: 'Ana Prueba', celularEnmascarado: '···123' } });
    expect(cuentas).toHaveLength(0);
  });

  it('previa de alta (sin id): el invitado se reutiliza -> LIBRE', async () => {
    invitado();
    await expect(cuentaSvc.previaCelular(null, CEL, undefined, admin)).resolves.toEqual({ estado: 'LIBRE' });
  });

  it('previa: invitado y el usuario ya tiene otra cuenta vinculada -> USUARIO_YA_VINCULADO', async () => {
    invitado();
    cuentas = [{ id: 3n, party_id: 31n, telefono: '900000999', usuario_party_id: 20n, activo: true }];
    const r: any = await cuentaSvc.previaCelular(7n, CEL, undefined, admin);
    expect(r).toMatchObject({ estado: 'OTRA_PERSONA', motivo: 'USUARIO_YA_VINCULADO' });
  });

  it('editar: invitado sin confirmar -> 409 CONFIRMAR_CREAR_CUENTA y no crea nada', async () => {
    invitado();
    await expect(service.editar(7n, { celular: CEL } as any, admin, '1.1.1.1')).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_CREAR_CUENTA' } });
    expect(cuentas).toHaveLength(0);
  });

  it('editar: invitado confirmado -> crea la cuenta en el party invitado, vinculada al usuario, sin contacto nuevo y auditada', async () => {
    invitado();
    await service.editar(7n, { celular: CEL, confirmaMismaPersona: true } as any, admin, '1.1.1.1');
    expect(cuentas).toEqual([expect.objectContaining({ party_id: 80n, hash: null, telefono: CEL, activo: true, usuario_party_id: 20n })]);
    expect(tx.contactMechanism.create).not.toHaveBeenCalled();
    expect(tx.partyRole.create).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'USUARIO_CREAR_CUENTA_CLIENTE', despues: expect.objectContaining({ cuentaPartyId: '80', usuarioPartyId: '20' }) }), tx);
  });

  it('sección Cuenta de cliente: buscar y vincular con un invitado crean la cuenta (en vez de «no hay cuenta»)', async () => {
    invitado();
    prismaMock.userAccount.findUnique.mockImplementation(async () => ({ id: 7n, party_id: 20n, activo: true }));
    await expect(cuentaSvc.buscar(7n, CEL, admin)).resolves.toEqual({ nombre: 'Ana Prueba', celular: '···123', creara: true });
    expect(cuentas).toHaveLength(0);
    const r: any = await cuentaSvc.vincular(7n, CEL, admin, '1.1.1.1');
    expect(r).toMatchObject({ ok: true, creada: true });
    expect(cuentas[0]).toMatchObject({ party_id: 80n, usuario_party_id: 20n, hash: null });
  });

  it('editar: dos peticiones a la vez (la cuenta del invitado ya existe) -> 409, nunca 500', async () => {
    invitado();
    tx.customerAccount.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.editar(7n, { celular: CEL, confirmaMismaPersona: true } as any, admin)).rejects.toMatchObject({ response: { codigo: 'CELULAR_DUPLICADO' } });
  });

  it('editar: vincula la cuenta (updateMany condicionado), audita con origen AUTO_CELULAR y NO crea un contacto duplicado', async () => {
    const r: any = await service.editar(7n, { celular: CEL } as any, admin, '1.1.1.1');
    expect(cuentas[0].usuario_party_id).toBe(20n);
    expect(tx.contactMechanism.create).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'USUARIO_VINCULAR_CUENTA_CLIENTE', entidadId: 8n, despues: expect.objectContaining({ origen: 'AUTO_CELULAR', usuarioPartyId: '20', cuentaPartyId: '80' }) }),
      tx,
    );
    expect(r.cuentaClienteVinculada).toEqual({ nombre: 'Ana Prueba', celular: '···123' });
  });

  it('editar: nombre distinto sin confirmación -> 409 CONFIRMAR_VINCULO y no vincula; con confirmación vincula', async () => {
    personas['80'] = { nombres: 'Rosa', apellidos: 'Otra' };
    await expect(service.editar(7n, { celular: CEL } as any, admin)).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_VINCULO' } });
    expect(cuentas[0].usuario_party_id).toBeNull();
    await service.editar(7n, { celular: CEL, confirmaMismaPersona: true } as any, admin);
    expect(cuentas[0].usuario_party_id).toBe(20n);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ despues: expect.objectContaining({ nombreCoincide: false }) }), tx);
  });

  it('editar: celular de otro usuario -> 409 «lo usa otro usuario del equipo»', async () => {
    usuariosDePartys.add(80n);
    await expect(service.editar(7n, { celular: CEL } as any, admin)).rejects.toMatchObject({
      response: { codigo: 'CELULAR_DUPLICADO', mensaje: expect.stringContaining('Ese celular ya lo usa otro usuario del equipo') },
    });
  });

  it('editar: cuenta ya vinculada a otro -> 409 mensaje distinto', async () => {
    cuentas[0].usuario_party_id = 55n;
    await expect(service.editar(7n, { celular: CEL } as any, admin)).rejects.toMatchObject({
      response: { codigo: 'CELULAR_DUPLICADO', mensaje: expect.stringContaining('ya vinculada a otra persona') },
    });
  });

  it('editar: cuenta inactiva -> 409 genérico, no vincula', async () => {
    cuentas[0].activo = false;
    await expect(service.editar(7n, { celular: CEL } as any, admin)).rejects.toMatchObject({ response: { codigo: 'CELULAR_DUPLICADO' } });
    expect(cuentas[0].usuario_party_id).toBeNull();
  });

  it('editar: celular libre sigue creando su contacto propio y no vincula nada', async () => {
    contactos = [];
    cuentas = [];
    await service.editar(7n, { celular: CEL } as any, admin);
    expect(tx.contactMechanism.create).toHaveBeenCalledWith({ data: expect.objectContaining({ party_id: 20n, valor: CEL }) });
    expect(auditoria.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ accion: 'USUARIO_VINCULAR_CUENTA_CLIENTE' }), expect.anything());
  });

  it('editar: si el usuario ya tiene OTRA cuenta vinculada -> 409 USUARIO_YA_VINCULADO', async () => {
    cuentas.push({ id: 9n, party_id: 90n, telefono: '911111111', usuario_party_id: 20n, activo: true });
    await expect(service.editar(7n, { celular: CEL } as any, admin)).rejects.toMatchObject({ response: { motivo: 'USUARIO_YA_VINCULADO' } });
  });

  it('editar: si el celular ya es de su cuenta vinculada no hace nada (idempotente)', async () => {
    cuentas[0].usuario_party_id = 20n;
    await service.editar(7n, { celular: CEL } as any, admin);
    expect(tx.contactMechanism.create).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ accion: 'USUARIO_VINCULAR_CUENTA_CLIENTE' }), expect.anything());
  });

  it('crear con DNI de la persona (party sin usuario) y celular de OTRA cuenta de cliente: vincula en la misma transacción', async () => {
    prismaMock.partyIdentifier.findFirst.mockResolvedValue({ id: 3n, party_id: 20n, tipo: 'DNI', numero: '12345678' });
    const r: any = await service.crear(crearBase as any, admin);
    expect(cuentas[0].usuario_party_id).toBe(20n);
    expect(tx.contactMechanism.create).not.toHaveBeenCalled();
    expect(r.cuentaClienteVinculada).toEqual({ nombre: 'Ana Prueba', celular: '···123' });
  });

  it('crear con celular de un usuario existente: 409 «otro usuario del equipo»', async () => {
    usuariosDePartys.add(80n);
    await expect(service.crear(crearBase as any, admin)).rejects.toMatchObject({ response: { mensaje: expect.stringContaining('Ese celular ya lo usa otro usuario del equipo') } });
  });

  it('crear con celular de una cuenta ya vinculada a otro usuario: 409 mensaje de cuenta vinculada', async () => {
    cuentas[0].usuario_party_id = 55n;
    await expect(service.crear(crearBase as any, admin)).rejects.toMatchObject({ response: { motivo: 'CUENTA_VINCULADA' } });
  });

  it('un no-ADMIN nunca dispara la vinculación', async () => {
    await expect(service.editar(7n, { celular: CEL } as any, { rol: 'CAJERO', partyId: 98n } as any)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    expect(cuentas[0].usuario_party_id).toBeNull();
  });
});
