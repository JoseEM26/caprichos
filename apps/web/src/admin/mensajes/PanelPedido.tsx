import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { DetalleConversacion } from './mensajesTipos';

export interface PanelPedidoProps {
  detalle: DetalleConversacion;
  tieneVouchersVer: boolean;
  onAplicarCambio: () => void;
  onAbrirRechazarCambio: () => void;
  onAprobarPago: () => void;
  onRechazarPago: () => void;
  onRecargar: (id: string) => void;
}

/** Cambio, reserva, pedido y pago: zona propia con su scroll para no aplastar la conversación. */
export function PanelPedido({
  detalle,
  tieneVouchersVer,
  onAplicarCambio,
  onAbrirRechazarCambio,
  onAprobarPago,
  onRechazarPago,
  onRecargar,
}: PanelPedidoProps) {
  return (
    <div className="cv-panels">
      {/* Solicitud de cambio si existe */}
      {detalle.solicitud && (
        <div className="cv-order" style={{ borderLeftColor: '#E67929' }} data-testid="seccion-solicitud-cambio">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <b style={{ color: '#C05621' }}>
              Solicitud de {detalle.solicitud.tipo === 'DIRECCION' ? 'cambio de dirección' : detalle.solicitud.tipo === 'CANCELAR' ? 'cancelación' : 'cambio de pedido'}
            </b>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                background: detalle.solicitud.estadoSolicitud === 'APLICADA' ? '#D1FAE5' : detalle.solicitud.estadoSolicitud === 'RECHAZADA' ? '#FEE2E2' : '#FEF3C7',
                color: detalle.solicitud.estadoSolicitud === 'APLICADA' ? '#065F46' : detalle.solicitud.estadoSolicitud === 'RECHAZADA' ? '#991B1B' : '#92400E',
              }}
            >
              {detalle.solicitud.estadoSolicitud || 'PENDIENTE'}
            </span>
          </div>
          <div><b>Detalle:</b> {detalle.solicitud.detalle}</div>
          {detalle.solicitud.nuevaDireccion && (
            <div style={{ marginTop: '2px' }}>
              <b>Nueva dirección:</b> {detalle.solicitud.nuevaDireccion}
            </div>
          )}
          {detalle.solicitud.nuevaReferencia && (
            <div style={{ color: '#54656F', fontSize: '13px' }}>
              Ref: {detalle.solicitud.nuevaReferencia}
            </div>
          )}
          {detalle.solicitud.nuevaZonaNombre && (
            <div style={{ marginTop: '2px', fontSize: '13px', color: '#1E293B' }}>
              <b>Zona:</b> {detalle.solicitud.nuevaZonaNombre}
              {detalle.solicitud.recargoEnvio !== undefined && detalle.solicitud.recargoEnvio !== null && detalle.solicitud.recargoEnvio > 0 ? (
                <span style={{ color: '#C05621', fontWeight: 600 }}>
                  {' '}(Recargo: +s/ {Number(detalle.solicitud.recargoEnvio).toFixed(2)} · Envío nuevo: s/ {Number(detalle.solicitud.nuevoEnvio || 0).toFixed(2)})
                </span>
              ) : null}
            </div>
          )}
          <div style={{ color: '#54656F', fontSize: '12px', marginTop: '4px' }}>
            Pedido {detalle.solicitud.pedido} · Estado pedido: {detalle.solicitud.estadoPedido} · Solicitado a las {detalle.solicitud.hora}
          </div>
          {(!detalle.solicitud.estadoSolicitud || detalle.solicitud.estadoSolicitud === 'PENDIENTE') && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button className="cv-ok" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={onAplicarCambio}>
                Aplicar cambio
              </button>
              <button className="cv-no" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={onAbrirRechazarCambio}>
                Rechazar cambio
              </button>
            </div>
          )}
        </div>
      )}

      {/* Solicitud de reserva si existe */}
      {detalle.solicitudReserva && (
        <div className="cv-order" style={{ borderLeftColor: '#E67929' }}>
          <b>Solicitud de reserva pendiente</b>
          <div>
            {detalle.solicitudReserva.personas} personas · {detalle.solicitudReserva.fecha} a las {detalle.solicitudReserva.hora}
          </div>
          {detalle.solicitudReserva.nota && (
            <div style={{ fontSize: '13px', color: '#54656F' }}>
              Nota: {detalle.solicitudReserva.nota}
            </div>
          )}
          <div style={{ marginTop: '6px' }}>
            <a
              href="/admin/reservas"
              style={{
                color: 'var(--cp-navy)',
                fontWeight: 700,
                textDecoration: 'underline',
                fontSize: '13px',
              }}
            >
              Ver y gestionar en Reservas
            </a>
          </div>
        </div>
      )}

      {/* Pedido armado si existe */}
      {detalle.pedido && (
        <div className="cv-order">
          <b>Pedido armado</b>
          {detalle.pedido.lineas.map((linea, idx) => (
            <div key={idx}>{linea}</div>
          ))}
          <div className="cv-total">Total s/ {detalle.pedido.total}</div>
        </div>
      )}

      {/* Acciones de Validar Pago */}
      {detalle.estado === 'validar' && detalle.pedido && (
        <div className="cv-pay">
          <div className="cv-paynote">
            {detalle.altaDemanda
              ? `Alta demanda activa: el tiempo prometido es de ${detalle.tiempoPrometidoMin || 25} minutos.`
              : `Tiempo prometido: ${detalle.tiempoPrometidoMin || 25} minutos.`}
          </div>

          {/* Lectura del voucher con IA si existe voucher en la conversación */}
          {detalle.voucher?.archivoId && tieneVouchersVer && (
            <FotoAmpliable archivoId={detalle.voucher.archivoId} alt="Comprobante de pago" alturaMaxima={220} />
          )}
          {detalle.voucher && (
            <TarjetaLecturaVoucher voucher={detalle.voucher} pedido={detalle.pedido} puedeVer={tieneVouchersVer} />
          )}
          {detalle.voucher && (
            <ReasignarVoucherBoton voucherId={detalle.voucher.id} onReasignado={() => onRecargar(detalle.id)} />
          )}
          {!detalle.voucher && detalle.pedido && (
            <div className="cv-paynote" data-testid="sin-voucher-pedido">
              Aún no envió el voucher de {detalle.pedido.codigo}.
            </div>
          )}

          <div className="cv-payb">
            <button className="cv-ok" onClick={onAprobarPago}>
              Aprobar el pago
            </button>
            <button className="cv-no" onClick={onRechazarPago}>
              Rechazar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
