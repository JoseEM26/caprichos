import { useRef } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useEsMovil } from './useEsMovil';
import { MenuOpciones } from './MenuOpciones';
import { TEXTO_CERRADO_PROGRAMAR, type ProgramarCarta } from './ProgramarPedido';

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
  /** Botón «Instalar app» (false en la vista previa del diseñador) */
  mostrarInstalar?: boolean;
  /** Botón «Reservar mesa» (false en la vista previa del diseñador) */
  mostrarReservar?: boolean;
  /** Local cerrado con «programar fuera de horario»: el aviso invita a programar en vez de decir que no se puede pedir. */
  programar?: ProgramarCarta | null;
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
 * Los botones de la derecha («Instalar app», «Mis pedidos», puntos y carrito) van juntos en un grupo: así saltan de línea
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
  mostrarInstalar = true,
  mostrarReservar = true,
  programar = null,
}: CabeceraCartaProps) {
  const { cantidadTotal, subtotal, abrirCajon } = useCarrito();
  const movil = useEsMovil();
  const franja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; scroll: number } | null>(null);

  const nombre = datosLocal?.nombre || 'Caprichos';
  const lema = [datosLocal?.lema || 'Cafetería artesanal', estadoLocal?.texto].filter(Boolean).join(' · ');
  const esCarta = pagina === 'carta';
  const cerrado = estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda);
  // Cerrado por horario pero se puede programar: aviso amable en vez del aviso de «no se puede pedir»
  const puedeProgramar = Boolean(cerrado && programar && !estadoLocal?.pausaAltaDemanda);
  // la insignia del carrito tiene tamaño fijo: a partir de 100 productos muestra 99+
  const insigniaCarrito = cantidadTotal > 99 ? '99+' : String(cantidadTotal);

  const mover = (px: number) => franja.current?.scrollBy({ left: px, behavior: 'smooth' });
  const chips = [{ id: 'todo', nombre: 'TODA LA CARTA' }, ...categorias];

  return (
    <>
      {/* El aviso de cierre se desplaza con la página; solo la cabecera queda fija */}
      {puedeProgramar && (
        <div
          role="status"
          data-testid="banner-programar"
          style={{ backgroundColor: 'var(--cp-navy)', color: '#FFFFFF', padding: '8px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700 }}
        >
          {TEXTO_CERRADO_PROGRAMAR}
        </div>
      )}
      {cerrado && !puedeProgramar && (
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
            gap: movil ? '4px 6px' : '12px 20px',
          }}
        >
          <div style={{ order: 1, display: 'flex', alignItems: 'center', gap: movil ? 8 : 12, flex: movil ? '0 0 auto' : '0 1 auto', minWidth: 0 }}>
            <img
              src="/logo.webp"
              alt={nombre}
              width={movil ? 32 : 48}
              height={movil ? 32 : 48}
              style={{ flex: 'none', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
            {!movil && <div style={{ minWidth: 0 }}>
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
              <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--cp-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lema}
              </div>
            </div>}
          </div>

          <nav aria-label="Páginas" style={{ order: 2, display: 'flex', gap: 0, alignItems: 'center', minWidth: 0, flex: movil ? '1 1 0' : 'none', overflowX: movil ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
            {PAGINAS.map(([id, texto]) => (
              <button
                key={id}
                onClick={() => onPagina(id)}
                aria-current={pagina === id ? 'page' : undefined}
                style={{
                  flex: 'none',
                  minHeight: TACTIL,
                  padding: movil ? '0 7px' : '0 14px',
                  border: 0,
                  borderBottom: `3px solid ${pagina === id ? 'var(--cp-orange)' : 'transparent'}`,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: movil ? 12 : 14,
                  whiteSpace: 'nowrap',
                }}
              >
                {texto}
              </button>
            ))}
          </nav>

          {esCarta ? (
            <div style={{ order: movil ? 5 : 3, flex: movil ? '1 1 100%' : '1 1 240px', minWidth: movil ? '100%' : 180 }}>
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

          {/* Grupo de la derecha: carrito y menú «Opciones» (cuenta, avatar, pedidos, reservas, instalar) */}
          <div
            style={{
              order: movil ? 3 : 4,
              flex: 'none',
              marginLeft: movil ? 0 : 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: movil ? 8 : 12,
            }}
          >

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

            <MenuOpciones mostrarInstalar={mostrarInstalar} mostrarReservar={mostrarReservar} />
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
