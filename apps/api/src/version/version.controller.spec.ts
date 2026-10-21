import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VersionController } from './version.controller';

describe('VersionController', () => {
  let controller: VersionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const valores: Record<string, string> = {
                APP_VERSION: '1.0.0-test',
                GIT_COMMIT: 'abc1234',
                NODE_ENV: 'test',
              };
              return valores[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<VersionController>(VersionController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe devolver la versión, commit y ambiente configurados', () => {
    const resultado = controller.obtenerVersion();

    expect(resultado).toEqual({
      version: '1.0.0-test',
      commit: 'abc1234',
      ambiente: 'test',
    });
  });
});
