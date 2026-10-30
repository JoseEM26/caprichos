import { IsString, Matches } from 'class-validator';

export class AsignarPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe contener exactamente 6 dígitos numéricos' })
  pin!: string;
}
