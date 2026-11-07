import { IsBoolean } from 'class-validator';

export class AtendidoDto {
  @IsBoolean({ message: 'atendido debe ser verdadero o falso' })
  atendido!: boolean;
}
