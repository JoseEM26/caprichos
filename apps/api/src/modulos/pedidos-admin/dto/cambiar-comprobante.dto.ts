import { IsIn, IsOptional, IsString } from 'class-validator';

/** Comprobante que pide Caja antes de cobrar: boleta o factura. Boleta: DNI opcional (8 dígitos). Factura: RUC y razón social. */
export class CambiarComprobanteDto {
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
}
