import { ProductoCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useEsMovil } from './useEsMovil';

export interface InfoRankingProducto {
  puesto?: number;
  estrellas?: number;
  textoEstrellas?: string;
}

interface TarjetaProductoProps {
  producto: ProductoCarta;
  rankingInfo?: InfoRankingProducto | null;
}

export function TarjetaProducto({ producto, rankingInfo }: TarjetaProductoProps) {
  const { abrirModalProducto } = useCarrito();
  const movil = useEsMovil();

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
      className="cp-tarjeta"
      style={{
        backgroundColor: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '12px',
        boxShadow: '0 6px 18px rgba(11, 44, 62, 0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: estaAgotado ? 0.6 : 1,
      }}
    >
      {/* Zona de imagen / iniciales: la foto se ve completa (contain) sobre su propia versión difuminada, como en el mockup */}
      <button
        type="button"
        onClick={() => !estaAgotado && abrirModalProducto(producto)}
        aria-label={`Ver ${producto.nombre}`}
        style={{ border: 0, padding: 0, background: 'transparent', display: 'block', width: '100%', minHeight: 0, cursor: estaAgotado ? 'default' : 'pointer' }}
      >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          backgroundColor: 'var(--cp-sand)',
          overflow: 'hidden',
        }}
      >
        {producto.fotoUrl ? (
          <>
            <img
              src={producto.fotoUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              style={{ position: 'absolute', left: '-8%', top: '-8%', width: '116%', height: '116%', objectFit: 'cover', filter: 'blur(16px)', opacity: 0.5 }}
            />
            <img
              src={producto.fotoUrl}
              alt={producto.nombre}
              loading="lazy"
              style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }}
            />
          </>
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
              fontSize: '36px',
              color: 'var(--cp-navy)',
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
      </button>

      {/* Cuerpo de la tarjeta */}
      <div
        style={{
          padding: movil ? '12px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: '6px',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 700,
            fontSize: movil ? '13px' : '15px',
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
              WebkitLineClamp: movil ? 2 : 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {producto.descripcion}
          </p>
        )}

        {rankingInfo && (
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                borderRadius: '9999px',
                padding: '2px 10px',
                display: 'inline-block',
              }}
            >
              {rankingInfo.textoEstrellas || (rankingInfo.estrellas === 3 ? '★★★ Más comprado del mes' : '★ Más comprado del mes')}
            </span>
          </div>
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
              fontSize: movil ? '15px' : '18px',
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
