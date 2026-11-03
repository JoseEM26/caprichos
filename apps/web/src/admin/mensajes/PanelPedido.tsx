import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { SemaforoVoucher, VoucherResumenChat } from '../vouchers/tipos';
import { DetalleConversacion } from './mensajesTipos';
import { ESTADOS_LABEL, esUsuarioWhatsApp } from './utilidadesChat';

export interface PanelPedidoProps {
  detalle: DetalleConversacion;
  tieneVouchersVer: boolean;
  panelAbierto: boolean;
  onTogglePanel: () => void;
  onAplicarCambio: () => void;
  onAbrirRechazarCambio: () => void;
  onAprobarPago: () => void;
  onRechazarPago: () => void;
  onRecargar: (id: string) => void;
  onTomarChat: () => void;
  onSoltarChat: () => void;
}

const SEMAFORO: Record<SemaforoVoucher, { texto: string; color: string; fondo: string }> = {
  CONFIABLE: { texto: 'Confiable', color: '#1E5E36', fondo: '#E8F5E9' },
  OBSERVADO: { texto: 'Observado', color: '#6B4300', fondo: '#FFF4D6' },
  RARO: { texto: 'Raro', color: '#8A3A08', fondo: '#FFF0E6' },
  ILEGIBLE: { texto: 'Ilegible', color: '#37474F', fondo: '#ECEFF1' },
  SIN_LECTURA: { texto: 'Sin lectura', color: '#37474F', fondo: '#ECEFF1' },
};

/** Lectura del voucher en una tabla de una fila por dato. El detalle completo va plegado. */
function ResumenVoucher({ voucher, pedidoMedio, porRevisar }: { voucher: VoucherResumenChat; pedidoMedio?: string | null; porRevisar: boolean }) {
  const ext = voucher.extraido;
  const monto = ext?.monto !== undefined && ext?.monto !== null ? `s/ ${Number(ext.monto).toFixed(2)}` : 'No se leyó';
  const medio =
    ext?.medioDetectado && ext.medioDetectado !== 'OTRO' ? ext.medioDetectado : voucher.medio || pedidoMedio || 'No se leyó';
  const operacion = ext?.operacion || 'No se leyó';
  const sem = SEMAFORO[voucher.semaforo] ?? SEMAFORO.SIN_LECTURA;
  return (
    <>
      <div className="msg-dato">
        <span className="msg-dato-etiqueta">Monto</span>
        <span className="msg-dato-valor">{monto}</span>
      </div>
      <div className="msg-dato">
        <span className="msg-dato-etiqueta">Medio</span>
        <span className="msg-dato-valor">{medio}</span>
      </div>
      <div className="msg-dato">
        <span className="msg-dato-etiqueta">Operación</span>
        <span className="msg-dato-valor">{operacion}</span>
      </div>
      <div className="msg-dato">
        <span className="msg-dato-etiqueta">Estado</span>
        <span className="msg-dato-valor">
          <span className="msg-semaforo" style={{ color: sem.color, background: sem.fondo }} data-testid="badge-semaforo-voucher">
            {sem.texto}
            {porRevisar ? ' · por revisar' : ''}
          </span>
        </span>
      </div>
    </>
  );
}

