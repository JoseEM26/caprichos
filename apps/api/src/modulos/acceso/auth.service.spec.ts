jest.mock('@nestjs/jwt', () => {
  return {
    JwtService: jest.fn().mockImplementation(() => ({
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    })),
    JwtModule: {
      registerAsync: jest.fn().mockReturnValue({
        module: class MockJwtModule {},
      }),
    },
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService, enmascararDni, hashSha256 } from './auth.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let redisClient: any;
  let jwtService: any;
  let configService: any;
  let auditoriaService: any;

  beforeEach(async () => {
    redisClient = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    };

    const redisServiceMock = {
      obtenerCliente: jest.fn().mockReturnValue(redisClient),
    };

    prisma = {
      partyIdentifier: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      sesion: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      userAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cumpleanosSaludo: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      person: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      rolPermiso: {
        findMany: jest.fn(),
      },
      userAccountRol: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userAccountPermiso: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    configService = {
      get: jest.fn((key: string, defaultVal: any) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_EXPIRA_MIN') return 15;
        if (key === 'REFRESH_DIAS') return 7;
        return defaultVal;
      }),
    };

    auditoriaService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: AuditoriaService, useValue: auditoriaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('enmascararDni', () => {
    it('debe enmascarar DNI de 8 dígitos mostrando solo 2 primeros y 2 últimos', () => {
      expect(enmascararDni('12345678')).toBe('12****78');
      expect(enmascararDni('87654321')).toBe('87****21');
    });

    it('debe manejar DNIs cortos devolviendo ****', () => {
      expect(enmascararDni('123')).toBe('****');
      expect(enmascararDni('')).toBe('****');
    });
  });

  describe('ingresar - Caso 1: contraseña mala', () => {
    it('debe lanzar 401 CREDENCIALES_INVALIDAS, incrementar Redis y registrar auditoría con DNI enmascarado', async () => {
      const contrasenaCorrecta = 'Correcta123!';
      const hashCorrecto = await argon2.hash(contrasenaCorrecta);

      redisClient.get.mockResolvedValue('0');
      redisClient.incr.mockResolvedValue(1);

      prisma.partyIdentifier.findFirst.mockResolvedValue({
        id: BigInt(1),
        tipo: 'DNI',
        numero: '12345678',
        party: {
          id: BigInt(10),
          usuario: {
            party_id: BigInt(10),
            rol: 'ADMIN',
            hash: hashCorrecto,
            activo: true,
            debe_cambiar: false,
          },
          persona: {
            nombres: 'Juan Perez',
          },
        },
      });

      await expect(
        service.ingresar(
          { dni: '12345678', contrasena: 'ContrasenaIncorrecta1' },
          '192.168.1.1',
          'Mozilla/5.0',
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNAUTHORIZED,
          response: {
            codigo: 'CREDENCIALES_INVALIDAS',
            mensaje: 'Credenciales inválidas',
          },
        }),
      );

      expect(redisClient.incr).toHaveBeenCalledWith('auth:intentos:12345678');
      expect(redisClient.expire).toHaveBeenCalledWith('auth:intentos:12345678', 900);
      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'ACCESO',
          modulo: 'acceso',
          accion: 'INGRESO_FALLIDO',
          resultado: 'RECHAZADO',
          motivo: 'CREDENCIALES_INVALIDAS',
          antes: { dni: '12****78' },
        }),
      );
    });

    it('debe lanzar 401 CREDENCIALES_INVALIDAS sin revelar si el DNI no existe', async () => {
      redisClient.get.mockResolvedValue('0');
      redisClient.incr.mockResolvedValue(1);
      prisma.partyIdentifier.findFirst.mockResolvedValue(null);

      await expect(
        service.ingresar(
          { dni: '99999999', contrasena: 'Cualquiera123' },
          '192.168.1.1',
          'Agent',
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNAUTHORIZED,
          response: {
            codigo: 'CREDENCIALES_INVALIDAS',
            mensaje: 'Credenciales inválidas',
          },
        }),
      );

      expect(redisClient.incr).toHaveBeenCalledWith('auth:intentos:99999999');
      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'INGRESO_FALLIDO',
          motivo: 'CREDENCIALES_INVALIDAS',
          antes: { dni: '99****99' },
        }),
      );
    });
  });

  describe('ingresar - Caso 2: bloqueo al 5º intento', () => {
    it('debe lanzar 429 CUENTA_BLOQUEADA cuando hay 5 o más fallos en Redis', async () => {
      redisClient.get.mockResolvedValue('5');

      await expect(
        service.ingresar(
          { dni: '12345678', contrasena: 'Cualquiera123' },
          '192.168.1.1',
          'Agent',
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
          response: expect.objectContaining({
            codigo: 'CUENTA_BLOQUEADA',
          }),
        }),
      );

      // No debe consultar base de datos si ya está bloqueado
      expect(prisma.partyIdentifier.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('ingresar - Caso 3: usuario desactivado', () => {
    it('debe lanzar 403 USUARIO_DESACTIVADO si activo=false a pesar de contraseña correcta', async () => {
      const contrasena = 'MiPassword123!';
      const hash = await argon2.hash(contrasena);

      redisClient.get.mockResolvedValue('0');
      prisma.partyIdentifier.findFirst.mockResolvedValue({
        id: BigInt(1),
        tipo: 'DNI',
        numero: '12345678',
        party: {
          id: BigInt(10),
          usuario: {
            party_id: BigInt(10),
            rol: 'CAJERO',
            hash,
            activo: false,
            debe_cambiar: false,
          },
          persona: { nombres: 'Cajero Inactivo' },
        },
      });

      await expect(
        service.ingresar(
          { dni: '12345678', contrasena },
          '127.0.0.1',
          'TestClient',
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.FORBIDDEN,
          response: {
            codigo: 'USUARIO_DESACTIVADO',
            mensaje: 'El usuario se encuentra desactivado',
          },
        }),
      );

      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'INGRESO_FALLIDO',
          resultado: 'RECHAZADO',
          motivo: 'USUARIO_DESACTIVADO',
        }),
      );
    });
  });

  describe('ingresar - Ingreso exitoso y limpieza de Redis', () => {
    it('debe limpiar contador en Redis al acertar, registrar auditoría INGRESO OK y retornar tokens', async () => {
      const contrasena = 'Correcta123!';
      const hash = await argon2.hash(contrasena);

      redisClient.get.mockResolvedValue('2');
      prisma.partyIdentifier.findFirst.mockResolvedValue({
        id: BigInt(1),
        tipo: 'DNI',
        numero: '12345678',
        party: {
          id: BigInt(10),
          usuario: {
            party_id: BigInt(10),
            rol: 'ADMIN',
            hash,
            activo: true,
            debe_cambiar: true,
          },
          persona: { nombres: 'Ana Torres' },
        },
      });

      prisma.sesion.create.mockResolvedValue({ id: BigInt(99) });

      const resultado = await service.ingresar(
        { dni: '12345678', contrasena },
        '10.0.0.1',
        'Chrome',
      );

      expect(redisClient.del).toHaveBeenCalledWith('auth:intentos:12345678');
      expect(prisma.sesion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            audiencia: 'ADMIN',
            party_id: BigInt(10),
          }),
        }),
      );

      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'ACCESO',
          accion: 'INGRESO',
          resultado: 'OK',
          partyId: BigInt(10),
        }),
      );

      expect(resultado.respuesta).toEqual({
        accessToken: 'mock-jwt-token',
        debeCambiar: true,
        usuario: {
          partyId: '10',
          nombres: 'Ana Torres',
          rol: 'ADMIN',
          roles: ['ADMIN'],
        },
      });
      expect(resultado.rawRefreshToken).toBeDefined();
    });
  });

  describe('ingresar con CE de 7 caracteres y roles extra', () => {
    it('busca el documento en los tipos del personal, acepta el CE y pone los roles en el token', async () => {
      const hash = await argon2.hash('ContrasenaCorrecta1');
      redisClient.get.mockResolvedValue('0');
      redisClient.incr.mockResolvedValue(1);
      prisma.partyIdentifier.findFirst.mockResolvedValue({
        id: BigInt(1),
        tipo: 'CE',
        numero: 'AB12345',
        party: {
          id: BigInt(10),
          usuario: { id: BigInt(5), party_id: BigInt(10), rol: 'CAJERO', hash, activo: true, debe_cambiar: false },
          persona: { nombres: 'Ana' },
        },
      });
      prisma.userAccountRol = { findMany: jest.fn().mockResolvedValue([{ rol: 'MOZO' }]) };
      prisma.sesion.create.mockResolvedValue({});

      const r = await service.ingresar({ dni: 'AB12345', contrasena: 'ContrasenaCorrecta1' }, '1.1.1.1', 'UA');

      expect(prisma.partyIdentifier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { numero: 'AB12345', tipo: { in: ['DNI', 'CE', 'CEDULA', 'PASAPORTE'] } } }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ roles: ['CAJERO', 'MOZO'], rol: 'CAJERO' }),
        expect.anything(),
      );
      expect(r.respuesta.usuario.roles).toEqual(['CAJERO', 'MOZO']);
    });
  });

  describe('renovar - Caso 5: refresh rotado', () => {
    it('debe revocar la sesión anterior y emitir una nueva sesión rotando el refresh', async () => {
      const rawRefresh = 'antiguo-refresh-token-123456';
      const hash = hashSha256(rawRefresh);

      const expiraFuturo = new Date(Date.now() + 1000 * 60 * 60);

      prisma.sesion.findUnique.mockResolvedValue({
        id: BigInt(5),
        audiencia: 'ADMIN',
        party_id: BigInt(10),
        refresh_hash: hash,
        expira_en: expiraFuturo,
        revocada_en: null,
        party: {
          usuario: {
            party_id: BigInt(10),
            rol: 'ADMIN',
            activo: true,
            debe_cambiar: false,
          },
          persona: { nombres: 'Ana Torres' },
        },
      });

      prisma.sesion.update.mockResolvedValue({ id: BigInt(5) });
      prisma.sesion.create.mockResolvedValue({ id: BigInt(6) });

      const resultado = await service.renovar(rawRefresh, '127.0.0.1', 'Browser');

      // Debe revocar sesión anterior
      expect(prisma.sesion.update).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
        data: { revocada_en: expect.any(Date) },
      });

      // Debe crear nueva sesión
      expect(prisma.sesion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            audiencia: 'ADMIN',
            party_id: BigInt(10),
          }),
        }),
      );

      expect(resultado.respuesta.accessToken).toBe('mock-jwt-token');
      expect(resultado.rawRefreshToken).not.toBe(rawRefresh);
    });

    it('debe lanzar 401 si el refresh ya fue revocado o está vencido', async () => {
      const rawRefresh = 'revocado-token-123';
      const hash = hashSha256(rawRefresh);

      prisma.sesion.findUnique.mockResolvedValue({
        id: BigInt(5),
        audiencia: 'ADMIN',
        party_id: BigInt(10),
        refresh_hash: hash,
        expira_en: new Date(Date.now() + 10000),
        revocada_en: new Date(), // ya revocado
        party: {
          usuario: {
            party_id: BigInt(10),
            rol: 'ADMIN',
            activo: true,
            debe_cambiar: false,
          },
        },
      });

      await expect(service.renovar(rawRefresh)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNAUTHORIZED,
          response: {
            codigo: 'TOKEN_INVALIDO',
            mensaje: 'Token de renovación revocado o vencido',
          },
        }),
      );
    });
  });

  describe('cambiarContrasena - Caso 4: debe_cambiar y cambio de clave', () => {
    it('no deja poner el número de documento como contraseña nueva', async () => {
      const hash = await argon2.hash('RealClave123');
      prisma.userAccount.findUnique.mockResolvedValue({ party_id: BigInt(10), hash, debe_cambiar: true });
      prisma.partyIdentifier.findMany.mockResolvedValue([{ numero: 'AB123456' }]);

      await expect(
        service.cambiarContrasena(BigInt(10), { contrasenaActual: 'RealClave123', contrasenaNueva: 'ab123456' }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({ codigo: 'CONTRASENA_ES_DOCUMENTO' }),
        }),
      );
    });

    it('debe rechazar contraseñas que no cumplan requisitos de seguridad', async () => {
      // Menos de 8 caracteres
      await expect(
        service.cambiarContrasena(BigInt(10), {
          contrasenaActual: 'Vieja123!',
          contrasenaNueva: 'Corta1',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({ codigo: 'CONTRASENA_INVALIDA' }),
        }),
      );

      // Sin números
      await expect(
        service.cambiarContrasena(BigInt(10), {
          contrasenaActual: 'Vieja123!',
          contrasenaNueva: 'Sololetraslargas',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({ codigo: 'CONTRASENA_INVALIDA' }),
        }),
      );

      // Igual a la actual
      await expect(
        service.cambiarContrasena(BigInt(10), {
          contrasenaActual: 'MismaClave123',
          contrasenaNueva: 'MismaClave123',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({ codigo: 'CONTRASENA_INVALIDA' }),
        }),
      );
    });

    it('debe rechazar si la contraseña actual no es correcta', async () => {
      const hash = await argon2.hash('RealClave123');
      prisma.userAccount.findUnique.mockResolvedValue({
        party_id: BigInt(10),
        hash,
        debe_cambiar: true,
      });

      await expect(
        service.cambiarContrasena(BigInt(10), {
          contrasenaActual: 'ClaveErronea123',
          contrasenaNueva: 'NuevaClaveValida99',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: {
            codigo: 'CONTRASENA_ACTUAL_INCORRECTA',
            mensaje: 'La contraseña actual no es correcta',
          },
        }),
      );
    });

    it('debe actualizar debe_cambiar=false, revocar otras sesiones y registrar auditoría CAMBIO_CLAVE', async () => {
      const actualClave = 'RealClave123';
      const hash = await argon2.hash(actualClave);
      prisma.userAccount.findUnique.mockResolvedValue({
        party_id: BigInt(10),
        hash,
        debe_cambiar: true,
      });
      prisma.userAccount.update.mockResolvedValue({
        party_id: BigInt(10),
        debe_cambiar: false,
      });
      prisma.sesion.updateMany.mockResolvedValue({ count: 2 });

      const res = await service.cambiarContrasena(
        BigInt(10),
        {
          contrasenaActual: actualClave,
          contrasenaNueva: 'NuevaSegura456',
        },
        'token-actual-de-cookie',
        '10.0.0.5',
        'Firefox',
      );

      expect(res.ok).toBe(true);

      // Verifica que pone debe_cambiar=false
      expect(prisma.userAccount.update).toHaveBeenCalledWith({
        where: { party_id: BigInt(10) },
        data: expect.objectContaining({
          debe_cambiar: false,
          hash: expect.any(String),
        }),
      });

      // Verifica que revoca las otras sesiones excluyendo la actual
      expect(prisma.sesion.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          party_id: BigInt(10),
          revocada_en: null,
          NOT: {
            refresh_hash: hashSha256('token-actual-de-cookie'),
          },
        }),
        data: {
          revocada_en: expect.any(Date),
        },
      });

      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'ACCESO',
          modulo: 'acceso',
          accion: 'CAMBIO_CLAVE',
          resultado: 'OK',
          partyId: BigInt(10),
        }),
      );
    });
  });

  describe('yo', () => {
    it('devuelve el usuario con su rol y sus permisos ordenados', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({
        party_id: 7n,
        rol: 'COCINA',
        debe_cambiar: false,
        party: { persona: { nombres: 'Luis' } },
      });
      prisma.rolPermiso.findMany.mockResolvedValue([
        { permiso: { modulo: 'cocina', accion: 'ver' } },
        { permiso: { modulo: 'cocina', accion: 'despejar' } },
      ]);

      const r = await service.yo(7n);

      expect(r).toEqual({
        partyId: '7',
        nombres: 'Luis',
        fotoUrl: null,
        rol: 'COCINA',
        roles: ['COCINA'],
        debeCambiar: false,
        permisos: ['cocina/despejar', 'cocina/ver'],
        cumpleHoy: false,
      });
      expect(prisma.rolPermiso.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { rol: { in: ['COCINA'] } } }),
      );
    });

    it('cumpleHoy: solo un booleano; la fecha de nacimiento no sale', async () => {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()).split('-').map(Number);
      prisma.userAccount.findUnique.mockResolvedValue({
        party_id: 7n, rol: 'MOZO', debe_cambiar: false,
        party: { persona: { nombres: 'Luis', cumple_dia: hoy[2], cumple_mes: hoy[1] } },
      });
      prisma.rolPermiso.findMany.mockResolvedValue([]);
      const r = await service.yo(7n);
      expect(r.cumpleHoy).toBe(true);
      expect(JSON.stringify(r)).not.toMatch(/cumple_|nacimiento/);
    });

    it('cumpleHoy pasa a false si el saludo ya se mostró hoy (en cualquier dispositivo)', async () => {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()).split('-').map(Number);
      prisma.userAccount.findUnique.mockResolvedValue({
        party_id: 7n, rol: 'MOZO', debe_cambiar: false,
        party: { persona: { nombres: 'Luis', cumple_dia: hoy[2], cumple_mes: hoy[1] } },
      });
      prisma.rolPermiso.findMany.mockResolvedValue([]);
      prisma.cumpleanosSaludo.findUnique.mockResolvedValue({ usuario_party_id: 7n });
      expect((await service.yo(7n)).cumpleHoy).toBe(false);
    });

    it('los permisos extra vigentes se suman a los del rol al refrescar la sesión', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: 3n, party_id: 7n, rol: 'COCINA', debe_cambiar: false, party: { persona: { nombres: 'Luis' } } });
      prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'cocina', accion: 'ver' } }]);
      prisma.userAccountPermiso.findMany.mockResolvedValue([{ modulo: 'creditos', accion: 'ver' }]);
      const r = await service.yo(7n);
      expect(r.permisos).toEqual(['cocina/ver', 'creditos/ver']);
      // revocado: la próxima lectura ya no lo trae
      prisma.userAccountPermiso.findMany.mockResolvedValue([]);
      expect((await service.yo(7n)).permisos).toEqual(['cocina/ver']);
    });

    it('cuenta que ya no existe -> 401 USUARIO_NO_ENCONTRADO', async () => {
      prisma.userAccount.findUnique.mockResolvedValue(null);
      await expect(service.yo(9n)).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('cumpleanosVisto', () => {
    it('registra el saludo del día de Lima y es idempotente (skipDuplicates = ON CONFLICT DO NOTHING)', async () => {
      prisma.person.findUnique.mockResolvedValue({ cumple_dia: 12, cumple_mes: 11 });
      const ahora = new Date('2026-11-13T02:00:00Z'); // en Lima sigue siendo el 12
      await service.cumpleanosVisto(7n, ahora);
      await service.cumpleanosVisto(7n, ahora);
      expect(prisma.cumpleanosSaludo.createMany).toHaveBeenCalledTimes(2);
      expect(prisma.cumpleanosSaludo.createMany).toHaveBeenCalledWith({
        data: [{ usuario_party_id: 7n, fecha: new Date('2026-11-12T00:00:00Z') }],
        skipDuplicates: true,
      });
    });

    it('29 de febrero: en año no bisiesto se registra el 28', async () => {
      prisma.person.findUnique.mockResolvedValue({ cumple_dia: 29, cumple_mes: 2 });
      await service.cumpleanosVisto(7n, new Date('2027-02-28T15:00:00Z'));
      expect(prisma.cumpleanosSaludo.createMany).toHaveBeenCalledTimes(1);
    });

    it('si hoy no es su cumpleaños no guarda nada', async () => {
      prisma.person.findUnique.mockResolvedValue({ cumple_dia: 13, cumple_mes: 11 });
      await expect(service.cumpleanosVisto(7n, new Date('2026-11-12T15:00:00Z'))).resolves.toEqual({ ok: true });
      expect(prisma.cumpleanosSaludo.createMany).not.toHaveBeenCalled();
    });
  });

  describe('salir', () => {
    it('debe revocar la sesión activa y registrar auditoría SALIDA', async () => {
      const rawRefresh = 'refresh-salir-123';
      const hash = hashSha256(rawRefresh);

      prisma.sesion.findUnique.mockResolvedValue({
        id: BigInt(7),
        party_id: BigInt(20),
        refresh_hash: hash,
        revocada_en: null,
      });
      prisma.sesion.update.mockResolvedValue({ id: BigInt(7) });

      const res = await service.salir(rawRefresh, BigInt(20), '127.0.0.1', 'Device');

      expect(res.ok).toBe(true);
      expect(prisma.sesion.update).toHaveBeenCalledWith({
        where: { id: BigInt(7) },
        data: { revocada_en: expect.any(Date) },
      });
      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'ACCESO',
          modulo: 'acceso',
          accion: 'SALIDA',
          resultado: 'OK',
          partyId: BigInt(20),
        }),
      );
    });
  });
  describe('salirTodas', () => {
    it('revoca todas las sesiones, marca el cierre en la cuenta y audita SALIDA_TODAS', async () => {
      prisma.userAccount.update.mockResolvedValue({});
      prisma.sesion.updateMany.mockResolvedValue({ count: 3 });

      const res = await service.salirTodas(BigInt(20), '127.0.0.1', 'Device');

      expect(res).toEqual({ ok: true, cerradas: 3 });
      expect(prisma.userAccount.update).toHaveBeenCalledWith({
        where: { party_id: BigInt(20) },
        data: { sesiones_cerradas_en: expect.any(Date) },
      });
      expect(prisma.sesion.updateMany).toHaveBeenCalledWith({
        where: { party_id: BigInt(20), revocada_en: null },
        data: { revocada_en: expect.any(Date) },
      });
      expect(auditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'SALIDA_TODAS', resultado: 'OK', partyId: BigInt(20) }),
      );
    });
  });
});
