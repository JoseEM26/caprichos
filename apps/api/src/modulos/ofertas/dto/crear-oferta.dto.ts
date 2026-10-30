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
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'esDescuentoValorValido', async: false })
export class EsDescuentoValorValidoConstraint implements ValidatorConstraintInterface {
  validate(valor: any, args: ValidationArguments) {
    if (valor === undefined || valor === null) return true;
    if (typeof valor !== 'number' || isNaN(valor)) return false;
    const objeto = args.object as any;
    const tipo = objeto.descuentoTipo;
    if (tipo === 'PORCENTAJE') {
      return valor >= 1 && valor <= 100;
    }
    if (tipo === 'MONTO' || tipo === 'MONTO_FIJO') {
      return valor > 0 && valor <= 9999.99;
    }
    return valor > 0;
  }

  defaultMessage(args: ValidationArguments) {
    const objeto = args.object as any;
    const tipo = objeto.descuentoTipo;
    if (tipo === 'PORCENTAJE') {
      return 'El porcentaje de descuento debe estar entre 1 y 100';
    }
    if (tipo === 'MONTO' || tipo === 'MONTO_FIJO') {
      return 'El monto de descuento debe ser mayor que 0 y máximo 9999.99';
    }
    return 'El valor del descuento debe ser mayor a 0';
  }
}

export class ComboPrecioDto {
  @IsOptional()
  tamanoValorId?: string | number;

  @IsOptional()
  @IsString()
  tamanoNombre?: string;

  @IsNumber({}, { message: 'El precio debe ser un número válido' })
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  precio!: number;
}

export class ComboParteDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  tipoParte?: string;

  @IsIn(['A_ELECCION', 'UNA_DE', 'FIJO'], { message: 'Tipo de parte no válido' })
  tipo!: 'A_ELECCION' | 'UNA_DE' | 'FIJO';

  @IsInt({ message: 'La cantidad debe ser un entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  cantidad!: number;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsArray({ message: 'categorias debe ser un arreglo' })
  categorias?: (string | number)[];

  @IsOptional()
  @IsArray({ message: 'productos debe ser un arreglo' })
  productos?: (string | number)[];

  /** Solo FIJO: plan B, plan C... en orden. Sin repetir ni incluir el principal. */
  @IsOptional()
  @IsArray({ message: 'reemplazos debe ser un arreglo' })
  reemplazos?: (string | number)[];
}

export class CrearOfertaDto {
  @IsIn(['COMBO', 'LLEVA_PAGA', 'DESCUENTO', 'DESCUENTO_AUTOMATICO'], { message: 'Tipo de oferta no válido' })
  tipo!: 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO' | 'DESCUENTO_AUTOMATICO';

  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  lleva?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paga?: number;

  @IsOptional()
  alcanceCategoriaId?: string | number | null;

  @IsOptional()
  alcanceProductoId?: string | number | null;

  @IsOptional()
  @IsIn(['PORCENTAJE', 'MONTO', 'MONTO_FIJO'], { message: 'descuentoTipo debe ser PORCENTAJE o MONTO' })
  descuentoTipo?: 'PORCENTAJE' | 'MONTO' | 'MONTO_FIJO';

  @IsOptional()
  @IsNumber({}, { message: 'descuentoValor debe ser un número' })
  @Validate(EsDescuentoValorValidoConstraint)
  descuentoValor?: number;

  @IsOptional()
  @IsNumber({}, { message: 'compraMinima debe ser un número' })
  @Min(0, { message: 'La compra mínima debe ser mayor o igual a 0' })
  compraMinima?: number;

  @IsOptional()
  @IsArray({ message: 'dias debe ser un arreglo de números (1..7)' })
  dias?: number[];

  @IsOptional()
  @IsArray()
  diasSemana?: number[];

  @IsOptional()
  @IsString()
  horaDesde?: string;

  @IsOptional()
  @IsString()
  horaInicio?: string;

  @IsOptional()
  @IsString()
  horaHasta?: string;

  @IsOptional()
  @IsString()
  horaFin?: string;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaInicio?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  fechaFin?: string;

  @IsOptional()
  @IsArray()
  canales?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsos?: number;

  @IsOptional()
  @IsBoolean()
  noSumaBeneficios?: boolean;

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
