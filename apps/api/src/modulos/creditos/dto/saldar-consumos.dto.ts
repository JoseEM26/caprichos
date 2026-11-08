import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaldarConsumosDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  consumoIds?: Array<string | number>;

  /** Alternativa a consumoIds: los pedidos del personal cuyo consumo se salda (p. ej. «Pagar ahora» al crear el pedido). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  pedidoIds?: Array<string | number>;

  @IsString()
  @IsNotEmpty({ message: 'Elige con qué paga el trabajador' })
  medio!: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class MarcarPlanillaDto {
  @IsString()
  @IsNotEmpty()
  desde!: string;

  @IsString()
  @IsNotEmpty()
  hasta!: string;

  @IsOptional()
  partyId?: string | number;

  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  motivo!: string;
}
