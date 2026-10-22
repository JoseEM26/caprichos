import { PieLegal } from './legal';
import { useEffect, useState, useMemo } from 'react';
import { api } from '../comun/api';
import { Cargando } from '../comun/Cargando';
import { EstadoError } from '../comun/EstadoError';
import {
  CategoriaCarta,
  DatosLocalCarta,
  EstadoLocalCarta,
} from './tipos';
import { CarritoProvider, useCarrito } from './CarritoContext';
import { CabeceraCarta } from './CabeceraCarta';
import type { PaginaCarta } from './CabeceraCarta';
import { PortadaCarta } from './PortadaCarta';
import { PaginaConocenos } from './PaginaConocenos';
import { PaginaNovedades } from './PaginaNovedades';
import { CuentaProvider } from './cuenta/CuentaContext';
import { PanelCuenta } from './cuenta/PanelCuenta';
import { useEsMovil } from './useEsMovil';
import { TarjetaProducto } from './TarjetaProducto';
import { VentanaProductoCarta } from './VentanaProductoCarta';
import { CajonCarrito } from './CajonCarrito';
import { FormularioCheckout } from './FormularioCheckout';
import { PantallaConfirmacion } from './PantallaConfirmacion';
import { NotificacionAgregado } from './NotificacionAgregado';
import { DecoracionAnimada } from './contenido/DecoracionAnimada';
import { VisorHistoriasModal } from './contenido/VisorHistoriasModal';
import type { HistoriaCírculo } from './contenido/VisorHistoriasModal';
import { PromosCarta } from './contenido/PromosCarta';
import type { PromoCarta } from './contenido/PromosCarta';
import { FormularioComentarios } from './contenido/FormularioComentarios';
import type { NovedadCarta } from './PaginaNovedades';
import type { BannerCarta } from './PortadaCarta';

interface ContenidoCarta {
  decoracion: string;
  organizacion: 'SECCIONES' | 'LISTA' | 'TARJETAS';
  paleta: Record<string, string>;
  novedades: NovedadCarta[];
  destacadas: HistoriaCírculo[];
  rankingMes: { productoId: string; puesto: number; estrellas: number; textoEstrellas: string }[];
  banner: BannerCarta;
  promos: PromoCarta[];
}

// El administrativo guarda la paleta por rol; la carta la lee con sus variables --cp-*
const VAR_PALETA: Record<string, string> = {
  accent: '--cp-orange', ink: '--cp-navy', bg: '--cp-cream', card: '--cp-white',
  price: '--cp-rust', sec: '--cp-gold', soft: '--cp-soft', line: '--cp-line',
};

const ZOOM_CELULAR = 0.82;

