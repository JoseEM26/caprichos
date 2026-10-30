import { IsString, Matches } from 'class-validator';

export class SubirFotoLocalDto {
  /** Id de un archivo ya subido con POST /admin/archivos (público, en WebP). */
  @IsString({ message: 'archivoId debe ser texto con el id del archivo' })
  @Matches(/^\d+$/, { message: 'archivoId debe ser un número' })
  archivoId!: string;
}
