import { montoElegiblePuntos } from '../ofertas/puntos-elegibles.util';
import { partyClienteDelPedido } from './cliente-del-pedido';

export type MotivoSinPuntos =
  | 'INVITADO'
  | 'CUPON'
  | 'SOLO_PROMOCION'
  | 'SIN_BENEFICIOS'
  | 'SIN_CUENTA_CLIENTE'
  | 'ANULADO'
  | 'CANJE_TOTAL'
  | 'NO_REGISTRADO';

export interface ExplicacionPuntos {
  estado: 'SUMADO' | 'PENDIENTE_DE_COBRO' | 'NO_SUMA';
  puntos?: number;
  estimado?: number;
  motivo?: MotivoSinPuntos;
  texto: string;
}

export interface PedidoParaPuntos {
  canal: string;
  party_id: bigint | null;
  cliente_party_id?: bigint | null;
  estado?: string | null;
  pago_estado?: string | null;
  cupon_id?: unknown;
  cupon_emitido_id?: unknown;
  puntos_ganados?: unknown;
  puntos_canjeados?: unknown;
  descuento_detalle?: unknown;
  lineas: {
    id?: bigint | string;
    producto_id?: bigint | string | null;
    subtotal?: unknown;
    precio_unit?: unknown;
    cantidad: number;
    oferta_id?: unknown;
    linea_combo_id?: unknown;
    producto?: { no_suma_beneficios?: boolean | null } | null;
  }[];
}

export interface ContextoPuntos {
  /** puntos_porcentaje (5 por defecto) */
  porcentaje: number;
  /** el cliente del pedido tiene rol CLIENTE activo */
  tieneRolCliente: boolean;
}

const redondear = (n: number) => Math.round(n * 100) / 100;
const pts = (n: number) => n.toFixed(2);

/** Explica, sin tocar la base, por qué un pedido suma (o no) puntos. Misma regla que PuntosService.acumularPorPedido. */
export function explicarPuntosPedido(pedido: PedidoParaPuntos, ctx: ContextoPuntos): ExplicacionPuntos {
  const ganados = Number(pedido.puntos_ganados ?? 0);
  if (ganados > 0) {
    return { estado: 'SUMADO', puntos: ganados, texto: `Sumó ${pts(ganados)} puntos al cobrarse el pedido` };
  }
  const no = (motivo: MotivoSinPuntos, texto: string): ExplicacionPuntos => ({ estado: 'NO_SUMA', motivo, texto });

  if (pedido.estado === 'ANULADO' || pedido.estado === 'RECHAZADO') {
    return no('ANULADO', 'Pedido anulado: no suma puntos');
  }
  if (!partyClienteDelPedido(pedido)) {
    return no('INVITADO', 'Se pidió como invitado: ingresa con tu celular para sumar puntos');
  }
  if (pedido.cupon_id || pedido.cupon_emitido_id) {
    return no('CUPON', 'Este pedido no suma puntos porque usaste un cupón');
  }
  if (!ctx.tieneRolCliente) {
    return no('SIN_CUENTA_CLIENTE', 'La persona no tiene una cuenta de cliente activa: no suma puntos');
  }

  const lineas = pedido.lineas.map((l) => ({
    productoId: l.producto_id ?? `linea-${l.id}`,
    subtotal: Number(l.subtotal ?? Number(l.precio_unit ?? 0) * l.cantidad),
    noSumaBeneficios: l.producto?.no_suma_beneficios ?? true,
    enPromocion: l.oferta_id != null || l.linea_combo_id != null,
  }));
  const elegible = montoElegiblePuntos(lineas, (pedido.descuento_detalle as any) ?? []);
  const base = Math.max(0, elegible - Number(pedido.puntos_canjeados ?? 0));
  const estimado = redondear(base * (ctx.porcentaje / 100));

  if (estimado <= 0) {
    if (elegible > 0) return no('CANJE_TOTAL', 'Pagaste todo con puntos: no queda monto para sumar puntos nuevos');
    if (lineas.length > 0 && lineas.every((l) => l.enPromocion)) {
      return no('SOLO_PROMOCION', 'Los combos y promociones no suman puntos');
    }
    return no('SIN_BENEFICIOS', 'Los productos de este pedido no suman puntos (promoción, descuento o marcados sin beneficios)');
  }
  if (pedido.pago_estado === 'PAGADO') {
    return {
      estado: 'NO_SUMA',
      motivo: 'NO_REGISTRADO',
      estimado,
      texto: `Pedido cobrado, pero los ${pts(estimado)} puntos no quedaron registrados: revisa con el administrador`,
    };
  }
  return {
    estado: 'PENDIENTE_DE_COBRO',
    estimado,
    texto: `Se sumarán ${pts(estimado)} puntos cuando Caja cobre tu pedido`,
  };
}
