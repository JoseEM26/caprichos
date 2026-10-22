import { IsOptional, IsString } from 'class-validator';

export class ComandasQueryDto {
  // sin área: vista general con las comandas de todas las áreas
  @IsOptional()
  @IsString()
  area?: string;
}
