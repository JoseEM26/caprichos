import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
