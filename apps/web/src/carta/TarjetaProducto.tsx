import { ProductoCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useEsMovil } from './useEsMovil';

export interface InfoRankingProducto {
  puesto?: number;
  estrellas?: number;
  textoEstrellas?: string;
}

export interface TarjetaProductoProps {
  producto: ProductoCarta;
  rankingInfo?: InfoRankingProducto | null;
  organizacion?: 'SECCIONES' | 'LISTA' | 'TARJETAS';
  insigniaBeneficio?: string | null;
}

const PRODUCTOS_100_CACAO = new Set([
  'FRAPPE MOCA',
  'ICED CHOCOLATE',
  'CHOCOLATE CALIENTE',
]);

function fmt(n: number): string {
  const num = Math.round(n * 100) / 100;
  return 's/ ' + (Number.isInteger(num) ? String(num) : num.toFixed(2));
}

export function TarjetaProducto({
  producto,
  rankingInfo,
  organizacion = 'SECCIONES',
  insigniaBeneficio,
}: TarjetaProductoProps) {
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
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const minPrecio = (() => {
    if (producto.tamanos && producto.tamanos.length > 0) {
      return Math.min(...producto.tamanos.map((t) => t.precio));
    }
    return producto.precio;
  })();

  const esDuoCompartir =
    producto.nombre.trim().toUpperCase() === 'DÚO PARA COMPARTIR' &&
    minPrecio === 33;
  const textoPrecioAnterior = esDuoCompartir ? fmt(38) : '';

  const variosTamanos = Boolean(producto.tamanos && producto.tamanos.length > 1);
  const textoPrecio =
    (variosTamanos && !textoPrecioAnterior ? 'Desde ' : '') + fmt(minPrecio);

  const tieneOpciones =
    variosTamanos || Boolean(producto.grupos && producto.grupos.length > 0);

  const tagCacao = PRODUCTOS_100_CACAO.has(producto.nombre.trim().toUpperCase())
    ? '100% CACAO'
    : '';

  const esLista = organizacion === 'LISTA';
  const cardDir = movil ? 'row' : esLista ? 'row' : 'column';
  const imgW = movil ? '100px' : esLista ? '120px' : '100%';
  const imgRatio = movil ? '1/1' : esLista ? '1/1' : '4/3';
  const imgPad = movil ? '8px' : '0';
  const imgRad = movil ? '10px' : '0';
  const initFs = movil ? 22 : 44;
  const cardPad = movil ? '8px 10px 8px 2px' : '12px';
  const nameFs = movil ? 13 : 15;
  const priceFs = movil ? 15 : 18;

  return (
    <article
      data-testid={`producto-${producto.id}`}
      className="card cp-tarjeta"
      style={{
        backgroundColor: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '12px',
        boxShadow: '0 6px 18px color-mix(in srgb, var(--cp-navy) 12%, transparent)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: cardDir,
        opacity: estaAgotado ? 0.6 : 1,
      }}
    >
      {/* Zona de imagen / iniciales */}
      <button
        type="button"
        onClick={() => !estaAgotado && abrirModalProducto(producto)}
        aria-label={`Ver ${producto.nombre}`}
        style={{
          border: 0,
          padding: imgPad,
          boxSizing: 'border-box',
          background: 'transparent',
          display: 'block',
          width: imgW,
          flex: 'none',
          alignSelf: 'flex-start',
          cursor: estaAgotado ? 'default' : 'pointer',
        }}
      >
        {producto.fotoUrl ? (
          <span
            style={{
              position: 'relative',
              display: 'block',
              width: '100%',
              aspectRatio: imgRatio,
              overflow: 'hidden',
              background: 'var(--cp-gold)',
              borderRadius: imgRad,
            }}
          >
            <img
              src={producto.fotoUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              style={{
                position: 'absolute',
                left: '-8%',
                top: '-8%',
                width: '116%',
                height: '116%',
                objectFit: 'cover',
                filter: 'blur(16px)',
                opacity: 0.5,
              }}
            />
            <img
              src={producto.fotoUrl}
              alt={producto.nombre}
              loading="lazy"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
            {estaAgotado && (
              <span
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
              </span>
            )}
          </span>
        ) : (
          <span
            style={{
              width: '100%',
              aspectRatio: imgRatio,
              background: 'var(--cp-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: `${initFs}px`,
              color: 'var(--cp-navy)',
              borderRadius: imgRad,
            }}
          >
            {iniciales}
          </span>
        )}
      </button>

      {/* Cuerpo de la tarjeta */}
      <div
        style={{
          padding: cardPad,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: `${nameFs}px`,
            lineHeight: '20px',
            color: 'var(--cp-navy)',
          }}
        >
          {producto.nombre}
        </div>

        {producto.descripcion && (
          <div
            style={{
              fontSize: '12px',
              lineHeight: '17px',
              color: 'var(--cp-soft)',
              flex: 1,
              ...(movil
                ? {
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }
                : {}),
            }}
          >
            {producto.descripcion}
          </div>
        )}

        {insigniaBeneficio && (
          <div>
            <span
              data-testid={`insignia-beneficio-${producto.id}`}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'var(--cp-rust)',
                color: '#FFFFFF',
                borderRadius: '9999px',
                padding: '2px 10px',
                display: 'inline-block',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {insigniaBeneficio}
            </span>
          </div>
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
              }}
            >
              {rankingInfo.textoEstrellas ||
                (rankingInfo.estrellas === 3
                  ? '★★★ MÁS COMPRADO DEL MES'
                  : '★ MÁS COMPRADO DEL MES')}
            </span>
          </div>
        )}

        {tagCacao && (
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                borderRadius: '9999px',
                padding: '2px 10px',
              }}
            >
              {tagCacao}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: `${priceFs}px`,
                color: 'var(--cp-rust)',
              }}
            >
              {textoPrecio}
            </span>
            {textoPrecioAnterior && (
              <span
                style={{
                  fontSize: '12px',
                  textDecoration: 'line-through',
                  color: 'var(--cp-soft)',
                }}
              >
                {textoPrecioAnterior}
              </span>
            )}
          </span>

          <button
            onClick={() => !estaAgotado && abrirModalProducto(producto)}
            disabled={estaAgotado}
            className="add"
            aria-label={
              estaAgotado
                ? `${producto.nombre} agotado`
                : `Pedir ${producto.nombre}`
            }
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '12px',
              border: 0,
              backgroundColor: estaAgotado ? 'var(--cp-line)' : 'var(--cp-orange)',
              color: estaAgotado ? 'var(--cp-soft)' : 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: estaAgotado ? 'not-allowed' : 'pointer',
            }}
          >
            {estaAgotado ? 'Agotado' : tieneOpciones ? 'Personalizar' : 'Agregar'}
          </button>
        </div>
      </div>
    </article>
  );
}
