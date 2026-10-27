import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ACCESORIOS_VALIDOS,
  ESTILOS_CABELLO,
  HEX_COLOR_REGEX,
  MM_DD_REGEX,
  TIPOS_GORRO,
} from '../mascota.constantes';
import {
  AspectoBase,
  AspectoParcial,
  CabelloConfig,
  EstiloCabello,
  GorroConfig,
  ModoMascota,
  TemaMascota,
  TipoGorro,
  UniformeConfig,
} from '../mascota.tipos';

export class CabelloDto implements CabelloConfig {
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color de cabello debe tener formato hexadecimal #RRGGBB',
  })
  color!: string;

  @IsIn(ESTILOS_CABELLO, {
    message: `El estilo de cabello debe ser uno de: ${ESTILOS_CABELLO.join(', ')}`,
  })
  estilo!: EstiloCabello;
}

export class UniformeDto implements UniformeConfig {
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color principal del uniforme debe tener formato #RRGGBB',
  })
  principal!: string;

  @Matches(HEX_COLOR_REGEX, {
    message: 'El color del delantal debe tener formato #RRGGBB',
  })
  delantal!: string;

  @Matches(HEX_COLOR_REGEX, {
    message: 'El color del ribete debe tener formato #RRGGBB',
  })
  ribete!: string;
}

export class GorroDto implements GorroConfig {
  @IsIn(TIPOS_GORRO, {
    message: `El tipo de gorro debe ser uno de: ${TIPOS_GORRO.join(', ')}`,
  })
  tipo!: TipoGorro;

  @Matches(HEX_COLOR_REGEX, {
    message: 'El color del gorro debe tener formato #RRGGBB',
  })
  color!: string;
}

export class AspectoBaseDto implements AspectoBase {
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color de piel debe tener formato #RRGGBB',
  })
  piel!: string;

  @ValidateNested()
  @Type(() => CabelloDto)
  cabello!: CabelloDto;

  @Matches(HEX_COLOR_REGEX, {
    message: 'El color de ojos debe tener formato #RRGGBB',
  })
  ojos!: string;

  @ValidateNested()
  @Type(() => UniformeDto)
  uniforme!: UniformeDto;

  @ValidateNested()
  @Type(() => GorroDto)
  gorro!: GorroDto;

  @IsArray()
  @IsIn(ACCESORIOS_VALIDOS, {
    each: true,
    message: `Los accesorios deben pertenecer a la lista permitida: ${ACCESORIOS_VALIDOS.join(', ')}`,
  })
  accesorios!: string[];
}

export class CabelloParcialDto implements Partial<CabelloConfig> {
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color de cabello debe tener formato #RRGGBB',
  })
  color?: string;

  @IsOptional()
  @IsIn(ESTILOS_CABELLO, {
    message: `El estilo de cabello debe ser uno de: ${ESTILOS_CABELLO.join(', ')}`,
  })
  estilo?: EstiloCabello;
}

export class UniformeParcialDto implements Partial<UniformeConfig> {
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color principal debe tener formato #RRGGBB',
  })
  principal?: string;

  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color del delantal debe tener formato #RRGGBB',
  })
  delantal?: string;

  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color del ribete debe tener formato #RRGGBB',
  })
  ribete?: string;
}

export class GorroParcialDto implements Partial<GorroConfig> {
  @IsOptional()
  @IsIn(TIPOS_GORRO, {
    message: `El tipo de gorro debe ser uno de: ${TIPOS_GORRO.join(', ')}`,
  })
  tipo?: TipoGorro;

  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color del gorro debe tener formato #RRGGBB',
  })
  color?: string;
}

export class AspectoParcialDto implements AspectoParcial {
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color de piel debe tener formato #RRGGBB',
  })
  piel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CabelloParcialDto)
  cabello?: CabelloParcialDto;

  @IsOptional()
  @Matches(HEX_COLOR_REGEX, {
    message: 'El color de ojos debe tener formato #RRGGBB',
  })
  ojos?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UniformeParcialDto)
  uniforme?: UniformeParcialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GorroParcialDto)
  gorro?: GorroParcialDto;

  @IsOptional()
  @IsArray()
  @IsIn(ACCESORIOS_VALIDOS, {
    each: true,
    message: `Los accesorios deben pertenecer a la lista permitida: ${ACCESORIOS_VALIDOS.join(', ')}`,
  })
  accesorios?: string[];
}

export class TemaMascotaDto implements TemaMascota {
  @IsString()
  @Matches(/^[a-z0-9_]{2,30}$/, {
    message:
      'La clave del tema debe contener solo minúsculas, números o guiones bajos (2-30 caracteres)',
  })
  clave!: string;

  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-_.,]+$/, {
    message: 'El nombre contiene caracteres especiales no permitidos',
  })
  nombre!: string;

  @ValidateNested()
  @Type(() => AspectoParcialDto)
  aspecto!: AspectoParcialDto;

  @Matches(MM_DD_REGEX, {
    message: 'La fecha inicial "desde" debe tener formato MM-DD (ej: 10-24)',
  })
  desde!: string;

  @Matches(MM_DD_REGEX, {
    message: 'La fecha final "hasta" debe tener formato MM-DD (ej: 11-02)',
  })
  hasta!: string;

  @IsBoolean()
  activo!: boolean;
}

export class ActualizarMascotaConfigDto {
  @ValidateNested()
  @Type(() => AspectoBaseDto)
  base!: AspectoBaseDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemaMascotaDto)
  temas!: TemaMascotaDto[];

  @IsIn(['AUTOMATICO', 'MANUAL'], {
    message: 'El modo debe ser "AUTOMATICO" o "MANUAL"',
  })
  modo!: ModoMascota;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[a-z0-9_]{2,30}$|^normal$/, {
    message:
      'El tema manual debe ser "normal" o una clave válida de tema existente',
  })
  temaManual?: string;
}
