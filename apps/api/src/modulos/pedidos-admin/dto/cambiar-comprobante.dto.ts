import { IsIn, IsOptional, IsString } from 'class-validator';

/** Comprobante que pide Caja antes de cobrar: boleta o factura. Boleta: DNI opcional (8 dígitos). Factura: RUC y razón social. */
export class CambiarComprobanteDto {
  @IsIn(['BOLETA', 'FACTURA'], { message: 'Elige boleta o factura' })
  tipo!: 'BOLETA' | 'FACTURA';

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
