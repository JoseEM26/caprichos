import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegistrarPagoDto {
  @IsString()
  @IsNotEmpty({ message: 'El método de pago es requerido' })
  metodo!: string;

  @IsString()
  @IsIn(['COORDINADO', 'PAGADO'], {
    message: 'El estado del pago debe ser COORDINADO o PAGADO',
  })
  estado!: 'COORDINADO' | 'PAGADO';
}
