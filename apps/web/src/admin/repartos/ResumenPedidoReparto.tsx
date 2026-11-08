import { enlaceLlamar } from './textoVisible';
import { useState } from 'react';
import { PedidoReparto } from './repartosApi';
import { useAccionesReparto } from './useAccionesReparto';
import { Boton } from '../../comun/Boton';
import { enlaceGoogleMaps } from '../../comun/mapa/leaflet';
import { CodigoPlus } from '../../comun/mapa/CodigoPlus';
import { clasificarEspera } from './calculoRuta';
import { ModalReportarFalla } from './ModalReportarFalla';
import { BotonEtapa, etapaDe } from './RepartidorView';

interface ResumenPedidoRepartoProps {
  pedido: PedidoReparto;
  esMio?: boolean;
  esDisponible?: boolean;
  puedeLiquidar?: boolean;
  /** Solo ADMIN: «Tomar como repartidor» en un pedido esperando repartidor. */
  puedeTomar?: boolean;
  /** Solo ADMIN y CAJERO: abre el modal de excepción Soltar / reasignar (motivo obligatorio). */
  alSoltar?: (pedido: PedidoReparto) => void;
  alCerrar?: () => void;
  alActualizar?: () => void;
  acciones: ReturnType<typeof useAccionesReparto>;
}

function formatearHora(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Lima',
    });
  } catch {
    return null;
  }
}

