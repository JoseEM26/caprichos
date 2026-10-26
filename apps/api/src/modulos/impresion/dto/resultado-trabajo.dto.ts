import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResultadoTrabajoDto {
  @IsNotEmpty({ message: 'El id del trabajo es obligatorio' })
  id!: string | number;

  @IsBoolean({ message: 'ok debe ser un valor booleano' })
  ok!: boolean;

  @IsOptional()
  @IsString({ message: 'El error debe ser una cadena de texto' })
  error?: string;
}
