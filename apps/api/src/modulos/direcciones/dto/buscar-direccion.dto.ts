import { IsString, MaxLength, MinLength } from 'class-validator';

export class BuscarDireccionDto {
  @IsString()
  @MinLength(3, { message: 'Escribe al menos 3 letras' })
  @MaxLength(120)
  q!: string;
}
