import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MOTIVOS_MERMA_PRODUCTO, type MotivoMermaProducto } from '../../stock/producto-controlado';

export class MermaProductoDto {
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  @IsString()
  productoId!: string;

  /** Producto por sabor: sabor del que sale la merma (obligatorio en esos productos; prohibido en los demás). */
  @IsOptional()
  @IsString({ message: 'El sabor debe ser un identificador' })
  saborId?: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad a botar debe ser al menos 1' })
  cantidad!: number;

  @IsIn(MOTIVOS_MERMA_PRODUCTO as readonly string[], { message: 'Motivo de merma no válido' })
  motivo!: MotivoMermaProducto;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La nota no puede pasar de 200 caracteres' })
  nota?: string;
}
