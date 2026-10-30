import { HttpException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { PuntosService } from './puntos.service';
import { DireccionesClienteService } from './direcciones-cliente.service';
import { partyClienteDelPedido } from './cliente-del-pedido';

describe('DireccionesClienteService', () => {
  let service: DireccionesClienteService;
  let prismaMock: any;
  let redisMock: any;
  let puntosMock: any;

  const fila = (extra: Record<string, unknown> = {}) => ({
    id: 1n,
    party_id: 77n,
    direccion: 'Av. Las Palmeras 123',
    referencia: null,
    lat: null,
    lng: null,
    zona_id: null,
    origen: 'CARTA',
    alias: null,
    usos: 1,
    ultimo_uso_en: new Date('2026-10-01T10:00:00Z'),
    activo: true,
    creado_en: new Date('2026-10-01T10:00:00Z'),
    ...extra,
  });

  beforeEach(async () => {
    prismaMock = {
      clienteDireccion: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(fila({ ...data, id: 9n }))),
        update: jest.fn().mockImplementation(({ data, where }: any) => Promise.resolve(fila({ ...data, id: where.id }))),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null) },
      customerAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue(null) },
      party: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    redisMock = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1) };
    puntosMock = { obtenerSaldo: jest.fn().mockResolvedValue(12.5) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DireccionesClienteService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PuntosService, useValue: puntosMock },
        { provide: RedisService, useValue: { obtenerCliente: () => redisMock } },
      ],
    }).compile();

    service = module.get(DireccionesClienteService);
  });

  describe('registrarUso', () => {
    it('crea la dirección con 1 uso cuando no existe', async () => {
      const r = await service.registrarUso(77n, { direccion: 'Av. Las Palmeras 123', referencia: 'Portón azul' }, 'CARTA');

      expect(prismaMock.clienteDireccion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          party_id: 77n,
          direccion: 'Av. Las Palmeras 123',
          referencia: 'Portón azul',
          origen: 'CARTA',
          usos: 1,
          activo: true,
        }),
      });
      expect(r?.usos).toBe(1);
    });

    it('dedupe por texto normalizado: suma un uso y actualiza referencia, sin crear otra', async () => {
      prismaMock.clienteDireccion.findMany.mockResolvedValue([fila({ id: 5n })]);

      await service.registrarUso(77n, { direccion: '  av.   LAS palmeras 123 ', referencia: 'Timbre 2' }, 'MOZO');

      expect(prismaMock.clienteDireccion.create).not.toHaveBeenCalled();
      expect(prismaMock.clienteDireccion.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: expect.objectContaining({ usos: { increment: 1 }, referencia: 'Timbre 2' }),
      });
    });

    it('dedupe por punto del mapa: mismas coordenadas a 5 decimales son la misma dirección aunque el texto cambie', async () => {
      prismaMock.clienteDireccion.findMany.mockResolvedValue([
        fila({ id: 6n, direccion: 'Casa de la esquina', lat: { toString: () => '-12.0463741' } as any, lng: { toString: () => '-77.0427931' } as any }),
      ]);

      await service.registrarUso(
        77n,
        { direccion: 'Frente al parque', lat: -12.046374, lng: -77.042793 },
        'CARTA',
      );

      expect(prismaMock.clienteDireccion.create).not.toHaveBeenCalled();
      expect(prismaMock.clienteDireccion.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 6n } }));
    });

    it('sin texto ni coordenadas no registra nada', async () => {
      const r = await service.registrarUso(77n, { direccion: '   ' }, 'CARTA');

      expect(r).toBeNull();
      expect(prismaMock.clienteDireccion.findMany).not.toHaveBeenCalled();
      expect(prismaMock.clienteDireccion.create).not.toHaveBeenCalled();
    });

    it('usa el cliente de la transacción cuando se pasa tx', async () => {
      const tx: any = {
        clienteDireccion: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue(fila()),
          update: jest.fn(),
        },
      };

      await service.registrarUso(77n, { direccion: 'Av. Las Palmeras 123' }, 'CARTA', tx);

      expect(tx.clienteDireccion.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.clienteDireccion.create).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('solo activas, de la más reciente a la más antigua, 5 por defecto', async () => {
      await service.listar(77n);

      expect(prismaMock.clienteDireccion.findMany).toHaveBeenCalledWith({
        where: { party_id: 77n, activo: true },
        orderBy: [{ ultimo_uso_en: 'desc' }, { id: 'desc' }],
        take: 5,
      });
    });

    it('respeta el límite pedido y devuelve la forma del contrato', async () => {
      prismaMock.clienteDireccion.findMany.mockResolvedValue([
        fila({ lat: 1 as any, lng: null, referencia: 'Portón' }),
      ]);

      const r = await service.listar('77', { limite: 3 });

      expect(prismaMock.clienteDireccion.findMany.mock.calls[0][0].take).toBe(3);
      expect(r).toEqual([
        {
          id: '1',
          direccion: 'Av. Las Palmeras 123',
          referencia: 'Portón',
          lat: 1,
          lng: null,
          alias: null,
          usos: 1,
          ultimoUsoEn: '2026-10-01T10:00:00.000Z',
          origen: 'CARTA',
        },
      ]);
    });
  });

  describe('desactivar', () => {
    it('marca activo = false solo si la dirección es de esa cuenta', async () => {
      const r = await service.desactivar(77n, '5');

      expect(prismaMock.clienteDireccion.updateMany).toHaveBeenCalledWith({
        where: { id: 5n, party_id: 77n, activo: true },
        data: { activo: false },
      });
      expect(r).toEqual({ ok: true });
    });

    it('dirección ajena o ya inactiva: NotFound, nada se borra', async () => {
      prismaMock.clienteDireccion.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.desactivar(77n, '5')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.clienteDireccion.updateMany).toHaveBeenCalledTimes(1);
    });

    it('id que no es número: NotFound sin consultar', async () => {
      await expect(service.desactivar(77n, 'abc')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.clienteDireccion.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('resolverPartyPorTelefono', () => {
    it('normaliza 51 + 9 dígitos y busca solo contactos de cuentas activas', async () => {
      prismaMock.contactMechanism.findFirst.mockResolvedValue({ party_id: 99n });

      const r = await service.resolverPartyPorTelefono('+51 987 654 321');

      expect(r).toBe(99n);
      const where = prismaMock.contactMechanism.findFirst.mock.calls[0][0].where;
      expect(where.valor.in).toEqual(['987654321', '51987654321']);
      expect(where.party).toEqual({ cuentaCliente: { is: { activo: true } } });
    });

    it('sin cuenta o teléfono inválido devuelve null sin consultar', async () => {
      expect(await service.resolverPartyPorTelefono('12345')).toBeNull();
      expect(prismaMock.contactMechanism.findFirst).not.toHaveBeenCalled();

      prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
      expect(await service.resolverPartyPorTelefono('987654321')).toBeNull();
    });
  });

  describe('buscarPorTelefono', () => {
    beforeEach(() => {
      prismaMock.customerAccount.findFirst.mockResolvedValue(null);
    });

    it('sin cuenta con ese celular: { encontrado: false }', async () => {
      prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
      expect(await service.buscarPorTelefono('987654321', 55n)).toEqual({ encontrado: false });
    });

    it('con cuenta: nombre, teléfono, puntos y direcciones; sin correo, cumpleaños ni DNI', async () => {
      prismaMock.customerAccount.findFirst.mockResolvedValue({ party_id: 77n });
      prismaMock.party.findUnique.mockResolvedValue({
        persona: { nombres: 'Ana', correo: 'ana@x.com', cumple_dia: 1, cumple_mes: 2 },
        contactos: [
          { tipo: 'CORREO', valor: 'ana@x.com' },
          { tipo: 'TELEFONO', valor: '987654321' },
        ],
      });
      prismaMock.clienteDireccion.findMany.mockResolvedValue([fila()]);

      const r: any = await service.buscarPorTelefono('987654321', 55n);

      expect(prismaMock.customerAccount.findFirst.mock.calls[0][0].where).toEqual({ telefono: '987654321', activo: true });
      expect(r).toEqual({
        encontrado: true,
        party: '77',
        nombre: 'Ana',
        telefono: '987654321',
        puntos: 12.5,
        direcciones: [expect.objectContaining({ direccion: 'Av. Las Palmeras 123' })],
      });
      expect(JSON.stringify(r)).not.toContain('ana@x.com');
    });

    it('más de 20 búsquedas por minuto del mismo usuario: 429', async () => {
      redisMock.incr.mockResolvedValue(21);
      await expect(service.buscarPorTelefono('987654321', 55n)).rejects.toBeInstanceOf(HttpException);
      expect(prismaMock.customerAccount.findFirst).not.toHaveBeenCalled();
    });

    it('si Redis no responde, no bloquea la búsqueda', async () => {
      redisMock.incr.mockRejectedValue(new Error('redis caído'));
      prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
      expect(await service.buscarPorTelefono('987654321', 55n)).toEqual({ encontrado: false });
    });
  });
});

describe('partyClienteDelPedido', () => {
  it('cliente_party_id manda sobre cualquier canal', () => {
    expect(partyClienteDelPedido({ canal: 'MOZO', party_id: 55n, cliente_party_id: 77n })).toBe(77n);
  });

  it('CARTA y WHATSAPP usan party_id como cliente; MOZO y CAJA no', () => {
    expect(partyClienteDelPedido({ canal: 'CARTA', party_id: 88n, cliente_party_id: null })).toBe(88n);
    expect(partyClienteDelPedido({ canal: 'WHATSAPP', party_id: 99n })).toBe(99n);
    expect(partyClienteDelPedido({ canal: 'MOZO', party_id: 55n, cliente_party_id: null })).toBeNull();
    expect(partyClienteDelPedido({ canal: 'CAJA', party_id: 55n })).toBeNull();
  });

  it('invitado: null', () => {
    expect(partyClienteDelPedido({ canal: 'CARTA', party_id: null, cliente_party_id: null })).toBeNull();
  });
});
