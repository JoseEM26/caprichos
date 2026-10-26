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
  @IsIn(['todos', 'atender', 'bot', 'atendidos'])
  filtro?: 'todos' | 'atender' | 'bot' | 'atendidos';

  @IsOptional()
  @IsString()
  q?: string;
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
