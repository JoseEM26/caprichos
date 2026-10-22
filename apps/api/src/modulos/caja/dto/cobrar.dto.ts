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
import { Type } from 'class-transformer';

export class PagoItemDto {
  @IsString({ message: 'El medio de pago debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El medio de pago es requerido' })
  medio!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser un número válido' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto recibido debe ser un número válido' })
  @Min(0, { message: 'El monto recibido no puede ser negativo' })
  recibido?: number;
}

export class CobrarDto {
  @IsNotEmpty({ message: 'El ID del pedido es requerido' })
  pedidoId!: string | number;

  @IsArray({ message: 'Los pagos deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe ingresar al menos un pago' })
  @ValidateNested({ each: true })
  @Type(() => PagoItemDto)
  pagos!: PagoItemDto[];
}
