import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReimprimirDto {
  @IsNotEmpty({ message: 'El tipo de etiqueta es obligatorio' })
  @IsIn(
    ['TODAS', 'general', 'area', 'bebida', 'ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA'],
    {
      message: 'Tipo de etiqueta inválido (TODAS, general, area o bebida)',
    },
  )
  tipo!: string;

  @IsOptional()
  area_id?: string | number;

  @IsOptional()
  indice?: number;

  /** Clave de una sola etiqueta del pedido: GENERAL, AREA:<nombre> o BEBIDA:<indice>. */
  @IsOptional()
  @IsString()
  clave?: string;

  /** Salta las reglas de modalidad y activos (decisión explícita; por defecto la reimpresión las respeta). */
  @IsOptional()
  @IsBoolean({ message: 'forzar debe ser verdadero o falso' })
  forzar?: boolean;
}
