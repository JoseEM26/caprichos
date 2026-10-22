import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ActualizarBorradorDisenoDto {
  @IsOptional()
  @IsString()
  organizacion?: 'SECCIONES' | 'LISTA' | 'TARJETAS';

  @IsOptional()
  @IsString()
  decoracion?: string;

  @IsOptional()
  contenido?: any;
}

export class CrearNovedadDto {
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @IsString()
  tipo!: string;

  @IsNotEmpty({ message: 'El título es obligatorio' })
  @IsString()
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsString()
  tema?: string;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsOptional()
  @IsString()
  evento_fecha?: string;

  @IsOptional()
  @IsString()
  evento_lugar?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  fotos?: string[];
}

export class ActualizarNovedadDto {
  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsString()
  tema?: string;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsOptional()
  @IsString()
  evento_fecha?: string;

  @IsOptional()
  @IsString()
  evento_lugar?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  fotos?: string[];
}

export class CrearDestacadaDto {
  @IsNotEmpty({ message: 'El título de la destacada es obligatorio' })
  @IsString()
  titulo!: string;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsString()
  portada_url?: string;
}

export class ActualizarDestacadaDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsNumber()
  orden?: number;

  @IsOptional()
  @IsString()
  portada_url?: string;

  @IsOptional()
  @IsBoolean()
  archivada?: boolean;

  @IsOptional()
  fotos?: Array<{ url: string; pie?: string; orden?: number }>;
}

export class GuardarPaletaDto {
  @IsOptional()
  paletas?: Record<string, Record<string, string>>;

  @IsOptional()
  @IsString()
  temaActivo?: string;
}

export class CrearMensajeCartaDto {
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @IsString()
  tipo!: string;

  @IsNotEmpty({ message: 'El mensaje no puede estar vacío' })
  @IsString()
  texto!: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  domicilio?: string;

  @IsOptional()
  @IsString()
  monto?: string;
}
