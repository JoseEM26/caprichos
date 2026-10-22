jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
    verifyAsync = jest.fn();
  },
  JwtModule: {
    register: jest.fn().mockReturnValue({ module: class {} }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ClientesService, enmascararDoc, parsearCumpleanos } from './clientes.service';
import { PuntosService } from './puntos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('ClientesService', () => {
  let service: ClientesService;
  let prismaMock: any;
  let redisMock: any;
  let jwtMock: any;
  let auditoriaMock: any;
  let puntosMock: any;

  beforeEach(async () => {
    prismaMock = {
      party: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      partyIdentifier: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      person: {
        create: jest.fn(),
        update: jest.fn(),
      },
      partyRole: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      customerDetail: {
        create: jest.fn(),
        update: jest.fn(),
      },
      customerAccount: {
        create: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      contactMechanism: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      consent: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };

    const redisClientMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue(redisClientMock),
    };

    jwtMock = {
      signAsync: jest.fn().mockResolvedValue('jwt_token_cliente_mock'),
      verifyAsync: jest.fn(),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    puntosMock = {
      obtenerSaldo: jest.fn().mockResolvedValue(10),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: JwtService, useValue: jwtMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => def ?? 'test-secret'),
          },
        },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: PuntosService, useValue: puntosMock },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
  });

  describe('utilidades', () => {
    it('enmascararDoc enmascara DNI mostrando primeros 4 dígitos y ****', () => {
      expect(enmascararDoc('45217890')).toBe('4521****');
      expect(enmascararDoc('20601234567')).toBe('2060******7');
    });

    it('parsearCumpleanos reconoce formatos YYYY-MM-DD y DD/MM', () => {
      expect(parsearCumpleanos('1995-03-14')).toEqual({ dia: 14, mes: 3 });
      expect(parsearCumpleanos('14/03')).toEqual({ dia: 14, mes: 3 });
      expect(parsearCumpleanos('invalido')).toBeNull();
    });
  });

  describe('registro (FT-CLI-01)', () => {
    it('crea cliente con datos válidos, cumpleaños y consentimiento', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);
      prismaMock.party.create.mockResolvedValue({ id: 100n });
      prismaMock.partyRole.create.mockResolvedValue({ id: 1n });

      // Mock para llamada a yo(...)
      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Ana Pérez', correo: 'ana@ejemplo.com', cumple_dia: 14, cumple_mes: 3 },
        documentos: [{ tipo: 'DNI', numero: '45217890' }],
        roles: [],
      });

      const res = await service.registro({
        dni: '45217890',
        nombre: 'Ana Pérez',
        contrasena: 'ClaveSegura2026',
        correo: 'ana@ejemplo.com',
        cumpleanos: '1995-03-14',
        aceptaDatos: true,
      });

      expect(res.token).toBe('jwt_token_cliente_mock');
      expect(res.cliente.nombre).toBe('Ana Pérez');
      expect(res.cliente.dniMascara).toBe('4521****');
      expect(prismaMock.party.create).toHaveBeenCalled();
      expect(prismaMock.consent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canal: 'CARTA',
            version_texto: '1.0',
          }),
        }),
      );
    });

    it('rechaza si no se acepta el tratamiento de datos', async () => {
      await expect(
        service.registro({
          dni: '45217890',
          nombre: 'Ana Pérez',
          contrasena: 'ClaveSegura2026',
          cumpleanos: '1995-03-14',
          aceptaDatos: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el DNI ya tiene cuenta con contraseña creada', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({
        party: {
          cuentaCliente: { hash: '$argon2id$mockhash' },
        },
      });

      await expect(
        service.registro({
          dni: '45217890',
          nombre: 'Ana Pérez',
          contrasena: 'ClaveSegura2026',
          cumpleanos: '1995-03-14',
          aceptaDatos: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ingresar (FT-CLI-01)', () => {
    it('ingresa con credenciales correctas y retorna token', async () => {
      const hash = await argon2.hash('ClaveValida123');
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({
        party: {
          id: 100n,
          cuentaCliente: { hash, activo: true },
          persona: { nombres: 'Ana Pérez' },
        },
      });

      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Ana Pérez', correo: 'ana@ejemplo.com', cumple_dia: 14, cumple_mes: 3 },
        documentos: [{ tipo: 'DNI', numero: '45217890' }],
        roles: [],
      });

      const res = await service.ingresar({
        dni: '45217890',
        contrasena: 'ClaveValida123',
      });

      expect(res.token).toBe('jwt_token_cliente_mock');
      expect(res.cliente.nombre).toBe('Ana Pérez');
    });

    it('un DNI registrado en mostrador sin clave crea la contraseña la primera vez (RQ-CLI-01-07)', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({
        party: {
          id: 100n,
          cuentaCliente: { hash: null, activo: true }, // sin clave
          persona: { nombres: 'Carlos Mostrador' },
        },
      });

      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Carlos Mostrador', correo: null, cumple_dia: 1, cumple_mes: 1 },
        documentos: [{ tipo: 'DNI', numero: '45217890' }],
        roles: [],
      });

      const res = await service.ingresar({
        dni: '45217890',
        contrasena: 'PrimeraClave2026',
      });

      expect(res.token).toBe('jwt_token_cliente_mock');
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            hash: expect.any(String),
          }),
        }),
      );
    });

    it('rechaza con contraseña errónea e incrementa contador en Redis', async () => {
      const hash = await argon2.hash('ClaveCorrecta');
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({
        party: {
          id: 100n,
          cuentaCliente: { hash, activo: true },
        },
      });

      await expect(
        service.ingresar({
          dni: '45217890',
          contrasena: 'ClaveEquivocada',
        }),
      ).rejects.toThrow(BadRequestException);

      const redis = redisMock.obtenerCliente();
      expect(redis.incr).toHaveBeenCalled();
    });
  });

  describe('registro en mostrador (RQ-CLI-01-06)', () => {
    it('crea cliente en mostrador con hash=null para que cree contraseña después', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);
      prismaMock.party.create.mockResolvedValue({ id: 105n });
      prismaMock.partyRole.create.mockResolvedValue({ id: 2n });

      const res = await service.crearEnMostrador({
        dni: '45217890',
        nombre: 'Pedro Local',
        cumpleanos: '1990-10-15',
        aceptaDatos: true,
      });

      expect(res.nombre).toBe('Pedro Local');
      expect(prismaMock.customerAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hash: null,
          }),
        }),
      );
    });
  });
});
