import { IsBoolean, ValidateIf } from 'class-validator';

export class MisAjustesCocinaDto {
  /** true/false fija mi preferencia; null la quita y vuelve al valor general del local. */
  @ValidateIf((o) => o.confirmarDespejar !== null)
  @IsBoolean({ message: 'confirmarDespejar debe ser true, false o null' })
  confirmarDespejar!: boolean | null;
}
