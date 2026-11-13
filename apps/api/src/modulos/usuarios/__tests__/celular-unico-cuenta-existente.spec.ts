jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test } from '@nestjs/testing';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';
import { trabajadorDeCuentaCliente } from '../../creditos/descuento-personal';

const admin: any = { rol: 'ADMIN', partyId: 99n };
const X = '900000123';
const A = 80n; // party del cliente de la carta
const B = 20n; // party del usuario del equipo

/** Coincidencia mínima de `where` de Prisma sobre filas en memoria (igualdad, in, not). Las relaciones anidadas se ignoran. */
const cumple = (fila: any, where: any = {}) =>
  Object.entries(where).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !('in' in v) && !('not' in v)) return true;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(fila[k]);
    if (v && typeof v === 'object' && 'not' in v) return fila[k] !== v.not;
    return fila[k] === v;
  });

/**
 * Cliente de la carta (party A) y usuario del equipo (party B) con la BD simulada de verdad: los filtros de resolverCelular
 * se aplican, así que un error de variantes (X / 51X), tipos o activo se nota. Datos inventados.
 */
describe('Un solo celular: la persona ya tiene cuenta de cliente', () => {
  let service: UsuariosService;
  let contactos: any[];
  let cuentas: any[];
  let usuarios: any[];
  let auditoria: any;
  let prisma: any;
  let partyUsuario: bigint;

  const cuentaA = (o: any = {}) => ({ id: 8n, party_id: A, telefono: X, hash: 'h', activo: true, usuario_party_id: null, ...o });
  const contactoA = (o: any = {}) => ({ id: 1n, party_id: A, tipo: 'WHATSAPP', valor: X, activo: true, principal: true, ...o });

  beforeEach(async () => {
    contactos = [contactoA()];
    cuentas = [cuentaA()];
    usuarios = [{ id: 7n, party_id: B, activo: true }];
    partyUsuario = B;
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    let seq = 100n;
    const tx: any = {
      customerAccount: {
        findMany: jest.fn(async ({ where }: any) => cuentas.filter((c) => cumple(c, where))),
        findFirst: jest.fn(async ({ where }: any) => cuentas.find((c) => cumple(c, where)) ?? null),
        create: jest.fn(async ({ data }: any) => {
          if (cuentas.some((c) => c.party_id === data.party_id)) throw { code: 'P2002' };
          const n = { id: seq++, ...data };
          cuentas.push(n);
          return n;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const c = cuentas.find((x) => cumple(x, where));
          if (c) Object.assign(c, data);
          return { count: c ? 1 : 0 };
        }),
      },
      contactMechanism: {
        findMany: jest.fn(async ({ where }: any) => contactos.filter((c) => cumple(c, where))),
        findFirst: jest.fn(async ({ where }: any) => contactos.find((c) => cumple(c, where)) ?? null),
        create: jest.fn(async ({ data }: any) => { const n = { id: seq++, ...data }; contactos.push(n); return n; }),
        update: jest.fn(),
      },
      userAccount: {
        findFirst: jest.fn(async ({ where }: any) => usuarios.find((u) => cumple(u, where)) ?? null),
        findUnique: jest.fn(async ({ where }: any) => {
          const u = usuarios.find((x) => x.id === where.id);
          return u && {
            ...u, party_id: partyUsuario, rol: 'MOZO', avisos_correo: false, debe_cambiar: false,
            party: { persona: { nombres: 'Ana', apellidos: 'Prueba', correo: null }, documentos: [{ tipo: 'DNI', numero: '12345678' }], contactos: [] },
            rolesExtra: [],
          };
        }),
        create: jest.fn(async ({ data }: any) => { const u = { id: 5n, activo: true, rol: 'MOZO', debe_cambiar: true, ...data }; usuarios.push(u); return u; }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
      },
      person: {
        findUnique: jest.fn(async ({ where }: any) => ({ nombres: 'Ana', apellidos: 'Prueba', party_id: where.party_id })),
        create: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Prueba' }),
        update: jest.fn().mockResolvedValue({}),
      },
      party: { create: jest.fn().mockResolvedValue({ id: 10n }), findUnique: jest.fn(async () => ({ tipo: 'PERSONA' })) },
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }) },
      partyRole: { create: jest.fn().mockResolvedValue({ id: 70n }), findFirst: jest.fn().mockResolvedValue(null) },
      customerDetail: { create: jest.fn() },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prisma = { ...tx, $transaction: jest.fn((cb: any) => cb(tx)) };
    const mod = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
        { provide: AvisosInternosService, useValue: { enviarPruebaAlertas: jest.fn() } },
      ],
    }).compile();
    service = mod.get(UsuariosService);
  });

  const guardar = (dto: any = {}) => service.editar(7n, { celular: X, ...dto } as any, admin, '1.1.1.1');
  const vinculos = () => auditoria.registrar.mock.calls.filter((c: any[]) => c[0].accion === 'USUARIO_VINCULAR_CUENTA_CLIENTE').length;
  const recibeDescuento = async () => (await trabajadorDeCuentaCliente(prisma, A))?.partyTrabajadorId;

  // 1. Cliente registrado en la carta (con contraseña) y usuario sin celular
  describe('1. cliente de la carta y usuario sin celular: el celular VINCULA, no da error', () => {
    const variantes: Array<[string, string, string]> = [
      ['9 dígitos', X, X], ['con 51 en el contacto', `51${X}`, X], ['con 51 en la cuenta', X, `51${X}`], ['con 51 en ambos', `51${X}`, `51${X}`],
    ];
    it.each(variantes)('contacto %s', async (_n, valorContacto, telCuenta) => {
      contactos = [contactoA({ valor: valorContacto })];
      cuentas = [cuentaA({ telefono: telCuenta })];
      await guardar();
      expect(cuentas[0].usuario_party_id).toBe(B);
      expect(contactos).toHaveLength(1); // sin contacto duplicado
      expect(await recibeDescuento()).toBe(B);
    });
    it.each(['TELEFONO', 'WHATSAPP'])('tipo de contacto %s', async (tipo) => {
      contactos = [contactoA({ tipo })];
      await guardar();
      expect(cuentas[0].usuario_party_id).toBe(B);
    });
    it('un contacto inactivo no cuenta', async () => {
      contactos = [contactoA({ activo: false })];
      cuentas = [cuentaA({ telefono: null })];
      await guardar();
      expect(cuentas[0].usuario_party_id).toBeNull();
      expect(contactos.filter((c) => c.party_id === B)).toHaveLength(1);
    });
  });

  it('2. cuenta creada desde Clientes › Nuevo cliente (sin contraseña): se vincula igual', async () => {
    cuentas = [cuentaA({ hash: null })];
    await guardar();
    expect(cuentas[0].usuario_party_id).toBe(B);
    expect(await recibeDescuento()).toBe(B);
  });

  it('3. cuenta de cliente DESACTIVADA con ese celular: 409 que dice reactivarla en Clientes; no vincula ni crea contacto', async () => {
    cuentas = [cuentaA({ activo: false })];
    await expect(guardar()).rejects.toMatchObject({ response: { codigo: 'CELULAR_DUPLICADO', motivo: 'CUENTA_DESACTIVADA', mensaje: expect.stringContaining('Reactívala primero en Clientes') } });
    expect(cuentas[0].usuario_party_id).toBeNull();
    expect(contactos).toHaveLength(1);
  });

  describe('4. el celular está en un solo lado de la cuenta: no hay falsa «otra persona»', () => {
    it('solo en customer_account.telefono (sin contacto)', async () => {
      contactos = [];
      await guardar();
      expect(cuentas[0].usuario_party_id).toBe(B);
    });
    it('solo en contact_mechanism (cuenta sin telefono)', async () => {
      cuentas = [cuentaA({ telefono: null })];
      await guardar();
      expect(cuentas[0].usuario_party_id).toBe(B);
    });
    it('cuenta ya vinculada a este usuario cuyo telefono es otro, y el contacto es el celular: YA vinculada, sin error', async () => {
      cuentas = [cuentaA({ telefono: '911111111', usuario_party_id: B })];
      await guardar();
      expect(vinculos()).toBe(0);
    });
  });

  it('5. la misma persona (usuario y cliente comparten party): sin error y sin vincular', async () => {
    partyUsuario = A;
    usuarios = [{ id: 7n, party_id: A, activo: true }];
    await guardar();
    expect(cuentas[0].usuario_party_id).toBeNull();
    expect(vinculos()).toBe(0);
    expect(contactos).toHaveLength(1);
    expect(await recibeDescuento()).toBe(A); // el descuento sigue por ser la misma persona
  });

  it('6. guardar otra vez el mismo celular ya vinculado: no hace nada y no da error', async () => {
    await guardar();
    await guardar();
    await guardar();
    expect(vinculos()).toBe(1);
    expect(cuentas[0].usuario_party_id).toBe(B);
    expect(contactos).toHaveLength(1);
  });

  describe('7. cambiar el celular de un trabajador ya vinculado', () => {
    beforeEach(async () => { await guardar(); });
    it('a un número libre: la vinculación se MANTIENE (no se desvincula sola) y el número nuevo queda como contacto', async () => {
      await guardar({ celular: '900000555' });
      expect(cuentas[0].usuario_party_id).toBe(B);
      expect(contactos.some((c) => c.party_id === B && c.valor === '900000555')).toBe(true);
      expect(await recibeDescuento()).toBe(B);
    });
    it('al número de OTRA cuenta de cliente: 409 que pide desvincular primero; nada cambia', async () => {
      cuentas.push({ id: 9n, party_id: 81n, telefono: '900000777', hash: 'h', activo: true, usuario_party_id: null });
      contactos.push({ id: 3n, party_id: 81n, tipo: 'WHATSAPP', valor: '900000777', activo: true, principal: true });
      await expect(guardar({ celular: '900000777' })).rejects.toMatchObject({ response: { motivo: 'USUARIO_YA_VINCULADO', mensaje: expect.stringContaining('Desvincúlala') } });
      expect(cuentas[0].usuario_party_id).toBe(B);
      expect(cuentas[1].usuario_party_id).toBeNull();
    });
  });

  describe('invitado sin cuenta (CREARA_CUENTA)', () => {
    beforeEach(() => { cuentas = []; });
    it('pide Sí/No y, confirmado, crea la cuenta en ese party vinculada al trabajador', async () => {
      await expect(guardar()).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_CREAR_CUENTA' } });
      expect(cuentas).toHaveLength(0);
      await guardar({ confirmaMismaPersona: true });
      expect(cuentas).toEqual([expect.objectContaining({ party_id: A, usuario_party_id: B, hash: null })]);
      expect(await recibeDescuento()).toBe(B);
    });
  });

  describe('conflictos reales', () => {
    it('otro usuario del equipo tiene el celular', async () => {
      usuarios.push({ id: 6n, party_id: A, activo: true });
      await expect(guardar()).rejects.toMatchObject({ response: { motivo: 'USUARIO', mensaje: expect.stringContaining('otro usuario del equipo') } });
    });
    it('la cuenta ya está vinculada a otro trabajador', async () => {
      cuentas = [cuentaA({ usuario_party_id: 55n })];
      await expect(guardar()).rejects.toMatchObject({ response: { motivo: 'CUENTA_VINCULADA' } });
    });
    it('varias cuentas con ese celular', async () => {
      cuentas.push({ id: 9n, party_id: 82n, telefono: X, hash: 'h', activo: true, usuario_party_id: null });
      await expect(guardar()).rejects.toMatchObject({ response: { motivo: 'VARIAS_CUENTAS' } });
    });
  });

  it('nombre distinto: pide confirmar que es la misma persona y con la confirmación vincula', async () => {
    prisma.person.findUnique.mockImplementation(async ({ where }: any) => (where.party_id === A ? { nombres: 'Rosa', apellidos: 'Otra' } : { nombres: 'Ana', apellidos: 'Prueba' }));
    await expect(guardar()).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_VINCULO' } });
    await guardar({ confirmaMismaPersona: true });
    expect(cuentas[0].usuario_party_id).toBe(B);
  });

  describe('alta (crear usuario)', () => {
    const base = { nombres: 'Ana', apellidos: 'Prueba', dni: '12345678', rol: 'MOZO', celular: X };
    it('con un cliente de la carta que tiene ese celular: reutiliza su party (una sola persona), sin 409', async () => {
      await service.crear(base as any, admin);
      expect(prisma.party.create).not.toHaveBeenCalled();
      expect(prisma.userAccount.create.mock.calls[0][0].data.party_id).toBe(A);
      expect(cuentas[0].usuario_party_id).toBeNull(); // misma persona: no hace falta vínculo
    });
    it('con cuenta solo en telefono (sin contacto): reutiliza su party igual', async () => {
      contactos = [];
      await service.crear(base as any, admin);
      expect(prisma.party.create).not.toHaveBeenCalled();
      expect(prisma.userAccount.create.mock.calls[0][0].data.party_id).toBe(A);
    });
    it('con un invitado sin cuenta: reutiliza su party (como antes)', async () => {
      cuentas = [];
      await service.crear(base as any, admin);
      expect(prisma.party.create).not.toHaveBeenCalled();
      expect(prisma.userAccount.create.mock.calls[0][0].data.party_id).toBe(A);
    });
    it('con cuenta desactivada: 409 claro', async () => {
      cuentas = [cuentaA({ activo: false })];
      await expect(service.crear(base as any, admin)).rejects.toMatchObject({ response: { motivo: 'CUENTA_DESACTIVADA' } });
    });
  });

  describe('importar personal', () => {
    const fila = { nombres: 'Ana', apellidos: 'Prueba', documento: '12345678', rol: 'MOZO', celular: X };
    it('simulación avisa que se une a su cuenta; la importación reutiliza la persona del cliente (sin error)', async () => {
      const s: any = await service.importarPersonal([fila] as any, { simular: true }, admin);
      expect(s.resultados[0]).toMatchObject({ estado: 'OK', vincula: true });
      const r: any = await service.importarPersonal([fila] as any, { simular: false }, admin);
      expect(r.resultados[0]).toMatchObject({ estado: 'CREADA' });
      expect(prisma.userAccount.create.mock.calls[0][0].data.party_id).toBe(A);
    });
  });

  describe('alertas de WhatsApp (mismo criterio)', () => {
    const adminUsuario = () => {
      usuarios = [{ id: 7n, party_id: B, activo: true, rol: 'ADMIN' }];
      prisma.userAccount.findUnique.mockImplementation(async () => ({ id: 7n, party_id: B, rol: 'ADMIN', alertas_whatsapp: false, party: { persona: { nombres: 'Ana' }, contactos: [] } }));
    };
    it('un celular que es de una cuenta de la carta: 409 que manda a Editar usuario (ya no el error viejo)', async () => {
      adminUsuario();
      await expect(service.configurarAlertasWhatsapp(7n, { celular: X, alertasWhatsapp: false } as any, admin)).rejects.toMatchObject({ response: { codigo: 'CELULAR_CON_CUENTA_CLIENTE' } });
    });
    it('si ya es de su cuenta vinculada: guarda la casilla sin duplicar el contacto', async () => {
      cuentas = [cuentaA({ usuario_party_id: B })];
      adminUsuario();
      await service.configurarAlertasWhatsapp(7n, { celular: X, alertasWhatsapp: false } as any, admin);
      expect(contactos).toHaveLength(1);
      const est: any = await service.obtenerAlertasWhatsapp(7n);
      expect(est.celular).toBe(X); // lo toma de su cuenta vinculada
    });
  });
});
