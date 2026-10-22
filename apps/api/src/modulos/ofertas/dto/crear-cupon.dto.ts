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
} from 'class-validator';

export class CrearCuponDto {
  @IsIn(['UNICO_COMPROBANTE', 'COMPARTIDO'], {
    message: 'modo debe ser UNICO_COMPROBANTE o COMPARTIDO',
  })
  modo!: 'UNICO_COMPROBANTE' | 'COMPARTIDO';

  @IsString({ message: 'El código base es obligatorio' })
  @IsNotEmpty({ message: 'El código base no puede estar vacío' })
  codigoBase!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsIn(['PORCENTAJE', 'MONTO'], { message: 'descuentoTipo debe ser PORCENTAJE o MONTO' })
  descuentoTipo!: 'PORCENTAJE' | 'MONTO';

  @IsNumber({}, { message: 'descuentoValor debe ser un número válido' })
  @Min(0, { message: 'descuentoValor debe ser mayor o igual a 0' })
  descuentoValor!: number;

  @IsOptional()
  @IsNumber({}, { message: 'compraMinima debe ser un número' })
  @Min(0)
  compraMinima?: number;

  @IsOptional()
  categoriaId?: string | number | null;

  @IsOptional()
  productoId?: string | number | null;

  @IsOptional()
  @IsArray()
  canales?: string[];

  @IsOptional()
  @IsBoolean()
  requiereCuenta?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  diasValidez?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  topeUsos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPorCliente?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
