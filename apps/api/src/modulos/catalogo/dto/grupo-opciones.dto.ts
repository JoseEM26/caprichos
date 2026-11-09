import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'esMayorOIgualQueMinimo', async: false })
export class EsMayorOIgualQueMinimoConstraint implements ValidatorConstraintInterface {
  validate(maximo: number, args: ValidationArguments) {
    const objeto = args.object as any;
    if (objeto.minimo !== undefined && maximo !== undefined) {
      return maximo >= objeto.minimo;
    }
    return true;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'El valor máximo debe ser mayor o igual que el mínimo';
  }
}

export class CrearGrupoOpcionesDto {
  @IsString({ message: 'El nombre del grupo debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del grupo es requerido' })
  nombre!: string;

  @IsOptional()
  listaId?: string | number;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsInt({ message: 'El mínimo debe ser un número entero' })
  @Min(0, { message: 'El mínimo debe ser mayor o igual a 0' })
  minimo: number = 0;

  @IsInt({ message: 'El máximo debe ser un número entero' })
  @Min(0, { message: 'El máximo debe ser mayor o igual a 0' })
  @Validate(EsMayorOIgualQueMinimoConstraint)
  maximo: number = 1;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarGrupoOpcionesDto {
  @IsOptional()
  @IsString({ message: 'El nombre del grupo debe ser texto' })
  nombre?: string;

  @IsOptional()
  listaId?: string | number;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsInt({ message: 'El mínimo debe ser un número entero' })
  @Min(0, { message: 'El mínimo debe ser mayor o igual a 0' })
  minimo?: number;

  @IsOptional()
  @IsInt({ message: 'El máximo debe ser un número entero' })
  @Min(0, { message: 'El máximo debe ser mayor o igual a 0' })
  @Validate(EsMayorOIgualQueMinimoConstraint)
  maximo?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CrearOpcionDto {
  @IsString({ message: 'El nombre de la opción debe ser texto' })
  @IsNotEmpty({ message: 'El nombre de la opción es requerido' })
  nombre!: string;

  @IsOptional()
  @IsNumber({}, { message: 'El precio extra debe ser un número' })
  @Min(0, { message: 'El precio extra debe ser mayor o igual a 0' })
  precioExtra?: number;

  /** «Resaltar siempre en cocina»: la opción sale destacada en la comanda cada vez que alguien la elige. */
  @IsOptional()
  @IsBoolean({ message: 'Resaltar siempre debe ser verdadero o falso' })
  resaltarSiempre?: boolean;
}

export class ActualizarOpcionDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la opción debe ser texto' })
  nombre?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El precio extra debe ser un número' })
  @Min(0, { message: 'El precio extra debe ser mayor o igual a 0' })
  precioExtra?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
  /** «Resaltar siempre en cocina»: la opción sale destacada en la comanda cada vez que alguien la elige. */
  @IsOptional()
  @IsBoolean({ message: 'Resaltar siempre debe ser verdadero o falso' })
  resaltarSiempre?: boolean;
}
