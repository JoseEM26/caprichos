import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TipoIniciativa {
  QUEJA = 'QUEJA',
  MEJORA = 'MEJORA',
  IDEA = 'IDEA',
}

export enum AreaIniciativa {
  CARTA_WEB = 'CARTA_WEB',
  PEDIDOS_CAJA = 'PEDIDOS_CAJA',
  COCINA = 'COCINA',
  REPARTO = 'REPARTO',
  ALMACEN_COMPRAS = 'ALMACEN_COMPRAS',
  OTRO = 'OTRO',
}

export class CrearIniciativaDto {
  @IsEnum(TipoIniciativa, { message: 'El tipo debe ser QUEJA, MEJORA o IDEA' })
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  tipo!: TipoIniciativa;

  @IsEnum(AreaIniciativa, { message: 'El área debe ser una de las opciones permitidas' })
  @IsNotEmpty({ message: 'El área es obligatoria' })
  area!: AreaIniciativa;

  @IsString({ message: 'El título debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'Escribe un título corto' })
  @MaxLength(80, { message: 'El título no puede superar los 80 caracteres' })
  titulo!: string;

  @IsString({ message: 'El detalle debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'Cuéntanos qué pasa o qué propones' })
  @MaxLength(600, { message: 'El comentario no puede superar los 600 caracteres' })
  detalle!: string;

  @IsOptional()
  archivoId?: string | number | bigint | null;
}
