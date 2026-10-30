import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LIMITE_CUERPO_TEXTO } from '../chatbot-configuracion.tipos';

export class ActualizarTextosBotDto {
  @IsOptional()
  @IsString({ message: 'El texto de bienvenida debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto de bienvenida no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_bienvenida?: string;

  @IsOptional()
  @IsString({ message: 'El texto de despedida debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto de despedida no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_despedida?: string;

  @IsOptional()
  @IsString({ message: 'El texto de pase a persona debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto de pase a persona no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_pase_persona?: string;

  @IsOptional()
  @IsString({ message: 'El texto fuera de horario debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto fuera de horario no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_fuera_horario?: string;

  @IsOptional()
  @IsString({ message: 'El texto de repregunta debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto de repregunta no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_no_entiendo?: string;

  @IsOptional()
  @IsString({ message: 'El texto de derivación debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto de derivación no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_no_entiendo_derivacion?: string;

  @IsOptional()
  @IsString({ message: 'El texto de indicación de pago debe ser una cadena' })
  @MaxLength(LIMITE_CUERPO_TEXTO, {
    message: `El texto de indicación de pago no puede exceder ${LIMITE_CUERPO_TEXTO} caracteres de WhatsApp`,
  })
  chatbot_texto_indicacion_pago?: string;
}

export class RestablecerTextoBotDto {
  @IsNotEmpty({ message: 'La clave del texto a restablecer es obligatoria' })
  @IsString({ message: 'La clave debe ser una cadena de texto' })
  clave!: string;
}

export class ActualizarFuncionesBotDto {
  @IsOptional()
  @IsBoolean({ message: 'La función pedido debe ser un booleano' })
  pedido?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La función pago debe ser un booleano' })
  pago?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La función reservas debe ser un booleano' })
  reservas?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La función cambios debe ser un booleano' })
  cambios?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La función IA debe ser un booleano' })
  ia?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La función promociones debe ser un booleano' })
  promociones?: boolean;
}

export class ActualizarAntiSpamDto {
  @IsNotEmpty({ message: 'El límite máximo por minuto es obligatorio' })
  @IsNumber({}, { message: 'El límite máximo por minuto debe ser un número' })
  @Min(3, { message: 'El límite por minuto debe estar entre 3 y 60' })
  @Max(60, { message: 'El límite por minuto debe estar entre 3 y 60' })
  maxPorMinuto!: number;

  @IsNotEmpty({ message: 'El límite máximo por hora es obligatorio' })
  @IsNumber({}, { message: 'El límite máximo por hora debe ser un número' })
  @Min(10, { message: 'El límite por hora debe estar entre 10 y 600' })
  @Max(600, { message: 'El límite por hora debe estar entre 10 y 600' })
  maxPorHora!: number;
}

export class ActualizarRetencionDto {
  @IsNotEmpty({ message: 'El plazo de retención en días es obligatorio' })
  @IsNumber({}, { message: 'El plazo de retención debe ser un número entero' })
  @Min(7, { message: 'El plazo de retención debe ser de al menos 7 días' })
  @Max(730, { message: 'El plazo de retención no puede exceder 730 días (2 años)' })
  diasRetencion!: number;
}

export class BajaClienteDto {
  @IsNotEmpty({ message: 'El identificador o teléfono del cliente es obligatorio' })
  @IsString({ message: 'El identificador debe ser una cadena de texto' })
  identificador!: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  motivo?: string;
}

export class ExportarClienteQueryDto {
  @IsNotEmpty({ message: 'El identificador o teléfono del cliente es obligatorio' })
  @IsString({ message: 'El identificador debe ser una cadena de texto' })
  identificador!: string;
}
