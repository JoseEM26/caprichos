import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Único lo que el usuario puede cambiar de su propia cuenta. Cualquier otro campo se rechaza. */
export class ActualizarMiPerfilDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'Los nombres deben ser texto' })
  @Length(2, 60, { message: 'Los nombres deben tener entre 2 y 60 caracteres' })
  nombres?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'Los apellidos deben ser texto' })
  @MaxLength(60, { message: 'Los apellidos no pueden pasar de 60 caracteres' })
  apellidos?: string;

  /** Vacío = quitar el correo. */
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El correo debe ser texto' })
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'El correo no tiene un formato válido' })
  @MaxLength(120, { message: 'El correo no puede pasar de 120 caracteres' })
  correo?: string;
}

/** Campos que la API acepta de "mi perfil"; el resto se rechaza en el controlador. */
export const CAMPOS_MI_PERFIL = ['nombres', 'apellidos', 'correo'] as const;
