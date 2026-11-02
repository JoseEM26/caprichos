jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';

// Contraseña de prueba del administrador (no es una credencial real).
const CLAVE_ADMIN_PRUEBA = 'Admin-prueba-1';
const CLAVE_NUEVA_PRUEBA = 'NuevaPrueba-9';

/** Texto de todo lo que se audita (los bigint no se serializan con JSON.stringify directo). */
const aTexto = (x: unknown) => JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

describe('Administración de cuenta por el ADMIN (DNI, correo, foto, clave)', () => {
  let service: UsuariosService;
  let prismaMock: any;
  let auditoriaMock: any;
  let archivosMock: any;
  let hashAdmin: string;

  const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
  const editor: UsuarioAutenticado = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };

  const cuentaAdmin = () => ({
    id: 1n,
    party_id: 1n,
    rol: 'ADMIN',
    hash: hashAdmin,
    activo: true,
    debe_cambiar: false,
    party: {
      persona: { nombres: 'Ana', apellidos: 'Admin', correo: null },
      documentos: [{ id: 50n, party_id: 1n, tipo: 'DNI', numero: '11111111' }],
    },
  });

  const cuentaDestino = () => ({
    id: 5n,
    party_id: 10n,
    rol: 'CAJERO',
    hash: 'hash-viejo',
    activo: true,
    debe_cambiar: false,
    party: {
      persona: { nombres: 'Carlos', apellidos: 'Perez', correo: 'carlos@ejemplo.com' },
      documentos: [{ id: 77n, party_id: 10n, tipo: 'DNI', numero: '12345678' }],
    },
  });

  beforeAll(async () => {
    hashAdmin = await argon2.hash(CLAVE_ADMIN_PRUEBA, { type: argon2.argon2id });
  });

  beforeEach(async () => {
    prismaMock = {
      userAccount: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.party_id !== undefined) return where.party_id === 1n ? cuentaAdmin() : null;
          if (where.id === 1n) return cuentaAdmin();
          if (where.id === 5n) return cuentaDestino();
          return null;
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(2),
      },
      partyIdentifier: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      person: {
        update: jest.fn().mockResolvedValue({}),
      },
      sesion: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    };

    auditoriaMock = { registrar: jest.fn().mockResolvedValue(undefined) };
    archivosMock = {
      subirArchivo: jest.fn().mockResolvedValue({ id: '9', url: '/archivos/publico/2026/10/foto.webp' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: ArchivosService, useValue: archivosMock },
        { provide: AvisosInternosService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('PATCH editar: DNI', () => {
    it('el ADMIN cambia el DNI de otro con su clave: actualiza party_identifier y audita el DNI enmascarado', async () => {
      const res = await service.editar(
        '5',
        { dni: '87654321', claveAdmin: CLAVE_ADMIN_PRUEBA },
        admin,
        '127.0.0.1',
      );

      expect(prismaMock.partyIdentifier.update).toHaveBeenCalledWith({
        where: { id: 77n },
        data: { tipo: 'DNI', numero: '87654321' },
      });
      expect(prismaMock.sesion.updateMany).not.toHaveBeenCalled();
      expect(res.reingresar).toBe(false);
      expect(res.dni).toBe('87****21');

      const auditoria = aTexto(auditoriaMock.registrar.mock.calls);
      expect(auditoria).toContain('12****78');
      expect(auditoria).toContain('87****21');
      expect(auditoria).not.toContain('12345678');
      expect(auditoria).not.toContain('87654321');
      expect(auditoria).not.toContain(CLAVE_ADMIN_PRUEBA);
    });

    it('DNI ya usado por otra persona: 409 DNI_DUPLICADO y no escribe nada', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({ id: 99n, party_id: 20n, tipo: 'DNI', numero: '87654321' });

      await expect(
        service.editar('5', { dni: '87654321', claveAdmin: CLAVE_ADMIN_PRUEBA }, admin),
      ).rejects.toMatchObject({ response: { codigo: 'DNI_DUPLICADO' } });
      await expect(
        service.editar('5', { dni: '87654321', claveAdmin: CLAVE_ADMIN_PRUEBA }, admin),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.partyIdentifier.update).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('un usuario con usuarios.editar que no es ADMIN recibe 403 al mandar dni', async () => {
      await expect(service.editar('5', { dni: '87654321', claveAdmin: CLAVE_ADMIN_PRUEBA }, editor)).rejects.toMatchObject(
        { response: { codigo: 'SOLO_ADMIN' } },
      );
      await expect(service.editar('5', { dni: '87654321', claveAdmin: CLAVE_ADMIN_PRUEBA }, editor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.partyIdentifier.update).not.toHaveBeenCalled();
    });

    it('con clave de administrador incorrecta responde 403 CLAVE_ADMIN_INCORRECTA sin cambiar nada', async () => {
      await expect(
        service.editar('5', { dni: '87654321', claveAdmin: 'otra-clave-1' }, admin),
      ).rejects.toMatchObject({ response: { codigo: 'CLAVE_ADMIN_INCORRECTA' } });
      expect(prismaMock.partyIdentifier.update).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('cambiar el DNI de la propia cuenta revoca sus sesiones y responde reingresar=true', async () => {
      const res = await service.editar('1', { dni: '22222222', claveAdmin: CLAVE_ADMIN_PRUEBA }, admin);

      expect(prismaMock.sesion.updateMany).toHaveBeenCalledWith({
        where: { party_id: 1n, revocada_en: null },
        data: { revocada_en: expect.any(Date) },
      });
      expect(res.reingresar).toBe(true);
    });

    it('sin cambio de DNI no pide clave de administrador', async () => {
      const res = await service.editar('5', { nombres: 'Carlos Luis' }, admin);
      expect(res.nombres).toBe('Carlos Luis');
      expect(prismaMock.partyIdentifier.update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH editar: correo', () => {
    it('quien no es administrador no puede cambiar el correo de otra persona', async () => {
      await expect(
        service.editar('5', { correo: 'otro@ejemplo.com' }, { ...editor, rol: 'CAJERO' } as any),
      ).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    });

    it('guarda el correo en minúsculas y vacío lo quita', async () => {
      await service.editar('5', { correo: '  Nuevo@Ejemplo.COM ' }, admin);
      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { party_id: 10n },
        data: { correo: 'nuevo@ejemplo.com' },
      });

      prismaMock.person.update.mockClear();
      await service.editar('5', { correo: '' }, admin);
      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { party_id: 10n },
        data: { correo: null },
      });
    });

    it('la auditoría no guarda el correo, solo que cambió', async () => {
      await service.editar('5', { correo: 'otro@ejemplo.com' }, admin);
      expect(aTexto(auditoriaMock.registrar.mock.calls)).not.toContain('otro@ejemplo.com');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ despues: expect.objectContaining({ correoCambiado: true }) }),
      );
    });
  });

  describe('POST :id/clave', () => {
    it('con la clave del ADMIN correcta: guarda hash argon2id nuevo, marca debe_cambiar y revoca sesiones', async () => {
      const res = await service.cambiarClaveAdmin(
        '5',
        { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: CLAVE_ADMIN_PRUEBA },
        admin,
        '127.0.0.1',
      );

      const llamada = prismaMock.userAccount.update.mock.calls[0][0];
      expect(llamada.data.debe_cambiar).toBe(true);
      expect(llamada.data.hash).toMatch(/^\$argon2id\$/);
      expect(await argon2.verify(llamada.data.hash, CLAVE_NUEVA_PRUEBA)).toBe(true);

      expect(prismaMock.sesion.updateMany).toHaveBeenCalledWith({
        where: { party_id: 10n, revocada_en: null },
        data: { revocada_en: expect.any(Date) },
      });
      expect(res.reingresar).toBe(false);
    });

    it('con clave de administrador incorrecta: 403 CLAVE_ADMIN_INCORRECTA y no toca la cuenta', async () => {
      await expect(
        service.cambiarClaveAdmin('5', { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: 'mal-clave-1' }, admin),
      ).rejects.toMatchObject({ response: { codigo: 'CLAVE_ADMIN_INCORRECTA' } });
      expect(prismaMock.userAccount.update).not.toHaveBeenCalled();
      expect(prismaMock.sesion.updateMany).not.toHaveBeenCalled();
    });

    it('la respuesta de error no revela si el usuario destino existe', async () => {
      const errorExistente = await service
        .cambiarClaveAdmin('5', { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: 'mal-clave-1' }, admin)
        .catch((e) => e);
      const errorInexistente = await service
        .cambiarClaveAdmin('999', { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: 'mal-clave-1' }, admin)
        .catch((e) => e);
      expect(errorInexistente.response).toEqual(errorExistente.response);
    });

    it('un no ADMIN no puede usar el endpoint: 403 SOLO_ADMIN', async () => {
      await expect(
        service.cambiarClaveAdmin('5', { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: CLAVE_ADMIN_PRUEBA }, editor),
      ).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      expect(prismaMock.userAccount.update).not.toHaveBeenCalled();
    });

    it('clave nueva sin letra y número (o menor de 8) responde 400 CLAVE_INVALIDA', async () => {
      await expect(
        service.cambiarClaveAdmin('5', { claveNueva: 'solotexto', claveAdmin: CLAVE_ADMIN_PRUEBA }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.cambiarClaveAdmin('5', { claveNueva: 'abc123', claveAdmin: CLAVE_ADMIN_PRUEBA }, admin),
      ).rejects.toMatchObject({ response: { codigo: 'CLAVE_INVALIDA' } });
    });

    it('la auditoría nunca contiene la clave nueva ni la del administrador', async () => {
      await service.cambiarClaveAdmin('5', { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: CLAVE_ADMIN_PRUEBA }, admin);
      const auditoria = aTexto(auditoriaMock.registrar.mock.calls);
      expect(auditoria).not.toContain(CLAVE_NUEVA_PRUEBA);
      expect(auditoria).not.toContain(CLAVE_ADMIN_PRUEBA);
      expect(auditoria).not.toContain('hash');
    });

    it('cambiar la clave de la propia cuenta responde reingresar=true', async () => {
      const res = await service.cambiarClaveAdmin(
        '1',
        { claveNueva: CLAVE_NUEVA_PRUEBA, claveAdmin: CLAVE_ADMIN_PRUEBA },
        admin,
      );
      expect(res.reingresar).toBe(true);
    });
  });

  describe('foto de otro usuario', () => {
    const archivo = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'f.jpg' } as any;

    it('el ADMIN sube la foto: usa ArchivosService y guarda foto_archivo_id en la persona', async () => {
      const res = await service.cambiarFotoUsuario('5', archivo, admin, '127.0.0.1');

      expect(archivosMock.subirArchivo).toHaveBeenCalledWith(archivo, false, admin, '127.0.0.1');
      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { party_id: 10n },
        data: { foto_archivo_id: 9n },
      });
      expect(res.fotoUrl).toBe('/archivos/publico/2026/10/foto.webp');
    });

    it('foto mayor de 2 MB: 413 FOTO_GRANDE', async () => {
      const grande = { buffer: Buffer.alloc(2 * 1024 * 1024 + 1) } as any;
      await expect(service.cambiarFotoUsuario('5', grande, admin)).rejects.toMatchObject({
        response: { codigo: 'FOTO_GRANDE' },
      });
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
    });

    it('un no ADMIN no puede cambiar ni quitar la foto de otro', async () => {
      await expect(service.cambiarFotoUsuario('5', archivo, editor)).rejects.toMatchObject({
        response: { codigo: 'SOLO_ADMIN' },
      });
      await expect(service.quitarFotoUsuario('5', editor)).rejects.toMatchObject({
        response: { codigo: 'SOLO_ADMIN' },
      });
    });

    it('el ADMIN quita la foto: deja foto_archivo_id en null', async () => {
      const res = await service.quitarFotoUsuario('5', admin);
      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { party_id: 10n },
        data: { foto_archivo_id: null },
      });
      expect(res.fotoUrl).toBeNull();
    });
  });
});
