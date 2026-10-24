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
import { ArchivosService } from '../archivos/archivos.service';
import { PayloadTooLargeException } from '@nestjs/common';

const tipoEsperado = (buf: Buffer): string => {
  if (buf[0] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89) return 'image/png';
  return 'image/webp';
};

describe('ClientesService', () => {
  let service: ClientesService;
  let prismaMock: any;
  let redisMock: any;
  let jwtMock: any;
  let auditoriaMock: any;
  let puntosMock: any;
  let archivosMock: any;

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
      archivo: {
        findUnique: jest.fn(),
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

    archivosMock = {
      subirArchivo: jest.fn().mockResolvedValue({ id: '55', url: '/archivos/publico/2026/10/foto.webp' }),
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
        { provide: ArchivosService, useValue: archivosMock },
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
        telefono: '912345678',
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
          telefono: '912345678',
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
          telefono: '912345678',
          cumpleanos: '1995-03-14',
          aceptaDatos: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('foto de perfil', () => {
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP')]);
    const archivoFile = (buffer: Buffer, mimetype: string) => ({ buffer, size: buffer.length, mimetype, originalname: 'foto.png' }) as any;

    beforeEach(() => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue({ id: 100n, persona: { nombres: 'Ana', foto_archivo_id: 55n }, documentos: [], contactos: [], roles: [] });
      prismaMock.archivo.findUnique.mockResolvedValue({ id: 55n, ruta: 'publico/2026/10/foto.webp' });
    });

    it('acepta JPEG, PNG y WebP, verificados por bytes, y enlaza la foto a la persona de la sesión', async () => {
      for (const buf of [JPEG, PNG, WEBP]) {
        archivosMock.subirArchivo.mockClear();
        await service.subirFoto(100n, archivoFile(buf, 'image/png'), '127.0.0.1');
        expect(archivosMock.subirArchivo).toHaveBeenCalledWith(expect.objectContaining({ mimetype: tipoEsperado(buf) }), false, expect.objectContaining({ partyId: 100n }), '127.0.0.1');
      }
      expect(prismaMock.person.update).toHaveBeenCalledWith({ where: { party_id: 100n }, data: { foto_archivo_id: 55n } });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_FOTO_SUBIDA', partyId: 100n }));
    });

    it('rechaza un archivo que dice ser PNG o JPEG pero no tiene bytes de imagen', async () => {
      const texto = Buffer.from('<html>no soy una imagen</html>');
      await expect(service.subirFoto(100n, archivoFile(texto, 'image/png'))).rejects.toThrow(BadRequestException);
      await expect(service.subirFoto(100n, archivoFile(texto, 'image/jpeg'))).rejects.toThrow(BadRequestException);
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });

    it('rechaza una foto de más de 2 MB con 413', async () => {
      const grande = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
      await expect(service.subirFoto(100n, archivoFile(grande, 'image/png'))).rejects.toThrow(PayloadTooLargeException);
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
    });

    it('quitar foto desvincula la foto sin tocar el archivo', async () => {
      await service.quitarFoto(100n);
      expect(prismaMock.person.update).toHaveBeenCalledWith({ where: { party_id: 100n }, data: { foto_archivo_id: null } });
      expect(prismaMock.archivo).not.toHaveProperty('delete');
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
    });

    it('yo devuelve fotoUrl con la ruta pública del archivo, y null sin foto', async () => {
      const conFoto = await service.yo(100n);
      expect(conFoto?.fotoUrl).toBe('/archivos/publico/2026/10/foto.webp');

      prismaMock.party.findUnique.mockResolvedValueOnce({ id: 101n, persona: { nombres: 'Luis', foto_archivo_id: null }, documentos: [], contactos: [], roles: [] });
      const sinFoto = await service.yo(101n);
      expect(sinFoto?.fotoUrl).toBeNull();
    });
  });

  describe('teléfono y perfil de la cuenta', () => {
    const datosRegistro = {
      dni: '45217890',
      nombre: 'Ana Pérez',
      contrasena: 'ClaveSegura2026',
      cumpleanos: '1995-03-14',
      aceptaDatos: true,
    };

    it('registro guarda el celular como contacto TELEFONO principal', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);
      prismaMock.party.create.mockResolvedValue({ id: 100n });
      prismaMock.partyRole.create.mockResolvedValue({ id: 1n });
      prismaMock.party.findUnique.mockResolvedValue({ id: 100n, persona: { nombres: 'Ana Pérez' }, documentos: [], roles: [] });

      await service.registro({ ...datosRegistro, telefono: '912345678' });

      expect(prismaMock.contactMechanism.create).toHaveBeenCalledWith({
        data: { party_id: 100n, tipo: 'TELEFONO', valor: '912345678', principal: true },
      });
    });

    it('registro rechaza teléfono que no tiene 9 dígitos empezando con 9', async () => {
      for (const telefono of ['', '812345678', '91234567', '9123456789', '91234abcd']) {
        await expect(service.registro({ ...datosRegistro, telefono })).rejects.toThrow(BadRequestException);
      }
      expect(prismaMock.party.create).not.toHaveBeenCalled();
    });

    it('yo devuelve el teléfono y null si el cliente no lo tiene', async () => {
      prismaMock.party.findUnique.mockResolvedValueOnce({
        id: 100n,
        persona: { nombres: 'Ana' },
        documentos: [],
        contactos: [{ tipo: 'CORREO', valor: 'ana@ejemplo.com' }, { tipo: 'TELEFONO', valor: '912345678' }],
        roles: [],
      });
      const conTelefono = await service.yo(100n);
      expect(conTelefono?.telefono).toBe('912345678');

      prismaMock.party.findUnique.mockResolvedValueOnce({ id: 101n, persona: { nombres: 'Luis' }, documentos: [], contactos: [], roles: [] });
      const sinTelefono = await service.yo(101n);
      expect(sinTelefono?.telefono).toBeNull();
    });

    it('actualizarPerfil guarda nombre, teléfono, correo y cumpleaños', async () => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.contactMechanism.findFirst.mockResolvedValue({ id: 7n });
      prismaMock.party.findUnique.mockResolvedValue({ id: 100n, persona: { nombres: 'Ana Pérez' }, documentos: [], contactos: [], roles: [] });

      await service.actualizarPerfil(100n, {
        nombre: 'Ana Pérez Gil',
        telefono: '987654321',
        correo: 'ana.nueva@ejemplo.com',
        cumpleanos: '14/03',
      }, '127.0.0.1');

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { party_id: 100n },
        data: { nombres: 'Ana Pérez Gil', correo: 'ana.nueva@ejemplo.com', cumple_dia: 14, cumple_mes: 3 },
      });
      expect(prismaMock.contactMechanism.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { valor: '987654321' } });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_PERFIL_EDITADO', partyId: 100n }));
    });

    it('actualizarPerfil nunca cambia el DNI ni la contraseña aunque se envíen', async () => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue({ id: 100n, persona: { nombres: 'Ana Pérez' }, documentos: [], contactos: [], roles: [] });

      await service.actualizarPerfil(100n, { nombre: 'Ana Pérez', dni: '11111111', contrasena: 'OtraClave2026' } as any);

      const datos = prismaMock.person.update.mock.calls[0][0].data;
      expect(datos).not.toHaveProperty('dni');
      expect(datos).not.toHaveProperty('contrasena');
      expect(prismaMock.customerAccount.upsert).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.updateMany).not.toHaveBeenCalled();
    });

    it('actualizarPerfil rechaza nombre corto, teléfono inválido, correo inválido y cumpleaños inválido', async () => {
      await expect(service.actualizarPerfil(100n, { nombre: 'Al' })).rejects.toThrow(BadRequestException);
      await expect(service.actualizarPerfil(100n, { telefono: '123' })).rejects.toThrow(BadRequestException);
      await expect(service.actualizarPerfil(100n, { correo: 'sin-arroba' })).rejects.toThrow(BadRequestException);
      await expect(service.actualizarPerfil(100n, { cumpleanos: '32/13' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });

    it('actualizarPerfil con correo vacío quita el correo', async () => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue({ id: 100n, persona: { nombres: 'Ana Pérez' }, documentos: [], contactos: [], roles: [] });

      await service.actualizarPerfil(100n, { correo: '' });

      expect(prismaMock.person.update).toHaveBeenCalledWith({ where: { party_id: 100n }, data: { correo: null } });
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
