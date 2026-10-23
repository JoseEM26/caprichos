import { useCarrito } from './CarritoContext';
import { Icono } from '../comun/Icono';
import { leerPedidosGuardados, useSeguimientoPedido } from './seguimiento';
import type { PasoSeguimiento, PedidoGuardado } from './seguimiento';
import type { PedidoConfirmado } from './tipos';

export function PantallaConfirmacion() {
  const { pedidoConfirmado, setPedidoConfirmado, seguimientoAbierto, setSeguimientoAbierto } = useCarrito();

  // Un pedido recién creado o uno abierto desde «Mi pedido»
  const pedido: PedidoGuardado | null =
    seguimientoAbierto ??
    (pedidoConfirmado
      ? {
          codigo: pedidoConfirmado.codigo,
          token: pedidoConfirmado.seguimientoToken,
          modalidad: pedidoConfirmado.modalidad,
          nombre: pedidoConfirmado.clienteNombre,
          creadoEn: '',
        }
      : null);

  if (!pedido) return null;

  const creacion = pedidoConfirmado?.codigo === pedido.codigo ? pedidoConfirmado : null;
  const otros = leerPedidosGuardados().filter((p) => p.codigo !== pedido.codigo);

  const cerrar = () => {
    setPedidoConfirmado(null);
    setSeguimientoAbierto(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmación del pedido"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        backgroundColor: 'rgba(11, 44, 62, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <TarjetaSeguimiento
        key={pedido.codigo}
        pedido={pedido}
        creacion={creacion}
        otros={otros}
        onElegir={setSeguimientoAbierto}
        onCerrar={cerrar}
      />
    </div>
  );
}

interface TarjetaSeguimientoProps {
  pedido: PedidoGuardado;
  creacion: PedidoConfirmado | null;
  otros: PedidoGuardado[];
  onElegir: (p: PedidoGuardado) => void;
  onCerrar: () => void;
}

function TarjetaSeguimiento({ pedido, creacion, otros, onElegir, onCerrar }: TarjetaSeguimientoProps) {
  const { estado, error } = useSeguimientoPedido(pedido.codigo, pedido.token);
  const anulado = estado?.anulado === true;
  const total = creacion?.total ?? estado?.total;

  let mensaje: string;
  if (error === 'NO_ENCONTRADO') mensaje = 'No encontramos este pedido. Puede que ya no esté disponible.';
  else if (anulado) mensaje = 'Tu pedido fue anulado';
  else if (creacion) mensaje = creacion.mensaje || 'Un asesor te escribirá para coordinar el pago';
  else if (estado) mensaje = estado.estadoEtiqueta;
  else if (error === 'RED') mensaje = 'No pudimos consultar el estado. Reintentaremos en unos segundos.';
  else mensaje = 'Consultando el estado de tu pedido...';

  return (
    <div
      style={{
        width: 'min(500px, 100%)',
        backgroundColor: 'var(--cp-white)',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(11, 44, 62, 0.35)',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        textAlign: 'center',
        margin: 'auto',
      }}
    >
      {/* Ícono de éxito animado */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '32px',
          backgroundColor: anulado ? 'var(--cp-rust)' : 'var(--cp-green)',
          color: '#FFFFFF',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {anulado ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M5 12.5l4.5 4.5L19 7.5" />}
        </svg>
      </div>

      <div>
        <h2
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '24px',
            lineHeight: '28px',
            color: 'var(--cp-navy)',
          }}
        >
          ¡Gracias, {pedido.nombre}!
        </h2>
        <div
          style={{
            marginTop: '6px',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--cp-rust)',
          }}
        >
          Recibimos tu pedido #{pedido.codigo}
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '13px',
            lineHeight: '18px',
            color: anulado ? 'var(--cp-rust)' : 'var(--cp-soft)',
            fontWeight: anulado ? 700 : 400,
          }}
        >
          {mensaje}
        </p>
      </div>

      {/* Resumen del pedido */}
      <div
        style={{
          backgroundColor: 'var(--cp-sand)',
          borderRadius: '14px',
          padding: '14px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '13px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Modalidad</span>
          <span style={{ fontWeight: 700 }}>
            {pedido.modalidad === 'DELIVERY' ? 'Delivery' : 'Recojo en local'}
          </span>
        </div>

        {creacion && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 700 }}>
              S/ {Number(creacion.subtotal).toFixed(2)}
            </span>
          </div>
        )}

        {creacion && creacion.envio !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Envío</span>
            <span style={{ fontWeight: 700 }}>
              {Number(creacion.envio) === 0
                ? 'GRATIS'
                : `S/ ${Number(creacion.envio).toFixed(2)}`}
            </span>
          </div>
        )}

        {total !== undefined && (
          <div
            style={{
              borderTop: '1px solid var(--cp-line)',
              paddingTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy)',
            }}
          >
            <span>Total</span>
            <span style={{ color: 'var(--cp-rust)' }}>
              S/ {Number(total).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Pasos reales del pedido, según la API */}
      {estado && !anulado && (
        <div
          style={{
            backgroundColor: 'var(--cp-cream)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '14px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {estado.pasos.map((p, idx) => (
            <PasoPedido key={p.clave} paso={p} numero={idx + 1} />
          ))}
        </div>
      )}

      {otros.length > 0 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Tus otros pedidos</div>
          {otros.map((p) => (
            <FilaOtroPedido key={p.codigo} pedido={p} onElegir={onElegir} />
          ))}
        </div>
      )}

      <button
        onClick={onCerrar}
        style={{
          width: '100%',
          minHeight: '50px',
          borderRadius: '12px',
          border: 0,
          backgroundColor: 'var(--cp-orange)',
          color: '#FFFFFF',
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '15px',
        }}
      >
        Volver a la carta
      </button>
    </div>
  );
}

function PasoPedido({ paso, numero }: { paso: PasoSeguimiento; numero: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '10px',
          backgroundColor: paso.hecho
            ? 'var(--cp-green)'
            : paso.actual
            ? 'var(--cp-orange)'
            : 'var(--cp-line)',
          color: '#FFFFFF',
          fontSize: '11px',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        {paso.hecho ? <Icono nombre="check" /> : numero}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: paso.actual ? 700 : 500,
          color: paso.actual ? 'var(--cp-navy)' : 'var(--cp-soft)',
        }}
      >
        {paso.etiqueta}
      </span>
      {paso.hora && (
        <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{formatearHora(paso.hora)}</span>
      )}
    </div>
  );
}

function FilaOtroPedido({ pedido, onElegir }: { pedido: PedidoGuardado; onElegir: (p: PedidoGuardado) => void }) {
  const { estado, error } = useSeguimientoPedido(pedido.codigo, pedido.token);
  const etiqueta = estado?.estadoEtiqueta ?? (error === 'NO_ENCONTRADO' ? 'No disponible' : 'Consultando...');

  return (
    <button
      onClick={() => onElegir(pedido)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        minHeight: '44px',
        padding: '0 14px',
        borderRadius: '12px',
        border: '1.5px solid var(--cp-line)',
        backgroundColor: 'var(--cp-white)',
        color: 'var(--cp-navy)',
        fontSize: '13px',
        fontWeight: 700,
      }}
    >
      <span>#{pedido.codigo}</span>
      <span style={{ color: 'var(--cp-soft)', fontWeight: 500 }}>{etiqueta}</span>
    </button>
  );
}

// La hora viene de la API como fecha ISO; si no se puede leer, se muestra tal cual
function formatearHora(hora: string): string {
  const fecha = new Date(hora);
  if (Number.isNaN(fecha.getTime())) return hora;
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
