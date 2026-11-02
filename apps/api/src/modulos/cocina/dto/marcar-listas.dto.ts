import { IsInt, Min } from 'class-validator';

export class MarcarListasDto {
  @IsInt({ message: 'Las unidades listas deben ser un número entero' })
  @Min(0, { message: 'Las unidades listas no pueden ser negativas' })
  listas!: number;
}
