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

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MiPerfilController } from './mi-perfil.controller';
import { MiPerfilService } from './mi-perfil.service';
import { ActualizarMiPerfilDto } from './mi-perfil.dto';

const SESION_A = { partyId: 1n, rol: 'MOZO', debeCambiar: false };

function nuevoPrisma() {
  return {
    userAccount: {
      findUnique: jest.fn().mockResolvedValue({
        party_id: 1n,
        rol: 'MOZO',
        activo: true,
        party: {
          persona: { nombres: 'Ana', apellidos: null, correo: null, foto_archivo_id: null },
          documentos: [{ tipo: 'DNI', numero: '12345678' }],
        },
      }),
    },
    person: { update: jest.fn().mockResolvedValue({}) },
    archivo: { findUnique: jest.fn() },
  };
}

describe('Mi perfil (API)', () => {
  let prisma: ReturnType<typeof nuevoPrisma>;
  let archivos: { subirArchivo: jest.Mock };
  let auditoria: { registrar: jest.Mock };
  let servicio: MiPerfilService;
  let controller: MiPerfilController;

  beforeEach(() => {
    prisma = nuevoPrisma();
    archivos = { subirArchivo: jest.fn().mockResolvedValue({ id: '99' }) };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    servicio = new MiPerfilService(prisma as any, archivos as any, auditoria as any);
    controller = new MiPerfilController(servicio);
  });

  it('DTO: acepta solo nombres, apellidos y correo; rechaza rol, usuario y permisos', async () => {
    const valido = plainToInstance(ActualizarMiPerfilDto, { nombres: 'Ana', correo: 'ana@x.pe' });
    expect(await validate(valido, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);

    const conRol = plainToInstance(ActualizarMiPerfilDto, { nombres: 'Ana', rol: 'ADMIN' });
    const errores = await validate(conRol, { whitelist: true, forbidNonWhitelisted: true });
    expect(errores.map((e) => e.property)).toContain('rol');
  });

  it('controlador: rechaza rol/usuario/permisos en el cuerpo y no toca la base', async () => {
    const req = { usuario: SESION_A, body: { nombres: 'Ana', rol: 'ADMIN' } };
    await expect(controller.actualizar({ nombres: 'Ana' }, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('controlador: un id en la URL o el cuerpo no cambia a quien se edita (solo la sesión)', async () => {
    const req = { usuario: SESION_A, body: { partyId: '2', nombres: 'Otra' } };
    await expect(controller.actualizar({ nombres: 'Otra' }, req)).rejects.toBeInstanceOf(BadRequestException);

    // Sin campos extra: siempre el partyId de la sesión (A), nunca el de B.
    await controller.actualizar({ nombres: 'Ana Maria' }, { usuario: SESION_A, body: { nombres: 'Ana Maria' } });
    expect(prisma.person.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { party_id: 1n } }),
    );
  });

  it('guarda nombres y correo, y audita solo los nombres de los campos (sin valores)', async () => {
    await servicio.actualizarDatos(1n, { nombres: 'Ana Maria', correo: 'ana@x.pe' }, '1.2.3.4');

    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { party_id: 1n },
      data: { nombres: 'Ana Maria', correo: 'ana@x.pe' },
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        categoria: 'CAMBIO',
        modulo: 'perfil',
        accion: 'EDITAR_DATOS',
        despues: { campos: ['nombres', 'correo'] },
      }),
    );
    const auditado = JSON.stringify(auditoria.registrar.mock.calls[0][0].despues);
    expect(auditado).not.toContain('ana@x.pe');
    expect(auditado).not.toContain('Ana Maria');
  });

  it('sin cambios reales no escribe ni audita', async () => {
    await servicio.actualizarDatos(1n, { nombres: 'Ana' });
    expect(prisma.person.update).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('foto: sube con la sesión, enlaza y audita; quitar solo desvincula', async () => {
    const file = { buffer: Buffer.from([1, 2, 3]), size: 3 } as Express.Multer.File;
    await servicio.cambiarFoto(SESION_A, file, '1.2.3.4');
    expect(archivos.subirArchivo).toHaveBeenCalledWith(file, false, SESION_A, '1.2.3.4');
    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { party_id: 1n },
      data: { foto_archivo_id: 99n },
    });

    await servicio.quitarFoto(SESION_A);
    expect(prisma.person.update).toHaveBeenLastCalledWith({
      where: { party_id: 1n },
      data: { foto_archivo_id: null },
    });
    expect(auditoria.registrar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'QUITAR_FOTO' }));
  });

  it('foto no válida no se enlaza', async () => {
    archivos.subirArchivo.mockRejectedValue(new Error('no es imagen'));
    const file = { buffer: Buffer.from('texto'), size: 5 } as Express.Multer.File;
    await expect(servicio.cambiarFoto(SESION_A, file)).rejects.toMatchObject({
      response: { codigo: 'FOTO_NO_VALIDA' },
    });
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('obtener: rol y DNI enmascarado son solo lectura', async () => {
    const perfil = await servicio.obtener(1n);
    expect(perfil).toMatchObject({ rol: 'MOZO', dniEnmascarado: expect.not.stringContaining('12345678'), activo: true });
  });
});
