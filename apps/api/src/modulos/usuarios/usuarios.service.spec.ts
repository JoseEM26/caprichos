jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prismaMock: any;
  let auditoriaMock: any;

  const adminAuth: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  const cajeroAuth: UsuarioAutenticado = {
    partyId: 2n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      partyRole: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      partyIdentifier: {
        findFirst: jest.fn(),
      },
      userAccount: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      sesion: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('crear', () => {
    it('debe crear un usuario y devolver la claveInicial UNA sola vez', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);

      const mockParty = { id: 10n, tipo: 'PERSONA', estado: 'ACTIVO' };
      const mockPerson = { party_id: 10n, nombres: 'Carlos', apellidos: 'Perez' };
      const mockPartyIdentifier = { id: 1n, party_id: 10n, tipo: 'DNI', numero: '12345678' };
      const mockUserAccount = {
        id: 5n,
        party_id: 10n,
        rol: 'CAJERO',
        hash: 'hash-argon2id',
        debe_cambiar: true,
        activo: true,
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          party: { create: jest.fn().mockResolvedValue(mockParty) },
          person: { create: jest.fn().mockResolvedValue(mockPerson) },
          partyIdentifier: { create: jest.fn().mockResolvedValue(mockPartyIdentifier) },
          userAccount: { create: jest.fn().mockResolvedValue(mockUserAccount) },
          partyRole: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const resultado = await service.crear(
        {
          nombres: 'Carlos',
          apellidos: 'Perez',
          dni: '12345678',
          rol: 'CAJERO',
        },
        adminAuth,
        '127.0.0.1',
      );

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe('5');
      expect(resultado.partyId).toBe('10');
      expect(resultado.nombres).toBe('Carlos');
      expect(resultado.apellidos).toBe('Perez');
      expect(resultado.dni).toBe('12****78'); // Enmascarado
      expect(resultado.claveInicial).toBeDefined();
      expect(typeof resultado.claveInicial).toBe('string');
      expect(resultado.claveInicial.length).toBe(12);

      // Verifica auditoría registrada
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'CREAR',
          resultado: 'OK',
          entidad: 'user_account',
          entidadId: 5n,
          despues: expect.objectContaining({
            dni: '12****78',
            rol: 'CAJERO',
            activo: true,
          }),
        }),
      );
    });

    it('DNI duplicado → 409 DNI_DUPLICADO', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({
        id: 1n,
        party_id: 10n,
        tipo: 'DNI',
        numero: '12345678',
      });
      // El party del DNI ya tiene usuario: es otra persona con cuenta, no se reutiliza
      prismaMock.userAccount.findUnique.mockResolvedValue({ id: 7n, party_id: 10n });

      await expect(
        service.crear(
          {
            nombres: 'Carlos',
            apellidos: 'Perez',
            dni: '12345678',
            rol: 'CAJERO',
          },
          adminAuth,
        ),
      ).rejects.toThrow(ConflictException);

      try {
        await service.crear(
          {
            nombres: 'Carlos',
            apellidos: 'Perez',
            dni: '12345678',
            rol: 'CAJERO',
          },
          adminAuth,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'DNI_DUPLICADO',
          }),
        );
      }
    });

    it('DNI duplicado por error de carrera P2002 → 409 DNI_DUPLICADO', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.crear(
          {
            nombres: 'Carlos',
            apellidos: 'Perez',
            dni: '12345678',
            rol: 'CAJERO',
          },
          adminAuth,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('último admin protegido', () => {
    it('no permite cambiar de rol al último ADMIN activo (editar)', async () => {
      const adminUsuario = {
        id: 1n,
        party_id: 1n,
        rol: 'ADMIN',
        activo: true,
        party: {
          persona: { nombres: 'Admin', apellidos: 'Principal' },
          documentos: [{ tipo: 'DNI', numero: '87654321' }],
        },
      };

      prismaMock.userAccount.findUnique.mockResolvedValue(adminUsuario);
      prismaMock.userAccount.count.mockResolvedValue(1); // Solo 1 admin activo

      await expect(
        service.editar(1n, { rol: 'CAJERO' }, adminAuth),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.editar(1n, { rol: 'CAJERO' }, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'ULTIMO_ADMIN',
          }),
        );
      }
    });

    it('no permite desactivar al último ADMIN activo', async () => {
      const adminUsuario = {
        id: 10n,
        party_id: 99n, // Distinto de adminAuth.partyId (1n) para no saltar por auto-desactivación
        rol: 'ADMIN',
        activo: true,
        party: {
          documentos: [{ tipo: 'DNI', numero: '87654321' }],
        },
      };

      prismaMock.userAccount.findUnique.mockResolvedValue(adminUsuario);
      prismaMock.userAccount.count.mockResolvedValue(1); // Solo 1 admin activo

      await expect(
        service.desactivar(10n, adminAuth),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.desactivar(10n, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'ULTIMO_ADMIN',
          }),
        );
      }
    });

    it('no permite auto-desactivación', async () => {
      const usuarioPropio = {
        id: 1n,
        party_id: 1n, // Coincide con adminAuth.partyId
        rol: 'ADMIN',
        activo: true,
        party: {
          documentos: [{ tipo: 'DNI', numero: '87654321' }],
        },
      };

      prismaMock.userAccount.findUnique.mockResolvedValue(usuarioPropio);

      await expect(
        service.desactivar(1n, adminAuth),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.desactivar(1n, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'AUTO_DESACTIVACION',
          }),
        );
      }
    });
  });

  describe('desactivar revoca sesiones', () => {
    it('desactivar usuario revoca las sesiones de la BD', async () => {
      const otroUsuario = {
        id: 20n,
        party_id: 50n,
        rol: 'CAJERO',
        activo: true,
        party: {
          documentos: [{ tipo: 'DNI', numero: '11223344' }],
        },
      };

      prismaMock.userAccount.findUnique.mockResolvedValue(otroUsuario);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          userAccount: { update: jest.fn().mockResolvedValue({ ...otroUsuario, activo: false }) },
          sesion: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        };
        return callback(tx);
      });

      const res = await service.desactivar(20n, adminAuth, '192.168.1.1');

      expect(res.activo).toBe(false);
      expect(prismaMock.$transaction).toHaveBeenCalled();

      // Verifica auditoría de desactivación
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'DESACTIVAR',
          entidadId: 20n,
          despues: expect.objectContaining({
            activo: false,
          }),
        }),
      );
    });
  });

  describe('obtenerDni (LECTURA_SENSIBLE)', () => {
    it('permite a un ADMIN ver el DNI completo y registra auditoría LECTURA_SENSIBLE', async () => {
      const targetUser = {
        id: 5n,
        party_id: 12n,
        rol: 'CAJERO',
        party: {
          documentos: [{ tipo: 'DNI', numero: '44556677' }],
        },
      };

      prismaMock.userAccount.findUnique.mockResolvedValue(targetUser);

      const res = await service.obtenerDni(5n, adminAuth, '10.0.0.1');

      expect(res.dni).toBe('44556677');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LECTURA_SENSIBLE',
          modulo: 'usuarios',
          accion: 'VER_DNI',
          resultado: 'OK',
          entidad: 'user_account',
          entidadId: 5n,
        }),
      );
    });

    it('prohíbe a un usuario no ADMIN ver el DNI completo', async () => {
      await expect(
        service.obtenerDni(5n, cajeroAuth),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('restablecerClave', () => {
    it('restablece contraseña aleatoria de 12 caracteres, debe_cambiar=true y revoca sesiones', async () => {
      const targetUser = {
        id: 5n,
        party_id: 12n,
        rol: 'CAJERO',
        debe_cambiar: false,
        party: {
          documentos: [{ tipo: 'DNI', numero: '44556677' }],
        },
      };

      prismaMock.userAccount.findUnique.mockResolvedValue(targetUser);
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          userAccount: { update: jest.fn().mockResolvedValue({ ...targetUser, debe_cambiar: true }) },
          sesion: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return callback(tx);
      });

      const res = await service.restablecerClave(5n, adminAuth);

      expect(res.claveInicial).toBeDefined();
      expect(res.claveInicial.length).toBe(12);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'RESTABLECER_CLAVE',
        }),
      );
    });
  });

  describe('listar', () => {
    it('lista usuarios paginados con DNI enmascarado', async () => {
      prismaMock.userAccount.count.mockResolvedValue(1);
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 10n,
          party_id: 20n,
          rol: 'COCINA',
          activo: true,
          debe_cambiar: false,
          alta_en: new Date('2026-10-01'),
          party: {
            persona: { nombres: 'Pedro', apellidos: 'Gomez' },
            documentos: [{ tipo: 'DNI', numero: '72345678' }],
          },
        },
      ]);

      const res = await service.listar({ pagina: 1, limite: 10 });

      expect(res.total).toBe(1);
      expect(res.elementos[0].id).toBe('10');
      expect(res.elementos[0].dni).toBe('72****78');
      expect(res.elementos[0].nombres).toBe('Pedro');
    });

    it('Producción se mapea a COCINA y solo cuenta roles extra vigentes', async () => {
      prismaMock.userAccount.count.mockResolvedValue(0);
      prismaMock.userAccount.findMany.mockResolvedValue([]);
      await service.listar({ rol: 'PRODUCCION' });
      const where = prismaMock.userAccount.findMany.mock.calls[0][0].where;
      const or = where.AND[0].OR;
      expect(or[0]).toEqual({ rol: 'COCINA' });
      expect(or[1].rolesExtra.some.rol).toBe('COCINA');
      expect(or[1].rolesExtra.some.OR).toEqual(expect.arrayContaining([{ vence_en: null }]));
    });

    it('filtra por creado, fechas y último acceso (auditoría de INGRESO)', async () => {
      prismaMock.auditoria = { groupBy: jest.fn().mockResolvedValue([{ party_id: 7n, _max: { en: new Date() } }, { party_id: 8n, _max: { en: new Date('2020-01-01') } }]) };
      prismaMock.userAccount.count.mockResolvedValue(0);
      prismaMock.userAccount.findMany.mockResolvedValue([]);
      await service.listar({ creado: '30', desde: '2026-01-01', hasta: '2026-02-01', acceso: 'hoy' });
      const and = prismaMock.userAccount.findMany.mock.calls[0][0].where.AND;
      expect(and.some((c: any) => c.alta_en?.gte && !c.alta_en.lte)).toBe(true);
      expect(and).toEqual(expect.arrayContaining([{ alta_en: { lte: new Date('2026-02-01T00:00:00.000Z') } }, { party_id: { in: [7n] } }]));
      await service.listar({ acceso: 'nunca' });
      expect(prismaMock.userAccount.findMany.mock.calls.at(-2)[0].where.AND).toEqual([{ party_id: { notIn: [7n, 8n] } }]);
      await service.listar({ acceso: 'mas30' });
      expect(prismaMock.userAccount.findMany.mock.calls.at(-2)[0].where.AND).toEqual([{ party_id: { in: [8n] } }]);
    });

    it('la búsqueda por nombre completo ignora tildes, ñ y mayúsculas', async () => {
      const cand = (id: bigint, nombres: string, apellidos: string) => ({ id, party: { persona: { nombres, apellidos }, documentos: [] } });
      prismaMock.userAccount.count.mockResolvedValue(0);
      prismaMock.userAccount.findMany.mockImplementation(async (a: any) =>
        a.select?.party ? [cand(1n, 'Juan', 'Pérez'), cand(2n, 'Peña', 'Núñez'), cand(3n, 'Ana', 'Ruiz')] : [],
      );
      await service.listar({ busqueda: 'JUAN perez' });
      expect(prismaMock.userAccount.findMany.mock.calls.at(-2)[0].where.AND).toEqual([{ id: { in: [1n] } }]);
      await service.listar({ busqueda: 'pena nunez' });
      expect(prismaMock.userAccount.findMany.mock.calls.at(-2)[0].where.AND).toEqual([{ id: { in: [2n] } }]);
    });

    it('devuelve conteos reales (activos, inactivos y por rol con extras vigentes) independientes de la página', async () => {
      prismaMock.userAccount.count.mockResolvedValue(1);
      const futuro = new Date(Date.now() + 86400000);
      const pasado = new Date(Date.now() - 86400000);
      prismaMock.userAccount.findMany.mockImplementation(async (a: any) =>
        a.select?.rolesExtra
          ? [
              { rol: 'CAJERO', activo: true, rolesExtra: [{ rol: 'COCINA', vence_en: null }, { rol: 'MOZO', vence_en: pasado }] },
              { rol: 'COCINA', activo: false, rolesExtra: [{ rol: 'MOZO', vence_en: futuro }] },
            ]
          : [],
      );
      const res = await service.listar({ pagina: 1, limite: 1 });
      expect(res.conteos).toEqual({ total: 2, activos: 1, inactivos: 1, porRol: { CAJERO: 1, COCINA: 2, MOZO: 1, PRODUCCION: 2 } });
    });
  });
});
