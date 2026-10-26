import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class ReimprimirDto {
  @IsNotEmpty({ message: 'El tipo de etiqueta es obligatorio' })
  @IsIn(
    ['general', 'area', 'bebida', 'ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA'],
    {
      message: 'Tipo de etiqueta inválido (general, area o bebida)',
    },
  )
  tipo!: string;

  @IsOptional()
  area_id?: string | number;

  @IsOptional()
  indice?: number;
}
