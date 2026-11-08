import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { MOTIVOS_MERMA_PRODUCTO, type MotivoMermaProducto } from '../../stock/producto-controlado';

export class LineaAperturaDto {
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  @IsString()
  productoId!: string;

  /** Producto por sabor: sabor cuyo saldo se fija (obligatorio en esos productos; prohibido en los demás). */
  @IsOptional()
  @IsString({ message: 'El sabor debe ser un identificador' })
  saborId?: string;

  /** Lo que quedó de ayer (contado). Corrige el saldo si cambió; el saldo no se reinicia. */
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidad!: number;

  /** Lo que se produjo hoy: se suma al saldo (movimiento «Produje hoy»). */
  @IsOptional()
  @IsInt({ message: 'Lo producido debe ser un número entero' })
  @Min(0, { message: 'Lo producido no puede ser negativo' })
  produccion?: number;

  /** Saldo que la pantalla tenía al contar. Si bajó la cantidad y el saldo real ya es otro → 409 CONTEO_DESACTUALIZADO. */
  @IsOptional()
  @IsInt()
  saldoEsperado?: number;

  /** Motivo de la merma cuando el conteo BAJA el saldo (obligatorio en ese caso; si falta → 400 MOTIVO_OBLIGATORIO). */
  @IsOptional()
  @IsIn(MOTIVOS_MERMA_PRODUCTO as readonly string[], { message: 'Motivo de merma no válido' })
  motivo?: MotivoMermaProducto;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La nota no puede pasar de 200 caracteres' })
  nota?: string;
}

export class RegistrarAperturaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Indica al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => LineaAperturaDto)
  items!: LineaAperturaDto[];
}
