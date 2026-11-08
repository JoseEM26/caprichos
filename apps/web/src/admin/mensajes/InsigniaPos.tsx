import { PosChat } from './mensajesTipos';

const TEXTO: Record<PosChat['estado'], string> = {
  REGISTRADO: 'Pedido registrado',
  SIN_COBRAR: 'Pedido sin cobrar',
  SIN_PEDIDO: 'Sin pedido',
};

/** Insignia «procesado en el punto de venta». Con `enlace` lleva a Caja con ese pedido (en la lista va sin enlace: la fila ya es un botón). */
export function InsigniaPos({ pos, id, enlace = false }: { pos?: PosChat; id: string; enlace?: boolean }) {
  if (!pos) return null;
  const texto = pos.codigo ? `${TEXTO[pos.estado]} · ${pos.codigo}` : TEXTO[pos.estado];
  const comun = { className: 'msg-chip msg-chip-pos', 'data-pos': pos.estado, 'data-testid': `pos-${id}` } as const;
  if (enlace && pos.pedidoId) {
    return (
      <a {...comun} href={`/admin/caja?pedido=${pos.pedidoId}`} title="Abrir el pedido en Caja">
        {texto}
      </a>
    );
  }
  return <span {...comun}>{texto}</span>;
}
