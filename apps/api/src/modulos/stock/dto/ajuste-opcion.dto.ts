import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class AjusteOpcionDto {
  @IsIn(['SUMA', 'QUITA', 'REEMPLAZA'], {
    message: 'El efecto debe ser SUMA, QUITA o REEMPLAZA',
  })
  efecto!: 'SUMA' | 'QUITA' | 'REEMPLAZA';

  @IsNotEmpty({ message: 'El insumo es obligatorio' })
  insumo_id!: string | number;

  @IsOptional()
  reemplaza_insumo_id?: string | number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cantidad?: number | null;
}
