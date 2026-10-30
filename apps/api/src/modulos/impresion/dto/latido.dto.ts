import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { EstadoImpresora, RolImpresora } from '@caprichos/compartido';

export class ImpresoraLatidoDto {
  @IsIn(['ETIQUETERA', 'TICKETERA'])
  rol!: RolImpresora;

  @IsIn(['lista', 'sin_papel', 'desconectada', 'sin_permiso', 'error'])
  estado!: EstadoImpresora;

  @IsOptional()
  @IsString()
  detalle?: string;
}

export class LatidoDto {
  @IsNotEmpty({ message: 'La versión es obligatoria' })
  @IsString({ message: 'La versión debe ser una cadena' })
  version!: string;

  @IsNotEmpty({ message: 'El estado de la impresora es obligatorio' })
  @IsIn(['lista', 'sin_papel', 'desconectada', 'sin_permiso', 'error'], {
    message: 'El estado de la impresora debe ser lista, sin_papel, desconectada, sin_permiso o error',
  })
  impresora!: EstadoImpresora;

  @IsOptional()
  @IsString({ message: 'El detalle debe ser una cadena' })
  detalle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpresoraLatidoDto)
  impresoras?: ImpresoraLatidoDto[];
}
