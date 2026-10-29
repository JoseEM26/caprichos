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
import { Reflector } from '@nestjs/core';
import { ClientesAdminController } from './clientes-admin.controller';
import { ClientesService } from './clientes.service';
import { PuntosService } from './puntos.service';
import { DireccionesClienteService } from './direcciones-cliente.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';

describe('ClientesAdminController', () => {
  let controller: ClientesAdminController;
  let clientesServiceMock: any;
  let puntosServiceMock: any;

  beforeEach(async () => {
    clientesServiceMock = {
      listarAdmin: jest.fn().mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 }),
      obtenerFichaAdmin: jest.fn().mockResolvedValue({ id: '100', nombre: 'Ana' }),
      crearEnMostrador: jest.fn().mockResolvedValue({ id: '100', nombre: 'Ana' }),
      editarCliente: jest.fn().mockResolvedValue({ ok: true }),
      cambiarEstado: jest.fn().mockResolvedValue({ ok: true, activo: false }),
    };

    puntosServiceMock = {
      ajustarManual: jest.fn().mockResolvedValue({ puntos: 10, nuevoSaldo: 20 }),
      listarMovimientos: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientesAdminController],
      providers: [
        { provide: ClientesService, useValue: clientesServiceMock },
        { provide: PuntosService, useValue: puntosServiceMock },
        { provide: DireccionesClienteService, useValue: { buscarPorDni: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: Reflector, useValue: {} },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClientesAdminController>(ClientesAdminController);
  });

  it('listar delega a clientesService.listarAdmin', async () => {
    const req: any = { usuario: { rol: 'ADMIN' }, ip: '127.0.0.1' };
    await controller.listar('ana', 'Persona', 'Activos', undefined, '1', '6', req);

    expect(clientesServiceMock.listarAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ana', tipo: 'Persona', estado: 'Activos' }),
      req.usuario,
      '127.0.0.1',
    );
  });

  it('ajustarPuntos delega a puntosService.ajustarManual', async () => {
    const req: any = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '127.0.0.1' };
    await controller.ajustarPuntos('100', { puntos: 10, motivo: 'Premio por fidelidad' }, req);

    expect(puntosServiceMock.ajustarManual).toHaveBeenCalledWith(
      '100',
      { puntos: 10, motivo: 'Premio por fidelidad' },
      1n,
      '127.0.0.1',
    );
  });

  describe('GET por-dni/:dni', () => {
    const direccionesDe = () => (controller as any).direcciones;

    it('DNI que no tiene 8 dígitos exactos: 400 DNI_INVALIDO y no busca', async () => {
      await expect(controller.buscarPorDni('4521789', { usuario: { partyId: 55n } } as any)).rejects.toMatchObject({
        response: { codigo: 'DNI_INVALIDO' },
      });
      await expect(controller.buscarPorDni('4521789a', { usuario: { partyId: 55n } } as any)).rejects.toMatchObject({
        response: { codigo: 'DNI_INVALIDO' },
      });
      expect(direccionesDe().buscarPorDni).not.toHaveBeenCalled();
    });

    it('encontrado: devuelve el DNI enmascarado y los datos del contrato', async () => {
      direccionesDe().buscarPorDni.mockResolvedValue({
        encontrado: true,
        party: '100',
        nombre: 'Ana',
        telefono: '987654321',
        puntos: 12,
        direcciones: [],
      });

      const r: any = await controller.buscarPorDni('45217890', { usuario: { partyId: 55n } } as any);

      expect(direccionesDe().buscarPorDni).toHaveBeenCalledWith('45217890', 55n);
      expect(r).toEqual({
        encontrado: true,
        party: '100',
        nombre: 'Ana',
        telefono: '987654321',
        puntos: 12,
        direcciones: [],
        dniMascara: '4521****',
      });
      expect(r).not.toHaveProperty('correo');
      expect(r).not.toHaveProperty('cumpleanos');
    });

    it('no encontrado: { encontrado: false } sin datos', async () => {
      direccionesDe().buscarPorDni.mockResolvedValue({ encontrado: false });

      const r = await controller.buscarPorDni('45217890', { usuario: { partyId: 55n } } as any);

      expect(r).toEqual({ encontrado: false });
    });
  });
});