/** Columna derecha: datos del cliente, pedido, comprobante y decisiones. Se pliega; en celular sale como hoja inferior. */
export function PanelPedido({
  detalle,
  tieneVouchersVer,
  panelAbierto,
  onTogglePanel,
  onAplicarCambio,
  onAbrirRechazarCambio,
  onAprobarPago,
  onRechazarPago,
  onRecargar,
  onTomarChat,
  onSoltarChat,
}: PanelPedidoProps) {
  const porRevisar = detalle.estado === 'validar' && Boolean(detalle.pedido);
  const solicitud = detalle.solicitud;
  const solicitudPendiente = Boolean(solicitud && (!solicitud.estadoSolicitud || solicitud.estadoSolicitud === 'PENDIENTE'));
  const tituloSolicitud = solicitud
    ? solicitud.tipo === 'DIRECCION'
      ? 'Cambio de dirección'
      : solicitud.tipo === 'CANCELAR'
      ? 'Cancelación'
      : 'Cambio de pedido'
    : '';

  return (
    <>
      <button
        type="button"
        className="msg-hoja-fondo"
        data-abierto={panelAbierto ? '1' : '0'}
        aria-label="Cerrar pedido y acciones"
        onClick={onTogglePanel}
      />
      <aside className="msg-panel" data-abierto={panelAbierto ? '1' : '0'} aria-label="Pedido y acciones">
        <div className="msg-panel-cab">
          <h2 className="msg-panel-titulo">Pedido y acciones</h2>
          <button
            type="button"
            className="msg-btn msg-plegar"
            aria-expanded={panelAbierto}
            aria-controls="msg-panel-cuerpo"
            onClick={onTogglePanel}
          >
            {panelAbierto ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <div className="msg-panel-cuerpo" id="msg-panel-cuerpo">
          {/* Cliente */}
          <section className="msg-seccion" aria-label="Datos del cliente">
            <span className="msg-seccion-titulo">Cliente</span>
            <div className="msg-dato">
              <span className="msg-dato-etiqueta">Nombre</span>
              <span className="msg-dato-valor">{detalle.nombre}</span>
            </div>
            <div className="msg-dato">
              <span className="msg-dato-etiqueta">Celular</span>
              <span className="msg-dato-valor">
                {esUsuarioWhatsApp(detalle) ? 'Usuario de WhatsApp' : detalle.telefono || 'Sin número'}
              </span>
            </div>
            {detalle.modalidad && (
              <div className="msg-dato">
                <span className="msg-dato-etiqueta">Entrega</span>
                <span className="msg-dato-valor">{detalle.modalidad}</span>
              </div>
            )}
            <div className="msg-dato">
              <span className="msg-dato-etiqueta">Estado del chat</span>
              <span className="msg-dato-valor">{ESTADOS_LABEL[detalle.estado]}</span>
            </div>
            <div className="msg-dato">
              <span className="msg-dato-etiqueta">Atiende</span>
              <span className="msg-dato-valor">
                {detalle.dueno ? (detalle.esMio ? 'Tú' : detalle.dueno) : 'Nadie: el bot atiende'}
              </span>
            </div>
            <button
              type="button"
              className="msg-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={detalle.esMio ? onSoltarChat : onTomarChat}
            >
              {detalle.esMio ? 'Soltar el chat' : 'Tomar el chat'}
            </button>
          </section>

          {/* Pedido */}
          <section className="msg-seccion" aria-label="Pedido">
            <span className="msg-seccion-titulo">Pedido</span>
            {detalle.pedido ? (
              <>
                <div className="msg-dato">
                  <span className="msg-dato-etiqueta">Código</span>
                  <span className="msg-dato-valor">{detalle.pedido.codigo}</span>
                </div>
                {solicitud && (
                  <div className="msg-dato">
                    <span className="msg-dato-etiqueta">Estado</span>
                    <span className="msg-dato-valor">{solicitud.estadoPedido}</span>
                  </div>
                )}
                <div className="msg-dato">
                  <span className="msg-dato-etiqueta">Medio de pago</span>
                  <span className="msg-dato-valor">{detalle.pedido.medio || 'Sin dato'}</span>
                </div>
                <ul className="msg-pedido-lineas">
                  {detalle.pedido.lineas.map((linea, idx) => (
                    <li key={idx}>{linea}</li>
                  ))}
                </ul>
                <div className="msg-total">Total s/ {detalle.pedido.total}</div>
              </>
            ) : (
              <span className="msg-panel-nota">Este chat no tiene un pedido armado.</span>
            )}
          </section>

          {/* Solicitud de cambio */}
          {solicitud && (
            <section className="msg-seccion msg-solicitud" data-testid="seccion-solicitud-cambio" aria-label="Solicitud de cambio">
              <span className="msg-seccion-titulo" style={{ color: '#8A4206' }}>
                Solicitud: {tituloSolicitud}
              </span>
              <div className="msg-dato">
                <span className="msg-dato-etiqueta">Estado</span>
                <span className="msg-dato-valor">{solicitud.estadoSolicitud || 'PENDIENTE'}</span>
              </div>
              <div>
                <b>Detalle:</b> {solicitud.detalle}
              </div>
              {solicitud.nuevaDireccion && (
                <div>
                  <b>Nueva dirección:</b> {solicitud.nuevaDireccion}
                </div>
              )}
              {solicitud.nuevaReferencia && <div className="msg-panel-nota">Ref: {solicitud.nuevaReferencia}</div>}
              {solicitud.nuevaZonaNombre && (
                <div>
                  <b>Zona:</b> {solicitud.nuevaZonaNombre}
                  {solicitud.recargoEnvio !== undefined && solicitud.recargoEnvio !== null && solicitud.recargoEnvio > 0 ? (
                    <span style={{ color: '#8A4206', fontWeight: 600 }}>
                      {' '}
                      (Recargo: +s/ {Number(solicitud.recargoEnvio).toFixed(2)} · Envío nuevo: s/ {Number(solicitud.nuevoEnvio || 0).toFixed(2)})
                    </span>
                  ) : null}
                </div>
              )}
              <div className="msg-panel-nota">
                Pedido {solicitud.pedido} · Solicitado a las {solicitud.hora}
              </div>
            </section>
          )}

          {/* Reserva */}
          {detalle.solicitudReserva && (
            <section className="msg-seccion msg-solicitud" aria-label="Solicitud de reserva">
              <span className="msg-seccion-titulo" style={{ color: '#8A4206' }}>
                Solicitud de reserva pendiente
              </span>
              <div>
                {detalle.solicitudReserva.personas} personas · {detalle.solicitudReserva.fecha} a las {detalle.solicitudReserva.hora}
              </div>
              {detalle.solicitudReserva.nota && <div className="msg-panel-nota">Nota: {detalle.solicitudReserva.nota}</div>}
              <a href="/admin/reservas" style={{ color: 'var(--cp-navy, #0B2C3E)', fontWeight: 700, fontSize: 14 }}>
                Ver y gestionar en Reservas
              </a>
            </section>
          )}

          {/* Comprobante: resumen; el detalle completo va plegado */}
          {(detalle.voucher || porRevisar) && (
            <section className="msg-seccion" aria-label="Comprobante de pago">
              <span className="msg-seccion-titulo">Comprobante</span>
              {detalle.voucher ? (
                <>
                  {tieneVouchersVer && detalle.voucher.archivoId && (
                    <div style={{ width: 160, maxWidth: '100%' }}>
                      <FotoAmpliable archivoId={detalle.voucher.archivoId} alt="Comprobante de pago" alturaMaxima={160} />
                    </div>
                  )}
                  {tieneVouchersVer && (
                    <>
                      <ResumenVoucher voucher={detalle.voucher} pedidoMedio={detalle.pedido?.medio} porRevisar={porRevisar} />
                      <details>
                        <summary>Ver la lectura completa</summary>
                        <TarjetaLecturaVoucher voucher={detalle.voucher} pedido={detalle.pedido} puedeVer={tieneVouchersVer} />
                      </details>
                    </>
                  )}
                  <ReasignarVoucherBoton voucherId={detalle.voucher.id} onReasignado={() => onRecargar(detalle.id)} />
                </>
              ) : (
                <span className="msg-panel-nota" data-testid="sin-voucher-pedido">
                  Aún no envió el voucher de {detalle.pedido?.codigo}.
                </span>
              )}
            </section>
          )}

          {/* Decisiones: lo mismo que la barra de acción pendiente */}
          {(porRevisar || solicitudPendiente) && (
            <section className="msg-seccion" aria-label="Decisiones">
              <span className="msg-seccion-titulo">Decisiones</span>
              {porRevisar && (
                <div className="msg-decisiones">
                  <button type="button" className="msg-ok" onClick={onAprobarPago}>
                    Aprobar pago
                  </button>
                  <button type="button" className="msg-no" onClick={onRechazarPago}>
                    Rechazar pedido
                  </button>
                </div>
              )}
              {solicitudPendiente && (
                <div className="msg-decisiones">
                  <button type="button" className="msg-ok" onClick={onAplicarCambio}>
                    Aplicar cambio
                  </button>
                  <button type="button" className="msg-no" onClick={onAbrirRechazarCambio}>
                    Rechazar cambio
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
