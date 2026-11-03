import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ComboParteDto, ComboPrecioDto, EsDescuentoValorValidoConstraint } from './crear-oferta.dto';

export class ActualizarOfertaDto {
  @IsOptional()
  @IsIn(['COMBO', 'LLEVA_PAGA', 'DESCUENTO', 'DESCUENTO_AUTOMATICO'], { message: 'Tipo de oferta no válido' })
  tipo?: 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO' | 'DESCUENTO_AUTOMATICO';

  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  lleva?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  paga?: number | null;

  @IsOptional()
  alcanceCategoriaId?: string | number | null;

  @IsOptional()
  alcanceProductoId?: string | number | null;

  @IsOptional()
  @IsIn(['PORCENTAJE', 'MONTO', 'MONTO_FIJO'], { message: 'descuentoTipo debe ser PORCENTAJE o MONTO' })
  descuentoTipo?: 'PORCENTAJE' | 'MONTO' | 'MONTO_FIJO' | null;

  @IsOptional()
  @IsNumber({}, { message: 'descuentoValor debe ser un número' })
  @Validate(EsDescuentoValorValidoConstraint)
  descuentoValor?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'compraMinima debe ser un número' })
  @Min(0, { message: 'La compra mínima debe ser mayor o igual a 0' })
  compraMinima?: number | null;

  @IsOptional()
  @IsArray({ message: 'dias debe ser un arreglo de números (1..7)' })
  dias?: number[] | null;

  @IsOptional()
  @IsArray()
  diasSemana?: number[] | null;

  @IsOptional()
  @IsString()
  horaDesde?: string | null;

  @IsOptional()
  @IsString()
  horaInicio?: string | null;

  @IsOptional()
  @IsString()
  horaHasta?: string | null;

  @IsOptional()
  @IsString()
  horaFin?: string | null;

  @IsOptional()
  @IsString()
  fechaDesde?: string | null;

  @IsOptional()
  @IsString()
  fechaInicio?: string | null;

  @IsOptional()
  @IsString()
  fechaHasta?: string | null;

  @IsOptional()
  @IsString()
  fechaFin?: string | null;

  @IsOptional()
  @IsArray()
  canales?: string[] | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsos?: number | null;

  @IsOptional()
  @IsBoolean()
  noSumaBeneficios?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarEnSaludoBot?: boolean;

  @IsOptional()
  @IsBoolean()
  soloPrimeraCompra?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  imagenArchivoId?: string | number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboPrecioDto)
  tamanos?: ComboPrecioDto[];

  @IsOptional()
  @IsArray()
  combosPrecios?: any[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboParteDto)
  partes?: ComboParteDto[];

  @IsOptional()
  @IsArray()
  combosPartes?: any[];
}
