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
      partyIdentifier: {
        findUnique: jest.fn(),
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
      prismaMock.partyIdentifier.findUnique.mockResolvedValue(null);

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
      prismaMock.partyIdentifier.findUnique.mockResolvedValue({
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
      prismaMock.partyIdentifier.findUnique.mockResolvedValue(null);
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

  describe('asignarPin (deprecado)', () => {
    it('responde 410 GONE PIN_DEPRECADO indicando que el PIN fijo fue retirado', async () => {
      await expect(
        service.asignarPin(1n, { pin: '123456' }, adminAuth),
      ).rejects.toMatchObject({
        status: HttpStatus.GONE,
        response: expect.objectContaining({
          codigo: 'PIN_DEPRECADO',
        }),
      });
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
  });
});
