import { PieLegal } from './legal';
import { Fragment, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { DispositivoForzado } from './useEsMovil';
import { resolverDisposicion, medidasMomento, anchoNovedad, gridColumnas } from './disposicion';
import type { IdSeccionCarta } from './disposicion';
import { api } from '../comun/api';
import { Cargando } from '../comun/Cargando';
import { EstadoError } from '../comun/EstadoError';
import {
  CategoriaCarta,
  DatosLocalCarta,
  EstadoLocalCarta,
} from './tipos';
import { CarritoProvider, useCarrito } from './CarritoContext';
import { abrirSeguimientoDesdeEnlace, leerEnlaceSeguimiento } from './seguimiento';
import { CabeceraCarta } from './CabeceraCarta';
import type { PaginaCarta } from './CabeceraCarta';
import { BannerMesCarta, FranjaDatosCarta } from './PortadaCarta';
import { PaginaConocenos } from './PaginaConocenos';
import type { ContenidoConocenos } from './conocenosContenido';
import { PaginaNovedades } from './PaginaNovedades';
import type { FotoMosaico } from './MosaicoMomentos';
import { CuentaProvider } from './cuenta/CuentaContext';
import { PanelCuenta } from './cuenta/PanelCuenta';
import { useEsMovil } from './useEsMovil';
import { TarjetaProducto } from './TarjetaProducto';
import { TarjetaOferta } from './TarjetaOferta';
import type { OfertaItem } from '../admin/ofertas/ofertasApi';
import { VentanaProductoCarta } from './VentanaProductoCarta';
import { comboDeProducto } from './ReemplazoCombo';
import { CajonCarrito } from './CajonCarrito';
import { FormularioCheckout } from './FormularioCheckout';
import { PantallaConfirmacion } from './PantallaConfirmacion';
import { MisPedidos } from './MisPedidos';
import { NotificacionAgregado } from './NotificacionAgregado';
import { DecoracionAnimada } from './contenido/DecoracionAnimada';
import { VisorHistoriasModal, extraerOffDeUrl, limpiarUrlFoto } from './contenido/VisorHistoriasModal';
import type { HistoriaCírculo } from './contenido/VisorHistoriasModal';
import { FormularioComentarios } from './contenido/FormularioComentarios';
import { CarruselResenas } from './CarruselResenas';
import { FranjaNovedades, ordenarNovedadesCarta } from './PaginaNovedades';
import type { NovedadCarta } from './PaginaNovedades';
import type { BannerCarta } from './PortadaCarta';
import { FranjaAvisoCarta } from './FranjaAvisoCarta';
import { useBeneficiosCarta } from './useBeneficiosCarta';
import { TextoEd, useEdicion } from './edicion';
import { ModalAvisoEntrada } from './ModalAvisoEntrada';

const INFO_CATEGORIA: Record<string, { title: string; note: string }> = {
  COMBOS: { title: 'Combos Dúo', note: 'Precio por tamaño de bebida' },
  FRAPPES: { title: 'Frappes', note: 'Todos al mismo precio: 12 oz s/ 14.50 · 16 oz s/ 16.50 · 21 oz s/ 17.50' },
  ICED: { title: 'Iced', note: 'Bebidas frías con hielo' },
  FROZEN: { title: 'Frozen', note: 'Solo tamaño extra de 21 oz' },
  CALIENTES: { title: 'Calientes', note: 'Servidas en taza de vidrio' },
  WAFFLES: { title: 'Waffles', note: 'Completo o 1/2' },
  SALADOS: { title: 'Salados', note: 'Hamburguesas, sándwiches, papas, petit pan y empanadas' },
  CROISSANTS: { title: 'Croissants artesanales', note: 'Hojaldrados, hechos a mano' },
  POSTRES: { title: 'Postres', note: 'Donas, galletas, tortas y postres individuales' },
  COMPLEMENTOS: { title: 'Postres', note: 'Donas, galletas, tortas y postres individuales' },
};

export interface ContenidoCarta {
  decoracion: string;
  disposicion?: unknown;
  organizacion: 'SECCIONES' | 'LISTA' | 'TARJETAS';
  paleta: Record<string, string>;
  novedades: NovedadCarta[];
  destacadas: HistoriaCírculo[];
  rankingMes: { productoId: string; puesto: number; estrellas: number; textoEstrellas: string }[];
  banner: BannerCarta;
  conocenos?: ContenidoConocenos;
  novedadesEncabezado?: {
    etiqueta: string;
    titulo: string;
    subtitulo: string;
  };
  /** Fotos propias de «Momentos Caprichos» de Novedades (solo las activas en la carta). */
  novedadesMomentos?: FotoMosaico[];
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

/** Datos con los que la vista previa del diseñador pinta la misma carta, sin pedir nada al cliente. */
export interface VistaPreviaCarta {
  categorias: CategoriaCarta[];
  ofertas: OfertaItem[];
  estadoLocal: EstadoLocalCarta | null;
  datosLocal: DatosLocalCarta | null;
  contenido: ContenidoCarta;
}

function ContenidoCartaPublica({ vistaPrevia, paginaInicial }: { vistaPrevia?: VistaPreviaCarta; paginaInicial?: PaginaCarta }) {
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [ofertasBase, setOfertas] = useState<OfertaItem[]>([]);
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocalCarta | null>(null);
  const [datosLocal, setDatosLocal] = useState<DatosLocalCarta | null>(null);
  const [contenido, setContenido] = useState<ContenidoCarta | null>(null);
  const [visor, setVisor] = useState<number | null>(null);
  const [cargando, setCargando] = useState(!vistaPrevia);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todo');
  const [pagina, setPagina] = useState<PaginaCarta>(paginaInicial ?? 'carta');
  const movil = useEsMovil();
  const ed = useEdicion();
  // En la carta pública las promociones ocultas no existen; en el diseñador se ven atenuadas para poder mostrarlas.
  const ofertas = useMemo(() => (ed ? ofertasBase : ofertasBase.filter((o) => o.visibleCarta !== false)), [ofertasBase, ed]);

  const { productoEnModal, cerrarModalProducto, abrirModalProducto, setListaPedidosAbierta, setSeguimientoAbierto } = useCarrito();

  // Enlace del bot o del aviso «pedido recibido»: abre directo el seguimiento de ese pedido (si el token no coincide, no pasa nada)
  useEffect(() => {
    if (vistaPrevia) return;
    const enlace = leerEnlaceSeguimiento();
    if (!enlace) return;
    void abrirSeguimientoDesdeEnlace(enlace).then((estado) => {
      if (estado) setSeguimientoAbierto({ codigo: estado.codigo, token: enlace.token, modalidad: estado.modalidad, nombre: '', creadoEn: '' });
    });
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [resCarta, resEstado, resLocal, resContenido, resOfertas] = await Promise.all([
        api.get<CategoriaCarta[]>('/carta'),
        api.get<EstadoLocalCarta>('/carta/estado').catch(() => null),
        api.get<DatosLocalCarta>('/carta/local').catch(() => null),
        api.get<ContenidoCarta>('/carta/contenido').catch(() => null),
        api.get<OfertaItem[]>('/carta/ofertas').catch(() => []),
      ]);
      if (resContenido) setContenido(resContenido);

      setCategorias(Array.isArray(resCarta) ? resCarta : []);
      setOfertas(Array.isArray(resOfertas) ? resOfertas : []);
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
    if (!vistaPrevia) cargarDatos();
  }, []);

  // Vista previa: los datos llegan del diseñador (borrador) y se actualizan al cambiar cualquier control
  useEffect(() => {
    if (!vistaPrevia) return;
    setCategorias(vistaPrevia.categorias);
    setOfertas(vistaPrevia.ofertas);
    setEstadoLocal(vistaPrevia.estadoLocal);
    setDatosLocal(vistaPrevia.datosLocal);
    setContenido(vistaPrevia.contenido);
    setCargando(false);
  }, [vistaPrevia]);

  // Todos los productos planos para vincular ofertas
  const todosLosProductos = useMemo(
    () => categorias.flatMap((c) => c.productos),
    [categorias],
  );

  // Filtrado reactivo de ofertas por búsqueda
  const ofertasFiltradas = useMemo(() => {
    const qLimpio = normalizarTexto(busqueda.trim());
    if (!qLimpio) return ofertas;

    const terminos = qLimpio.split(/\s+/).filter(Boolean);
    return ofertas.filter((o) => {
      const texto = normalizarTexto(`${o.nombre} ${o.descripcion || ''} ${o.productoNombre || ''}`);
      return terminos.every((t) => texto.includes(t));
    });
  }, [ofertas, busqueda]);

  // Si se debe mostrar la sección de promociones
  const mostrarPromociones =
    (categoriaActivaId === 'todo' || categoriaActivaId === 'promociones') &&
    ofertasFiltradas.length > 0;

  // Lista de chips para la cabecera (Promociones destacada después de TODA LA CARTA)
  const categoriasChips = useMemo(() => {
    const lista: { id: string; nombre: string }[] = [];
    if (ofertas.length > 0) {
      lista.push({ id: 'promociones', nombre: 'PROMOCIONES' });
    }
    lista.push(...categorias.map((c) => ({ id: c.id, nombre: c.nombre })));
    return lista;
  }, [ofertas, categorias]);

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
    if (categoriaActivaId === 'promociones') return [];
    if (busqueda.trim() || categoriaActivaId === 'todo') return categoriasFiltradas;
    return categoriasFiltradas.filter((c) => c.id === categoriaActivaId);
  }, [categoriasFiltradas, categoriaActivaId, busqueda]);

  const sinResultados = !mostrarPromociones && secciones.length === 0;

  const fotoDestacada = useMemo(() => {
    if (contenido?.banner?.foto) return contenido.banner.foto;
    const productos = categorias.flatMap((c) => c.productos);
    const objetivo = (contenido?.banner?.target || '').toUpperCase();
    const elegido = objetivo ? productos.find((p) => p.nombre.toUpperCase() === objetivo && p.fotoUrl) : undefined;
    const prod = elegido ?? productos.find((p) => p.nombre === 'FRAPPE MARACUYÁ' && p.fotoUrl);
    return prod?.fotoUrl ?? productos.find((p) => p.fotoUrl)?.fotoUrl ?? null;
  }, [categorias, contenido]);

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
  const disp = useMemo(() => resolverDisposicion(contenido?.disposicion), [contenido]);

  const destacadasVisibles = useMemo(() => {
    return (contenido?.destacadas ?? [])
      .filter((d) => d.activo !== false && !extraerOffDeUrl(d.portada_url) && Array.isArray(d.fotos) && d.fotos.length > 0)
      .map((d) => ({
        ...d,
        portada_url: limpiarUrlFoto(d.portada_url || d.fotos[0]?.url || ''),
      }));
  }, [contenido]);

  // Las fotos de las novedades de ejemplo ya vienen de la base (contenido-base del API).
  const novedadesEnriquecidas = useMemo(() => ordenarNovedadesCarta(contenido?.novedades ?? []), [contenido]);

  const mapaBeneficios = useBeneficiosCarta(ofertas, categorias);

  const irAPromociones = () => {
    setPagina('carta');
    setCategoriaActivaId('todo');
    setTimeout(() => {
      const el = document.getElementById('categoria-promociones');
      if (el) {
        if (!vistaPrevia) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setCategoriaActivaId('promociones');
      }
    }, 100);
  };

  const irACarta = () => {
    setPagina('carta');
    setCategoriaActivaId('todo');
    if (!vistaPrevia) setTimeout(() => document.getElementById('carta-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const pedirDestacadoPortada = () => {
    const objetivo = (contenido?.banner?.target || 'FRAPPE MARACUYÁ').toUpperCase();
    const prod = categorias
      .flatMap((c) => c.productos)
      .find((p) => p.nombre.toUpperCase() === objetivo);
    if (prod) {
      abrirModalProducto(prod);
    } else {
      irACarta();
    }
  };

  const cambiarPagina = (p: PaginaCarta) => {
    if (ed) return; // el editor en sitio muestra una sola página
    setPagina(p);
    if (!vistaPrevia) window.scrollTo({ top: 0 });
  };

  const irArriba = () => {
    if (vistaPrevia) return;
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // Orden y visibilidad de las secciones de la carta (ajustes del diseñador)
  const renderSeccion = (id: IdSeccionCarta): ReactNode => {
    switch (id) {
      case 'mes':
        return (
          <>
      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (
        <BannerMesCarta
          fotoDestacada={fotoDestacada}
          banner={contenido?.banner}
          onPedir={pedirDestacadoPortada}
          onVerCarta={irACarta}
          tamanoPc={disp.banner.tamanoPc}
          tamanoCelular={disp.banner.tamanoCelular}
          ajusteFoto={disp.banner.ajusteFoto}
          focoFoto={disp.banner.focoFoto}
        />
      )}
          </>
        );
      case 'franja':
        return (
          <>
      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (
        <FranjaDatosCarta datosLocal={datosLocal} estadoLocal={estadoLocal} items={disp.franja.items} />
      )}
          </>
        );
      case 'momentos': {
        // En edición se ven todos los momentos (también los ocultos o sin fotos) y se puede agregar uno
        const lista = ed
          ? (contenido?.destacadas ?? []).map((d) => ({ ...d, portada_url: limpiarUrlFoto(d.portada_url || d.fotos?.[0]?.url || '') }))
          : destacadasVisibles;
        const m = medidasMomento(disp.momentos.tamano, movil);
        const circulo = (d: (typeof lista)[number], i: number) => {
          const Etiqueta = ed ? 'div' : 'button';
          const cuerpo = (
            <Etiqueta
              key={d.id}
              {...(ed ? {} : { 'aria-label': `Ver fotos: ${d.titulo}`, onClick: () => setVisor(i) })}
              style={{
                flex: 'none',
                scrollSnapAlign: 'start',
                border: 0,
                background: 'transparent',
                padding: 0,
                width: m.ancho,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                color: 'var(--cp-navy)',
                cursor: ed ? 'default' : 'pointer',
              }}
            >
              <span style={{ width: m.circulo, height: m.circulo, borderRadius: '50%', padding: 3, boxSizing: 'border-box', background: 'linear-gradient(135deg, var(--cp-orange), var(--cp-rust))', display: 'block' }}>
                <span style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid var(--cp-cream)', boxSizing: 'border-box', overflow: 'hidden', background: 'color-mix(in srgb, var(--cp-line) 55%, var(--cp-white))', color: 'var(--cp-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {d.portada_url ? (
                    <img src={d.portada_url} alt="" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                      <circle cx="12" cy="13.5" r="3.5" />
                    </svg>
                  )}
                </span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, lineHeight: '14px', textAlign: 'center' }}>
                <TextoEd clave={`momento:${d.id}:titulo`} valor={d.titulo} ayuda="Título del momento" />
              </span>
            </Etiqueta>
          );
          return ed ? ed.bloque(`momento:${d.id}`, cuerpo, { debajo: true, estilo: { flex: 'none' } }) : cuerpo;
        };
        return (
          <>
      {pagina === 'carta' && !busqueda.trim() && categoriaActivaId === 'todo' && (lista.length > 0 || ed) && (
        <div style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '20px 16px 0' : '32px 24px 0' }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 17 : 22, marginBottom: 10 }}>Momentos Caprichos</div>
          <div
            style={{
              display: 'flex',
              gap: movil ? 10 : 18,
              ...(ed ? { flexWrap: 'wrap', paddingBottom: 56 } : { overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: 4, scrollbarWidth: 'none' }),
            }}
          >
            {lista.map((d, i) => circulo(d, i))}
            {ed && ed.agregar('momento', 'Agregar un momento', { width: m.ancho, height: m.circulo })}
          </div>
        </div>
      )}
          </>
        );
      }
      case 'novedades':
        return (
          <>
      {pagina === 'carta' && !busqueda.trim() && novedadesEnriquecidas.length > 0 && (
        <FranjaNovedades
          novedades={novedadesEnriquecidas}
          onVerTodas={() => cambiarPagina('novedades')}
          onVerCarta={irACarta}
          anchoTarjeta={anchoNovedad(disp.novedades.tamano, movil)}
        />
      )}


          </>
        );
      case 'categorias':
        return (
          <>
      {/* Lista de productos por categoría */}
      {pagina === 'carta' && (
      <main
        id="carta-lista"
        style={{
          maxWidth: '1200px',
          width: '100%',
          boxSizing: 'border-box',
          margin: '0 auto',
          padding: movil ? '8px 16px 48px' : '24px 24px 64px',
          flex: 1,
        }}
      >
        {sinResultados ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 0',
              color: 'var(--cp-soft)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '20px',
                color: 'var(--cp-navy)',
              }}
            >
              No encontramos &ldquo;{busqueda}&rdquo;
            </div>
            <div style={{ marginTop: '4px', color: 'var(--cp-soft)' }}>
              Prueba con otra palabra o elige una categoría.
            </div>
            <button
              onClick={() => {
                setBusqueda('');
                setCategoriaActivaId('todo');
              }}
              style={{
                marginTop: '16px',
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              Ver toda la carta
            </button>
          </div>
        ) : (
          <>
            {mostrarPromociones && (
              <section
                id="categoria-promociones"
                data-testid="categoria-promociones"
                style={{
                  marginTop: '32px',
                  scrollMarginTop: '140px',
                }}
              >
                {/* Título de categoría estilo mockup con líneas decorativas */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
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
                      margin: 0,
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '28px',
                      lineHeight: '34px',
                      letterSpacing: '0.03em',
                      color: 'var(--cp-navy)',
                      textAlign: 'center',
                    }}
                  >
                    Promociones
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
                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--cp-soft)', margin: '-8px 0 16px' }}>
                  Combos especiales, 2x1 y promociones por tiempo limitado
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumnas(movil, organizacion, disp.carta.columnasPc),
                    gap: '16px',
                  }}
                >
                  {ofertasFiltradas.map((ofe) => {
                    const tarjeta = (
                      <TarjetaOferta
                        key={ofe.id}
                        oferta={ofe}
                        productos={todosLosProductos}
                        categorias={categorias}
                        onSeleccionarCategoria={(catId) => {
                          setCategoriaActivaId(catId);
                          setBusqueda('');
                        }}
                      />
                    );
                    return ed ? ed.bloque(`promo:${ofe.id}`, tarjeta) : tarjeta;
                  })}
                </div>
              </section>
            )}

            {categoriaActivaId !== 'promociones' &&
              secciones.map((cat) => {
                const clave = cat.nombre.trim().toUpperCase();
                const infoCat = INFO_CATEGORIA[clave] ?? { title: cat.nombre, note: '' };
                const seccionCategoria = (
                  <section
                    key={cat.id}
                    id={`categoria-${cat.id}`}
                    style={{
                      marginTop: '32px',
                      scrollMarginTop: '140px',
                    }}
                  >
                    {/* Título de categoría estilo mockup con líneas decorativas */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
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
                          margin: 0,
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 800,
                          fontSize: '28px',
                          lineHeight: '34px',
                          letterSpacing: '0.03em',
                          color: 'var(--cp-navy)',
                          textAlign: 'center',
                        }}
                      >
                        {infoCat.title}
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
                    {infoCat.note && (
                      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--cp-soft)', margin: '-8px 0 16px' }}>
                        {infoCat.note}
                      </div>
                    )}

                    {/* Grid de productos responsiva */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: gridColumnas(movil, organizacion, disp.carta.columnasPc),
                        gap: '16px',
                      }}
                    >
                      {cat.productos.map((prod) => {
                        const tarjeta = (
                          <TarjetaProducto
                            key={prod.id}
                            producto={prod}
                            rankingInfo={rankingPorProducto.get(String(prod.id))}
                            organizacion={organizacion}
                            insigniaBeneficio={mapaBeneficios.get(String(prod.id))}
                          />
                        );
                        return ed ? ed.bloque(`producto:${prod.id}`, tarjeta) : tarjeta;
                      })}
                    </div>
                  </section>
                );
                return ed ? ed.bloque(`categoria:${cat.id}`, seccionCategoria) : seccionCategoria;
              })}
          </>
        )}
      </main>
      )}


          </>
        );
      default:
        return null;
    }
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

  const nombreMarca = (datosLocal?.nombre || 'Caprichos').toUpperCase();
  const descLocal =
    'Creamos momentos para compartir con experiencias gastronómicas artesanales: ingredientes premium, procesos hechos a mano y sin químicos.';
  const dirLocal = datosLocal?.direccion || 'Campoy, San Juan de Lurigancho, Lima';
  const horarioTexto = 'Todos los días, de 2:00 pm a 10:00 pm';
  const mapaUrl =
    'https://www.google.com/maps/search/?api=1&query=Caprichos%20Campoy%20Lima';
  const telLocal = datosLocal?.telefono || '9XX XXX XXX';
  const waNum = String(datosLocal?.whatsapp || '51900000000').replace(/\D/g, '');
  const waUrl = `https://wa.me/${waNum || '51900000000'}`;
  const envioGratis = datosLocal?.envioGratisDesde ?? 70;
  const pedidoMin = datosLocal?.pedidoMinimo ?? 14.5;
  const fmtMonto = (m: number) => `s/ ${Number.isInteger(m) ? m : m.toFixed(2)}`;
  const lineaPie = `Horario: ${horarioTexto} · Delivery gratis por compras de más de ${fmtMonto(envioGratis)} · Pedido mínimo de delivery ${fmtMonto(pedidoMin)}`;
  const redes = [
    { n: datosLocal?.redes?.instagramNombre || '@caprichos (ejemplo)', url: datosLocal?.redes?.instagram || 'https://www.instagram.com/' },
    { n: 'Facebook', url: datosLocal?.redes?.facebook || 'https://www.facebook.com/' },
    { n: 'TikTok', url: datosLocal?.redes?.tiktok || 'https://www.tiktok.com/' },
  ].filter((r) => r.url);

  return (
    <div
      style={{
        // el mockup en celular maqueta a 476 px y reduce al 82 %: todo se ve más pequeño y cabe más
        zoom: movil ? ZOOM_CELULAR : 1,
        minHeight: vistaPrevia ? undefined : movil ? `${100 / ZOOM_CELULAR}vh` : '100vh',
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
        categorias={categoriasChips}
        categoriaActivaId={categoriaActivaId}
        onCategoria={(id) => {
          setCategoriaActivaId(id);
          setBusqueda('');
        }}
      />

      {/* Franja de aviso de promociones de hoy */}
      <FranjaAvisoCarta
        ofertas={ofertas}
        categorias={categorias}
        onVerPromociones={irAPromociones}
        storageKey={vistaPrevia ? 'caprichos_preview_franja_aviso' : undefined}
      />

      {pagina === 'conocenos' && <PaginaConocenos datosLocal={datosLocal} estadoLocal={estadoLocal} contenido={contenido?.conocenos} />}
      {pagina === 'novedades' && (
        <PaginaNovedades
          novedades={novedadesEnriquecidas}
          datosLocal={datosLocal}
          estadoLocal={estadoLocal}
          onVerCarta={irACarta}
          encabezado={contenido?.novedadesEncabezado}
          momentos={contenido?.novedadesMomentos}
        />
      )}

      {pagina === 'carta' &&
        disp.secciones.map((sec) =>
          ed ? ed.bloque(`seccion:${sec.id}`, renderSeccion(sec.id)) : sec.visible ? <Fragment key={sec.id}>{renderSeccion(sec.id)}</Fragment> : null,
        )}
      {pagina === 'carta' && !vistaPrevia && <CarruselResenas />}
      {pagina === 'carta' && !vistaPrevia && <FormularioComentarios />}

      {visor !== null && destacadasVisibles.length > 0 && (
        <VisorHistoriasModal historias={destacadasVisibles} destacadaIdxInicial={visor} onCerrar={() => setVisor(null)} />
      )}

      {/* Pie de página estilo mockup (4 columnas en fondo oscuro) */}
      <footer
        style={{
          marginTop: movil ? 24 : 40,
          backgroundColor: 'var(--cp-navy)',
          color: 'var(--cp-cream)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: movil ? '24px 16px 8px' : '36px 24px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: movil ? 20 : 32,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ flex: '1.4 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.webp" alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover' }} />
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, letterSpacing: '0.04em' }}>
                {nombreMarca}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: '19px', opacity: 0.85 }}>{descLocal}</div>
          </div>

          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', color: 'var(--cp-orange)' }}>
              VISÍTANOS
            </div>
            <div style={{ fontSize: 13, lineHeight: '19px' }}>{dirLocal}</div>
            <div style={{ fontSize: 13, lineHeight: '19px', opacity: 0.85 }}>{horarioTexto}</div>
            <a
              href={mapaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-cream)', textDecoration: 'underline', minHeight: 32, display: 'flex', alignItems: 'center' }}
            >
              Cómo llegar
            </a>
          </div>

          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', color: 'var(--cp-orange)' }}>
              CONTACTO
            </div>
            <div style={{ fontSize: 13, lineHeight: '19px' }}>{telLocal}</div>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                minHeight: 40,
                padding: '0 14px',
                boxSizing: 'border-box',
                borderRadius: 12,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                alignSelf: 'flex-start',
              }}
            >
              Escríbenos por WhatsApp
            </a>
          </div>

          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', color: 'var(--cp-orange)' }}>
              SÍGUENOS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {redes.map((r) => (
                <a
                  key={r.n}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: 36,
                    padding: '0 12px',
                    boxSizing: 'border-box',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-cream)',
                    color: 'var(--cp-cream)',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  {r.n}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
              <button onClick={() => cambiarPagina('carta')} style={{ minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>
                Carta
              </button>
              <button onClick={() => cambiarPagina('novedades')} style={{ minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>
                Novedades
              </button>
              <button onClick={() => cambiarPagina('conocenos')} style={{ minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>
                Conócenos
              </button>
              <button onClick={irArriba} style={{ minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>
                Volver arriba
              </button>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid color-mix(in srgb, var(--cp-cream) 25%, transparent)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', fontSize: 12, lineHeight: '17px', opacity: 0.8, textAlign: 'center' }}>
            {lineaPie} · © 2026 Caprichos
          </div>
        </div>
      </footer>

      {/* Ventana modal de detalle del producto */}
      {productoEnModal && (
        <VentanaProductoCarta
          producto={productoEnModal}
          esBebida={['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES'].includes(
            (categorias.find((c) => c.productos.some((p) => p.id === productoEnModal.id))?.nombre ?? '').toUpperCase(),
          )}
          onCerrar={cerrarModalProducto}
          oferta={comboDeProducto(ofertas, productoEnModal.id)}
        />
      )}

      {/* Pie con términos, privacidad y libro de reclamaciones */}
      {!vistaPrevia && <PieLegal />}

      {!vistaPrevia && (
        <>
      {/* Cajón lateral del carrito */}
      <CajonCarrito
        estadoLocal={estadoLocal}
        datosLocal={datosLocal}
        ofertas={ofertas}
        categorias={categorias}
      />

      {/* Ventana opcional de bienvenida con la mejor promoción del día */}
      <ModalAvisoEntrada
        ofertas={ofertas}
        categorias={categorias}
        estadoLocal={estadoLocal}
        onVerPromocion={irAPromociones}
      />

      {/* Formulario de Checkout */}
      <FormularioCheckout
        estadoLocal={estadoLocal}
        datosLocal={datosLocal}
      />

      {/* Pantalla de confirmación de pedido */}
      <PantallaConfirmacion />

      {/* Historial de pedidos («Mis pedidos») */}
      <MisPedidos />

      {/* Notificación Toast "Agregado a tu pedido" */}
      <NotificacionAgregado />

      {/* Cuenta del cliente */}
      <PanelCuenta alVerPedidos={() => setListaPedidosAbierta(true)} invitadoPermitido={datosLocal?.invitadoPermitido === true} />
        </>
      )}
    </div>
  );
}

/** Vista previa del diseñador: la misma carta (mismos componentes), con datos del borrador y sin navegar ni pedir. */
export function CartaVistaPrevia({ datos, movil, pagina }: { datos: VistaPreviaCarta; movil: boolean; pagina?: PaginaCarta }) {
  return (
    <DispositivoForzado movil={movil}>
      <CarritoProvider>
        <CuentaProvider>
          <ContenidoCartaPublica vistaPrevia={datos} paginaInicial={pagina} />
        </CuentaProvider>
      </CarritoProvider>
    </DispositivoForzado>
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
