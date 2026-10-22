import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearComentarioDto {
  @IsString({ message: 'El comentario debe ser texto' })
  @IsNotEmpty({ message: 'Escribe tu comentario' })
  @MaxLength(400, { message: 'El comentario no puede superar los 400 caracteres' })
  texto!: string;
}
