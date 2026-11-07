import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PruebaImpresionDto {
  @IsIn(['ETIQUETERA', 'TICKETERA'], { message: 'Máquina de prueba inválida (ETIQUETERA o TICKETERA)' })
  rol!: 'ETIQUETERA' | 'TICKETERA';

  /** Impresora concreta del equipo del local (de la lista que informa el programa). Sin ella, prueba la configurada. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  impresoraId?: string;

  /** Computadora (DeviceKey) a la que pertenece la impresora: la prueba y la elección son POR máquina. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  equipoId?: string;
}

export class PruebaTodasDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  equipoId?: string;
}

export class ElegirImpresoraDto {
  @IsIn(['ETIQUETERA', 'TICKETERA'], { message: 'Máquina inválida (ETIQUETERA o TICKETERA)' })
  rol!: 'ETIQUETERA' | 'TICKETERA';

  @IsString()
  @IsNotEmpty({ message: 'Elige una impresora' })
  @MaxLength(300)
  impresoraId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  equipoId?: string;
}
