// stub: lo reemplaza el agente del detalle
export interface DetalleVentaModalProps {
  pedidoId: string;
  alCerrar: () => void;
}

export function DetalleVentaModal({ alCerrar }: DetalleVentaModalProps) {
  return (
    <div role="dialog" aria-label="Detalle de la venta">
      <button type="button" onClick={alCerrar}>Cerrar</button>
    </div>
  );
}
