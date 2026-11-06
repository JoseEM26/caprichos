import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class LineaAperturaDto {
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  @IsString()
  productoId!: string;

  /** Producto por sabor: sabor cuyo saldo se fija (obligatorio en esos productos; prohibido en los demás). */
  @IsOptional()
  @IsString({ message: 'El sabor debe ser un identificador' })
  saborId?: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidad!: number;
}

export class RegistrarAperturaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Indica al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => LineaAperturaDto)
  items!: LineaAperturaDto[];
}
