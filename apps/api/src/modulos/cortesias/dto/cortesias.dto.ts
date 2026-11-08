import { IsArray, IsInt, IsIn, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { MOTIVOS_CORTESIA, MOTIVOS_CORTESIA_ANTERIORES } from '../cortesia.tipos';

const CODIGOS_MOTIVO = MOTIVOS_CORTESIA.map((m) => m.codigo);
const CODIGOS_FILTRO = [...CODIGOS_MOTIVO, ...MOTIVOS_CORTESIA_ANTERIORES.map((m) => m.codigo)];

/** Cortesía por separado: sin pedido propio; el pedido de referencia es obligatorio. */
export class RegistrarCortesiaDto {
  @IsNotEmpty({ message: 'Elige el producto' })
  productoId!: number | string;

  @IsOptional()
  tamanoId?: number | string;

  /** Producto por sabor: el sabor que se regala. */
  @IsOptional()
  saborId?: number | string;

  @IsOptional()
  @IsArray()
  sabores?: { saborId: number | string; cantidad: number }[];

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad!: number;

  @IsIn(CODIGOS_MOTIVO, { message: 'Elige el motivo de la cortesía' })
  motivo!: string;

  @IsOptional()
  @IsString()
  nota?: string;

  @IsNotEmpty({ message: 'Indica el pedido al que corresponde la cortesía' })
  pedidoReferenciaId!: number | string;
}

/** Cortesía sobre una línea ya creada (o al armar el pedido): motivo y nota. */
export class DarCortesiaLineaDto {
  @IsIn(CODIGOS_MOTIVO, { message: 'Elige el motivo de la cortesía' })
  motivo!: string;

  @IsOptional()
  @IsString()
  nota?: string;
}

export class FiltroCortesiasDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha desde debe ser AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha hasta debe ser AAAA-MM-DD' })
  hasta?: string;

  @IsOptional()
  @IsIn(CODIGOS_FILTRO)
  motivo?: string;

  @IsOptional()
  productoId?: string;
}
