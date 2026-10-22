import { useRef } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { useCuenta } from './cuenta/CuentaContext';
import { useEsMovil } from './useEsMovil';

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

const flecha = {
  flex: 'none',
  width: 36,
  height: 36,
  minHeight: 36,
  border: '1.5px solid var(--cp-navy)',
  borderRadius: 18,
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
  const { cantidadTotal, subtotal, abrirCajon } = useCarrito();
  const { cliente, abrirPanel } = useCuenta();
  const movil = useEsMovil();
  const franja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; scroll: number } | null>(null);

  const nombre = datosLocal?.nombre || 'Caprichos';
  const lema = ['Cafetería artesanal', estadoLocal?.texto].filter(Boolean).join(' · ');
  const esCarta = pagina === 'carta';
  const cerrado = estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda);
  const alto = movil ? 40 : 44;

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
          padding: movil ? '6px 12px' : '12px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: movil ? '4px 10px' : '12px 20px',
        }}
      >
        <div style={{ order: 1, display: 'flex', alignItems: 'center', gap: movil ? 8 : 12, flex: movil ? 1 : 'none', minWidth: 0 }}>
          <img
            src="/logo.webp"
            alt={nombre}
            width={movil ? 32 : 48}
            height={movil ? 32 : 48}
            style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 15 : 20, lineHeight: movil ? '18px' : '24px', letterSpacing: '0.02em' }}>
              {nombre}
            </div>
            {!movil && <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--cp-soft)' }}>{lema}</div>}
          </div>
        </div>

        <nav aria-label="Páginas" style={{ order: movil ? 4 : 2, display: 'flex', gap: 4, alignItems: 'center', width: movil ? '100%' : 'auto' }}>
          {PAGINAS.map(([id, texto]) => (
            <button
              key={id}
              onClick={() => onPagina(id)}
              aria-current={pagina === id ? 'page' : undefined}
              style={{
                minHeight: movil ? 36 : 44,
                padding: movil ? '0 10px' : '0 14px',
                border: 0,
                borderBottom: `3px solid ${pagina === id ? 'var(--cp-orange)' : 'transparent'}`,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: movil ? 13 : 14,
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
                minHeight: alto,
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

        <button
          onClick={abrirPanel}
          aria-label={cliente ? `Mi cuenta: ${cliente.puntos} puntos` : 'Ingresar o crear cuenta'}
          style={{
            order: movil ? 2 : 4,
            flex: 'none',
            minHeight: alto,
            padding: `0 ${movil ? 10 : 14}px`,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: '1.5px solid var(--cp-navy)',
            background: cliente ? 'rgba(230,121,41,0.25)' : 'transparent',
            color: 'var(--cp-navy)',
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </svg>
          <span>{cliente ? `${cliente.puntos} pts` : 'Ingresar'}</span>
        </button>

        <button
          onClick={abrirCajon}
          aria-label={`Abrir el carrito: ${cantidadTotal} productos, S/ ${subtotal.toFixed(2)}`}
          title={`${cantidadTotal} productos · S/ ${subtotal.toFixed(2)}`}
          style={{
            order: movil ? 3 : 5,
            position: 'relative',
            flex: 'none',
            width: movil ? 44 : 48,
            height: alto,
            minHeight: alto,
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
                minWidth: 22,
                height: 22,
                boxSizing: 'border-box',
                borderRadius: 11,
                background: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
              }}
            >
              {cantidadTotal}
            </span>
          )}
        </button>
      </header>

      {esCarta && categorias.length > 0 && (
        <nav
          aria-label="Categorías de la carta"
          style={{ maxWidth: 1200, margin: '0 auto', padding: movil ? '0 12px 6px' : '0 24px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
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
                    minHeight: movil ? 32 : 40,
                    padding: movil ? '0 12px' : '0 16px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy)',
                    background: activa ? 'var(--cp-navy)' : 'var(--cp-white)',
                    color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 700,
                    fontSize: movil ? 10 : 12,
                    letterSpacing: '0.05em',
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
