import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ResolverFallaDto {
  @IsNotEmpty({ message: 'La nota de resolución es obligatoria' })
  @IsString()
  nota!: string;

  @IsOptional()
  @IsEnum(['REPROGRAMADO', 'DEVUELTO', 'COBRADO_IGUAL'], {
    message: 'El tipo de cierre debe ser REPROGRAMADO, DEVUELTO o COBRADO_IGUAL',
  })
  cierre?: 'REPROGRAMADO' | 'DEVUELTO' | 'COBRADO_IGUAL';

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El recargo no puede ser negativo' })
  recargo?: number;
}
