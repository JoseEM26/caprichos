import { ArrayUnique, IsArray, IsString, Matches } from 'class-validator';

export class AreasUsuarioDto {
  /** Lista completa de áreas que atiende el usuario (vacía = ve todas). */
  @IsArray({ message: 'areaIds debe ser una lista' })
  @ArrayUnique({ message: 'Hay áreas repetidas' })
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true, message: 'Cada área debe ser un identificador numérico' })
  areaIds!: string[];
}
