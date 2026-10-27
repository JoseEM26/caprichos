jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  })),
  JwtModule: {
    registerAsync: jest.fn().mockReturnValue({
      module: class MockJwtModule {},
    }),
  },
}));

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CartaIngresoController, PantallaIngresoAdminController } from '../pantalla-ingreso.controller';
import { PantallaIngresoService } from '../pantalla-ingreso.service';
import { ActualizarPantallaIngresoDto } from '../dto/actualizar-pantalla-ingreso.dto';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { CLAVE_PERMISO } from '../../acceso/permiso.decorator';

describe('PantallaIngreso controllers', () => {
  let publico: CartaIngresoController;
  let admin: PantallaIngresoAdminController;
  let servicioMock: { obtenerPublica: jest.Mock; obtenerAdmin: jest.Mock; actualizar: jest.Mock };

  beforeEach(async () => {
    servicioMock = {
      obtenerPublica: jest.fn().mockResolvedValue({ imagenes: [], frase: 'x' }),
      obtenerAdmin: jest.fn().mockResolvedValue({ imagenes: [], frase: 'x', fabrica: [] }),
      actualizar: jest.fn().mockResolvedValue({ imagenes: [], frase: 'x', fabrica: [] }),
    };
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [CartaIngresoController, PantallaIngresoAdminController],
      providers: [{ provide: PantallaIngresoService, useValue: servicioMock }],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();
    publico = modulo.get(CartaIngresoController);
    admin = modulo.get(PantallaIngresoAdminController);
  });

  it('GET /carta/ingreso es público (sin AccesoGuard) y delega en el servicio', async () => {
    expect(Reflect.getMetadata('__guards__', CartaIngresoController)).toBeUndefined();
    await publico.obtener();
    expect(servicioMock.obtenerPublica).toHaveBeenCalled();
  });

  it('el controlador admin exige configuracion/editar en GET y PUT', () => {
    const permisoGet = Reflect.getMetadata(CLAVE_PERMISO, PantallaIngresoAdminController.prototype.obtener);
    const permisoPut = Reflect.getMetadata(CLAVE_PERMISO, PantallaIngresoAdminController.prototype.actualizar);
    expect(permisoGet).toEqual({ modulo: 'configuracion', accion: 'editar' });
    expect(permisoPut).toEqual({ modulo: 'configuracion', accion: 'editar' });
  });

  it('PUT pasa el dto, el usuario y la IP al servicio', async () => {
    const dto = { imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }], frase: 'Hola' } as any;
    const req = { usuario: { partyId: 1n }, ip: '127.0.0.1' };
    await admin.actualizar(dto, req);
    expect(servicioMock.actualizar).toHaveBeenCalledWith(dto, req.usuario, '127.0.0.1');
  });

  describe('validación del cuerpo (ValidationPipe whitelist)', () => {
    const cargar = async (cuerpo: unknown) => {
      const instancia = plainToInstance(ActualizarPantallaIngresoDto, cuerpo);
      return validate(instancia, { whitelist: true, forbidNonWhitelisted: true });
    };

    it('acepta un cuerpo válido', async () => {
      const errores = await cargar({
        imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
        frase: 'Hola',
      });
      expect(errores).toHaveLength(0);
    });

    it('rechaza más de 5 imágenes, lista vacía y tipos fuera de lista', async () => {
      const seis = Array.from({ length: 6 }, () => ({ tipo: 'defecto', valor: 'fantasma-cafe.webp' }));
      expect((await cargar({ imagenes: seis, frase: 'x' })).length).toBeGreaterThan(0);
      expect((await cargar({ imagenes: [], frase: 'x' })).length).toBeGreaterThan(0);
      expect(
        (await cargar({ imagenes: [{ tipo: 'externo', valor: 'a' }], frase: 'x' })).length,
      ).toBeGreaterThan(0);
    });

    it('rechaza frases de más de 80 caracteres y campos no permitidos', async () => {
      expect(
        (await cargar({ imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }], frase: 'a'.repeat(81) })).length,
      ).toBeGreaterThan(0);
      expect(
        (await cargar({
          imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
          frase: 'x',
          rol: 'ADMIN',
        })).length,
      ).toBeGreaterThan(0);
    });
  });
});
