import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { PartyPuntosService } from './party-puntos.service';

describe('PartyPuntosService', () => {
  let service: PartyPuntosService;
  let prisma: any;

  /** Party suelto (sin cuenta ni usuario) con ese celular: la consulta de contacto que NO filtra por cuenta. */
  const sueltoCon = (respuesta: () => any) =>
    prisma.contactMechanism.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.party?.cuentaCliente?.is === null ? respuesta() : null),
    );
  /** Cuenta activa por el celular de la cuenta. */
  const cuentaActivaCon = (partyId: bigint) =>
    prisma.customerAccount.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.activo === true ? { party_id: partyId } : null),
    );
  /** Cuenta desactivada con ese celular. */
  const cuentaDesactivada = () =>
    prisma.customerAccount.findFirst.mockImplementation(({ where }: any) => Promise.resolve(where.activo === false ? { id: 1n } : null));

  beforeEach(async () => {
    prisma = {
      customerAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      partyRole: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 900n }) },
      customerDetail: { create: jest.fn() },
      party: { create: jest.fn().mockResolvedValue({ id: 500n }) },
      person: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [PartyPuntosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PartyPuntosService);
  });

  it('crea un party de puntos con celular, persona placeholder, rol CLIENTE y puntos en 0', async () => {
    const id = await service.resolverOCrear('987 654 321');

    expect(id).toBe(500n);
    expect(prisma.party.create).toHaveBeenCalledWith({ data: { tipo: 'PERSONA', estado: 'ACTIVO' } });
    expect(prisma.person.create).toHaveBeenCalledWith({ data: { party_id: 500n, nombres: 'Cliente' } });
    expect(prisma.contactMechanism.create).toHaveBeenCalledWith({
      data: { party_id: 500n, tipo: 'TELEFONO', valor: '987654321', principal: true },
    });
    expect(prisma.customerDetail.create).toHaveBeenCalledWith({ data: { party_role_id: 900n, puntos: 0 } });
  });

  it('acepta el celular con prefijo 51', async () => {
    await service.resolverOCrear('51987654321');
    expect(prisma.contactMechanism.create.mock.calls[0][0].data.valor).toBe('987654321');
  });

  it('reutiliza un party suelto con ese celular que ya tiene rol CLIENTE, sin crear otro', async () => {
    sueltoCon(() => ({ party_id: 42n }));
    prisma.partyRole.findFirst.mockResolvedValue({ id: 7n, customer_detail: { party_role_id: 7n } });

    expect(await service.resolverOCrear('987654321')).toBe(42n);
    expect(prisma.party.create).not.toHaveBeenCalled();
    expect(prisma.partyRole.create).not.toHaveBeenCalled();
  });

  it('un party suelto sin rol CLIENTE lo recibe con puntos en 0', async () => {
    sueltoCon(() => ({ party_id: 42n }));

    expect(await service.resolverOCrear('987654321')).toBe(42n);
    expect(prisma.partyRole.create).toHaveBeenCalledWith({ data: { party_id: 42n, rol: 'CLIENTE' } });
    expect(prisma.customerDetail.create).toHaveBeenCalledWith({ data: { party_role_id: 900n, puntos: 0 } });
  });

  it('con cuenta activa devuelve el party de esa cuenta', async () => {
    cuentaActivaCon(77n);

    expect(await service.resolverOCrear('987654321')).toBe(77n);
    expect(prisma.party.create).not.toHaveBeenCalled();
  });

  it('con cuenta desactivada devuelve null y no acumula ni crea nada', async () => {
    cuentaDesactivada();

    expect(await service.resolverOCrear('987654321')).toBeNull();
    expect(prisma.party.create).not.toHaveBeenCalled();
  });

  it('celular inválido o el relleno 999999999: null sin crear nada', async () => {
    expect(await service.resolverOCrear('12345678')).toBeNull();
    expect(await service.resolverOCrear('812345678')).toBeNull();
    expect(await service.resolverOCrear('999999999')).toBeNull();
    expect(await service.resolverOCrear(undefined)).toBeNull();
    expect(prisma.party.create).not.toHaveBeenCalled();
  });

  it('carrera: si otro registro gana (P2002), vuelve a buscar y devuelve ese party', async () => {
    let consultas = 0;
    sueltoCon(() => (consultas++ === 0 ? null : { party_id: 88n }));
    prisma.party.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    prisma.partyRole.findFirst.mockResolvedValue({ id: 3n, customer_detail: { party_role_id: 3n } });

    expect(await service.resolverOCrear('987654321')).toBe(88n);
    expect(prisma.party.create).toHaveBeenCalledTimes(1);
  });

  it('celular de un party de personal (con usuario): lo reutiliza y le asegura el rol CLIENTE, sin crear otro party', async () => {
    // La consulta de contacto del party suelto ya no excluye a los parties con user_account
    prisma.contactMechanism.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.party?.cuentaCliente?.is === null ? { party_id: 33n } : null),
    );
    prisma.partyRole.findFirst.mockResolvedValue(null);
    prisma.partyRole.create.mockResolvedValue({ id: 901n });

    expect(await service.resolverOCrear('987654321')).toBe(33n);
    expect(prisma.party.create).not.toHaveBeenCalled();
    expect(prisma.partyRole.create).toHaveBeenCalledWith({ data: { party_id: 33n, rol: 'CLIENTE' } });
    expect(prisma.customerDetail.create).toHaveBeenCalledWith({ data: { party_role_id: 901n, puntos: 0 } });
  });

  it('carrera con choque de unicidad y nadie más con ese celular: devuelve null, nunca lanza', async () => {
    sueltoCon(() => null);
    prisma.party.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    expect(await service.resolverOCrear('987654321')).toBeNull();
  });
});
