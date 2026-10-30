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
import { IniciativasController } from './iniciativas.controller';
import { IniciativasService } from './iniciativas.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { TipoIniciativa, AreaIniciativa } from './dto/crear-iniciativa.dto';
import { EstadoIniciativa } from './dto/cambiar-estado.dto';

describe('IniciativasController', () => {
  let controller: IniciativasController;
  let service: {
    obtenerConteoNuevas: jest.Mock;
    listar: jest.Mock;
    crear: jest.Mock;
    comentar: jest.Mock;
    cambiarEstado: jest.Mock;
  };

  const usuario = {
    partyId: BigInt(1),
    rol: 'ADMIN',
    debeCambiar: false,
  } as any;

  beforeEach(async () => {
    service = {
      obtenerConteoNuevas: jest.fn(),
      listar: jest.fn(),
      crear: jest.fn(),
      comentar: jest.fn(),
      cambiarEstado: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IniciativasController],
      providers: [{ provide: IniciativasService, useValue: service }],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IniciativasController>(IniciativasController);
  });

  it('obtenerResumen llama a obtenerConteoNuevas', async () => {
    service.obtenerConteoNuevas.mockResolvedValue({ nuevas: 2 });
    const res = await controller.obtenerResumen();
    expect(res).toEqual({ nuevas: 2 });
    expect(service.obtenerConteoNuevas).toHaveBeenCalled();
  });

  it('listar llama al servicio con filtros', async () => {
    service.listar.mockResolvedValue({ conteos: {}, elementos: [] });
    const req = { usuario };
    await controller.listar({ tipo: 'QUEJA' }, req);
    expect(service.listar).toHaveBeenCalledWith({ tipo: 'QUEJA' }, usuario);
  });

  it('crear pasa DTO e IP al servicio', async () => {
    service.crear.mockResolvedValue({ id: '1', codigo: 'IN-0001' });
    const req = { ip: '127.0.0.1', headers: {}, usuario };
    await controller.crear(
      {
        tipo: TipoIniciativa.IDEA,
        area: AreaIniciativa.COCINA,
        titulo: 'Título',
        detalle: 'Detalle',
      },
      req,
    );
    expect(service.crear).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Título' }),
      usuario,
      '127.0.0.1',
    );
  });

  it('comentar pasa el id, dto e IP al servicio', async () => {
    service.comentar.mockResolvedValue({ id: '1' });
    const req = { ip: '127.0.0.1', headers: {}, usuario };
    await controller.comentar('5', { texto: 'Comentario' }, req);
    expect(service.comentar).toHaveBeenCalledWith('5', { texto: 'Comentario' }, usuario, '127.0.0.1');
  });

  it('cambiarEstado pasa el id, estado e IP al servicio', async () => {
    service.cambiarEstado.mockResolvedValue({ id: '5', estado: 'HECHA' });
    const req = { ip: '127.0.0.1', headers: {}, usuario };
    await controller.cambiarEstado('5', { estado: EstadoIniciativa.HECHA }, req);
    expect(service.cambiarEstado).toHaveBeenCalledWith('5', { estado: EstadoIniciativa.HECHA }, usuario, '127.0.0.1');
  });
});
