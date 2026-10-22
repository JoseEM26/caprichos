import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ListarPantallasDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  estacion?: string;
}

export class VincularPantallaDto {
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @IsString()
  @Length(4, 12, { message: 'Escribe el código completo que aparece en la TV (6 caracteres).' })
  codigo!: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  areaId?: string;
}

export class EditarPantallaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  areaId?: string;
}
