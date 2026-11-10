import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class FeriadosQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) anio?: number;
}

export class FeriadoCrearDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
  @IsString() @MinLength(2) @MaxLength(120) nombre!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) recargo?: number;
}

export class FeriadoEditarDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nombre?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) recargo?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
