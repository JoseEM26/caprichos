import { useEffect, useRef, useState } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useCuenta } from './cuenta/CuentaContext';
import { useEsMovil } from './useEsMovil';
import { usePedidosGuardados } from './seguimiento';

export type PaginaCarta = 'carta' | 'novedades' | 'conocenos';

interface CabeceraCartaProps {
  busqueda: string;
  onCambioBusqueda: (valor: string) => void;
  estadoLocal: EstadoLocalCarta | null;
  datosLocal: DatosLocalCarta | null;
  pagina: PaginaCarta;
  onPagina: (p: PaginaCarta) => void;
  categorias: { id: string; nombre: string }[];
  categoriaActivaId: string;
  onCategoria: (id: string) => void;
}

const PAGINAS: [PaginaCarta, string][] = [
  ['carta', 'Carta'],
  ['novedades', 'Novedades'],
  ['conocenos', 'Conócenos'],
];

// objetivo táctil mínimo de 44 px (también en celular)
const TACTIL = 44;

const flecha = {
  flex: 'none',
  width: TACTIL,
  height: TACTIL,
  minHeight: TACTIL,
  border: '1.5px solid var(--cp-navy)',
  borderRadius: TACTIL / 2,
  background: 'transparent',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: 18,
  lineHeight: '18px',
  padding: 0,
} as const;

/**
 * Cabecera fija de la carta (mockup Main ▸ CABECERA FIJA): marca, páginas, buscador, cuenta y carrito,
 * con la franja de categorías dentro del mismo bloque pegado arriba para que no se descuadre al desplazar.
 *
 * Los botones de la derecha («Mis pedidos», puntos y carrito) van juntos en un grupo: así saltan de línea
 * como una sola pieza y nunca se separa el carrito del resto.
 */
