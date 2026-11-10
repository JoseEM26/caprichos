import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class GuardarRolModulosDto {
  /** Claves de los módulos que el rol debe ver (las del catálogo MODULOS_ROL). */
  @IsArray({ message: 'Indica la lista de módulos' })
  @ArrayMaxSize(200)
  @IsString({ each: true })
  modulos!: string[];
}
