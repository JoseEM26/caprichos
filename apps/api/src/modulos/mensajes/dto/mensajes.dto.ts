import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class ListarConversacionesDto {
  @IsOptional()
  @IsIn(['todos', 'atender', 'bot', 'atendidos', 'novistos'])
  filtro?: 'todos' | 'atender' | 'bot' | 'atendidos' | 'novistos';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['faltan', 'procesados'])
  pos?: 'faltan' | 'procesados';
}

export class AtendidoDto {
  @IsOptional()
  @IsBoolean()
  confirmar?: boolean;
}

export class ImagenDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024, { message: 'El subtítulo es demasiado largo' })
  subtitulo?: string;
}

export class DocumentoDto {
  /** Nombre original en UTF-8 (multer lo entrega mal codificado cuando tiene tildes). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;
}

export class TextoDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe un mensaje' })
  @MaxLength(1000, { message: 'El mensaje es demasiado largo' })
  texto!: string;
}

export class TomarDto {
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}

export class EditarNombreContactoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 60, { message: 'El nombre debe tener entre 2 y 60 caracteres' })
  @Matches(/\S+/, { message: 'El nombre no puede consistir únicamente en espacios' })
  nombre?: string;

  @IsOptional()
  @IsBoolean({ message: 'revertir debe ser un booleano' })
  revertir?: boolean;
}

export class RechazarPagoDto {
  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @MaxLength(300, { message: 'El motivo es demasiado largo' })
  motivo?: string;
}

export class RechazarCambioDto {
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @Length(3, 300, { message: 'El motivo debe tener entre 3 y 300 caracteres' })
  motivo!: string;
}
