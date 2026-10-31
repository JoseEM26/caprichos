import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
