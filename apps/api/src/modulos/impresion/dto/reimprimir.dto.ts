import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReimprimirDto {
  @IsNotEmpty({ message: 'El tipo de etiqueta es obligatorio' })
  @IsIn(
    ['TODAS', 'general', 'area', 'bebida', 'ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'ticket', 'TICKET_PAGO'],
    {
      message: 'Tipo de etiqueta inválido (TODAS, general, area o bebida)',
    },
  )
  tipo!: string;

  @IsOptional()
  area_id?: string | number;

  @IsOptional()
  indice?: number;

  /** Clave de una sola etiqueta del pedido: GENERAL, AREA:<nombre> o BEBIDA:<indice>. */
  @IsOptional()
  @IsString()
  clave?: string;

  /** Salta las reglas de modalidad y activos (decisión explícita; por defecto la reimpresión las respeta). */
  @IsOptional()
  @IsBoolean({ message: 'forzar debe ser verdadero o falso' })
  forzar?: boolean;
}

/** Reimpresión rápida de un pedido desde Caja: stickers y/o tickets, de cualquier pedido (también cerrado). */
export class ReimprimirPedidoDto {
  @IsIn(['todo', 'stickers', 'ticket_cocina', 'ticket_pago'], { message: 'Qué reimprimir: todo, stickers, ticket_cocina o ticket_pago' })
  tipo!: 'todo' | 'stickers' | 'ticket_cocina' | 'ticket_pago';

  /** Solo con tipo `stickers`: cuáles. Por defecto, todos. */
  @IsOptional()
  @IsIn(['todos', 'general', 'area', 'bebida'], { message: 'Stickers: todos, general, area o bebida' })
  sub?: 'todos' | 'general' | 'area' | 'bebida';

  /** Solo calcula y devuelve qué se imprimiría y dónde (para el «¿Seguro?»); no encola nada. */
  @IsOptional()
  @IsBoolean()
  vista_previa?: boolean;

  /** Pedido ANULADO o RECHAZADO: confirmación reforzada obligatoria para imprimir. */
  @IsOptional()
  @IsBoolean()
  confirmar_anulado?: boolean;

  /** Anula conscientemente el aviso de «ya se envió hace N s» (reimpresión idéntica repetida en 15 s). */
  @IsOptional()
  @IsBoolean()
  otra_copia?: boolean;
}

/** Reimpresión desde la cola: lista de trabajos o un grupo de fallidos de una máquina. */
export class ReimprimirTrabajosDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Máximo 30 papeles a la vez' })
  ids?: Array<string | number>;

  @IsOptional()
  @IsIn(['STICKERS_FALLIDOS', 'TICKETS_FALLIDOS'], { message: 'Grupo no válido' })
  grupo?: string;
}
