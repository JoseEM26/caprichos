import { IsArray, IsNotEmpty } from 'class-validator';
import { Coordenada } from '../zonas.tipos';

export class EditarPoligonoDto {
  @IsArray({ message: 'El polígono debe ser un arreglo de puntos [lat, lng]' })
  @IsNotEmpty({ message: 'El polígono es requerido' })
  poligono!: Coordenada[];
}
