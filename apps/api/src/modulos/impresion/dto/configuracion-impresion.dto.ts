import { ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { MODALIDADES_PEDIDO } from '@caprichos/compartido';

/** Cambio parcial de reglas de impresión. Las modalidades se validan contra MODALIDADES_PEDIDO. */
export class ReglasImpresionDto {
  @IsOptional()
  @IsArray({ message: 'generalModalidades debe ser una lista' })
  @ArrayUnique({ message: 'Hay modalidades repetidas' })
  @IsIn(MODALIDADES_PEDIDO as unknown as string[], { each: true, message: 'Modalidad no válida' })
  generalModalidades?: string[];

  @IsOptional()
  @IsBoolean({ message: 'bebidaActivo debe ser verdadero o falso' })
  bebidaActivo?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'areaActivo debe ser verdadero o falso' })
  areaActivo?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'comandaSalonActivo debe ser verdadero o falso' })
  comandaSalonActivo?: boolean;
}

export class AsignarAreaEquipoDto {
  /** Id del área, o null para Caja. */
  areaId!: string | null;
}
