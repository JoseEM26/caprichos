import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Revertir un pedido anulado (POST /admin/pedidos/:id/revertir-anulacion). El servicio exige el motivo (≥5). */
export class RevertirAnulacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
