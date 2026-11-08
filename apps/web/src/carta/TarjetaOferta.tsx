import { useMemo } from 'react';
import { OfertaItem } from '../admin/ofertas/ofertasApi';
import { CategoriaCarta, ProductoCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { TextoEd } from './edicion';
import { useEsMovil } from './useEsMovil';
import { etiquetaModalidades } from './modalidadOferta';
import { textoEnvioGratisHasta } from '../comun/envioGratis';

interface TarjetaOfertaProps {
  oferta: OfertaItem;
  productos: ProductoCarta[];
  categorias: CategoriaCarta[];
  onSeleccionarCategoria?: (categoriaId: string) => void;
  esMovilPreview?: boolean;
}

function fmt(n: number): string {
  const num = Math.round(n * 100) / 100;
  return 's/ ' + (Number.isInteger(num) ? String(num) : num.toFixed(2));
}

export function TarjetaOferta({
  oferta,
  productos,
  categorias: _categorias,
  onSeleccionarCategoria,
  esMovilPreview,
}: TarjetaOfertaProps) {
  const { abrirModalProducto } = useCarrito();
  const esMovilDetectado = useEsMovil();
  const movil = esMovilPreview !== undefined ? esMovilPreview : esMovilDetectado;

  // Buscar el producto vinculado si tiene alcanceProductoId
  const productoVinculado = useMemo(() => {
    if (!oferta.alcanceProductoId) return null;
    return productos.find((p) => String(p.id) === String(oferta.alcanceProductoId)) || null;
  }, [oferta.alcanceProductoId, productos]);

  // Letra inicial igual que la carta para cuando no hay foto
  const inicial = (oferta.nombre.trim()[0] || 'P').toUpperCase();

  // Cálculo del precio o beneficio para mostrar
  const { textoPrecio, textoBadge } = useMemo(() => {
    if (oferta.tipo === 'COMBO') {
      const precios = oferta.combosPrecio || oferta.combosPrecios || [];
      if (precios.length > 0) {
        const valores = precios.map((p) => Number(p.precio)).filter((v) => !isNaN(v) && v > 0);
        if (valores.length > 0) {
          const minP = Math.min(...valores);
          return {
            textoPrecio: (valores.length > 1 ? 'Desde ' : '') + fmt(minP),
            textoBadge: 'Combo',
          };
        }
      }
      return { textoPrecio: 'Combo especial', textoBadge: 'Combo' };
    }

    if (oferta.tipo === 'ENVIO_GRATIS') {
      return { textoPrecio: textoEnvioGratisHasta(oferta.horaHasta), textoBadge: 'Envío gratis' };
    }

    if (oferta.tipo === 'LLEVA_PAGA') {
      const lleva = oferta.lleva || 2;
      const paga = oferta.paga || 1;
      const badge = `${lleva}x${paga}`;
      if (productoVinculado) {
        return {
          textoPrecio: fmt(productoVinculado.precio),
          textoBadge: badge,
        };
      }
      if (oferta.descuentoValor) {
        return {
          textoPrecio: fmt(Number(oferta.descuentoValor)),
          textoBadge: badge,
        };
      }
      return { textoPrecio: badge, textoBadge: 'Promoción' };
    }

    // DESCUENTO
    if (oferta.descuentoTipo === 'PORCENTAJE') {
      return {
        textoPrecio: `${oferta.descuentoValor || 0} % OFF`,
        textoBadge: 'Descuento',
      };
    }
    return {
      textoPrecio: oferta.descuentoValor ? `- ${fmt(Number(oferta.descuentoValor))}` : 'Descuento',
      textoBadge: 'Descuento',
    };
  }, [oferta, productoVinculado]);

  // Vigencia
  const aplicaHoy = oferta.vigenteAhora !== false;
  // Combo sin con qué armarse (principal y reemplazos agotados): se ve agotado y no se puede agregar
  const agotado = oferta.tipo === 'COMBO' && oferta.disponible === false && oferta.sinStock !== true;
  // Desactivada (visible_carta = «Mostrar como No disponible»), o armable solo con productos sin saldo: no se puede pedir
  const noDisponible = oferta.activo === false || (oferta.tipo === 'COMBO' && oferta.sinStock === true);
  const sinPedir = agotado || noDisponible;
  // Restringida a un tipo de pedido: se dice cuál (el cliente elige comer aquí, recoger o delivery al pedir)
  const soloModalidad = etiquetaModalidades(oferta.modalidades);

  const cardDir = movil ? 'row' : 'column';
  const imgW = movil ? '100px' : '100%';
  const imgRatio = movil ? '1/1' : '4/3';
  const imgPad = movil ? '8px' : '0';
  const imgRad = movil ? '10px' : '0';
  const initFs = movil ? 22 : 44;
  const cardPad = movil ? '8px 10px 8px 2px' : '12px';
  const nameFs = movil ? 13 : 15;
  const priceFs = movil ? 15 : 18;

  const handleAccion = () => {
    if (productoVinculado) {
      abrirModalProducto(productoVinculado);
      return;
    }

    if (oferta.alcanceCategoriaId && onSeleccionarCategoria) {
      onSeleccionarCategoria(String(oferta.alcanceCategoriaId));
      return;
    }

    // Si es combo y tiene nombre que coincide con algún producto
    const prodPorNombre = productos.find(
      (p) => p.nombre.trim().toUpperCase() === oferta.nombre.trim().toUpperCase() ||
             (oferta.productoNombre && p.nombre.trim().toUpperCase() === oferta.productoNombre.trim().toUpperCase())
    );
    if (prodPorNombre) {
      abrirModalProducto(prodPorNombre);
      return;
    }

    // Desplazar a la carta
    const el = document.getElementById('carta-lista');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const botonLabel = (() => {
    if (oferta.tipo === 'COMBO') {
      return 'Personalizar';
    }
    if (productoVinculado) {
      return 'Pedir';
    }
    return 'Ver oferta';
  })();

  return (
    <article
      data-testid={`oferta-${oferta.id}`}
      className="card cp-tarjeta cp-tarjeta-oferta"
      style={{
        backgroundColor: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '12px',
        boxShadow: '0 6px 18px color-mix(in srgb, var(--cp-navy) 12%, transparent)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: cardDir,
        opacity: aplicaHoy && !sinPedir ? 1 : 0.75,
      }}
    >
      {/* Zona de imagen / letra inicial */}
      <button
        type="button"
        onClick={sinPedir ? undefined : handleAccion}
        aria-label={`Ver oferta ${oferta.nombre}`}
        style={{
          border: 0,
          padding: imgPad,
          boxSizing: 'border-box',
          background: 'transparent',
          display: 'block',
          width: imgW,
          flex: 'none',
          alignSelf: 'flex-start',
          cursor: 'pointer',
        }}
      >
        {oferta.imagenUrl ? (
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
              src={oferta.imagenUrl}
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
              src={oferta.imagenUrl}
              alt={oferta.nombre}
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
            {!aplicaHoy && (
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
                  letterSpacing: '0.04em',
                }}
              >
                Hoy no aplica
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
              position: 'relative',
            }}
          >
            {inicial}
            {!aplicaHoy && (
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
                  letterSpacing: '0.04em',
                }}
              >
                Hoy no aplica
              </span>
            )}
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
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              background: 'var(--cp-sand)',
              color: 'var(--cp-navy)',
              borderRadius: '9999px',
              padding: '2px 8px',
            }}
          >
            {textoBadge}
          </span>
          {soloModalidad && (
            <span
              data-testid="etiqueta-modalidad"
              style={{ fontSize: '11px', fontWeight: 700, background: 'var(--cp-sand)', color: 'var(--cp-navy)', borderRadius: '9999px', padding: '2px 8px' }}
            >
              {soloModalidad}
            </span>
          )}
          {noDisponible ? (
            <span
              data-testid="insignia-no-disponible"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'var(--cp-sand)',
                color: 'var(--cp-soft)',
                borderRadius: '9999px',
                padding: '2px 8px',
              }}
            >
              No disponible
            </span>
          ) : agotado ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'color-mix(in srgb, var(--cp-rust) 15%, var(--cp-cream))',
                color: 'var(--cp-rust)',
                borderRadius: '9999px',
                padding: '2px 8px',
              }}
            >
              Agotado
            </span>
          ) : !aplicaHoy ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'color-mix(in srgb, var(--cp-rust) 15%, var(--cp-cream))',
                color: 'var(--cp-rust)',
                borderRadius: '9999px',
                padding: '2px 8px',
              }}
            >
              Hoy no aplica
            </span>
          ) : (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'color-mix(in srgb, #2E7D32 15%, var(--cp-cream))',
                color: '#2E7D32',
                borderRadius: '9999px',
                padding: '2px 8px',
              }}
            >
              Disponible
            </span>
          )}
        </div>

        <div
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: `${nameFs}px`,
            lineHeight: '20px',
            color: 'var(--cp-navy)',
          }}
        >
          <TextoEd clave={`promo:${oferta.id}:nombre`} valor={oferta.nombre} ayuda="Nombre de la promoción" />
        </div>

        {oferta.descripcion && (
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
            <TextoEd clave={`promo:${oferta.id}:descripcion`} valor={oferta.descripcion} ayuda="Descripción de la promoción" />
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

          {!sinPedir && (
          <button
            type="button"
            onClick={handleAccion}
            aria-label={`${botonLabel} ${oferta.nombre}`}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '12px',
              border: 0,
              backgroundColor: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {botonLabel}
          </button>
          )}
        </div>
      </div>
    </article>
  );
}
