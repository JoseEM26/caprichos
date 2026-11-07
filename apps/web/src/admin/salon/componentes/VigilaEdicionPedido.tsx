import { useEventos } from '../../../comun/socket';

/**
 * Escucha, mientras el editor de un pedido está abierto, si otra persona abre su editor (pedido:editando) o guarda
 * el pedido (pedido:editado). No dibuja nada. Vive aparte para que el modal solo se suscriba al socket al editar.
 */
export function VigilaEdicionPedido({
  pedidoId,
  alOtroEdita,
  alOtroGuardo,
}: {
  pedidoId: string;
  /** Nombre de quien lo está editando, o null si ya lo soltó. */
  alOtroEdita: (nombre: string | null) => void;
  alOtroGuardo: (version: number) => void;
}) {
  useEventos('pedido:editando', (d: { id: string; activo: boolean; nombre?: string }) => {
    if (String(d?.id) !== pedidoId) return;
    alOtroEdita(d.activo ? (d.nombre ?? 'Alguien') : null);
  });
  useEventos('pedido:editado', (d: { id: string; version?: number }) => {
    if (String(d?.id) !== pedidoId || typeof d.version !== 'number') return;
    alOtroGuardo(d.version);
  });
  return null;
}
