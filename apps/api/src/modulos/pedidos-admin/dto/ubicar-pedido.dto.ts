import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UbicarPedidoDto {
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string;
}
