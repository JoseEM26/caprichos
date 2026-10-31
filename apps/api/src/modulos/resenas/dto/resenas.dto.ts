import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class BuscarNegocioDto {
  @IsString()
  @Length(3, 120, { message: 'Escribe al menos 3 letras del nombre de tu local' })
  consulta!: string;
}

export class GuardarNegocioDto {
  @IsString()
  @Length(1, 60)
  businessId!: string;

  @IsString()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'El enlace del local debe ser una URL https' })
  @MaxLength(500)
  enlaceLocal?: string;
}

export class CargaInicialDto {
  @IsOptional()
  @IsBoolean()
  repetir?: boolean;
}

export class VisibleResenaDto {
  @IsBoolean({ message: 'visible debe ser verdadero o falso' })
  visible!: boolean;
}
