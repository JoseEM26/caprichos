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

import { ComprobantesController } from './comprobantes.controller';

describe('ComprobantesController', () => {
  let controller: ComprobantesController;
  let serviceMock: any;

  const mockUsuario = {
    partyId: 1n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  beforeEach(() => {
    serviceMock = {
      listarPorEmitir: jest.fn().mockResolvedValue({ total: 0, elementos: [] }),
      obtenerPorPedido: jest.fn().mockResolvedValue({ titulo: 'Nota de venta' }),
      reimprimirPorPedido: jest.fn().mockResolvedValue({ titulo: 'Nota de venta - COPIA 1' }),
      marcarEmitido: jest.fn().mockResolvedValue({ id: '1', emision: 'EMITIDO' }),
    };

    controller = new ComprobantesController(serviceMock, { resumenDiario: jest.fn() } as any, { salud: jest.fn() } as any, {} as any, {} as any);
  });

  it('GET /admin/comprobantes/por-emitir delega a service.listarPorEmitir', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };
    const query = { pagina: 1, limite: 10 };

    await controller.listarPorEmitir(query, req);

    expect(serviceMock.listarPorEmitir).toHaveBeenCalledWith(query, mockUsuario, '127.0.0.1');
  });

  it('GET /admin/comprobantes/pedido/:pedidoId delega a service.obtenerPorPedido', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };

    await controller.obtenerPorPedido('100', req);

    expect(serviceMock.obtenerPorPedido).toHaveBeenCalledWith('100', mockUsuario, '127.0.0.1');
  });

  it('POST /admin/comprobantes/pedido/:pedidoId/reimprimir delega a service.reimprimirPorPedido', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };

    await controller.reimprimir('100', req);

    expect(serviceMock.reimprimirPorPedido).toHaveBeenCalledWith('100', mockUsuario, '127.0.0.1');
  });

  it('POST /admin/comprobantes/:id/emitido delega a service.marcarEmitido', async () => {
    const req = { usuario: mockUsuario, ip: '127.0.0.1' };
    const dto = { referenciaExterna: 'B001-000123' };

    await controller.marcarEmitido('1', dto, req);

    expect(serviceMock.marcarEmitido).toHaveBeenCalledWith('1', dto, mockUsuario, '127.0.0.1');
  });
});
