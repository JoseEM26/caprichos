import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
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

/** Cambio de comprobante de un pedido ya cobrado: se aplica en el envío de la noche. */
export class CambiarComprobanteCobradoDto {
  @IsIn(['SIMPLE', 'BOLETA', 'FACTURA'], { message: 'Elige comprobante simple, boleta o factura' })
  tipo!: 'SIMPLE' | 'BOLETA' | 'FACTURA';

  @IsOptional()
  @IsString()
  doc?: string;

  @IsOptional()
  @IsString()
  razon?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsString({ message: 'El motivo es obligatorio' })
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

  /** si = boletas y facturas se emiten en la noche; no = al cobrar. Sin valor no cambia. */
  @IsOptional()
  @IsIn(['si', 'no'], { message: 'El envío nocturno es si o no' })
  envioNocturno?: 'si' | 'no';

  /** Hora Lima (HH:MM) desde la que corre el lote de la noche. Sin valor no cambia. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de envío va como HH:MM (ej. 23:00)' })
  horaEnvio?: string;

  /** Hora Lima (HH:MM) del resumen diario de boletas. Sin valor no cambia. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora del resumen va como HH:MM (ej. 23:30)' })
  horaResumen?: string;
}


/** Marca «Boleta electrónica por defecto» (ADMIN; la web pide Sí/No). Solo aplica con SUNAT real. */
export class BoletaPorDefectoDto {
  @IsBoolean({ message: 'La marca debe ser sí o no' })
  activo!: boolean;
}
