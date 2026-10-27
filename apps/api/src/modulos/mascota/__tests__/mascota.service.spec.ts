import { Test, TestingModule } from '@nestjs/testing';
import { MascotaService } from '../mascota.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import {
  CLAVE_PARAMETRO_MASCOTA,
  DEFAULT_MASCOTA_CONFIG,
} from '../mascota.constantes';
import { ActualizarMascotaConfigDto } from '../dto/actualizar-mascota.dto';

describe('MascotaService', () => {
  let service: MascotaService;
  let prismaMock: {
    parametro: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let auditoriaMock: {
    registrar: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MascotaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
      ],
    }).compile();

    service = module.get<MascotaService>(MascotaService);
  });

  describe('obtenerAspectoPublico', () => {
    it('retorna aspecto por defecto resuelto cuando no existe parametro en base de datos', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);

      const res = await service.obtenerAspectoPublico('06-15');
      expect(prismaMock.parametro.findUnique).toHaveBeenCalledWith({
        where: { clave: CLAVE_PARAMETRO_MASCOTA },
      });
      expect(res).toBeDefined();
      expect(res.aspecto.gorro.tipo).toBe('chef');
      expect(res.aspecto.piel).toBe('#FFE0C2');
      expect(res.tema).toBeNull();
    });

    it('resuelve aspecto con la configuración guardada', async () => {
      const configGuardada = {
        ...DEFAULT_MASCOTA_CONFIG,
        modo: 'MANUAL',
        temaManual: 'halloween',
      };
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: CLAVE_PARAMETRO_MASCOTA,
        valor: configGuardada,
      });

      const res = await service.obtenerAspectoPublico('06-15');
      expect(res.tema).toBe('halloween');
      expect(res.aspecto.gorro.tipo).toBe('bruja');
      expect(res.aspecto.accesorios).toEqual(['calabaza']);
    });
  });

  describe('obtenerConfigAdmin', () => {
    it('retorna config completa y aspecto resuelto de hoy', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);

      const res = await service.obtenerConfigAdmin('06-15');
      expect(res.base).toBeDefined();
      expect(res.temas).toHaveLength(DEFAULT_MASCOTA_CONFIG.temas.length);
      expect(res.modo).toBe('AUTOMATICO');
      expect(res.resuelto).toBeDefined();
      expect(res.resuelto.aspecto.piel).toBe(DEFAULT_MASCOTA_CONFIG.base.piel);
    });
  });

  describe('actualizarConfig', () => {
    it('guarda configuración validada en BD y emite registro de auditoría', async () => {
      const anterior = {
        clave: CLAVE_PARAMETRO_MASCOTA,
        valor: DEFAULT_MASCOTA_CONFIG,
      };
      prismaMock.parametro.findUnique.mockResolvedValue(anterior);

      const dto: ActualizarMascotaConfigDto = {
        base: {
          ...DEFAULT_MASCOTA_CONFIG.base,
          piel: '#F5C6A5',
        },
        temas: DEFAULT_MASCOTA_CONFIG.temas,
        modo: 'MANUAL',
        temaManual: 'halloween',
      };

      prismaMock.parametro.upsert.mockResolvedValue({
        clave: CLAVE_PARAMETRO_MASCOTA,
        valor: dto,
      });

      const usuario = {
        partyId: BigInt(10),
        id: 'user-1',
        email: 'admin@caprichos.pe',
        roles: ['ADMIN'],
      } as any;

      const resultado = await service.actualizarConfig(dto, usuario, '192.168.1.1');

      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: CLAVE_PARAMETRO_MASCOTA },
        update: { valor: dto },
        create: { clave: CLAVE_PARAMETRO_MASCOTA, valor: dto },
      });

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'mascota',
          accion: 'ACTUALIZAR_CONFIG',
          resultado: 'OK',
          entidad: 'mascota_config',
          antes: anterior.valor,
          despues: dto,
          partyId: BigInt(10),
          ip: '192.168.1.1',
        }),
      );

      expect(resultado.base.piel).toBe('#F5C6A5');
      expect(resultado.modo).toBe('MANUAL');
      expect(resultado.resuelto.tema).toBe('halloween');
    });
  });

  describe('restablecerConfig', () => {
    it('restablece configuración de fábrica en BD y registra auditoría', async () => {
      const anterior = {
        clave: CLAVE_PARAMETRO_MASCOTA,
        valor: { custom: true },
      };
      prismaMock.parametro.findUnique.mockResolvedValue(anterior);
      prismaMock.parametro.upsert.mockResolvedValue({
        clave: CLAVE_PARAMETRO_MASCOTA,
        valor: DEFAULT_MASCOTA_CONFIG,
      });

      const usuario = {
        partyId: BigInt(99),
        id: 'user-admin',
        roles: ['ADMIN'],
      } as any;

      const res = await service.restablecerConfig(usuario, '10.0.0.1');

      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: CLAVE_PARAMETRO_MASCOTA },
        update: { valor: DEFAULT_MASCOTA_CONFIG },
        create: { clave: CLAVE_PARAMETRO_MASCOTA, valor: DEFAULT_MASCOTA_CONFIG },
      });

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'mascota',
          accion: 'RESTABLECER_CONFIG',
          resultado: 'OK',
          entidad: 'mascota_config',
          antes: anterior.valor,
          despues: DEFAULT_MASCOTA_CONFIG,
          partyId: BigInt(99),
          ip: '10.0.0.1',
        }),
      );

      expect(res.base.piel).toBe(DEFAULT_MASCOTA_CONFIG.base.piel);
      expect(res.modo).toBe('AUTOMATICO');
    });
  });
});
