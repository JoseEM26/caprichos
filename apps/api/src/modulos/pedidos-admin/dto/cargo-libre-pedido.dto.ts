import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

/** «Servicio o producto» sobre un pedido sin cobrar. Descripción y monto se validan de nuevo en el servidor. */
export class CargoLibrePedidoDto {
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con 2 decimales como máximo' })
  monto!: number;

  /** Línea del pedido a la que acompaña (opcional): su comanda y su sticker llevan el texto. */
  @IsOptional()
  paraLineaId?: number | string;
}
