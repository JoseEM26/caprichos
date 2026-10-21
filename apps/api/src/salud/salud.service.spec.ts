import { Test, TestingModule } from '@nestjs/testing';
import { SaludService } from './salud.service';
import { PrismaService } from '../comun/prisma/prisma.service';
import { RedisService } from '../comun/redis/redis.service';

describe('SaludService', () => {
  let service: SaludService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockPrisma = {
      verificarConexion: jest.fn(),
    };
    const mockRedis = {
      verificarConexion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaludService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SaludService>(SaludService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  it('debe responder estado ok cuando PostgreSQL y Redis están conectados', async () => {
    prismaService.verificarConexion.mockResolvedValue({ conectado: true });
    redisService.verificarConexion.mockResolvedValue({ conectado: true });

    const salud = await service.verificarSalud();

    expect(salud.estado).toBe('ok');
    expect(salud.detalles.base.estado).toBe('conectado');
    expect(salud.detalles.redis.estado).toBe('conectado');
  });

  it('debe responder estado error cuando PostgreSQL falla', async () => {
    prismaService.verificarConexion.mockResolvedValue({
      conectado: false,
      mensaje: 'Timeout al conectar a PostgreSQL',
    });
    redisService.verificarConexion.mockResolvedValue({ conectado: true });

    const salud = await service.verificarSalud();

    expect(salud.estado).toBe('error');
    expect(salud.detalles.base.estado).toBe('desconectado');
    expect(salud.detalles.base.mensaje).toBe('Timeout al conectar a PostgreSQL');
    expect(salud.detalles.redis.estado).toBe('conectado');
  });

  it('debe responder estado error cuando Redis falla', async () => {
    prismaService.verificarConexion.mockResolvedValue({ conectado: true });
    redisService.verificarConexion.mockResolvedValue({
      conectado: false,
      mensaje: 'ECONNREFUSED 127.0.0.1:6379',
    });

    const salud = await service.verificarSalud();

    expect(salud.estado).toBe('error');
    expect(salud.detalles.base.estado).toBe('conectado');
    expect(salud.detalles.redis.estado).toBe('desconectado');
    expect(salud.detalles.redis.mensaje).toBe('ECONNREFUSED 127.0.0.1:6379');
  });
});
