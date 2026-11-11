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

import { MensajesController } from './mensajes.controller';

describe('MensajesController', () => {
  let controller: MensajesController;
  let service: any;

  beforeEach(() => {
    service = {
      listar: jest.fn().mockResolvedValue({ chats: [], conteos: {} }),
      respuestasRapidas: jest.fn().mockResolvedValue([]),
      detalle: jest.fn().mockResolvedValue({ id: '1', nombre: 'Test' }),
      enviar: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      pulir: jest.fn().mockResolvedValue({ texto: 'Texto pulido' }),
      tomar: jest.fn().mockResolvedValue({ ok: true }),
      soltar: jest.fn().mockResolvedValue({ ok: true }),
      pausar: jest.fn().mockResolvedValue({ ok: true }),
      reanudar: jest.fn().mockResolvedValue({ ok: true }),
      marcarAtendido: jest.fn().mockResolvedValue({ ok: true }),
      aprobarPago: jest.fn().mockResolvedValue({ ok: true }),
      rechazarPago: jest.fn().mockResolvedValue({ ok: true }),
      editarNombre: jest.fn().mockResolvedValue({ ok: true }),
      reabrirConPlantilla: jest.fn().mockResolvedValue({ ok: true, id: 'msg-plantilla-1' }),
      reintentarMensaje: jest.fn().mockResolvedValue({ ok: true, id: '10' }),
    };

    controller = new MensajesController(service);
  });

  it('enviar delega en service.enviar extrayendo ip del request', async () => {
    const req = { usuario: { partyId: 1n }, ip: '127.0.0.1' };
    const res = await controller.enviar('1', { texto: 'Hola' }, req, { setHeader: jest.fn() } as any);
    expect(res).toEqual({ id: 'msg-1' });
    expect(service.enviar).toHaveBeenCalledWith('1', 'Hola', req.usuario, '127.0.0.1', undefined);
  });

  it('reabrirPlantilla delega en service.reabrirConPlantilla', async () => {
    const req = { usuario: { partyId: 1n }, ip: '127.0.0.1' };
    const res = await controller.reabrirPlantilla('1', undefined, req);
    expect(res).toEqual({ ok: true, id: 'msg-plantilla-1' });
    expect(service.reabrirConPlantilla).toHaveBeenCalledWith('1', req.usuario, '127.0.0.1', false);
    await controller.reabrirPlantilla('1', { forzar: true }, req);
    expect(service.reabrirConPlantilla).toHaveBeenLastCalledWith('1', req.usuario, '127.0.0.1', true);
  });

  it('reintentar delega en service.reintentarMensaje', async () => {
    const req = { usuario: { partyId: 1n }, ip: '127.0.0.1' };
    const res = await controller.reintentar('1', '10', req);
    expect(res).toEqual({ ok: true, id: '10' });
    expect(service.reintentarMensaje).toHaveBeenCalledWith('1', '10', req.usuario, '127.0.0.1');
  });
});
