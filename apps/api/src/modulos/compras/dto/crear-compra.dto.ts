import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompraLineaDto {
  @IsNotEmpty({ message: 'El ID del insumo es obligatorio' })
  insumoId!: string | number;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidadCompra!: number;

  @IsNumber({}, { message: 'El costo unitario debe ser un número' })
  @Min(0, { message: 'El costo unitario no puede ser negativo' })
  costoUnit!: number;

  @IsOptional()
  @IsIn(['compra', 'almacen'], { message: 'Unidad debe ser compra o almacen' })
  unidad?: 'compra' | 'almacen';
}

export class CrearCompraDto {
  @IsNotEmpty({ message: 'El ID del proveedor es obligatorio' })
  proveedorPartyId!: string | number;

  @IsOptional()
  pedidoProveedorId?: string | number;

  @IsNotEmpty({ message: 'El tipo de comprobante es obligatorio' })
  @IsIn(['FACTURA', 'BOLETA', 'NOTA_VENTA', 'GUIA', 'OTRO'], {
    message: 'Tipo de comprobante inválido',
  })
  comprobanteTipo!: string;

  @IsNotEmpty({ message: 'El número de comprobante es obligatorio' })
  @IsString({ message: 'El número de comprobante debe ser texto' })
  comprobanteNumero!: string;

  @IsNotEmpty({ message: 'La condición de pago es obligatoria' })
  @IsIn(['CONTADO', 'CREDITO'], { message: 'Condición debe ser CONTADO o CREDITO' })
  condicion!: string;

  @IsOptional()
  @IsNumber({}, { message: 'Los días de crédito deben ser un número' })
  @Min(0)
  diasCredito?: number;

  @IsOptional()
  @IsString({ message: 'La fecha de compra debe ser texto' })
  fechaCompra?: string;

  @IsOptional()
  @IsString({ message: 'La nota debe ser texto' })
  nota?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El total debe ser un número' })
  total?: number;

  @IsArray({ message: 'Las líneas deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un insumo en la compra' })
  @ValidateNested({ each: true })
  @Type(() => CompraLineaDto)
  lineas!: CompraLineaDto[];
}
