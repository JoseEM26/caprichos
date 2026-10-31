import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const MOTIVOS_SALTO = ['NO_CONTESTA', 'DIRECCION_NO_ENCONTRADA', 'TRAFICO', 'OTRO'] as const;
export type MotivoSalto = (typeof MOTIVOS_SALTO)[number];

export class SaltarPedidoDto {
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsEnum(MOTIVOS_SALTO, { message: 'Motivo de salto no válido' })
  motivo!: MotivoSalto;

  /** Obligatorio cuando el motivo es OTRO (se valida en el servicio). */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El detalle admite hasta 200 caracteres' })
  detalle?: string;
}
