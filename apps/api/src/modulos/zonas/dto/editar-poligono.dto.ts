import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Coordenada } from '../zonas.tipos';

export class EditarPoligonoDto {
  @IsArray({ message: 'El polígono debe ser un arreglo de puntos [lat, lng]' })
  @IsNotEmpty({ message: 'El polígono es requerido' })
  poligono!: Coordenada[];

  /** Motivo para el historial (p. ej. «Pegado automático»). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  motivo?: string;
}
