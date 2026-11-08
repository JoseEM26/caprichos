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
        { provide: DireccionesClienteService, useValue: { buscarPorTelefono: jest.fn() } },
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
    await controller.listar('ana', 'Persona', 'Activos', undefined, undefined, undefined, '1', '6', req);

    expect(clientesServiceMock.listarAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ana', tipo: 'Persona', estado: 'Activos' }),
      req.usuario,
      '127.0.0.1',
    );
  });

  it('listar pasa los filtros de verificación y rechaza valores inválidos', async () => {
    const req: any = { usuario: { rol: 'ADMIN' }, ip: '127.0.0.1' };
    await controller.listar(undefined, undefined, undefined, undefined, 'verificados', 'si', '1', '6', req);
    expect(clientesServiceMock.listarAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ verificacion: 'verificados', gastaPuntos: 'si' }),
      req.usuario,
      '127.0.0.1',
    );
    await expect(controller.listar(undefined, undefined, undefined, undefined, 'raro', undefined, '1', '6', req)).rejects.toThrow();
    await expect(controller.listar(undefined, undefined, undefined, undefined, undefined, 'x', '1', '6', req)).rejects.toThrow();
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

  describe('GET por-telefono/:telefono', () => {
    const direccionesDe = () => (controller as any).direcciones;

    it('celular que no tiene 9 dígitos exactos y empieza en 9: 400 TELEFONO_INVALIDO y no busca', async () => {
      for (const t of ['91234567', '812345678', '91234567a', '9123456789', '45217890']) {
        await expect(controller.buscarPorTelefono(t, { usuario: { partyId: 55n } } as any)).rejects.toMatchObject({
          response: { codigo: 'TELEFONO_INVALIDO' },
        });
      }
      expect(direccionesDe().buscarPorTelefono).not.toHaveBeenCalled();
    });

    it('encontrado: devuelve solo los datos del contrato, sin DNI ni correo', async () => {
      const datos = { encontrado: true, party: '100', nombre: 'Ana', telefono: '987654321', puntos: 12, direcciones: [] };
      direccionesDe().buscarPorTelefono.mockResolvedValue(datos);

      const r: any = await controller.buscarPorTelefono('987654321', { usuario: { partyId: 55n } } as any);

      expect(direccionesDe().buscarPorTelefono).toHaveBeenCalledWith('987654321', 55n);
      expect(r).toEqual(datos);
      for (const k of ['dniMascara', 'dni', 'correo', 'cumpleanos']) expect(r).not.toHaveProperty(k);
    });

    it('no encontrado: { encontrado: false } sin datos', async () => {
      direccionesDe().buscarPorTelefono.mockResolvedValue({ encontrado: false });
      expect(await controller.buscarPorTelefono('987654321', { usuario: { partyId: 55n } } as any)).toEqual({ encontrado: false });
    });
  });

  describe('GET por-dni/:dni (retirado)', () => {
    it('responde 410 BUSQUEDA_DNI_RETIRADA', () => {
      let error: any;
      try {
        controller.buscarPorDniRetirado();
      } catch (e) {
        error = e;
      }
      expect(error.getStatus()).toBe(410);
      expect(error.getResponse()).toMatchObject({ codigo: 'BUSQUEDA_DNI_RETIRADA' });
    });
  });
});
