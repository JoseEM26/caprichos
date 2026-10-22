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

import { Test, TestingModule } from '@nestjs/testing';
import { PlanoController } from './plano.controller';
import { PlanoService } from './plano.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('PlanoController', () => {
  let controller: PlanoController;
  let service: any;

  beforeEach(async () => {
    service = {
      obtenerPlano: jest.fn(),
      obtenerMesasActivas: jest.fn(),
      crearPiso: jest.fn(),
      actualizarPiso: jest.fn(),
      crearElemento: jest.fn(),
      girarElemento: jest.fn(),
      actualizarElemento: jest.fn(),
      eliminarElemento: jest.fn(),
      obtenerDiseno: jest.fn(),
      aplicarDiseno: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanoController],
      providers: [
        { provide: PlanoService, useValue: service },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secret' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlanoController>(PlanoController);
  });

  it('GET /admin/plano llama a obtenerPlano', async () => {
    service.obtenerPlano.mockResolvedValue([]);
    const res = await controller.obtenerPlano();
    expect(res).toEqual([]);
    expect(service.obtenerPlano).toHaveBeenCalled();
  });

  it('GET /admin/plano/mesas llama a obtenerMesasActivas', async () => {
    service.obtenerMesasActivas.mockResolvedValue([]);
    const res = await controller.obtenerMesasActivas();
    expect(res).toEqual([]);
    expect(service.obtenerMesasActivas).toHaveBeenCalled();
  });

  it('POST /admin/plano/pisos llama a crearPiso con req.usuario e ip', async () => {
    service.crearPiso.mockResolvedValue({ id: '1' });
    const req = { usuario: { partyId: 1n }, ip: '127.0.0.1' };
    const dto = { nombre: 'Piso 3' };
    const res = await controller.crearPiso(dto, req);
    expect(res).toEqual({ id: '1' });
    expect(service.crearPiso).toHaveBeenCalledWith(dto, req.usuario, '127.0.0.1');
  });

  it('PATCH /admin/plano/pisos/:id llama a actualizarPiso', async () => {
    service.actualizarPiso.mockResolvedValue({ id: '1', nombre: 'Piso 1 Modificado' });
    const req = { usuario: { partyId: 1n }, ip: '127.0.0.1' };
    const dto = { nombre: 'Piso 1 Modificado' };
    const res = await controller.actualizarPiso('1', dto, req);
    expect(res.nombre).toBe('Piso 1 Modificado');
    expect(service.actualizarPiso).toHaveBeenCalledWith('1', dto, req.usuario, '127.0.0.1');
  });

  it('POST /admin/plano/elementos llama a crearElemento', async () => {
    service.crearElemento.mockResolvedValue({ id: '10' });
    const req = { usuario: { partyId: 1n } };
    const dto = { pisoId: '1', tipo: 'MESA', x: 0, y: 0, ancho: 2, alto: 2, asientos: 4 };
    const res = await controller.crearElemento(dto, req);
    expect(res).toEqual({ id: '10' });
    expect(service.crearElemento).toHaveBeenCalledWith(dto, req.usuario, undefined);
  });

  it('POST /admin/plano/elementos/:id/girar llama a girarElemento', async () => {
    service.girarElemento.mockResolvedValue({ id: '10', ancho: 2, alto: 1 });
    const req = { usuario: { partyId: 1n } };
    const res = await controller.girarElemento('10', req);
    expect(res.ancho).toBe(2);
    expect(service.girarElemento).toHaveBeenCalledWith('10', req.usuario, undefined);
  });

  it('PATCH /admin/plano/elementos/:id llama a actualizarElemento', async () => {
    service.actualizarElemento.mockResolvedValue({ id: '10', x: 5 });
    const req = { usuario: { partyId: 1n } };
    const dto = { x: 5 };
    const res = await controller.actualizarElemento('10', dto, req);
    expect(res.x).toBe(5);
    expect(service.actualizarElemento).toHaveBeenCalledWith('10', dto, req.usuario, undefined);
  });

  it('DELETE /admin/plano/elementos/:id llama a eliminarElemento', async () => {
    service.eliminarElemento.mockResolvedValue({ ok: true, eliminado: true, id: '10' });
    const req = { usuario: { partyId: 1n } };
    const res = await controller.eliminarElemento('10', req);
    expect(res.eliminado).toBe(true);
    expect(service.eliminarElemento).toHaveBeenCalledWith('10', req.usuario, undefined);
  });

  it('GET /admin/plano/diseno llama a obtenerDiseno', async () => {
    service.obtenerDiseno.mockResolvedValue({ floors: [] });
    const res = await controller.obtenerDiseno();
    expect(res).toEqual({ floors: [] });
    expect(service.obtenerDiseno).toHaveBeenCalled();
  });

  it('PUT /admin/plano/diseno llama a aplicarDiseno', async () => {
    service.aplicarDiseno.mockResolvedValue({ ok: true });
    const req = { usuario: { partyId: 1n } };
    const body = { floors: [] };
    const res = await controller.aplicarDiseno(body, req);
    expect(res.ok).toBe(true);
    expect(service.aplicarDiseno).toHaveBeenCalledWith(body, req.usuario, undefined);
  });
});
