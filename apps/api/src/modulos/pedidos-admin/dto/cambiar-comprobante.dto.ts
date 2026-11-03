import { IsIn, IsOptional, IsString } from 'class-validator';

/** Comprobante que pide Caja antes de cobrar. Boleta: DNI opcional (8 dígitos). Factura: RUC y razón social. */
export class CambiarComprobanteDto {
  @IsIn(['NOTA_VENTA', 'BOLETA', 'FACTURA'], { message: 'El comprobante debe ser nota de venta, boleta o factura' })
  tipo!: 'NOTA_VENTA' | 'BOLETA' | 'FACTURA';

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
