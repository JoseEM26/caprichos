import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDefined, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class LineaCuponCajaDto {
  @IsDefined()
  productoId!: string | number;

  @IsNumber()
  cantidad!: number;

  @IsNumber()
  subtotal!: number;

  @IsNumber()
  precioUnitario!: number;

  /** Línea de combo/oferta: no entra al descuento del personal (igual que al crear el pedido). */
  @IsOptional()
  @IsString()
  ofertaId?: string;
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

/** Descuentos que el servidor aplicará al pedido de mesa/caja (promociones automáticas y cupón opcional). */
export class VistaPreviaDescuentosCajaDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsIn(['CAJA', 'MOZO'])
  canal?: 'CAJA' | 'MOZO';

  @IsOptional()
  @IsString()
  modalidad?: string;

  @IsArray({ message: 'Agrega productos al pedido' })
  @ArrayMinSize(1, { message: 'Agrega productos al pedido' })
  @ValidateNested({ each: true })
  @Type(() => LineaCuponCajaDto)
  lineas!: LineaCuponCajaDto[];

  /** Pedido del personal: si viene, la respuesta añade el descuento del personal que aplicará el servidor. */
  @IsOptional()
  @IsString()
  colaboradorPartyId?: string;
}
