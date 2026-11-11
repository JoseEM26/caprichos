import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListarConversacionesDto {
  @IsOptional()
  @IsIn(['todos', 'atender', 'bot', 'atendidos', 'novistos', 'reprogramar'])
  filtro?: 'todos' | 'atender' | 'bot' | 'atendidos' | 'novistos' | 'reprogramar';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['faltan', 'procesados'])
  pos?: 'faltan' | 'procesados';

  /** Cursor de la página anterior (`siguienteCursor`). Sin él, la primera página. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  /** 'todos' (por defecto), 'hoy', 'ayer', 'manana' o un día de Lima AAAA-MM-DD. */
  @IsOptional()
  @Matches(/^(todos|hoy|ayer|manana|\d{4}-\d{2}-\d{2})$/)
  dia?: string;

  @IsOptional()
  @IsIn(['1'])
  soloBloqueados?: '1';

  /** Solo para `fila`: clave del último chat ya cargado (para saber si el chat cae dentro de lo cargado). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  hasta?: string;
}

export class AtendidoDto {
  @IsOptional()
  @IsBoolean()
  confirmar?: boolean;
}

export class ImagenDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024, { message: 'El subtítulo es demasiado largo' })
  subtitulo?: string;
}

export class DocumentoDto {
  /** Nombre original en UTF-8 (multer lo entrega mal codificado cuando tiene tildes). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;
}

export class TextoDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe un mensaje' })
  @MaxLength(1000, { message: 'El mensaje es demasiado largo' })
  texto!: string;

  /** Identificador que genera la web por mensaje: el mismo id dos veces no envía dos veces (idempotencia). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idCliente?: string;
}

export class AnterioresDto {
  /** Id del mensaje más antiguo que la web ya tiene: se piden los anteriores a ese. */
  @IsString()
  @MaxLength(20)
  antes!: string;
}

export class TomarDto {
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}

export class EditarNombreContactoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 60, { message: 'El nombre debe tener entre 2 y 60 caracteres' })
  @Matches(/\S+/, { message: 'El nombre no puede consistir únicamente en espacios' })
  nombre?: string;

  @IsOptional()
  @IsBoolean({ message: 'revertir debe ser un booleano' })
  revertir?: boolean;
}

export class RechazarPagoDto {
  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @MaxLength(300, { message: 'El motivo es demasiado largo' })
  motivo?: string;
}

export class RechazarCambioDto {
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @Length(3, 300, { message: 'El motivo debe tener entre 3 y 300 caracteres' })
  motivo!: string;
}

/** Plantilla de respuesta rápida (los límites finos y la limpieza del texto los aplica el servicio). */
export class PlantillaRespuestaDto {
  @IsOptional()
  @IsString({ message: 'El título debe ser texto' })
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString({ message: 'El texto debe ser texto' })
  @MaxLength(4096, { message: 'El texto es demasiado largo' })
  texto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoria?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class OrdenPlantillasDto {
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  ids!: string[];
}
