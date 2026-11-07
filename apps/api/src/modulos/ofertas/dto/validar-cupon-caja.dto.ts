import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDefined, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class LineaCuponCajaDto {
  @IsDefined()
  productoId!: string | number;

  @IsNumber()
  cantidad!: number;

  @IsNumber()
  subtotal!: number;

  @IsNumber()
  precioUnitario!: number;
}

/** Cupón en el «Nuevo pedido» de mesa/caja: solo validar, el canje ocurre al crear el pedido. */
export class ValidarCuponCajaDto {
  @IsString({ message: 'El código es obligatorio' })
  @IsNotEmpty({ message: 'El código no puede estar vacío' })
  codigo!: string;

  @IsOptional()
  @IsIn(['CAJA', 'MOZO'])
  canal?: 'CAJA' | 'MOZO';

  @IsArray({ message: 'Agrega productos al pedido' })
  @ArrayMinSize(1, { message: 'Agrega productos al pedido' })
  @ValidateNested({ each: true })
  @Type(() => LineaCuponCajaDto)
  lineas!: LineaCuponCajaDto[];
}
