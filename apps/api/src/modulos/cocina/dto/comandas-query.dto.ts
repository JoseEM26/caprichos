import { IsNotEmpty, IsString } from 'class-validator';

export class ComandasQueryDto {
  @IsNotEmpty({ message: 'El parámetro area es obligatorio' })
  @IsString()
  area!: string;
}
