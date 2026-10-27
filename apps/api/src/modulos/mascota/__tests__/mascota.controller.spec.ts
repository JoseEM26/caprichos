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
import {
  CartaMascotaController,
  MascotaAdminController,
} from '../mascota.controller';
import { MascotaService } from '../mascota.service';
import { DEFAULT_MASCOTA_CONFIG } from '../mascota.constantes';
import { AccesoGuard } from '../../acceso/acceso.guard';

describe('Mascota Controllers', () => {
  let cartaController: CartaMascotaController;
  let adminController: MascotaAdminController;
  let mascotaServiceMock: {
    obtenerAspectoPublico: jest.Mock;
    obtenerConfigAdmin: jest.Mock;
    actualizarConfig: jest.Mock;
    restablecerConfig: jest.Mock;
  };

  beforeEach(async () => {
    mascotaServiceMock = {
      obtenerAspectoPublico: jest.fn().mockResolvedValue({
        tema: null,
        aspecto: DEFAULT_MASCOTA_CONFIG.base,
      }),
      obtenerConfigAdmin: jest.fn().mockResolvedValue({
        ...DEFAULT_MASCOTA_CONFIG,
        resuelto: { tema: null, aspecto: DEFAULT_MASCOTA_CONFIG.base },
      }),
      actualizarConfig: jest.fn().mockResolvedValue({
        ...DEFAULT_MASCOTA_CONFIG,
        resuelto: { tema: null, aspecto: DEFAULT_MASCOTA_CONFIG.base },
      }),
      restablecerConfig: jest.fn().mockResolvedValue({
        ...DEFAULT_MASCOTA_CONFIG,
        resuelto: { tema: null, aspecto: DEFAULT_MASCOTA_CONFIG.base },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartaMascotaController, MascotaAdminController],
      providers: [
        {
          provide: MascotaService,
          useValue: mascotaServiceMock,
        },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    cartaController = module.get<CartaMascotaController>(CartaMascotaController);
    adminController = module.get<MascotaAdminController>(MascotaAdminController);
  });

  describe('CartaMascotaController', () => {
    it('GET /carta/mascota retorna el aspecto público', async () => {
      const res = await cartaController.obtenerAspecto();
      expect(mascotaServiceMock.obtenerAspectoPublico).toHaveBeenCalled();
      expect(res.aspecto).toBeDefined();
    });
  });

  describe('MascotaAdminController', () => {
    const reqMock = {
      usuario: { partyId: BigInt(1), roles: ['ADMIN'] },
      ip: '127.0.0.1',
    };

    it('GET /admin/mascota llama a obtenerConfigAdmin', async () => {
      const res = await adminController.obtenerConfig();
      expect(mascotaServiceMock.obtenerConfigAdmin).toHaveBeenCalled();
      expect(res.base).toBeDefined();
    });

    it('PUT /admin/mascota delega en actualizarConfig con req y dto', async () => {
      const dto = {
        base: DEFAULT_MASCOTA_CONFIG.base,
        temas: DEFAULT_MASCOTA_CONFIG.temas,
        modo: 'AUTOMATICO' as const,
      };

      await adminController.actualizarConfig(dto as any, reqMock);
      expect(mascotaServiceMock.actualizarConfig).toHaveBeenCalledWith(
        dto,
        reqMock.usuario,
        '127.0.0.1',
      );
    });

    it('POST /admin/mascota/restablecer delega en restablecerConfig con req', async () => {
      await adminController.restablecerConfig(reqMock);
      expect(mascotaServiceMock.restablecerConfig).toHaveBeenCalledWith(
        reqMock.usuario,
        '127.0.0.1',
      );
    });
  });
});
