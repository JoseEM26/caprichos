import { ProductoCarta } from './tipos';
import { useCarrito } from './CarritoContext';

interface TarjetaProductoProps {
  producto: ProductoCarta;
}

export function TarjetaProducto({ producto }: TarjetaProductoProps) {
  const { abrirModalProducto } = useCarrito();

  const estaAgotado = (() => {
    if (!producto.disponible) return true;
    if (producto.agotadoHasta) {
      return new Date(producto.agotadoHasta) > new Date();
    }
    return false;
  })();

  const iniciales = producto.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Cálculo de precio "desde"
  const textoPrecio = (() => {
    if (producto.tamanos && producto.tamanos.length > 0) {
      const precios = producto.tamanos.map((t) => t.precio);
      const min = Math.min(...precios);
      if (producto.tamanos.length > 1) {
        return `desde S/ ${min.toFixed(2)}`;
      }
      return `S/ ${min.toFixed(2)}`;
    }
    return `S/ ${producto.precio.toFixed(2)}`;
  })();

  const tieneOpciones =
    (producto.tamanos && producto.tamanos.length > 1) ||
    (producto.grupos && producto.grupos.length > 0);

  return (
    <article
      data-testid={`producto-${producto.id}`}
      style={{
        backgroundColor: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '16px',
        boxShadow: '0 4px 14px rgba(11, 44, 62, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: estaAgotado ? 0.6 : 1,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Zona de imagen / iniciales */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          // sin foto: franja compacta con las iniciales (en celular no ocupa media pantalla)
          aspectRatio: producto.fotoUrl ? '16/10' : undefined,
          height: producto.fotoUrl ? undefined : '56px',
          backgroundColor: 'var(--cp-sand)',
          overflow: 'hidden',
        }}
      >
        {producto.fotoUrl ? (
          <img
            src={producto.fotoUrl}
            alt={producto.nombre}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '24px',
              color: 'var(--cp-soft)',
              backgroundColor: 'var(--cp-sand)',
            }}
          >
            {iniciales}
          </div>
        )}

        {/* Badge de Agotado */}
        {estaAgotado && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              backgroundColor: 'var(--cp-navy)',
              color: '#FFFFFF',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              letterSpacing: '0.06em',
            }}
          >
            AGOTADO
          </div>
        )}
      </div>

      {/* Cuerpo de la tarjeta */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: '6px',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '15px',
            lineHeight: '20px',
            color: 'var(--cp-navy)',
          }}
        >
          {producto.nombre}
        </h3>

        {producto.descripcion && (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              lineHeight: '16px',
              color: 'var(--cp-soft)',
              flex: 1,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {producto.descripcion}
          </p>
        )}

        <div
          style={{
            marginTop: 'auto',
            paddingTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-rust)',
            }}
          >
            {textoPrecio}
          </span>

          <button
            onClick={() => !estaAgotado && abrirModalProducto(producto)}
            disabled={estaAgotado}
            aria-label={estaAgotado ? `${producto.nombre} agotado` : `Pedir ${producto.nombre}`}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '12px',
              border: 0,
              backgroundColor: estaAgotado ? 'var(--cp-line)' : 'var(--cp-orange)',
              color: estaAgotado ? 'var(--cp-soft)' : '#FFFFFF',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: estaAgotado ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {estaAgotado ? 'Agotado' : tieneOpciones ? 'Elegir' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  );
}
