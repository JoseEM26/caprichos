import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RespuestaVersion } from '@caprichos/compartido';

@Controller('version')
export class VersionController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  obtenerVersion(): RespuestaVersion {
    return {
      version: this.configService.get<string>('APP_VERSION', '0.1.0'),
      commit: this.configService.get<string>('GIT_COMMIT', 'dev-local'),
      ambiente: this.configService.get<string>('NODE_ENV', 'development'),
    };
  }
}
