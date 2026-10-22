import { IsOptional, IsPositive, Min } from 'class-validator';
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
}
