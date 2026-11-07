import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TomarTrabajosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  max?: number = 10;

  /** Roles que el agente puede imprimir ahora (su impresora está lista). Sin roles: todos. */
  @IsOptional()
  @IsArray()
  @IsIn(['ETIQUETERA', 'TICKETERA'], { each: true })
  roles?: ('ETIQUETERA' | 'TICKETERA')[];

  /** El programa sabe imprimir pruebas dirigidas a una impresora concreta: recibe también esas, aunque no haya máquina lista. */
  @IsOptional()
  @IsBoolean()
  pruebas?: boolean;
}
