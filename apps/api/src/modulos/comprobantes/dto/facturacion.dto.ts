import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Reintento de una boleta/factura: correcciones opcionales (los campos que no vienen no cambian). */
export class ReintentarComprobanteDto {
  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  razon?: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}

export class AnularComprobanteDto {
  @IsString({ message: 'motivo debe ser texto' })
  motivo!: string;
}

/** Parámetros de facturación electrónica editables por ADMIN (Configuración). */
export class ConfigFacturacionDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'El IGV debe ser un número' })
  @Min(0, { message: 'El IGV no puede ser negativo' })
  @Max(100, { message: 'El IGV no puede pasar de 100' })
  igvPct!: number;

  @IsString()
  @Matches(/^B[A-Z0-9]{3}$/, { message: 'La serie de boleta es B seguido de 3 caracteres (ej. B002)' })
  serieBoleta!: string;

  @IsString()
  @Matches(/^F[A-Z0-9]{3}$/, { message: 'La serie de factura es F seguido de 3 caracteres (ej. F002)' })
  serieFactura!: string;

  /** Proveedor de facturación electrónica. Sin credenciales, SUNAT cae a SIMULADO. */
  @IsOptional()
  @IsIn(['SIMULADO', 'SUNAT'], { message: 'El proveedor debe ser SIMULADO o SUNAT' })
  proveedor?: 'SIMULADO' | 'SUNAT';
}

