import { IsIn, IsNotEmpty } from 'class-validator';

export class AgotarDto {
  @IsIn(['PRODUCTO', 'SABOR', 'OPCION'], {
    message: 'El tipo debe ser PRODUCTO, SABOR u OPCION',
  })
  @IsNotEmpty()
  tipo!: 'PRODUCTO' | 'SABOR' | 'OPCION';

  @IsNotEmpty({ message: 'El id es requerido' })
  id!: string | number;

  @IsIn(['HOY', 'HASTA_REACTIVAR'], {
    message: 'La duración debe ser HOY o HASTA_REACTIVAR',
  })
  @IsNotEmpty()
  duracion!: 'HOY' | 'HASTA_REACTIVAR';
}
