import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class LineaMermaDto {
  @IsNotEmpty({ message: 'El ID del insumo o producto es obligatorio' })
  insumoId!: string | number;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsNotEmpty({ message: 'El origen es obligatorio' })
  @IsString({ message: 'El origen debe ser texto' })
  origen!: string;

  @IsNotEmpty({ message: 'El destino o motivo de la merma es obligatorio' })
  @IsString({ message: 'El destino debe ser texto' })
  destino!: string;
}

export class MermaMultipleDto {
  @IsOptional()
  @IsString({ message: 'El motivo global debe ser texto' })
  motivoGlobal?: string;

  @IsArray({ message: 'Las líneas deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto a mermar' })
  @ValidateNested({ each: true })
  @Type(() => LineaMermaDto)
  lineas!: LineaMermaDto[];
}
