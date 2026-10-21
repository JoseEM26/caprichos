import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../../comun/prisma/prisma.service';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let prisma: {
    auditoria: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      auditoria: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AuditoriaService>(AuditoriaService);
  });

  describe('registrar', () => {
    it('debe registrar un evento de auditoría correctamente', async () => {
      prisma.auditoria.create.mockResolvedValue({ id: BigInt(1) });

      await service.registrar({
        categoria: 'ACCESO',
        modulo: 'auth',
        accion: 'LOGIN',
        resultado: 'OK',
        partyId: BigInt(10),
        ip: '192.168.1.1',
      });

      expect(prisma.auditoria.create).toHaveBeenCalledWith({
        data: {
          categoria: 'ACCESO',
          modulo: 'auth',
          accion: 'LOGIN',
          resultado: 'OK',
          entidad: null,
          entidad_id: null,
          antes: undefined,
          despues: undefined,
          motivo: null,
          party_id: BigInt(10),
          con_pin_admin: false,
          ip: '192.168.1.1',
          dispositivo: null,
          request_id: null,
        },
      });
    });

    it('no debe lanzar excepción si falla la inserción (regla de contrato: nunca lanza)', async () => {
      prisma.auditoria.create.mockRejectedValue(new Error('Fallo de conexión en BD'));

      await expect(
        service.registrar({
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'EDITAR',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('listar', () => {
    it('debe listar registros aplicando paginación por defecto y orden descendente', async () => {
      const fecha = new Date();
      prisma.auditoria.count.mockResolvedValue(1);
      prisma.auditoria.findMany.mockResolvedValue([
        {
          id: BigInt(42),
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'CREAR',
          resultado: 'OK',
          entidad: 'user_account',
          entidad_id: BigInt(5),
          antes: null,
          despues: { rol: 'CAJERO' },
          motivo: 'Nuevo empleado',
          party_id: BigInt(12),
          con_pin_admin: false,
          ip: '127.0.0.1',
          dispositivo: 'Mozilla',
          request_id: 'req-123',
          en: fecha,
          hash_anterior: Buffer.from('abc1', 'hex'),
          hash: Buffer.from('def2', 'hex'),
        },
      ]);

      const resultado = await service.listar({});

      expect(prisma.auditoria.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { en: 'desc' },
        skip: 0,
        take: 20,
      });

      expect(resultado.total).toBe(1);
      expect(resultado.pagina).toBe(1);
      expect(resultado.limite).toBe(20);
      expect(resultado.paginas).toBe(1);
      expect(resultado.datos[0].id).toBe('42');
      expect(resultado.datos[0].entidadId).toBe('5');
      expect(resultado.datos[0].partyId).toBe('12');
      expect(resultado.datos[0].hashAnterior).toBe('abc1');
      expect(resultado.datos[0].hash).toBe('def2');
    });

    it('debe respetar el límite máximo de 100 registros', async () => {
      prisma.auditoria.count.mockResolvedValue(0);
      prisma.auditoria.findMany.mockResolvedValue([]);

      const resultado = await service.listar({ limite: 500, pagina: 2 });

      expect(prisma.auditoria.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { en: 'desc' },
        skip: 100,
        take: 100,
      });
      expect(resultado.limite).toBe(100);
      expect(resultado.pagina).toBe(2);
    });

    it('debe filtrar por modulo, accion, partyId, entidad y rango de fechas', async () => {
      prisma.auditoria.count.mockResolvedValue(0);
      prisma.auditoria.findMany.mockResolvedValue([]);

      const desde = '2026-10-01T00:00:00.000Z';
      const hasta = '2026-10-20T23:59:59.000Z';

      await service.listar({
        modulo: 'usuarios',
        accion: 'CREAR',
        partyId: '99',
        entidad: 'user_account',
        desde,
        hasta,
      });

      expect(prisma.auditoria.findMany).toHaveBeenCalledWith({
        where: {
          modulo: 'usuarios',
          accion: 'CREAR',
          party_id: BigInt(99),
          entidad: 'user_account',
          en: {
            gte: new Date(desde),
            lte: new Date(hasta),
          },
        },
        orderBy: { en: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('verificarCadena', () => {
    it('debe retornar valida true cuando no hay discrepancias', async () => {
      prisma.$queryRaw.mockResolvedValue([{ total: BigInt(15), discrepancias: BigInt(0) }]);

      const resultado = await service.verificarCadena();

      expect(resultado).toEqual({
        valida: true,
        totalFilas: 15,
        discrepancias: 0,
      });
    });

    it('debe retornar valida false e id del primer fallo cuando hay discrepancias', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total: BigInt(10), discrepancias: BigInt(1) }])
        .mockResolvedValueOnce([{ id: BigInt(4) }]);

      const resultado = await service.verificarCadena();

      expect(resultado).toEqual({
        valida: false,
        totalFilas: 10,
        discrepancias: 1,
        primerFalloId: '4',
      });
    });

    it('debe retornar error controlado si la consulta raw falla', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Fallo en la base'));

      const resultado = await service.verificarCadena();

      expect(resultado.valida).toBe(false);
      expect(resultado.discrepancias).toBe(-1);
      expect(resultado.error).toBe('Fallo en la base');
    });
  });
});
