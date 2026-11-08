import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class LiberarMesaDto {
  // Opcional: liberar es libre. Si se escribe, queda en la auditoría.
  @IsOptional()
  @IsString({ message: 'El motivo debe ser un texto' })
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres' })
  motivo?: string;

  // Forzar: libera la mesa aunque el pedido siga en cocina. No anula ni toca el pedido.
  @IsOptional()
  @IsBoolean({ message: 'forzar debe ser verdadero o falso' })
  forzar?: boolean;
}
