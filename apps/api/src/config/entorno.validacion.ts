import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Entorno {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

export class VariablesEntorno {
  @IsEnum(Entorno)
  @IsOptional()
  NODE_ENV: Entorno = Entorno.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  DATABASE_URL: string = 'postgresql://caprichos:caprichos_dev@localhost:5432/caprichos?schema=public'; // valor de ejemplo para desarrollo local (placeholder)

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  APP_VERSION: string = '0.1.0';

  @IsString()
  @IsOptional()
  GIT_COMMIT: string = 'dev-local';
}

export function validarEntorno(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(VariablesEntorno, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Error en validación de variables de entorno: ${errors.toString()}`);
  }

  return validatedConfig;
}
