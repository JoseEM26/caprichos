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

import { Test, TestingModule } from '@nestjs/testing';
import { CartaEnvioController, ZonasAdminController } from './zonas.controller';
import { ZonasService } from './zonas.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('ZonasControllers', () => {
  let envioController: CartaEnvioController;
  let adminController: ZonasAdminController;
  let service: any;

  beforeEach(async () => {
    service = {
      consultarEnvio: jest.fn(),
      listarZonasAdmin: jest.fn(),
      editarTarifa: jest.fn(),
      editarActiva: jest.fn(),
      editarPoligono: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartaEnvioController, ZonasAdminController],
      providers: [
        { provide: ZonasService, useValue: service },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secret' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    envioController = module.get<CartaEnvioController>(CartaEnvioController);
    adminController = module.get<ZonasAdminController>(ZonasAdminController);
  });

  describe('CartaEnvioController (Público)', () => {
    it('GET /carta/envio llama a service.consultarEnvio con números', async () => {
      service.consultarEnvio.mockResolvedValue({
        cubierto: true,
        zona: 'Z4',
        tarifa: 4.0,
        gratisDesde: 70,
      });

      const res = await envioController.consultarEnvio({ lat: -12.05, lng: -77.00 });

      expect(service.consultarEnvio).toHaveBeenCalledWith(-12.05, -77.00);
      expect(res.cubierto).toBe(true);
      expect(res.zona).toBe('Z4');
    });
  });

  describe('ZonasAdminController (Admin)', () => {
    it('GET /admin/zonas lista las zonas', async () => {
      service.listarZonasAdmin.mockResolvedValue([
        { id: '1', codigo: 'Z2', tarifa: 2.0, activa: true, puntos: 27 },
      ]);

      const res = await adminController.listarZonas();
      expect(service.listarZonasAdmin).toHaveBeenCalled();
      expect(res).toHaveLength(1);
    });

    it('PUT /admin/zonas/:codigo/tarifa actualiza tarifa', async () => {
      service.editarTarifa.mockResolvedValue({ codigo: 'Z4', tarifa: 6.0 });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };
      const res = await adminController.editarTarifa('Z4', { tarifa: 6.0 }, reqMock);

      expect(service.editarTarifa).toHaveBeenCalledWith('Z4', { tarifa: 6.0 }, reqMock.usuario, '127.0.0.1');
      expect(res.tarifa).toBe(6.0);
    });

    it('PUT /admin/zonas/:codigo/activa actualiza estado activa', async () => {
      service.editarActiva.mockResolvedValue({ codigo: 'Z4', activa: false });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };
      const res = await adminController.editarActiva('Z4', { activa: false }, reqMock);

      expect(service.editarActiva).toHaveBeenCalledWith('Z4', { activa: false }, reqMock.usuario, '127.0.0.1');
      expect(res.activa).toBe(false);
    });

    it('PUT /admin/zonas/:codigo/poligono actualiza polígono', async () => {
      service.editarPoligono.mockResolvedValue({ codigo: 'Z4', puntos: 4 });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };
      const res = await adminController.editarPoligono('Z4', { poligono: [[0, 0], [1, 0], [1, 1], [0, 1]] }, reqMock);

      expect(service.editarPoligono).toHaveBeenCalledWith(
        'Z4',
        { poligono: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        reqMock.usuario,
        '127.0.0.1',
      );
      expect(res.puntos).toBe(4);
    });
  });
});
