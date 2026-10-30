import { IsOptional, IsString } from 'class-validator';

export class CrearLlaveDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena' })
  nombre?: string;
}
