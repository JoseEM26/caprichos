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
import { CreditosController } from './creditos.controller';
import { CreditosService } from './creditos.service';
import { AccesoGuard } from '../acceso/acceso.guard';

describe('CreditosController', () => {
  let controller: CreditosController;
  let service: {
    obtenerResumen: jest.Mock;
    listarPersonalActivo: jest.Mock;
    exportar: jest.Mock;
    registrarConsumo: jest.Mock;
  };

  const usuario = {
    partyId: BigInt(1),
    rol: 'ADMIN',
    debeCambiar: false,
  } as any;

  beforeEach(async () => {
    service = {
      obtenerResumen: jest.fn(),
      listarPersonalActivo: jest.fn(),
      exportar: jest.fn(),
      registrarConsumo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditosController],
      providers: [{ provide: CreditosService, useValue: service }],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CreditosController>(CreditosController);
  });

  it('obtenerResumen delega al servicio', async () => {
    service.obtenerResumen.mockResolvedValue({ totales: {} });
    const res = await controller.obtenerResumen({ periodo: 'mes' });
    expect(res).toEqual({ totales: {} });
    expect(service.obtenerResumen).toHaveBeenCalledWith({ periodo: 'mes' });
  });

  it('listarPersonalActivo delega al servicio', async () => {
    service.listarPersonalActivo.mockResolvedValue([]);
    const res = await controller.listarPersonalActivo();
    expect(res).toEqual([]);
    expect(service.listarPersonalActivo).toHaveBeenCalled();
  });

  it('exportar establece cabeceras y envía CSV', async () => {
    service.exportar.mockResolvedValue({
      nombreArchivo: 'test.csv',
      contenidoCsv: 'a,b,c',
    });
    const res: any = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    const req = { ip: '127.0.0.1', headers: {}, usuario };

    await controller.exportar({}, req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="test.csv"');
    expect(res.send).toHaveBeenCalledWith('a,b,c');
  });

  it('registrarConsumo delega al servicio', async () => {
    service.registrarConsumo.mockResolvedValue({ id: '1', monto: 20 });
    const req = { ip: '127.0.0.1', headers: {}, usuario };

    const res = await controller.registrarConsumo(
      { pedidoId: '10', partyId: '5' },
      req,
    );

    expect(res).toEqual({ id: '1', monto: 20 });
    expect(service.registrarConsumo).toHaveBeenCalledWith('10', '5', usuario, '127.0.0.1');
  });
});
