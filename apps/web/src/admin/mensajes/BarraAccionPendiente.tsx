import type { ReactNode } from 'react';
import { DetalleConversacion } from './mensajesTipos';

export interface BarraAccionPendienteProps {
  detalle: DetalleConversacion;
  onReabrirPlantilla: () => void;
  onAprobarPago: () => void;
  onRechazarPago: () => void;
  onAplicarCambio: () => void;
  onAbrirRechazarCambio: () => void;
}

const TIPO_CAMBIO: Record<string, string> = {
  DIRECCION: 'un cambio de dirección',
  CANCELAR: 'una cancelación',
};

/** Acciones que esperan una decisión del asesor, pegadas encima del cuadro para escribir. */
export function BarraAccionPendiente({
  detalle,
  onReabrirPlantilla,
  onAprobarPago,
  onRechazarPago,
  onAplicarCambio,
  onAbrirRechazarCambio,
}: BarraAccionPendienteProps) {
  const filas: ReactNode[] = [];

  if (detalle.ventanaAbierta === false) {
    filas.push(
      <div className="msg-accion" key="ventana">
        <span className="msg-accion-etiqueta">Acción pendiente</span>
        <span className="msg-accion-texto">
          Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada.
        </span>
        <div className="msg-accion-botones">
          <button type="button" className="msg-accion-neutro" onClick={onReabrirPlantilla}>
            Reabrir con plantilla
          </button>
        </div>
      </div>,
    );
  }

  if (detalle.estado === 'validar' && detalle.pedido) {
    filas.push(
      <div className="msg-accion" key="pago">
        <span className="msg-accion-etiqueta">Acción pendiente</span>
        <span className="msg-accion-texto">
          Revisa el comprobante: aprueba o rechaza el pedido {detalle.pedido.codigo}.
        </span>
        <div className="msg-accion-botones">
          <button type="button" className="msg-accion-ok" onClick={onAprobarPago}>
            Aprobar pago
          </button>
          <button type="button" className="msg-accion-no" onClick={onRechazarPago}>
            Rechazar pedido
          </button>
        </div>
      </div>,
    );
  }

  const solicitud = detalle.solicitud;
  if (solicitud && (!solicitud.estadoSolicitud || solicitud.estadoSolicitud === 'PENDIENTE')) {
    filas.push(
      <div className="msg-accion" key="cambio" data-testid="barra-cambio-pendiente">
        <span className="msg-accion-etiqueta">Acción pendiente</span>
        <span className="msg-accion-texto">
          Pide {TIPO_CAMBIO[solicitud.tipo] ?? 'un cambio de pedido'} en el pedido {solicitud.pedido}.
        </span>
        <div className="msg-accion-botones">
          <button type="button" className="msg-accion-ok" onClick={onAplicarCambio}>
            Aplicar cambio
          </button>
          <button type="button" className="msg-accion-no" onClick={onAbrirRechazarCambio}>
            Rechazar cambio
          </button>
        </div>
      </div>,
    );
  }

  if (filas.length === 0) return null;
  return (
    <section className="msg-acciones" aria-label="Acción pendiente">
      {filas}
    </section>
  );
}
