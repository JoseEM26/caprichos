jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
    verifyAsync = jest.fn();
  },
  JwtModule: {
    register: jest.fn().mockReturnValue({ module: class {} }),
  },
}));

import { PuntosService } from './puntos.service';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CuentaClienteController } from './cuenta-cliente.controller';
import { ClientesService } from './clientes.service';
import { RecuperarClaveService } from './recuperar-clave.service';
import { CodigoRegistroService } from './codigo-registro.service';
import { FacturacionClienteService } from './facturacion-cliente.service';
import { DireccionesClienteService } from './direcciones-cliente.service';

describe('CuentaClienteController', () => {
  let controller: CuentaClienteController;
  const codigoRegistroMock = {
    solicitar: jest.fn().mockResolvedValue({ ok: true, mensaje: 'Te enviamos un código por WhatsApp.' }),
    consumir: jest.fn().mockResolvedValue(undefined),
    verificar: jest.fn().mockResolvedValue({ ok: true }),
  };
  const facturacionMock = { obtener: jest.fn() };
  const recuperarMock = { solicitar: jest.fn().mockResolvedValue({ ok: true }), confirmar: jest.fn().mockResolvedValue({ ok: true }) };
  let clientesServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    clientesServiceMock = {
      registro: jest.fn(),
      ingresar: jest.fn(),
      clienteDesdeRequest: jest.fn(),
      equipoDeCuenta: jest.fn().mockResolvedValue(null),
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
        { provide: PuntosService, useValue: { movimientosCuenta: jest.fn().mockResolvedValue({ porcentaje: 5, movimientos: [], pagina: 1, hayMas: false }) } },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: DireccionesClienteService, useValue: { listar: jest.fn(), desactivar: jest.fn() } },
        { provide: RecuperarClaveService, useValue: recuperarMock },
        { provide: FacturacionClienteService, useValue: facturacionMock },
        { provide: CodigoRegistroService, useValue: codigoRegistroMock },
      ],
    }).compile();

    controller = module.get<CuentaClienteController>(CuentaClienteController);
  });

  it('registro pone cookie cp_cliente y devuelve cliente', async () => {
    clientesServiceMock.registro.mockResolvedValue({
      cliente: { partyId: '100', nombre: 'Ana', correo: null, cumpleanos: '14/03', puntos: 0 },
      token: 'mock_jwt_token',
    });

    const res: any = { cookie: jest.fn() };
    const req: any = { ip: '127.0.0.1' };

    const r = await controller.registro(
      { nombre: 'Ana', contrasena: '12345678', telefono: '912345678', aceptaDatos: true },
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

  it('yo agrega equipo solo si la cuenta es de un trabajador', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
    expect(await controller.yo({ cookies: {} } as any)).toEqual({ cliente: { partyId: '100', nombre: 'Ana' } });
    clientesServiceMock.equipoDeCuenta.mockResolvedValue({ esEquipo: true, puedeCredito: true });
    expect(await controller.yo({ cookies: {} } as any)).toEqual({
      cliente: { partyId: '100', nombre: 'Ana' },
      equipo: { esEquipo: true, puedeCredito: true },
    });
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

  describe('direcciones guardadas de la cuenta', () => {
    const direccionesDe = () => (controller as any).direcciones;

    it('GET direcciones: lista las de la sesión; sin sesión, lista vacía', async () => {
      clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
      direccionesDe().listar.mockResolvedValue([{ id: '1', direccion: 'Av. X 123' }]);

      const r = await controller.listarDirecciones({} as any);

      expect(direccionesDe().listar).toHaveBeenCalledWith('100');
      expect(r).toEqual({ direcciones: [{ id: '1', direccion: 'Av. X 123' }] });

      clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);
      expect(await controller.listarDirecciones({} as any)).toEqual({ direcciones: [] });
    });

    it('DELETE direcciones/:id desactiva solo de la sesión; sin sesión responde 401', async () => {
      clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
      direccionesDe().desactivar.mockResolvedValue({ ok: true });

      expect(await controller.desactivarDireccion('7', {} as any)).toEqual({ ok: true });
      expect(direccionesDe().desactivar).toHaveBeenCalledWith('100', '7');

      clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);
      await expect(controller.desactivarDireccion('7', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('puntos/movimientos', () => {
    it('devuelve el historial paginado de la sesión; sin sesión responde 401', async () => {
      const puntos = (controller as any).puntos;
      clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });

      const r = await controller.movimientosPuntos({} as any, '2');
      expect(puntos.movimientosCuenta).toHaveBeenCalledWith(100n, 2);
      expect(r.porcentaje).toBe(5);

      await controller.movimientosPuntos({} as any, 'x');
      expect(puntos.movimientosCuenta).toHaveBeenLastCalledWith(100n, 1);

      clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);
      await expect(controller.movimientosPuntos({} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it('ingresar pone la cookie cp_cliente con el celular y la contraseña', async () => {
    clientesServiceMock.ingresar = jest.fn().mockResolvedValue({ cliente: { partyId: '100', nombre: 'Ana' }, token: 'tok' });
    const res: any = { cookie: jest.fn() };
    const r = await controller.ingresar({ telefono: '912345678', contrasena: '12345678' }, { ip: '1.1.1.1' } as any, res);
    expect(clientesServiceMock.ingresar).toHaveBeenCalledWith({ telefono: '912345678', contrasena: '12345678' }, '1.1.1.1');
    expect(res.cookie).toHaveBeenCalledWith('cp_cliente', 'tok', expect.objectContaining({ httpOnly: true }));
    expect(r.cliente.nombre).toBe('Ana');
  });

  it('recuperar/solicitar y recuperar/confirmar delegan al servicio de recuperación', async () => {
    await controller.solicitarRecuperacion('912345678', { ip: '1.1.1.1' } as any);
    expect(recuperarMock.solicitar).toHaveBeenCalledWith('912345678', '1.1.1.1');
    const dto = { telefono: '912345678', codigo: '123456', contrasenaNueva: 'NuevaClave2026' };
    await controller.confirmarRecuperacion(dto, { ip: '1.1.1.1' } as any);
    expect(recuperarMock.confirmar).toHaveBeenCalledWith(dto, '1.1.1.1');
  });
  it('registro/codigo envía el código y responde sin revelar si el celular existe', async () => {
    const r = await controller.solicitarCodigoRegistro('912345678', { ip: '1.1.1.1' } as any);
    expect(codigoRegistroMock.solicitar).toHaveBeenCalledWith('912345678', '1.1.1.1');
    expect(r).toMatchObject({ ok: true });
  });
  it('registro/verificar pasa el código al servicio de registro', async () => {
    const r = await controller.verificarCodigoRegistro({ telefono: '912345678', codigo: '123456' });
    expect(codigoRegistroMock.verificar).toHaveBeenCalledWith('912345678', '123456');
    expect(r).toEqual({ ok: true });
  });
  it('facturacion: sin sesión no devuelve el RUC (nadie lo obtiene tecleando un celular)', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue(null);
    expect(await controller.datosFacturacion({} as any)).toEqual({ facturacion: null });
    expect(facturacionMock.obtener).not.toHaveBeenCalled();
  });
  it('facturacion: con sesión devuelve el RUC de SU cuenta', async () => {
    clientesServiceMock.clienteDesdeRequest.mockResolvedValue({ partyId: '100', nombre: 'Ana' });
    facturacionMock.obtener.mockResolvedValue({ ruc: '20000000015', razonSocial: 'X SAC', direccion: null });
    const r = await controller.datosFacturacion({} as any);
    expect(facturacionMock.obtener).toHaveBeenCalledWith('100');
    expect(r.facturacion?.ruc).toBe('20000000015');
  });
});
