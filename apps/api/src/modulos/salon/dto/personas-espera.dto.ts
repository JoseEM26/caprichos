import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PersonasEsperaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  personas?: number;
}
