import { IsBoolean, IsNotEmpty } from 'class-validator';

export class EditarActivaDto {
  @IsBoolean({ message: 'El estado activa debe ser un booleano' })
  @IsNotEmpty({ message: 'El estado activa es requerido' })
  activa!: boolean;
}
