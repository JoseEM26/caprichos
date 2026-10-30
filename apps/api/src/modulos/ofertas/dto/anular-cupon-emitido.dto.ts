import { IsNotEmpty, IsString } from 'class-validator';

export class AnularCuponEmitidoDto {
  @IsString({ message: 'El motivo es obligatorio' })
  @IsNotEmpty({ message: 'El motivo no puede estar vacío' })
  motivo!: string;
}
