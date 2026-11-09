import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FiltroHistorialDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  estado?: 'todas' | 'nuevas' | 'leidas';

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  /** Cuántas devolver (por defecto 10, máximo 50) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;

  /** Id de la última notificación ya recibida: devuelve las que van después (más antiguas) */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cursor?: string;
}

export class MarcarLeidaDto {
  @IsOptional()
  @IsBoolean()
  leida?: boolean;
}

export class MarcarClaveDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  clave!: string;

  @IsOptional()
  @IsBoolean()
  leida?: boolean;
}

export class MarcarTodasDto {
  @IsOptional()
  ids?: string[];
}

export class CrearMensajeInternoDto {
  @IsOptional()
  @IsString()
  rol_destino?: string;

  @IsNotEmpty()
  @IsString()
  titulo!: string;

  @IsNotEmpty()
  @IsString()
  mensaje!: string;
}
