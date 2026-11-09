import { ArrayUnique, IsArray } from 'class-validator';

export class OrdenarGruposDto {
  @IsArray({ message: 'grupoIds debe ser una lista' })
  @ArrayUnique({ message: 'Hay grupos repetidos' })
  grupoIds!: Array<string | number>;
}
