import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LiberarMesaDto {
  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  motivo!: string;

  // Forzar: libera la mesa aunque el pedido siga en cocina. No anula ni toca el pedido.
  @IsOptional()
  @IsBoolean({ message: 'forzar debe ser verdadero o falso' })
  forzar?: boolean;
}
