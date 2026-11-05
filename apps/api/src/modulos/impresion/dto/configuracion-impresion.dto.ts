import { ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
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

  @IsOptional()
  @IsBoolean({ message: 'comandaAreaActivo debe ser verdadero o falso' })
  comandaAreaActivo?: boolean;
}

export class AsignarAreaEquipoDto {
  /** Id del área, o null para Caja. */
  areaId!: string | null;

  /** Si el destino ya tiene equipo con esa máquina: true lo reemplaza (lo desactiva) en vez de responder 409. */
  @IsOptional()
  @IsBoolean({ message: 'reemplazar debe ser verdadero o falso' })
  reemplazar?: boolean;
}

export class ReemplazarEquipoDto {
  /** Id del equipo nuevo que toma el área del equipo de la ruta; ese equipo queda desactivado. */
  @IsString({ message: 'porEquipoId es obligatorio' })
  porEquipoId!: string;
}
