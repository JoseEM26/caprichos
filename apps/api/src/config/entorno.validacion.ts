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
  JWT_SECRET: string = 'solo-desarrollo-cambiar-en-produccion'; // en producción viene del entorno (ver validarEntorno)

  @IsNumber()
  @IsOptional()
  JWT_EXPIRA_MIN: number = 15;

  @IsNumber()
  @IsOptional()
  REFRESH_DIAS: number = 7;

  @IsString()
  @IsOptional()
  GIT_COMMIT: string = 'dev-local';

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_MODEL?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_PHONE_ID?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_VERIFY_TOKEN?: string;

  @IsString()
  @IsOptional()
  WHATSAPP_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  ADMIN_WHATSAPP_NUMBERS?: string;
}

export function validarEntorno(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(VariablesEntorno, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Error en validación de variables de entorno: ${errors.toString()}`);
  }

  if (validatedConfig.NODE_ENV !== Entorno.Development && validatedConfig.NODE_ENV !== Entorno.Test && (!config.JWT_SECRET || String(config.JWT_SECRET).length < 32)) {
    throw new Error('JWT_SECRET es obligatorio (mínimo 32 caracteres) fuera de desarrollo');
  }

  return validatedConfig;
}
