import { IsEnum, IsNotEmpty } from 'class-validator';

export enum EstadoIniciativa {
  NUEVA = 'NUEVA',
  EN_REVISION = 'EN_REVISION',
  HECHA = 'HECHA',
  NO_POR_AHORA = 'NO_POR_AHORA',
}

export class CambiarEstadoDto {
  @IsEnum(EstadoIniciativa, { message: 'El estado debe ser NUEVA, EN_REVISION, HECHA o NO_POR_AHORA' })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  estado!: EstadoIniciativa;
}
