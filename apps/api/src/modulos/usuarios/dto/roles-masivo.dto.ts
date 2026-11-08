import { IsBoolean, IsDefined, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RolesMasivoDto {
  /** Ids de cuenta, o 'todos' (todas las cuentas; por defecto solo las activas). */
  @IsDefined({ message: 'Indica los usuarios o «todos»' })
  usuarioIds!: string[] | 'todos';

  @IsString()
  @IsNotEmpty({ message: 'Indica el rol' })
  rol!: string;

  @IsIn(['agregar', 'quitar'], { message: 'La acción debe ser agregar o quitar' })
  accion!: 'agregar' | 'quitar';

  /** Solo con 'todos': por defecto true (las cuentas desactivadas se dejan quietas). */
  @IsOptional()
  @IsBoolean()
  soloActivos?: boolean;
}
