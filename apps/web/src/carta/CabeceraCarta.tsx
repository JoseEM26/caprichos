import { EstadoLocalCarta } from './tipos';
import { useCarrito } from './CarritoContext';

interface CabeceraCartaProps {
  busqueda: string;
  onCambioBusqueda: (valor: string) => void;
  estadoLocal: EstadoLocalCarta | null;
}

export function CabeceraCarta({
  busqueda,
  onCambioBusqueda,
  estadoLocal,
}: CabeceraCartaProps) {
  const { cantidadTotal, subtotal, abrirCajon } = useCarrito();

  const tiempoEstimado = (() => {
    if (!estadoLocal || !estadoLocal.abierta) return null;
    const base = estadoLocal.tiempoPrometidoMin || 30;
    const extra = estadoLocal.altaDemandaMin || 0;
    return `${base + extra} min aprox.`;
  })();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: 'var(--cp-cream)',
        borderBottom: '1px solid var(--cp-line)',
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
      }}
    >
      {/* Aviso de estado del local si está cerrado o en pausa */}
      {estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda) && (
        <div
          role="status"
          style={{
            backgroundColor: 'var(--cp-rust)',
            color: '#FFFFFF',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {estadoLocal.pausaAltaDemanda
            ? 'Pausa por alta demanda: puedes mirar la carta pero no se pueden enviar pedidos'
            : `Local cerrado (${estadoLocal.texto}): puedes mirar la carta pero no se pueden enviar pedidos`}
        </div>
      )}

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Logo / Nombre */}
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/logo.webp"
            alt="Caprichos"
            width={40}
            height={40}
            style={{ borderRadius: '50%', display: 'block' }}
          />
          <div style={{ display: 'none', minWidth: 0, lineHeight: 1.1 }}>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
                display: 'block',
              }}
            >
              Caprichos
            </span>
          </div>
        </div>

        {/* Buscador reactivo */}
        <div style={{ flex: 1, position: 'relative' }}>
          <label htmlFor="buscar-carta" style={{ position: 'absolute', left: '-9999px' }}>
            Buscar en la carta
          </label>
          <input
            id="buscar-carta"
            type="search"
            value={busqueda}
            onChange={(e) => onCambioBusqueda(e.target.value)}
            placeholder="Buscar en la carta..."
            style={{
              width: '100%',
              minHeight: '44px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-line)',
              backgroundColor: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 16px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Estado abierto / tiempo */}
        {estadoLocal?.abierta && !estadoLocal.pausaAltaDemanda && tiempoEstimado && (
          <div
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--cp-sand)',
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--cp-navy)',
            }}
            className="cp-tiempo-banner"
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: 'var(--cp-ok, #2F9E57)',
              }}
            />
            <span>{tiempoEstimado}</span>
          </div>
        )}

        {/* Botón de Carrito */}
        <button
          onClick={abrirCajon}
          aria-label={`Abrir el carrito: ${cantidadTotal} productos, S/ ${subtotal.toFixed(2)}`}
          title={`${cantidadTotal} productos · S/ ${subtotal.toFixed(2)}`}
          style={{
            position: 'relative',
            flex: 'none',
            minWidth: '48px',
            height: '44px',
            padding: '0 12px',
            border: 0,
            borderRadius: '12px',
            backgroundColor: 'var(--cp-orange)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: 800,
            fontSize: '14px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 6h15l-1.5 9h-12z M6 6L5 3H2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
          </svg>
          {cantidadTotal > 0 && (
            <span
              style={{
                backgroundColor: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                borderRadius: '10px',
                padding: '2px 7px',
                fontSize: '12px',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
              }}
            >
              {cantidadTotal}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
