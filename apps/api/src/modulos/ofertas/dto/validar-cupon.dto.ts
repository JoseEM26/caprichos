import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ValidarCuponDto {
  @IsString({ message: 'El código es obligatorio' })
  @IsNotEmpty({ message: 'El código no puede estar vacío' })
  codigo!: string;

  @IsNumber({}, { message: 'El subtotal debe ser un número válido' })
  @Min(0, { message: 'El subtotal no puede ser negativo' })
  subtotal!: number;

  @IsOptional()
  @IsArray()
  lineas?: Array<{
    productoId: string | number;
    categoriaId?: string | number;
    cantidad: number;
    subtotal: number;
  }>;

  @IsOptional()
  clientePartyId?: string | number | bigint | null;
}