export function ResumenPedidoReparto({
  pedido,
  esMio = false,
  esDisponible = false,
  puedeLiquidar = false,
  puedeTomar = false,
  alSoltar,
  alCerrar,
  alActualizar,
  acciones,
}: ResumenPedidoRepartoProps) {
  const [modalFallaAbierto, setModalFallaAbierto] = useState(false);

  const telDigitos = pedido.cliente_telefono
    ? pedido.cliente_telefono.replace(/\D/g, '').slice(-9)
    : null;
  const telUrl = enlaceLlamar(pedido.cliente_telefono);
  const waUrl = telDigitos ? `https://wa.me/51${telDigitos}` : null;
  const navUrl =
    pedido.lat != null && pedido.lng != null
      ? enlaceGoogleMaps(pedido.lat, pedido.lng)
      : pedido.direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.direccion)}`
      : null;

  const esEfectivoPendiente =
    pedido.cobro_pendiente_efectivo ||
    pedido.cobroPendienteEfectivo ||
    (pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO');

  const vueltoCalculado =
    pedido.paga_con && pedido.paga_con > pedido.total
      ? pedido.paga_con - pedido.total
      : null;

  const payText = `${pedido.pago_metodo || 'EFECTIVO'} · ${
    pedido.pago_estado === 'PAGADO' ? 'Cobrado' : 'Cobrar'
  }`;

  let cashNote = '';
  if (esEfectivoPendiente) {
    if (vueltoCalculado !== null) {
      cashNote = `Cobrar en efectivo S/ ${Number(pedido.total).toFixed(2)} · paga con S/ ${Number(pedido.paga_con).toFixed(2)} · llevar vuelto S/ ${vueltoCalculado.toFixed(2)}`;
    } else if (pedido.paga_con) {
      cashNote = `Cobrar en efectivo S/ ${Number(pedido.total).toFixed(2)} · paga con S/ ${Number(pedido.paga_con).toFixed(2)} (monto exacto)`;
    } else {
      cashNote = `Cobrar en efectivo S/ ${Number(pedido.total).toFixed(2)} · consultar al cliente con cuánto paga para llevar el vuelto`;
    }
  }

  const infoEspera = clasificarEspera(pedido.minutosEspera);
  const colorBorde = infoEspera.colorHex;
  const faltaUbicar = pedido.lat == null || pedido.lng == null;

  // Horas de cada paso (Decisión 7 del dueño)
  const horaTomado = formatearHora(pedido.tomado_en);
  const horaSalio = formatearHora(pedido.salio_en);
  const horaLlego = formatearHora(pedido.llego_en);
  const horaEntregado = formatearHora(pedido.entregado_en);

  const pasos = [
    { label: 'Tomado', hora: horaTomado, activo: !!horaTomado },
    { label: 'Salió', hora: horaSalio, activo: !!horaSalio },
    { label: 'Llegó', hora: horaLlego, activo: !!horaLlego },
    { label: 'Entregado', hora: horaEntregado, activo: !!horaEntregado },
  ].filter((p) => p.activo);

  const ejecutarEtapa = (p: PedidoReparto, etapa: string) => {
    if (etapa === 'salir') acciones.salir(p);
    else if (etapa === 'llegue') acciones.llegue(p);
    else acciones.entregar(p);
  };

  return (
    <div
      role="region"
      aria-label={`Hoja de pedido ${pedido.codigo}`}
      style={{
        position: 'relative',
        background: 'var(--cp-white, #FFFFFF)',
        border: `2px solid ${colorBorde}`,
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 -6px 24px rgba(11, 44, 62, 0.16)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Cabecera: Cliente, código, zona, tiempo de espera y total */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '19px',
              lineHeight: '24px',
              color: 'var(--cp-navy, #0B2C3E)',
              overflowWrap: 'anywhere',
            }}
          >
            {pedido.cliente_nombre}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft, #5A6E78)',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            <strong style={{ color: 'var(--cp-navy, #0B2C3E)' }}>{pedido.codigo}</strong>
            {pedido.zona && <span>· Zona {pedido.zona}</span>}
            <span>· espera</span>
            <span
              style={{
                fontWeight: 800,
                color: infoEspera.colorHex,
              }}
            >
              {pedido.minutosEspera} min ({infoEspera.label})
            </span>
            {faltaUbicar && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  background: '#FDE8E8',
                  color: 'var(--cp-rust, #C4412B)',
                  border: '1px solid var(--cp-rust, #C4412B)',
                }}
              >
                Falta ubicar
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 'none' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                lineHeight: '26px',
                color: 'var(--cp-rust, #C4412B)',
              }}
            >
              S/ {Number(pedido.total).toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft, #5A6E78)', fontWeight: 700 }}>
              {payText}
            </div>
          </div>
          {alCerrar && (
            <button
              type="button"
              aria-label="Cerrar hoja de pedido"
              onClick={alCerrar}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '24px',
                lineHeight: '24px',
                fontWeight: 800,
                color: 'var(--cp-soft, #5A6E78)',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Dirección y referencia */}
      <div style={{ fontSize: '13px', color: 'var(--cp-navy, #0B2C3E)', lineHeight: '18px' }}>
        <strong>Dirección:</strong> {pedido.direccion || 'Por ubicar'}
        {pedido.referencia && (
          <span style={{ color: 'var(--cp-soft, #5A6E78)' }}> · Ref.: {pedido.referencia}</span>
        )}
      </div>

      <CodigoPlus lat={pedido.lat} lng={pedido.lng} />

      {/* Nota de cobro en efectivo y vuelto a llevar */}
      {cashNote && (
        <div
          style={{
            background: '#FFF6E3',
            border: '1.5px solid var(--cp-gold, #D4A373)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          {cashNote}
        </div>
      )}

      {/* Alerta ámbar para caja cuando lleva más de N min sin salir (posible repartidor desconectado) */}
      {pedido.alerta_tomado_sin_salir && (
        <div
          role="status"
          data-testid="alerta-tomado-sin-salir"
          style={{
            background: '#FEF3C7',
            border: '1.5px solid var(--cp-gold, #D97706)',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#92400E',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div>
            Alerta caja: Tomado hace {pedido.minutos_sin_salir ?? 10} min sin salir (posible repartidor desconectado)
          </div>
          {alSoltar && (
            <button
              type="button"
              onClick={() => alSoltar(pedido)}
              disabled={acciones.cargandoAccion}
              style={{
                alignSelf: 'flex-start',
                minHeight: '36px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid #92400E',
                background: 'var(--cp-white, #FFFFFF)',
                color: '#92400E',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Soltar / reasignar
            </button>
          )}
        </div>
      )}

      {/* Horas de cada paso registrado (Decisión 7 del dueño) */}
      {pasos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            padding: '8px 12px',
            background: 'var(--cp-cream, #FFFDF8)',
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: '10px',
            fontSize: '12px',
          }}
        >
          {pasos.map((p) => (
            <span key={p.label} style={{ color: 'var(--cp-navy, #0B2C3E)' }}>
              <strong>{p.label}:</strong> {p.hora}
            </span>
          ))}
        </div>
      )}

      {/* Fila de botones de contacto y navegación rápida (min-height 48px, fáciles con guantes) */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {telUrl ? (
          <a
            href={telUrl}
            style={{
              flex: '1 1 90px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              background: 'var(--cp-navy, #0B2C3E)',
              color: 'var(--cp-cream, #FFFDF8)',
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
              background: '#EAEAEA',
              color: '#888888',
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

        {waUrl && (
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
        )}

        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: '1 1 90px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              color: 'var(--cp-navy, #0B2C3E)',
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
        )}

        {/* Botón para reportar problema (FT-DEL-03, Decisión 7) */}
        {(esMio || puedeLiquidar) && pedido.estado !== 'ENTREGADO' && (
          <button
            type="button"
            onClick={() => setModalFallaAbierto(true)}
            style={{
              flex: '1 1 120px',
              minHeight: '48px',
              boxSizing: 'border-box',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-rust, #C4412B)',
              background: 'transparent',
              color: 'var(--cp-rust, #C4412B)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Reportar problema
          </button>
        )}
      </div>

      {/* Error de acción si ocurrió */}
      {acciones.errorAccion && (
        <div
          role="alert"
          style={{
            background: '#FDE8E8',
            border: '1.5px solid var(--cp-rust, #C4412B)',
            color: 'var(--cp-rust, #C4412B)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {acciones.errorAccion}
        </div>
      )}

      {/* UN SOLO BOTÓN GRANDE DE ESTADO (Tomar pedido, En camino, He llegado, Entregado) - Decisión 7 */}
      {esDisponible && !puedeTomar && (
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-soft, #5A6E78)', textAlign: 'center', padding: '6px 0' }}>
          Esperando que un repartidor lo tome
        </div>
      )}
      {esDisponible && puedeTomar && (
        faltaUbicar ? (
          <Boton
            disabled
            variante="secundario"
            style={{
              minHeight: '56px',
              borderRadius: '14px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '17px',
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
              minHeight: '56px',
              border: 'none',
              borderRadius: '14px',
              background: 'var(--cp-orange, #E67929)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              width: '100%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(230, 121, 41, 0.35)',
            }}
          >
            {acciones.cargandoAccion ? 'Tomando...' : 'Tomar como repartidor'}
          </button>
        )
      )}

      {esMio && (
        <BotonEtapa
          pedido={pedido}
          etapa={etapaDe(pedido)}
          grande
          onAccion={ejecutarEtapa}
        />
      )}

      {/* Si fue tomado por otro repartidor */}
      {!esDisponible && !esMio && (
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--cp-soft, #5A6E78)',
            textAlign: 'center',
            padding: '6px 0',
          }}
        >
          {pedido.repartidor?.nombre
            ? `Tomado por ${pedido.repartidor.nombre}`
            : pedido.repartidor_party_id
            ? 'Tomado por un repartidor asignado'
            : 'Sin repartidor asignado'}
        </div>
      )}

      {/* Liberar pedido por caja/administrador */}
      {alSoltar && (pedido.repartidor || pedido.repartidor_party_id) && pedido.estado !== 'ENTREGADO' && !pedido.alerta_tomado_sin_salir && (
        <button
          type="button"
          onClick={() => alSoltar(pedido)}
          disabled={acciones.cargandoAccion}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy, #0B2C3E)',
            background: 'transparent',
            color: 'var(--cp-navy, #0B2C3E)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Soltar / reasignar
        </button>
      )}

      {/* Modal para reportar entrega fallida / incidente */}
      {modalFallaAbierto && (
        <ModalReportarFalla
          pedido={pedido}
          alCerrar={() => setModalFallaAbierto(false)}
          alCompletar={() => {
            setModalFallaAbierto(false);
            alActualizar?.();
          }}
        />
      )}
    </div>
  );
}
