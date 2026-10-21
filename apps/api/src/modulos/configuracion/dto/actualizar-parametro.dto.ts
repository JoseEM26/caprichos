import { IsDefined, IsNumber, Min } from 'class-validator';

export class ActualizarParametroDto {
  @IsDefined({ message: 'El valor es requerido' })
  @IsNumber({}, { message: 'El valor debe ser un número' })
  @Min(0, { message: 'El valor debe ser mayor o igual a 0' })
  valor!: number;
}
