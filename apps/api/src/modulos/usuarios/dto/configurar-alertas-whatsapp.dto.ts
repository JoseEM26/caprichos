import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConfigurarAlertasWhatsappDto {
  @IsOptional()
  @IsString()
  celular?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsBoolean()
  alertasWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  alertas_whatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
