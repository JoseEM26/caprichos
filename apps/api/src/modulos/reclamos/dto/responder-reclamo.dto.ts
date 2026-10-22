import { IsString, MinLength } from 'class-validator';

export class ResponderReclamoDto {
  @IsString()
  @MinLength(20, {
    message: 'La respuesta debe tener al menos 20 caracteres',
  })
  respuesta!: string;
}
