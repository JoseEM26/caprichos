import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CambiarEstadoDto {
  @IsString()
  @IsNotEmpty({ message: 'El estado es requerido' })
  estado!: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  /** Solo el administrador: pasa el pedido aunque Cocina no haya despejado (exige `motivo`). */
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}
