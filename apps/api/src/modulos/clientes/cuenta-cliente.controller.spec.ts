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
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CuentaClienteController } from './cuenta-cliente.controller';
import { ClientesService } from './clientes.service';

describe('CuentaClienteController', () => {
  let controller: CuentaClienteController;
  let clientesServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    clientesServiceMock = {
      registro: jest.fn(),
      ingresar: jest.fn(),
      clienteDesdeRequest: jest.fn(),
      notificaciones: jest.fn(),
      guardarCumpleanos: jest.fn(),
      actualizarPerfil: jest.fn(),
      subirFoto: jest.fn(),
      quitarFoto: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue('development'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CuentaClienteController],
      providers: [
        { provide: ClientesService, useValue: clientesServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    controller = module.get<CuentaClienteController>(CuentaClienteController);
  });

  it('registro pone cookie cp_cliente y devuelve cliente', async () => {
    clientesServiceMock.registro.mockResolvedValue({
      cliente: { partyId: '100', nombre: 'Ana', dniMascara: '4521****', correo: null, cumpleanos: '14/03', puntos: 0 },
      token: 'mock_jwt_token',
    });

    const res: any = { cookie: jest.fn() };
    const req: any = { ip: '127.0.0.1' };

    const r = await controller.registro(
      { dni: '45217890', nombre: 'Ana', contrasena: '12345678', telefono: '912345678', cumpleanos: '14/03', aceptaDatos: true },
      req,
      res,
    );

    expect(r.cliente.nombre).toBe('Ana');
    expect(res.cookie).toHaveBeenCalledWith(
      'cp_cliente',
      'mock_jwt_token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('yo devuelve cliente: null si no hay sesión (NUNCA 401)', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);

    const req: any = { cookies: {} };
    const r = await controller.yo(req);

    expect(r).toEqual({ cliente: null });
  });

  it('PUT perfil actualiza la sesión del cliente y devuelve el cliente', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
    clientesServiceMock.actualizarPerfil.mockResolvedValue({ partyId: '100', nombre: 'Ana Pérez', telefono: '912345678' });

    const req: any = { ip: '127.0.0.1' };
    const r = await controller.actualizarPerfil({ nombre: 'Ana Pérez', telefono: '912345678' }, req);

    expect(clientesServiceMock.actualizarPerfil).toHaveBeenCalledWith('100', { nombre: 'Ana Pérez', telefono: '912345678' }, '127.0.0.1');
    expect(r.cliente?.telefono).toBe('912345678');
  });

  it('PUT perfil sin sesión responde 401', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);

    await expect(controller.actualizarPerfil({ telefono: '912345678' }, { cookies: {} } as any)).rejects.toThrow(UnauthorizedException);
    expect(clientesServiceMock.actualizarPerfil).not.toHaveBeenCalled();
  });

  it('POST foto sube la foto de la sesión del cliente y devuelve el cliente', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
    clientesServiceMock.subirFoto.mockResolvedValue({ partyId: '100', nombre: 'Ana', fotoUrl: '/archivos/publico/x.webp' });
    const archivo = { buffer: Buffer.from('x') } as any;

    const r = await controller.subirFoto(archivo, { ip: '127.0.0.1' } as any);

    expect(clientesServiceMock.subirFoto).toHaveBeenCalledWith('100', archivo, '127.0.0.1');
    expect(r.cliente?.fotoUrl).toBe('/archivos/publico/x.webp');
  });

  it('POST foto sin sesión responde 401 sin subir nada', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);

    await expect(controller.subirFoto({} as any, { cookies: {} } as any)).rejects.toThrow(UnauthorizedException);
    expect(clientesServiceMock.subirFoto).not.toHaveBeenCalled();
  });

  it('DELETE foto quita la foto de la sesión y sin sesión responde 401', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
    clientesServiceMock.quitarFoto.mockResolvedValue({ partyId: '100', nombre: 'Ana', fotoUrl: null });

    const r = await controller.quitarFoto({ ip: '127.0.0.1' } as any);
    expect(clientesServiceMock.quitarFoto).toHaveBeenCalledWith('100', '127.0.0.1');
    expect(r.cliente?.fotoUrl).toBeNull();

    clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);
    await expect(controller.quitarFoto({ cookies: {} } as any)).rejects.toThrow(UnauthorizedException);
  });

  it('salir limpia la cookie cp_cliente', async () => {
    const res: any = { clearCookie: jest.fn() };
    const r = await controller.salir(res);

    expect(r).toEqual({ ok: true });
    expect(res.clearCookie).toHaveBeenCalledWith('cp_cliente', expect.objectContaining({ path: '/' }));
  });
});
