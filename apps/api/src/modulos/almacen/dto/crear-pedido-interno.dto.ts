import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class LineaPedidoInternoDto {
  @IsOptional()
  insumoId?: string | number;

  @IsNotEmpty({ message: 'El nombre del insumo es obligatorio' })
  @IsString({ message: 'El nombre del insumo debe ser texto' })
  insumo!: string;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsOptional()
  @IsString({ message: 'La unidad debe ser texto' })
  unidad?: string;
}

export class CrearPedidoInternoDto {
  @IsOptional()
  areaId?: string | number;

  @IsOptional()
  @IsString({ message: 'El nombre del área debe ser texto' })
  area?: string;

  @IsArray({ message: 'Los items deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un insumo en el pedido' })
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoInternoDto)
  items!: LineaPedidoInternoDto[];

  @IsOptional()
  @IsString({ message: 'La nota debe ser texto' })
  nota?: string;
}
