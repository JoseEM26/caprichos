jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
    verifyAsync = jest.fn();
  },
  JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) },
}));
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CodigoRegistroService } from '../../clientes/codigo-registro.service';
import { AvisoCuentaService } from '../../clientes/aviso-cuenta.service';
import { PuntosService } from '../../clientes/puntos.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';
import { trabajadorDeCuentaCliente } from '../../creditos/descuento-personal';

const admin: any = { rol: 'ADMIN', partyId: 99n };
const X = '900000123';

const cumple = (fila: any, where: any = {}) =>
  Object.entries(where).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !('in' in v) && !('not' in v)) return true;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(fila[k]);
    if (v && typeof v === 'object' && 'not' in v) return fila[k] !== v.not;
    return fila[k] === v;
  });

/**
 * Todos los órdenes de creación entre un integrante del equipo y un cliente de la carta con el MISMO celular, sobre una BD simulada
 * que aplica los filtros (incluidos los de relación que usan registro y el bot). Datos inventados.
 */
describe('Orden de creación: usuario del equipo y cliente con el mismo celular', () => {
  let usuarios: UsuariosService;
  let clientes: ClientesService;
  let prisma: any;
  let auditoria: any;
  let partys: any[];
  let personas: any[];
  let contactos: any[];
  let cuentas: any[];
  let users: any[];
  let roles: any[];
  let detalles: any[];
  let consents: any[];
  let seq: bigint;

  const sembrarParty = (id: bigint, nombres: string, apellidos = 'Prueba') => {
    partys.push({ id, tipo: 'PERSONA', estado: 'ACTIVO' });
    personas.push({ party_id: id, nombres, apellidos, correo: null, cumple_mes: null, cumple_dia: null });
  };
  const sembrarCliente = (id: bigint, nombres: string, o: { hash?: string | null; puntos?: number; contacto?: boolean; telefono?: string | null } = {}) => {
    sembrarParty(id, nombres);
    cuentas.push({ id: id + 1000n, party_id: id, telefono: o.telefono === undefined ? X : o.telefono, hash: o.hash === undefined ? 'h' : o.hash, activo: true, usuario_party_id: null });
    roles.push({ id: id + 2000n, party_id: id, rol: 'CLIENTE', hasta: null });
    detalles.push({ party_role_id: id + 2000n, puntos: o.puntos ?? 0 });
    if (o.contacto !== false) contactos.push({ id: id + 3000n, party_id: id, tipo: 'TELEFONO', valor: X, activo: true, principal: true });
  };
  const sembrarStaff = (id: bigint, nombres: string, o: { contacto?: { tipo?: string; valor?: string } | null; activo?: boolean } = {}) => {
    sembrarParty(id, nombres);
    users.push({ id: id - 13n, party_id: id, activo: o.activo ?? true, rol: 'MOZO' });
    if (o.contacto !== null) contactos.push({ id: id + 3000n, party_id: id, tipo: o.contacto?.tipo ?? 'WHATSAPP', valor: o.contacto?.valor ?? X, activo: true, principal: true });
  };

  const partyOk = (partyId: bigint, c: any): boolean => {
    const p = partys.find((x) => x.id === partyId);
    if (!p) return false;
    if (c.tipo && p.tipo !== c.tipo) return false;
    if (c.estado && p.estado !== c.estado) return false;
    const cuenta = cuentas.find((x) => x.party_id === partyId);
    const user = users.find((x) => x.party_id === partyId);
    if (c.cuentaCliente) {
      if (c.cuentaCliente.is === null && cuenta) return false;
      if (c.cuentaCliente.is && (!cuenta || !cumple(cuenta, c.cuentaCliente.is))) return false;
    }
    if (c.usuario) {
      if (c.usuario.is === null && user) return false;
      if (c.usuario.is && (!user || !cumple(user, c.usuario.is))) return false;
    }
    return true;
  };
  const conParty = (c: any) => ({ ...c, party: { usuario: users.find((u) => u.party_id === c.party_id) ?? null, cuentaCliente: cuentas.find((x) => x.party_id === c.party_id) ?? null } });
  const buscarContactos = (where: any) => contactos.filter((c) => cumple(c, where) && (!where.party || partyOk(c.party_id, where.party)));

  beforeEach(async () => {
    partys = []; personas = []; contactos = []; cuentas = []; users = []; roles = []; detalles = []; consents = [];
    seq = 500n;
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const tx: any = {
      party: {
        create: jest.fn(async ({ data }: any) => { const p = { id: seq++, ...data }; partys.push(p); return p; }),
        findUnique: jest.fn(async ({ where }: any) => partys.find((p) => p.id === where.id) ?? null),
      },
      person: {
        findUnique: jest.fn(async ({ where }: any) => personas.find((p) => p.party_id === where.party_id) ?? null),
        create: jest.fn(async ({ data }: any) => { const p = { apellidos: '', correo: null, cumple_mes: null, cumple_dia: null, ...data }; personas.push(p); return p; }),
        update: jest.fn(async ({ where, data }: any) => { const p = personas.find((x) => x.party_id === where.party_id); Object.assign(p, data); return p; }),
      },
      partyRole: {
        findFirst: jest.fn(async ({ where }: any) => {
          const r = roles.find((x) => cumple(x, { party_id: where.party_id, rol: where.rol, hasta: where.hasta }));
          return r ? { ...r, customer_detail: detalles.find((d) => d.party_role_id === r.id) ?? null, employee_detail: null } : null;
        }),
        create: jest.fn(async ({ data }: any) => { const r = { id: seq++, hasta: null, ...data }; roles.push(r); return r; }),
      },
      customerDetail: { create: jest.fn(async ({ data }: any) => { detalles.push(data); return data; }) },
      customerAccount: {
        findMany: jest.fn(async ({ where }: any) => cuentas.filter((c) => cumple(c, where))),
        findFirst: jest.fn(async ({ where }: any) => cuentas.find((c) => cumple(c, where)) ?? null),
        create: jest.fn(async ({ data }: any) => {
          if (cuentas.some((c) => c.party_id === data.party_id)) throw { code: 'P2002' };
          const n = { id: seq++, usuario_party_id: null, ...data };
          cuentas.push(n);
          return n;
        }),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const c = cuentas.find((x) => x.party_id === where.party_id);
          if (c) Object.assign(c, update);
          else cuentas.push({ id: seq++, usuario_party_id: null, ...create });
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const c = cuentas.find((x) => cumple(x, where));
          if (c) Object.assign(c, data);
          return { count: c ? 1 : 0 };
        }),
      },
      contactMechanism: {
        findMany: jest.fn(async ({ where }: any) => buscarContactos(where).map(conParty)),
        findFirst: jest.fn(async ({ where }: any) => { const c = buscarContactos(where)[0]; return c ? conParty(c) : null; }),
        create: jest.fn(async ({ data }: any) => {
          if (contactos.some((c) => c.activo && c.valor === data.valor && ['TELEFONO', 'WHATSAPP'].includes(c.tipo) && ['TELEFONO', 'WHATSAPP'].includes(data.tipo))) throw { code: 'P2002' };
          const n = { id: seq++, activo: true, ...data };
          contactos.push(n);
          return n;
        }),
        update: jest.fn(async ({ where, data }: any) => { const c = contactos.find((x) => x.id === where.id); Object.assign(c, data); return c; }),
      },
      userAccount: {
        findFirst: jest.fn(async ({ where }: any) => users.find((u) => cumple(u, where)) ?? null),
        findUnique: jest.fn(async ({ where }: any) => {
          const u = users.find((x) => x.id === where.id);
          const per = u && personas.find((p) => p.party_id === u.party_id);
          return u && { ...u, avisos_correo: false, debe_cambiar: false, party: { persona: per, documentos: [{ tipo: 'DNI', numero: '12345678' }], contactos: [] }, rolesExtra: [] };
        }),
        create: jest.fn(async ({ data }: any) => { const u = { id: seq++, activo: true, ...data }; users.push(u); return u; }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
      },
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }) },
      consent: { create: jest.fn(async ({ data }: any) => { consents.push(data); return data; }) },
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
    };
    prisma = { ...tx, $transaction: jest.fn((cb: any) => cb(tx)) };
    const mod = await Test.createTestingModule({
      providers: [
        UsuariosService,
        ClientesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
        { provide: AvisosInternosService, useValue: { enviarPruebaAlertas: jest.fn() } },
        { provide: RedisService, useValue: { obtenerCliente: () => ({ get: jest.fn(), set: jest.fn(), incr: jest.fn(), expire: jest.fn(), del: jest.fn() }) } },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('tok'), verifyAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d ?? 'x') } },
        { provide: PuntosService, useValue: { obtenerSaldo: jest.fn() } },
        { provide: CodigoRegistroService, useValue: { exigirVerificado: jest.fn().mockResolvedValue(undefined), consumirVerificado: jest.fn().mockResolvedValue(undefined) } },
        { provide: AvisoCuentaService, useValue: { avisar: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    usuarios = mod.get(UsuariosService);
    clientes = mod.get(ClientesService);
    jest.spyOn(clientes, 'yo').mockResolvedValue({ nombre: 'x' } as any);
    jest.spyOn(clientes as any, 'generarTokenCliente').mockResolvedValue('tok');
  });

  const registro = (nombre = 'Rosa Otra', tel = X) =>
    clientes.registro({ nombre, contrasena: 'ClaveSegura2026', telefono: tel, cumpleanos: '14/03', aceptaDatos: true } as any);
  const altaBase = { nombres: 'Ana', apellidos: 'Prueba', dni: '12345678', rol: 'MOZO', celular: X };
  const descuento = async (partyId: bigint) => trabajadorDeCuentaCliente(prisma, partyId);

  // A) Primero el usuario del equipo con celular; luego el cliente se registra en la carta
  describe('A) usuario con celular primero, el cliente se registra después', () => {
    it.each([
      ['WHATSAPP', X], ['TELEFONO', X], ['WHATSAPP', `51${X}`], ['TELEFONO', `51${X}`],
    ])('contacto %s guardado como %s: reutiliza el party del equipo, conserva su nombre, pone la contraseña y recibe descuento y crédito', async (tipo, valor) => {
      sembrarStaff(20n, 'Ana', { contacto: { tipo, valor } });
      await registro('Rosa Otra');
      expect(partys).toHaveLength(1);
      expect(cuentas).toEqual([expect.objectContaining({ party_id: 20n, telefono: X, activo: true, hash: expect.stringContaining('argon2') })]);
      expect(personas[0].nombres).toBe('Ana'); // no se pisa el nombre del personal
      expect(contactos.filter((c) => ['TELEFONO', 'WHATSAPP'].includes(c.tipo))).toHaveLength(1);
      expect(detalles).toHaveLength(1);
      expect(await descuento(20n)).toMatchObject({ partyTrabajadorId: 20n, porVinculo: true, pct: 25 }); // porVinculo = también crédito
    });
  });

  // B) Usuario sin celular; el cliente se registra; luego se le pone X al usuario
  describe('B) usuario sin celular, el cliente se registra y luego se escribe el celular en el usuario', () => {
    it('mismo nombre: se vincula sin preguntar y recibe el descuento', async () => {
      sembrarStaff(20n, 'Ana', { contacto: null });
      await registro('Ana Prueba');
      expect(partys).toHaveLength(2);
      await usuarios.editar(7n, { celular: X } as any, admin);
      const cuenta = cuentas.find((c) => c.party_id !== 20n)!;
      expect(cuenta.usuario_party_id).toBe(20n);
      expect(await descuento(cuenta.party_id)).toMatchObject({ partyTrabajadorId: 20n, porVinculo: true });
    });
    it('nombre distinto: pide Sí/No («es la misma persona») y con el Sí vincula', async () => {
      sembrarStaff(20n, 'Ana', { contacto: null });
      await registro('Rosa Otra');
      await expect(usuarios.editar(7n, { celular: X } as any, admin)).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_VINCULO' } });
      expect(cuentas[0].usuario_party_id).toBeNull();
      await usuarios.editar(7n, { celular: X, confirmaMismaPersona: true } as any, admin);
      expect(cuentas[0].usuario_party_id).toBe(20n);
    });
  });

  // C) y D) Primero el cliente (con contraseña, o creado desde Clientes › Nuevo cliente = hash null); luego el alta del usuario
  describe.each([
    ['C) cliente de la carta (con contraseña)', 'h'],
    ['D) cliente creado desde Clientes › Nuevo cliente (sin contraseña)', null],
  ])('%s primero, el alta del usuario después', (_t, hash) => {
    it('alta con DNI nuevo y celular X: queda UNA sola persona; el cliente conserva puntos y contraseña; el descuento funciona', async () => {
      sembrarCliente(80n, 'Ana', { hash: hash as any, puntos: 50 });
      await usuarios.crear(altaBase as any, admin);
      expect(partys).toHaveLength(1);
      const u = users.find((x) => x.rol === 'MOZO' && x.party_id === 80n);
      expect(u).toBeDefined();
      expect(cuentas[0]).toMatchObject({ party_id: 80n, hash });
      expect(detalles[0].puntos).toBe(50);
      expect(contactos).toHaveLength(1);
      expect(await descuento(80n)).toMatchObject({ partyTrabajadorId: 80n, porVinculo: true });
    });
    it('el nombre del alta es distinto: se conserva el del cliente (no se pisa) y no hay error de celular duplicado', async () => {
      sembrarCliente(80n, 'Rosa', { hash: hash as any });
      personas[0].apellidos = 'Otra';
      await usuarios.crear(altaBase as any, admin);
      expect(partys).toHaveLength(1);
      expect(personas[0]).toMatchObject({ nombres: 'Rosa', apellidos: 'Otra' });
      expect(await descuento(80n)).toMatchObject({ partyTrabajadorId: 80n });
    });
    it('cuenta que guarda el celular solo en customer_account.telefono (sin contacto): también reutiliza su party', async () => {
      sembrarCliente(80n, 'Ana', { hash: hash as any, contacto: false });
      await usuarios.crear(altaBase as any, admin);
      expect(partys).toHaveLength(1);
      expect(users.some((x) => x.party_id === 80n && x.rol === 'MOZO')).toBe(true);
      expect(contactos.filter((c) => c.party_id === 80n)).toHaveLength(1); // el contacto se crea en la misma persona
    });
    it('y editar un usuario existente (otra persona) con ese celular lo vincula', async () => {
      sembrarCliente(80n, 'Ana', { hash: hash as any });
      sembrarStaff(20n, 'Ana', { contacto: null });
      await usuarios.editar(7n, { celular: X } as any, admin);
      expect(cuentas[0].usuario_party_id).toBe(20n);
    });
  });

  // E) Bot de WhatsApp
  describe('E) cuenta creada desde el bot (sin contraseña)', () => {
    it.each([['WHATSAPP', X], ['TELEFONO', `51${X}`]])('celular del personal (%s %s) sin cuenta: reutiliza su party, no pisa su nombre y no duplica contactos', async (tipo, valor) => {
      sembrarStaff(20n, 'Ana', { contacto: { tipo, valor } });
      const r = await clientes.crearCuentaDesdeBot(X, 'Rosa Otra');
      expect(r.partyId).toBe('20');
      expect(partys).toHaveLength(1);
      expect(cuentas).toEqual([expect.objectContaining({ party_id: 20n, hash: null, telefono: X, activo: true })]);
      expect(personas[0].nombres).toBe('Ana');
      expect(roles.some((x) => x.party_id === 20n && x.rol === 'CLIENTE')).toBe(true);
      expect(detalles).toHaveLength(1);
      expect(consents).toEqual([expect.objectContaining({ party_id: 20n, canal: 'BOT' })]);
      expect(contactos).toHaveLength(1);
      expect(await descuento(20n)).toMatchObject({ partyTrabajadorId: 20n, porVinculo: true });
    });
    it('celular de un invitado (pedidos/WhatsApp, sin cuenta): reutiliza su party y le pone el nombre', async () => {
      sembrarParty(60n, 'Cliente');
      contactos.push({ id: 1n, party_id: 60n, tipo: 'WHATSAPP', valor: X, activo: true, principal: true });
      await clientes.crearCuentaDesdeBot(X, 'Rosa Otra');
      expect(partys).toHaveLength(1);
      expect(personas[0].nombres).toBe('Rosa Otra');
      expect(cuentas).toEqual([expect.objectContaining({ party_id: 60n, hash: null })]);
      expect(contactos).toHaveLength(1);
    });
    it('celular de nadie: crea persona, rol, cuenta y contacto como antes', async () => {
      await clientes.crearCuentaDesdeBot(X, 'Rosa Otra');
      expect(partys).toHaveLength(1);
      expect(contactos).toHaveLength(1);
      expect(cuentas[0]).toMatchObject({ hash: null, telefono: X });
    });
    it('TELEFONO_REGISTRADO solo cuando ya existe una cuenta real (activa o no)', async () => {
      sembrarCliente(80n, 'Ana');
      await expect(clientes.crearCuentaDesdeBot(X, 'Rosa Otra')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REGISTRADO' } });
      cuentas[0].activo = false;
      await expect(clientes.crearCuentaDesdeBot(X, 'Rosa Otra')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REGISTRADO' } });
    });
  });

  // F) El descuento sigue al estado activo del usuario
  describe('F) usuario desactivado y reactivado', () => {
    it('misma persona: sin descuento mientras el usuario está desactivado y vuelve al reactivarlo', async () => {
      sembrarCliente(80n, 'Ana');
      users.push({ id: 7n, party_id: 80n, activo: true, rol: 'MOZO' });
      expect(await descuento(80n)).toMatchObject({ partyTrabajadorId: 80n });
      users[0].activo = false;
      expect(await descuento(80n)).toBeNull();
      users[0].activo = true;
      expect(await descuento(80n)).toMatchObject({ partyTrabajadorId: 80n });
    });
    it('cuenta vinculada: igual, sigue a usuario.activo', async () => {
      sembrarCliente(80n, 'Ana');
      sembrarStaff(20n, 'Ana', { contacto: null });
      cuentas[0].usuario_party_id = 20n;
      expect(await descuento(80n)).toMatchObject({ partyTrabajadorId: 20n });
      users[0].activo = false;
      expect(await descuento(80n)).toBeNull();
      users[0].activo = true;
      expect(await descuento(80n)).toMatchObject({ partyTrabajadorId: 20n });
    });
  });
});
