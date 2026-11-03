import { IsIn } from 'class-validator';

export class PruebaImpresionDto {
  @IsIn(['ETIQUETERA', 'TICKETERA'], { message: 'Máquina de prueba inválida (ETIQUETERA o TICKETERA)' })
  rol!: 'ETIQUETERA' | 'TICKETERA';
}
