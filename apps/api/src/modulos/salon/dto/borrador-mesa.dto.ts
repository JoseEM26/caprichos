import { IsInt, IsObject, Max, Min } from 'class-validator';

export class GuardarBorradorMesaDto {
  /** Todo lo que el modal necesita para restaurarse (líneas, cliente, nota, cupón, personas, pago). */
  @IsObject()
  contenido!: Record<string, unknown>;

  /** Cantidad de productos, solo para mostrarla en las tarjetas. */
  @IsInt()
  @Min(0)
  @Max(999)
  productos!: number;
}
