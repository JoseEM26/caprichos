import { PedidoReparto } from './repartosApi';
import { useAccionesReparto } from './useAccionesReparto';
import { Boton } from '../../comun/Boton';
import { enlaceGoogleMaps } from '../../comun/mapa/leaflet';

interface ResumenPedidoRepartoProps {
  pedido: PedidoReparto;
  esMio?: boolean;
  esDisponible?: boolean;
  puedeLiquidar?: boolean;
  alCerrar?: () => void;
  acciones: ReturnType<typeof useAccionesReparto>;
}

export function ResumenPedidoReparto({
  pedido,
  esMio = false,
  esDisponible = false,
  alCerrar,
  acciones,
}: ResumenPedidoRepartoProps) {
  const telDigitos = pedido.cliente_telefono
    ? pedido.cliente_telefono.replace(/\D/g, '').slice(-9)
    : null;
  const telUrl = telDigitos ? `tel:${telDigitos}` : null;
  const waUrl = telDigitos ? `https://wa.me/51${telDigitos}` : null;
  const navUrl =
    pedido.lat != null && pedido.lng != null
      ? enlaceGoogleMaps(pedido.lat, pedido.lng)
      : pedido.direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          pedido.direccion,
        )}`
      : null;

  const esEfectivoPendiente =
    pedido.cobro_pendiente_efectivo ||
    pedido.cobroPendienteEfectivo ||
    (pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO');

  const vueltoCalculado =
    pedido.paga_con && pedido.paga_con > pedido.total
      ? pedido.paga_con - pedido.total
      : null;

  let payText = `${pedido.pago_metodo} · ${
    pedido.pago_estado === 'PAGADO' ? 'cobrado' : 'cobrar'
  }`;
  let cashNote = '';
  if (esEfectivoPendiente) {
    if (vueltoCalculado !== null) {
      cashNote = `Cobrar en efectivo S/ ${Number(pedido.total).toFixed(
        2,
      )} · paga con S/ ${Number(pedido.paga_con).toFixed(
        2,
      )} · llevar vuelto S/ ${vueltoCalculado.toFixed(2)}`;
    } else if (pedido.paga_con) {
      cashNote = `Cobrar en efectivo S/ ${Number(pedido.total).toFixed(
        2,
      )} · paga con S/ ${Number(pedido.paga_con).toFixed(2)} (monto exacto)`;
    } else {
      cashNote = `Cobrar en efectivo S/ ${Number(pedido.total).toFixed(
        2,
      )} · pregunta con cuánto paga para llevar el vuelto`;
    }
  }

  const colorBorde =
    pedido.color === 'rojo'
      ? 'var(--cp-rust, #C4412B)'
      : pedido.color === 'naranja'
      ? 'var(--cp-orange, #E67929)'
      : 'var(--cp-green, #2E8B57)';

  const faltaUbicar = pedido.lat == null || pedido.lng == null;

  return (
    <div
      role="region"
      aria-label={`Resumen de pedido ${pedido.codigo}`}
      style={{
        flex: 'none',
        background: 'var(--cp-white)',
        border: `2px solid ${colorBorde}`,
        borderRadius: '16px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 -6px 20px rgba(11,44,62,0.12)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Cabecera: Cliente, código, zona, espera y total */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            {pedido.cliente_nombre}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            <span>{pedido.codigo}</span>
            {pedido.zona ? ` · Zona ${pedido.zona}` : ''} · espera{' '}
            {pedido.minutosEspera} min
            {faltaUbicar && (
              <span
                style={{
                  marginLeft: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  background: '#FDE8E8',
                  color: 'var(--cp-rust)',
                  border: '1px solid var(--cp-rust)',
                }}
              >
                Falta ubicar
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ textAlign: 'right', fontWeight: 800, color: 'var(--cp-rust)' }}>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '20px',
                lineHeight: '24px',
              }}
            >
              S/ {Number(pedido.total).toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
              {payText}
            </div>
          </div>
          {alCerrar && (
            <button
              type="button"
              aria-label="Cerrar resumen"
              onClick={alCerrar}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '20px',
                lineHeight: '20px',
                fontWeight: 800,
                color: 'var(--cp-soft)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Dirección */}
      <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
        {pedido.direccion || 'Por ubicar'}
        {pedido.referencia && (
          <span style={{ color: 'var(--cp-soft)' }}> · Ref.: {pedido.referencia}</span>
        )}
      </div>

      {/* Nota de cobro en efectivo y vuelto */}
      {cashNote && (
        <div
          style={{
            background: '#FFF6E3',
            border: '1.5px solid var(--cp-gold)',
            borderRadius: '10px',
            padding: '8px 10px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--cp-navy)',
          }}
        >
          {cashNote}
        </div>
      )}

      {/* Botones de acción rápida: Llamar, WhatsApp, Navegar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {telUrl ? (
          <a
            href={telUrl}
            style={{
              flex: '1 1 90px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              background: 'var(--cp-navy)',
              color: 'var(--cp-cream)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            Llamar
          </a>
        ) : (
          <span
            style={{
              flex: '1 1 90px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              background: '#e0e0e0',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            Sin tel.
          </span>
        )}

        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: '1 1 90px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              background: '#25D366',
              color: '#0B2C3E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            WhatsApp
          </a>
        ) : null}

        {navUrl ? (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: '1 1 90px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              color: 'var(--cp-navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '13px',
              background: 'transparent',
            }}
          >
            Navegar
          </a>
        ) : null}
      </div>

      {/* Error de acción si ocurrió */}
      {acciones.errorAccion && (
        <div
          role="alert"
          style={{
            background: '#FDE8E8',
            border: '1.5px solid var(--cp-rust)',
            color: 'var(--cp-rust)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {acciones.errorAccion}
        </div>
      )}

      {/* Botón grande del siguiente estado */}
      {esDisponible && (
        faltaUbicar ? (
          <Boton
            disabled
            variante="secundario"
            style={{
              minHeight: '60px',
              borderRadius: '14px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              width: '100%',
            }}
          >
            Falta ubicar
          </Boton>
        ) : (
          <button
            type="button"
            onClick={() => acciones.tomar(pedido)}
            disabled={acciones.cargandoAccion}
            style={{
              minHeight: '60px',
              border: 0,
              borderRadius: '14px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              width: '100%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {acciones.cargandoAccion ? 'Tomando...' : 'Tomar pedido'}
          </button>
        )
      )}

      {esMio && (
        pedido.estado === 'LISTO' ? (
          <button
            type="button"
            onClick={() => acciones.salir(pedido)}
            disabled={acciones.cargandoAccion}
            style={{
              minHeight: '60px',
              border: 0,
              borderRadius: '14px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              width: '100%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {acciones.cargandoAccion ? 'Marcando salida...' : 'En camino'}
          </button>
        ) : pedido.estado === 'EN_CAMINO' ? (
          !pedido.llego_en ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => acciones.llegue(pedido)}
                disabled={acciones.cargandoAccion}
                style={{
                  flex: 1,
                  minHeight: '60px',
                  border: 0,
                  borderRadius: '14px',
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {acciones.cargandoAccion ? 'Marcando llegada...' : 'He llegado'}
              </button>
              <button
                type="button"
                onClick={() => acciones.entregar(pedido)}
                disabled={acciones.cargandoAccion}
                style={{
                  flex: 1,
                  minHeight: '60px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '14px',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {acciones.cargandoAccion ? 'Entregando...' : 'Entregado al cliente'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => acciones.entregar(pedido)}
              disabled={acciones.cargandoAccion}
              style={{
                minHeight: '60px',
                border: 0,
                borderRadius: '14px',
                background: 'var(--cp-green, #2E8B57)',
                color: 'var(--cp-white, #FFFFFF)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                width: '100%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {acciones.cargandoAccion ? 'Entregando...' : 'Entregado al cliente'}
            </button>
          )
        ) : (
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--cp-soft)',
              textAlign: 'center',
            }}
          >
            Estado: {pedido.estado}
          </div>
        )
      )}

      {/* Si ya fue tomado por otro */}
      {!esDisponible && !esMio && (
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-soft)' }}>
          {pedido.repartidor?.nombre
            ? `Tomado por ${pedido.repartidor.nombre}`
            : pedido.repartidor_party_id
            ? `Tomado por Repartidor #${pedido.repartidor_party_id}`
            : 'Sin repartidor asignado'}
        </div>
      )}
    </div>
  );
}
