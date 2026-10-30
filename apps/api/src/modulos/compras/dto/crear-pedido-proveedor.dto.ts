import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, Min, ValidateNested } from 'class-validator';

export class PedidoProveedorLineaDto {
  @IsNotEmpty({ message: 'El ID del insumo es obligatorio' })
  insumoId!: string | number;

  @IsNumber({}, { message: 'La cantidad de compra debe ser un número' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidadCompra!: number;
}

export class CrearPedidoProveedorDto {
  @IsNotEmpty({ message: 'El ID del proveedor es obligatorio' })
  proveedorPartyId!: string | number;

  @IsArray({ message: 'Las líneas deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un insumo' })
  @ValidateNested({ each: true })
  @Type(() => PedidoProveedorLineaDto)
  lineas!: PedidoProveedorLineaDto[];
}
