import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Volver atrás un pedido entregado (POST /admin/pedidos/:id/reabrir). El servicio exige el motivo (≥5). */
export class ReabrirPedidoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
