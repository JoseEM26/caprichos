import { IsIn, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListarPorEmitirDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'pagina debe ser mayor o igual a 1' })
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'limite debe ser positivo' })
  limite?: number = 20;

  @IsOptional()
  @IsIn(['BOLETA', 'FACTURA'])
  tipo?: 'BOLETA' | 'FACTURA';

  @IsOptional()
  @IsIn(['POR_EMITIR'])
  estado?: 'POR_EMITIR';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  buscar?: string;
}
