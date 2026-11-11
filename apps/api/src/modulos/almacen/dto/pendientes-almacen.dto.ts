import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/** Emitir pendientes: por ids (uno por uno o varios) o todos los de un insumo. */
export class EmitirPendientesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  ids?: Array<string | number>;

  @IsOptional()
  insumoId?: string | number;
}

export class FilaRecuentoInsumoDto {
  insumoId!: string | number;

  @Type(() => Number)
  @IsNumber({}, { message: 'La cantidad contada debe ser un número' })
  @Min(0, { message: 'La cantidad contada no puede ser negativa' })
  contado!: number;
}

/** Recuento nocturno de insumos de Cocina o de Almacén. */
export class RecuentoInsumosDto {
  @IsIn(['COCINA', 'ALMACEN'], { message: 'El lugar debe ser COCINA o ALMACEN' })
  lugar!: 'COCINA' | 'ALMACEN';

  @IsArray()
  @ArrayMinSize(1, { message: 'Cuenta al menos un insumo' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => FilaRecuentoInsumoDto)
  filas!: FilaRecuentoInsumoDto[];

  @IsOptional()
  @IsString()
  motivo?: string;
}
