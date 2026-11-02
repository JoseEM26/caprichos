import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, Min, ValidateNested } from 'class-validator';

export class LineaDespachoDto {
  @IsNotEmpty({ message: 'La línea es requerida' })
  lineaId!: string | number;

  @IsInt({ message: 'Las unidades a despachar deben ser un número entero' })
  @Min(1, { message: 'Las unidades a despachar deben ser al menos 1' })
  unidades!: number;
}

export class DespacharDto {
  /** Sin líneas (o vacío): despacha todo lo que esté listo y aún no salió. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineaDespachoDto)
  lineas?: LineaDespachoDto[];
}
