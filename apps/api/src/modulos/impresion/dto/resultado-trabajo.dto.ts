import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResultadoTrabajoDto {
  @IsNotEmpty({ message: 'El id del trabajo es obligatorio' })
  id!: string | number;

  @IsBoolean({ message: 'ok debe ser un valor booleano' })
  ok!: boolean;

  @IsOptional()
  @IsString({ message: 'El error debe ser una cadena de texto' })
  error?: string;

  /** Con qué diseño salió: los comandos del servidor o el de respaldo del programa (un programa viejo no lo manda). */
  @IsOptional()
  @IsIn(['servidor', 'respaldo'])
  diseno?: 'servidor' | 'respaldo';
}