export function CabeceraCarta({
  busqueda,
  onCambioBusqueda,
  estadoLocal,
  datosLocal,
  pagina,
  onPagina,
  categorias,
  categoriaActivaId,
  onCategoria,
}: CabeceraCartaProps) {
  const { cantidadTotal, subtotal, abrirCajon, setListaPedidosAbierta } = useCarrito();
  const { cliente, abrirPanel } = useCuenta();
  const movil = useEsMovil();
  // en pantallas medianas «Mi pedido» queda solo con el icono para que la cabecera no baje a dos filas
  const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1240);
  useEffect(() => {
    const alRedimensionar = () => setAngosto(window.innerWidth < 1240);
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);
  const franja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; scroll: number } | null>(null);

  const nombre = datosLocal?.nombre || 'Caprichos';
  const lema = [datosLocal?.lema || 'Cafetería artesanal', estadoLocal?.texto].filter(Boolean).join(' · ');
  const esCarta = pagina === 'carta';
  const cerrado = estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda);
  // Pedidos guardados en este navegador (el más reciente va primero) y cuántos siguen activos
  const guardados = usePedidosGuardados();
  const activos = guardados.filter((p) => !p.terminado).length;
  const etiquetaPedidos = guardados.length === 1 && !cliente ? 'Mi pedido' : 'Mis pedidos';
  const mostrarPedidos = guardados.length > 0 || cliente !== null;
  // puntos siempre con 2 decimales (1.01 pts, 12.00 pts) para que el chip no cambie de ancho
  const puntosTexto = (Number(cliente?.puntos) || 0).toFixed(2);
  // la insignia del carrito tiene tamaño fijo: a partir de 100 productos muestra 99+
  const insigniaCarrito = cantidadTotal > 99 ? '99+' : String(cantidadTotal);

  const mover = (px: number) => franja.current?.scrollBy({ left: px, behavior: 'smooth' });
  const chips = [{ id: 'todo', nombre: 'TODA LA CARTA' }, ...categorias];

  return (
    <>
      {/* El aviso de cierre se desplaza con la página; solo la cabecera queda fija */}
      {cerrado && (
        <div
          role="status"
          style={{ backgroundColor: 'var(--cp-rust)', color: '#FFFFFF', padding: '8px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}
        >
          {estadoLocal.pausaAltaDemanda
            ? 'Pausa por alta demanda: puedes mirar la carta pero no se pueden enviar pedidos'
            : `Local cerrado (${estadoLocal.texto}): puedes mirar la carta pero no se pueden enviar pedidos`}
        </div>
      )}

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: 'var(--cp-cream)',
          borderBottom: '1px solid var(--cp-line)',
        }}
      >
        <header
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            // el safe-area solo tiene efecto si la página se muestra de borde a borde (viewport-fit=cover)
            paddingTop: `calc(${movil ? 6 : 12}px + env(safe-area-inset-top, 0px))`,
            paddingBottom: movil ? 6 : 12,
            paddingLeft: `max(${movil ? 12 : 24}px, env(safe-area-inset-left, 0px))`,
            paddingRight: `max(${movil ? 12 : 24}px, env(safe-area-inset-right, 0px))`,
            boxSizing: 'border-box',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: movil ? '4px 10px' : '12px 20px',
          }}
        >
          <div style={{ order: 1, display: 'flex', alignItems: 'center', gap: movil ? 8 : 12, flex: movil ? '1 1 0' : '0 1 auto', minWidth: 0 }}>
            <img
              src="/logo.webp"
              alt={nombre}
              width={movil ? 32 : 48}
              height={movil ? 32 : 48}
              style={{ flex: 'none', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: movil ? 15 : 20,
                  lineHeight: movil ? '18px' : '24px',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {nombre}
              </div>
              {!movil && (
                <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--cp-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lema}
                </div>
              )}
            </div>
          </div>

          <nav aria-label="Páginas" style={{ order: movil ? 4 : 2, display: 'flex', gap: 4, alignItems: 'center', width: movil ? '100%' : 'auto' }}>
            {PAGINAS.map(([id, texto]) => (
              <button
                key={id}
                onClick={() => onPagina(id)}
                aria-current={pagina === id ? 'page' : undefined}
                style={{
                  flex: 'none',
                  minHeight: TACTIL,
                  padding: movil ? '0 10px' : '0 14px',
                  border: 0,
                  borderBottom: `3px solid ${pagina === id ? 'var(--cp-orange)' : 'transparent'}`,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: movil ? 13 : 14,
                  whiteSpace: 'nowrap',
                }}
              >
                {texto}
              </button>
            ))}
          </nav>

          {esCarta ? (
            <div style={{ order: movil ? 5 : 3, flex: movil ? '1 1 100%' : mostrarPedidos ? '1 1 150px' : '1 1 240px', minWidth: movil ? '100%' : mostrarPedidos ? 110 : 180 }}>
              <label htmlFor="buscar-carta" style={{ position: 'absolute', left: '-9999px' }}>
                Buscar en la carta
              </label>
              <input
                id="buscar-carta"
                type="search"
                value={busqueda}
                onChange={(e) => onCambioBusqueda(e.target.value)}
                placeholder="Buscar en la carta"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: TACTIL,
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 14px',
                  fontSize: movil ? 13 : 14,
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <div style={{ order: 3, flex: 1 }} />
          )}

          {/* Grupo de la derecha: pedidos, puntos y carrito saltan de línea como una sola pieza */}
          <div
            style={{
              order: movil ? 2 : 4,
              flex: 'none',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: movil ? 8 : 12,
            }}
          >
            {mostrarPedidos && (
              <button
                onClick={() => setListaPedidosAbierta(true)}
                aria-label={etiquetaPedidos}
                title={etiquetaPedidos}
                style={{
                  flex: 'none',
                  minHeight: TACTIL,
                  padding: `0 ${movil ? 10 : 14}px`,
                  boxSizing: 'border-box',
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                  <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                  <path d="M9 8h6M9 12h6" />
                </svg>
                {!(movil || angosto) && <span>{etiquetaPedidos}</span>}
                {activos > 0 && (
                  <span
                    aria-label={`${activos} ${activos === 1 ? 'pedido activo' : 'pedidos activos'}`}
                    style={{ flex: 'none', minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 9, backgroundColor: 'var(--cp-orange)', color: '#FFFFFF', fontSize: 11, lineHeight: '18px', textAlign: 'center', fontWeight: 800 }}
                  >
                    {activos}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={abrirPanel}
              aria-label={cliente ? `Mi cuenta: ${cliente.puntos} puntos` : 'Ingresar o crear cuenta'}
              style={{
                flex: 'none',
                minHeight: TACTIL,
                padding: `0 ${movil ? 10 : 14}px`,
                boxSizing: 'border-box',
                borderRadius: 12,
                border: '1.5px solid var(--cp-navy)',
                background: cliente ? 'rgba(230,121,41,0.25)' : 'transparent',
                color: 'var(--cp-navy)',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: 13,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {cliente?.fotoUrl ? (
                // mismo recuadro de 18 px que el icono: la cabecera no cambia de ancho con o sin foto
                <img src={cliente.fotoUrl} alt="" width={18} height={18} style={{ width: 18, height: 18, borderRadius: 9, objectFit: 'cover', flex: 'none' }} />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
                </svg>
              )}
              <span>{cliente ? `${puntosTexto} pts` : 'Ingresar'}</span>
            </button>

            <button
              onClick={abrirCajon}
              aria-label={`Abrir el carrito: ${cantidadTotal} productos, S/ ${subtotal.toFixed(2)}`}
              title={`${cantidadTotal} productos · S/ ${subtotal.toFixed(2)}`}
              style={{
                position: 'relative',
                flex: 'none',
                width: movil ? TACTIL : 48,
                height: TACTIL,
                minHeight: TACTIL,
                padding: 0,
                border: 0,
                borderRadius: 12,
                backgroundColor: 'var(--cp-orange)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6h15l-1.5 9h-12z M6 6L5 3H2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
              </svg>
              {cantidadTotal > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -7,
                    right: -7,
                    pointerEvents: 'none',
                    minWidth: 22,
                    width: 22,
                    height: 22,
                    boxSizing: 'border-box',
                    borderRadius: 11,
                    background: 'var(--cp-navy)',
                    color: 'var(--cp-cream)',
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: 12,
                    lineHeight: '22px',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {insigniaCarrito}
                </span>
              )}
            </button>
          </div>
        </header>

        {esCarta && categorias.length > 0 && (
          <nav
            aria-label="Categorías de la carta"
            style={{ maxWidth: 1200, margin: '0 auto', padding: movil ? '0 12px 6px' : '0 24px 10px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {movil && (
              <button onClick={() => mover(-220)} aria-label="Ver categorías anteriores" style={flecha}>
                ‹
              </button>
            )}
            <div
              ref={franja}
              onMouseDown={(e) => {
                arrastre.current = { x: e.clientX, scroll: franja.current?.scrollLeft ?? 0 };
              }}
              onMouseMove={(e) => {
                if (arrastre.current && franja.current) franja.current.scrollLeft = arrastre.current.scroll - (e.clientX - arrastre.current.x);
              }}
              onMouseUp={() => (arrastre.current = null)}
              onMouseLeave={() => (arrastre.current = null)}
              style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, overflowX: 'auto', cursor: 'grab', scrollbarWidth: 'none' }}
            >
              {chips.map((c) => {
                const activa = categoriaActivaId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onCategoria(c.id)}
                    aria-pressed={activa}
                    style={{
                      flex: 'none',
                      minHeight: TACTIL,
                      padding: movil ? '0 12px' : '0 16px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-navy)',
                      background: activa ? 'var(--cp-navy)' : 'var(--cp-white)',
                      color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 700,
                      fontSize: movil ? 10 : 12,
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.nombre}
                  </button>
                );
              })}
            </div>
            {movil && (
              <button onClick={() => mover(220)} aria-label="Ver más categorías" style={flecha}>
                ›
              </button>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
