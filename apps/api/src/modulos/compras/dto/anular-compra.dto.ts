import { IsNotEmpty, IsString, Length } from 'class-validator';

export class AnularCompraDto {
  @IsNotEmpty({ message: 'El motivo de anulación es obligatorio' })
  @IsString({ message: 'El motivo debe ser texto' })
  @Length(3, 255, { message: 'El motivo debe tener entre 3 y 255 caracteres' })
  motivo!: string;
}
