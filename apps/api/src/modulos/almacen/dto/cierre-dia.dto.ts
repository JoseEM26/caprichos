import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class FilaCierreDiaDto {
  @IsOptional()
  insumoId?: string | number;

  @IsOptional()
  productoId?: string | number;

  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  nombre!: string;

  @IsNumber({}, { message: 'El stock según sistema debe ser número' })
  sistema!: number;

  @IsNumber({}, { message: 'El stock contado debe ser número' })
  @Min(0, { message: 'El stock contado no puede ser negativo' })
  contado!: number;

  @IsNumber({}, { message: 'La cantidad a botar debe ser número' })
  @Min(0, { message: 'La cantidad a botar no puede ser negativa' })
  botar!: number;

  @IsNotEmpty({ message: 'El destino de la merma es obligatorio' })
  @IsString()
  destino!: string;

  @IsOptional()
  @IsString()
  unidad?: string;
}

export class CierreDiaDto {
  @IsOptional()
  lugarId?: string | number;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsArray({ message: 'Las filas deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto en el cierre' })
  @ValidateNested({ each: true })
  @Type(() => FilaCierreDiaDto)
  filas!: FilaCierreDiaDto[];
}
