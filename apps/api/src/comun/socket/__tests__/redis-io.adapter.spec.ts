import { RedisIoAdapter } from '../redis-io.adapter';
import { ConfigService } from '@nestjs/config';

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn().mockReturnValue('mock-adapter-fn'),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const instance = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      on: jest.fn(),
      duplicate: jest.fn(),
    };
    instance.duplicate.mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      on: jest.fn(),
    });
    return instance;
  });
});

describe('RedisIoAdapter', () => {
  let mockApp: any;
  let mockConfigService: any;
  let adapter: RedisIoAdapter;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, def?: any) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return def;
      }),
    };

    mockApp = {
      get: jest.fn().mockReturnValue(mockConfigService),
    };

    adapter = new RedisIoAdapter(mockApp);
  });

  afterEach(async () => {
    await adapter.cerrar();
    jest.clearAllMocks();
  });

  it('se conecta exitosamente a Redis y marca el adaptador como conectado', async () => {
    await adapter.conectarRedis();
    expect(adapter.estaConectado()).toBe(true);
  });

  it('cae a adaptador en memoria sin crashear si Redis falla en conectar', async () => {
    const RedisMock = require('ioredis');
    RedisMock.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
      on: jest.fn(),
      duplicate: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      }),
    }));

    const adapterFallo = new RedisIoAdapter(mockApp);
    await adapterFallo.conectarRedis();

    expect(adapterFallo.estaConectado()).toBe(false);
  });

  it('configura el adaptador en createIOServer si está conectado a Redis', async () => {
    await adapter.conectarRedis();

    const mockServer = {
      adapter: jest.fn(),
    };

    // Espiamos super.createIOServer
    const spySuper = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
      .mockReturnValue(mockServer as any);

    const server = adapter.createIOServer(3000);

    expect(mockServer.adapter).toHaveBeenCalledWith('mock-adapter-fn');
    spySuper.mockRestore();
  });
});
