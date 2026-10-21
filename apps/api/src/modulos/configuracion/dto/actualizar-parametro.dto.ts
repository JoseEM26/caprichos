import { IsDefined } from 'class-validator';

export class ActualizarParametroDto {
  @IsDefined({ message: 'El valor es requerido' })
  valor!: any;
}