function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ContenidoCartaPublica() {
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocalCarta | null>(null);
  const [datosLocal, setDatosLocal] = useState<DatosLocalCarta | null>(null);
  const [contenido, setContenido] = useState<ContenidoCarta | null>(null);
  const [visor, setVisor] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todo');
  const [pagina, setPagina] = useState<PaginaCarta>('carta');
  const movil = useEsMovil();

  const { productoEnModal, cerrarModalProducto, abrirModalProducto } = useCarrito();

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [resCarta, resEstado, resLocal, resContenido] = await Promise.all([
        api.get<CategoriaCarta[]>('/carta'),
        api.get<EstadoLocalCarta>('/carta/estado').catch(() => null),
        api.get<DatosLocalCarta>('/carta/local').catch(() => null),
        api.get<ContenidoCarta>('/carta/contenido').catch(() => null),
      ]);
      if (resContenido) setContenido(resContenido);

      setCategorias(Array.isArray(resCarta) ? resCarta : []);
      if (resEstado) setEstadoLocal(resEstado);
      if (resLocal) setDatosLocal(resLocal);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la carta. Por favor verifica tu conexión.',
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrado reactivo de categorías y productos por término de búsqueda
  const categoriasFiltradas = useMemo(() => {
    const qLimpio = normalizarTexto(busqueda.trim());
    if (!qLimpio) return categorias;

    const terminos = qLimpio.split(/\s+/).filter(Boolean);

    return categorias
      .map((cat) => {
        const productosCoincidentes = cat.productos.filter((prod) => {
          const texto = normalizarTexto(`${prod.nombre} ${prod.descripcion || ''}`);
          return terminos.every((t) => texto.includes(t));
        });

        return {
          ...cat,
          productos: productosCoincidentes,
        };
      })
      .filter((cat) => cat.productos.length > 0);
  }, [categorias, busqueda]);

  // Con «TODO» se ve la portada y todas las secciones; con una categoría, solo esa (como el mockup)
  const secciones = useMemo(() => {
    if (busqueda.trim() || categoriaActivaId === 'todo') return categoriasFiltradas;
    return categoriasFiltradas.filter((c) => c.id === categoriaActivaId);
  }, [categoriasFiltradas, categoriaActivaId, busqueda]);

  const fotoDestacada = useMemo(() => {
    const prod = categorias.flatMap((c) => c.productos).find((p) => p.nombre === 'FRAPPE MARACUYÁ' && p.fotoUrl);
    return prod?.fotoUrl ?? categorias.flatMap((c) => c.productos).find((p) => p.fotoUrl)?.fotoUrl ?? null;
  }, [categorias]);

  const estilosPaleta = useMemo(() => {
    const o: Record<string, string> = {};
    (contenido && contenido.decoracion.toUpperCase() !== 'NINGUNO' ? Object.entries(contenido.paleta ?? {}) : []).forEach(([k, v]) => { if (VAR_PALETA[k] && v) o[VAR_PALETA[k]] = v; });
    return o;
  }, [contenido]);
  const rankingPorProducto = useMemo(
    () => new Map((contenido?.rankingMes ?? []).map((r) => [r.productoId, r])),
    [contenido],
  );
  const organizacion = contenido?.organizacion ?? 'SECCIONES';

  const irACarta = () => {
    setPagina('carta');
    setCategoriaActivaId('todo');
    setTimeout(() => document.getElementById('carta-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const cambiarPagina = (p: PaginaCarta) => {
    setPagina(p);
    window.scrollTo({ top: 0 });
  };

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--cp-cream)',
        }}
      >
        <Cargando mensaje="Cargando la carta..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: 'var(--cp-cream)',
        }}
      >
        <EstadoError
          mensaje={error}
          alReintentar={cargarDatos}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        // el mockup en celular maqueta a 476 px y reduce al 82 %: todo se ve más pequeño y cabe más
        zoom: movil ? ZOOM_CELULAR : 1,
        minHeight: movil ? `${100 / ZOOM_CELULAR}vh` : '100vh',
        backgroundColor: 'var(--cp-cream)',
        color: 'var(--cp-navy)',
        display: 'flex',
        flexDirection: 'column',
        ...(estilosPaleta as React.CSSProperties),
      }}
    >
      <DecoracionAnimada tema={contenido?.decoracion ?? 'NINGUNO'} />
      {/* Cabecera pegajosa con las categorías dentro */}
      <CabeceraCarta
        busqueda={busqueda}
        onCambioBusqueda={setBusqueda}
        estadoLocal={estadoLocal}
        datosLocal={datosLocal}
        pagina={pagina}
        onPagina={cambiarPagina}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        categoriaActivaId={categoriaActivaId}
        onCategoria={(id) => {
          setCategoriaActivaId(id);
          setBusqueda('');
        }}
      />

      {pagina === 'conocenos' && <PaginaConocenos datosLocal={datosLocal} estadoLocal={estadoLocal} />}
      {pagina === 'novedades' && <PaginaNovedades novedades={contenido?.novedades ?? []} datosLocal={datosLocal} estadoLocal={estadoLocal} onVerCarta={irACarta} />}

      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (
        <PortadaCarta
          datosLocal={datosLocal}
          estadoLocal={estadoLocal}
          fotoDestacada={fotoDestacada}
          banner={contenido?.banner}
          onPedir={irACarta}
          onVerCarta={irACarta}
        />
      )}

      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (contenido?.destacadas.length ?? 0) > 0 && (
        <div style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '20px 16px 0' : '32px 24px 0' }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 17 : 22, marginBottom: 10 }}>Momentos Caprichos</div>
          <div style={{ display: 'flex', gap: movil ? 10 : 18, overflowX: 'auto', paddingBottom: 4 }}>
            {contenido!.destacadas.map((d, i) => (
              <button key={d.id} aria-label={`Ver fotos: ${d.titulo}`} onClick={() => setVisor(i)}
                style={{ flex: '0 0 auto', border: 0, background: 'transparent', padding: 0, width: movil ? 68 : 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--cp-navy)' }}>
                <span style={{ width: movil ? 60 : 84, height: movil ? 60 : 84, borderRadius: '50%', padding: 3, boxSizing: 'border-box', background: 'linear-gradient(135deg, var(--cp-orange), var(--cp-rust))', display: 'block' }}>
                  <span style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--cp-cream)', boxSizing: 'border-box', overflow: 'hidden', background: 'var(--cp-sand)', display: 'block' }}>
                    {d.portada_url && <img src={d.portada_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, lineHeight: '14px', textAlign: 'center' }}>{d.titulo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (contenido?.novedades.length ?? 0) > 0 && (
        <div style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '20px 16px 0' : '32px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 17 : 22 }}>Novedades</span>
            <button onClick={() => cambiarPagina('novedades')} style={{ minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 800, fontSize: 13 }}>Ver todas</button>
          </div>
          <div style={{ display: 'flex', gap: movil ? 10 : 16, overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
            {contenido!.novedades.slice(0, 4).map((n) => (
              <button key={n.id} onClick={() => cambiarPagina('novedades')}
                style={{ flex: movil ? '0 0 66%' : '0 0 300px', scrollSnapAlign: 'start', border: '1px solid var(--cp-line)', padding: 0, borderRadius: movil ? 16 : 20, background: 'var(--cp-white)', color: 'var(--cp-navy)', textAlign: 'left', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '16 / 9', background: 'var(--cp-gold)' }}>
                  {n.fotos[0] && <img src={n.fotos[0].url} alt="" loading="lazy" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <span style={{ position: 'absolute', left: 8, top: 8, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', background: 'var(--cp-orange)', color: 'var(--cp-navy)', borderRadius: 9999, padding: '3px 9px' }}>
                    {n.tipo === 'BANNER' ? 'EN PORTADA' : n.tipo === 'PROMOCION' ? 'PROMO' : n.tipo === 'IMAGEN' ? 'NOVEDAD' : n.tipo}
                  </span>
                </span>
                <span style={{ padding: '10px 12px 12px', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 14, lineHeight: '18px' }}>{n.titulo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (
        <PromosCarta
          promos={contenido?.promos ?? []}
          fotoDe={(nombre) => categorias.flatMap((c) => c.productos).find((p) => p.nombre === nombre)?.fotoUrl ?? null}
          onAbrir={(nombre) => {
            const prod = categorias.flatMap((c) => c.productos).find((p) => p.nombre === nombre);
            if (prod) abrirModalProducto(prod);
          }}
        />
      )}

      {/* Lista de productos por categoría */}
      {pagina === 'carta' && (
      <main
        id="carta-lista"
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: movil ? '8px 16px 48px' : '24px 24px 64px',
          flex: 1,
        }}
      >
        {secciones.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 20px',
              color: 'var(--cp-soft)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '20px',
                color: 'var(--cp-navy)',
                marginBottom: '8px',
              }}
            >
              No encontramos resultados para &ldquo;{busqueda}&rdquo;
            </div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Prueba con otra palabra o borra el buscador para ver toda la carta.
            </p>
            <button
              onClick={() => setBusqueda('')}
              style={{
                marginTop: '16px',
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: 'var(--cp-orange)',
                color: '#FFFFFF',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              Ver toda la carta
            </button>
          </div>
        ) : (
          secciones.map((cat) => (
            <section
              key={cat.id}
              id={`categoria-${cat.id}`}
              style={{
                marginTop: movil ? '24px' : '32px',
                scrollMarginTop: '140px',
              }}
            >
              {/* Título de categoría estilo mockup con líneas decorativas */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    height: '3px',
                    backgroundColor: 'var(--cp-orange)',
                    borderRadius: '2px',
                  }}
                />
                <h2
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: movil ? '22px' : '28px',
                    lineHeight: movil ? '28px' : '34px',
                    letterSpacing: '0.03em',
                    color: 'var(--cp-navy)',
                    textAlign: 'center',
                  }}
                >
                  {cat.nombre}
                </h2>
                <span
                  style={{
                    flex: 1,
                    height: '3px',
                    backgroundColor: 'var(--cp-orange)',
                    borderRadius: '2px',
                  }}
                />
              </div>

              {/* Grid de productos responsiva */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: organizacion === 'LISTA' ? '1fr' : organizacion === 'TARJETAS' ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: '16px',
                }}
              >
                {cat.productos.map((prod) => (
                  <TarjetaProducto key={prod.id} producto={prod} rankingInfo={rankingPorProducto.get(String(prod.id))} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
      )}

      {pagina === 'carta' && <FormularioComentarios />}

      {visor !== null && contenido && (
        <VisorHistoriasModal historias={contenido.destacadas} destacadaIdxInicial={visor} onCerrar={() => setVisor(null)} />
      )}

      {/* Pie informativo */}
      <footer
        style={{
          borderTop: '1px solid var(--cp-line)',
          backgroundColor: 'var(--cp-sand)',
          padding: '24px 16px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--cp-soft)',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}>
          {datosLocal?.nombre || 'Caprichos'}
        </div>
        <div>{datosLocal?.direccion} {datosLocal?.telefono ? `· Tel: ${datosLocal.telefono}` : ''}</div>
      </footer>

      {/* Ventana modal de detalle del producto */}
      {productoEnModal && (
        <VentanaProductoCarta
          producto={productoEnModal}
          esBebida={['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES'].includes(
            (categorias.find((c) => c.productos.some((p) => p.id === productoEnModal.id))?.nombre ?? '').toUpperCase(),
          )}
          onCerrar={cerrarModalProducto}
        />
      )}

      {/* Pie con términos, privacidad y libro de reclamaciones */}
      <PieLegal />

      {/* Cajón lateral del carrito */}
      <CajonCarrito estadoLocal={estadoLocal} />

      {/* Formulario de Checkout */}
      <FormularioCheckout
        estadoLocal={estadoLocal}
        datosLocal={datosLocal}
      />

      {/* Pantalla de confirmación de pedido */}
      <PantallaConfirmacion />

      {/* Notificación Toast "Agregado a tu pedido" */}
      <NotificacionAgregado />

      {/* Cuenta del cliente */}
      <PanelCuenta />
    </div>
  );
}

export function CartaPublica() {
  return (
    <CarritoProvider>
      <CuentaProvider>
        <ContenidoCartaPublica />
      </CuentaProvider>
    </CarritoProvider>
  );
}
