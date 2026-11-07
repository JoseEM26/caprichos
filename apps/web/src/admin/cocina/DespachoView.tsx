import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { listarDespacho, marcarPedidoAtendido } from './cocinaApi';
import { reproducirCampanaCocina } from './audioAlerta';
import { TiempoEspera } from './TiempoEspera';
import { textoSabores } from './cocinaTipos';
import type { LineaComanda, PedidoDespacho, UmbralesCocina } from './cocinaTipos';

const VERDE = '#2F7A45';
const MODALIDAD: Record<string, string> = {
  MESA: 'Mesa',
  LOCAL: 'Local',
  LLEVAR: 'Para llevar',
  RECOGER: 'Recoger',
  DELIVERY: 'Delivery',
};

/** Tamaño, sabor, opciones y personas de la línea, en texto corrido. */
export function detalleLinea(l: LineaComanda): string[] {
  const opciones = (l.opciones || []).map((o) => (typeof o === 'string' ? o : (o?.nombre ?? ''))).filter(Boolean);
  return [l.tamano, ...opciones, ...(l.personas || []).map((p) => `Para ${p}`)].filter((x): x is string => Boolean(x));
}

/** Quién o dónde: mesa, cliente o ambos. */
function destino(p: PedidoDespacho): string {
  const mesa = p.modalidad === 'MESA' && p.mesa ? `Mesa ${p.mesa}` : '';
  return [mesa, p.cliente].filter(Boolean).join(' · ');
}

const boton = (activo: boolean): CSSProperties => ({
  minHeight: '44px',
  padding: '0 18px',
  borderRadius: '12px',
  border: '1.5px solid var(--cp-navy)',
  background: activo ? 'var(--cp-navy)' : 'transparent',
  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: '14px',
  cursor: 'pointer',
});

/** Check grande (≥56 px) para marcar el pedido como atendido. */
function CheckAtendido({ p, grande, alCambiar, ocupado }: { p: PedidoDespacho; grande?: boolean; alCambiar: (p: PedidoDespacho) => void; ocupado: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={p.atendido}
      aria-label={`${p.atendido ? 'Reabrir' : 'Marcar como atendido'} el pedido ${p.codigo}`}
      data-testid={`check-atendido-${p.pedidoId}`}
      disabled={ocupado}
      onClick={(e) => {
        e.stopPropagation();
        alCambiar(p);
      }}
      style={{
        minHeight: grande ? '64px' : '56px',
        minWidth: grande ? '220px' : '56px',
        padding: '0 16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        borderRadius: '14px',
        border: `3px solid ${VERDE}`,
        background: p.atendido ? VERDE : 'var(--cp-white, #fff)',
        color: p.atendido ? '#fff' : VERDE,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 900,
        fontSize: grande ? '22px' : '28px',
        cursor: ocupado ? 'wait' : 'pointer',
      }}
    >
      <span aria-hidden="true">{p.atendido ? '✓' : ''}</span>
      {grande && <span>{p.atendido ? 'Atendido' : 'Marcar atendido'}</span>}
    </button>
  );
}

function EstadoAreas({ p, grande }: { p: PedidoDespacho; grande?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: grande ? '18px' : '10px' }}>
      {p.areas.map((a) => (
        <section key={a.areaId} data-testid={`area-${p.pedidoId}-${a.areaId}`} aria-label={`Área ${a.areaNombre}`}>
          <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <strong style={{ fontFamily: 'Montserrat, sans-serif', fontSize: grande ? '22px' : '14px', textTransform: 'uppercase' }}>
              {a.areaNombre}
            </strong>
            <span
              data-testid={`estado-area-${p.pedidoId}-${a.areaId}`}
              style={{
                fontWeight: 800,
                fontSize: grande ? '16px' : '12px',
                padding: '2px 10px',
                borderRadius: '9999px',
                background: a.listo ? VERDE : 'var(--cp-orange, #E67929)',
                color: a.listo ? '#fff' : 'var(--cp-navy)',
              }}
            >
              {a.listo ? 'Lista' : 'Pendiente'}
            </span>
          </header>
          <ul style={{ margin: 0, paddingLeft: grande ? '24px' : '18px', fontSize: grande ? '24px' : '15px', lineHeight: grande ? 1.35 : 1.3 }}>
            {a.lineas.map((l) => (
              <li key={l.id} style={{ marginBottom: grande ? '8px' : '2px' }}>
                <strong>{l.cantidad}×</strong> {l.nombre}
                {textoSabores(l) && (
                  <div data-testid="linea-sabores" style={{ fontSize: grande ? '22px' : '14px', fontWeight: 800, color: 'var(--cp-navy)' }}>
                    {textoSabores(l)}
                  </div>
                )}
                {detalleLinea(l).length > 0 && (
                  <div style={{ fontSize: grande ? '20px' : '12px', color: 'var(--cp-soft)' }}>{detalleLinea(l).join(' · ')}</div>
                )}
                {l.nota && (
                  <div style={{ fontSize: grande ? '20px' : '12px', fontWeight: 700, background: '#FFF3C4', display: 'inline-block', padding: '0 6px', borderRadius: '4px' }}>
                    {l.nota}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EstadoPedido({ p }: { p: PedidoDespacho }) {
  return (
    <span
      data-testid={`estado-pedido-${p.pedidoId}`}
      style={{
        fontWeight: 900,
        fontSize: '13px',
        padding: '3px 12px',
        borderRadius: '9999px',
        background: p.completo ? VERDE : 'var(--cp-sand, #EDE1D1)',
        color: p.completo ? '#fff' : 'var(--cp-navy)',
      }}
    >
      {p.completo ? 'COMPLETO' : `Faltan ${p.areas.filter((a) => !a.listo).length} de ${p.areas.length}`}
    </span>
  );
}

function DetalleGrande({
  p,
  umbrales,
  alCerrar,
  alCambiar,
  ocupado,
}: {
  p: PedidoDespacho;
  umbrales?: UmbralesCocina;
  alCerrar: () => void;
  alCambiar: (p: PedidoDespacho) => void;
  ocupado: boolean;
}) {
  const entrega = p.modalidad === 'DELIVERY' || p.nota;
  return (
    <ModalConPestanas
      titulo={`${p.codigo} · ${MODALIDAD[p.modalidad] ?? p.modalidad}`}
      subtitulo={destino(p) || undefined}
      ancho={1100}
      alCerrar={alCerrar}
      accionesEncabezado={<EstadoPedido p={p} />}
      pestanas={[
        {
          id: 'productos',
          etiqueta: 'Productos',
          contenido: (
            <div data-testid="detalle-despacho" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <TiempoEspera desde={p.creado_en} minutosRespaldo={p.minutos} umbrales={umbrales} style={{ alignSelf: 'flex-start', fontSize: '18px' }} />
              <EstadoAreas p={p} grande />
            </div>
          ),
        },
        ...(entrega
          ? [
              {
                id: 'entrega',
                etiqueta: p.modalidad === 'DELIVERY' ? 'Entrega' : 'Nota',
                contenido: (
                  <div style={{ fontSize: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {p.modalidad === 'DELIVERY' && (
                      <>
                        {p.cliente && <div><strong>Cliente:</strong> {p.cliente}</div>}
                        {p.telefono && <div><strong>Teléfono:</strong> {p.telefono}</div>}
                        {p.direccion && <div><strong>Dirección:</strong> {p.direccion}</div>}
                        {p.referencia && <div><strong>Referencia:</strong> {p.referencia}</div>}
                      </>
                    )}
                    {p.nota && <div><strong>Nota del pedido:</strong> {p.nota}</div>}
                  </div>
                ),
              },
            ]
          : []),
      ]}
      pie={
        <>
          {p.atendido && p.atendido_por && (
            <span style={{ marginRight: 'auto', fontSize: '14px' }}>Atendido por {p.atendido_por}</span>
          )}
          <CheckAtendido p={p} grande alCambiar={alCambiar} ocupado={ocupado} />
        </>
      }
    />
  );
}

/**
 * Pantalla Despacho: pedidos completos del día con todas sus áreas juntas, para juntar lo de cada área
 * y entregar el pedido entero. Cada pedido se marca como atendido con un check grande.
 */
export function DespachoView({ puedeMarcar = true }: { puedeMarcar?: boolean }) {
  const [pedidos, setPedidos] = useState<PedidoDespacho[]>([]);
  const [umbrales, setUmbrales] = useState<UmbralesCocina | undefined>();
  const [verAtendidos, setVerAtendidos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const completosPrevios = useRef<Set<string> | null>(null);
  const atendidosRef = useRef(verAtendidos);
  atendidosRef.current = verAtendidos;

  const cargar = useCallback(async () => {
    try {
      const r = await listarDespacho(atendidosRef.current);
      // Aviso sonoro cuando un pedido pasa a completo (todas sus áreas listas)
      const completos = new Set(r.pedidos.filter((p) => p.completo && !p.atendido).map((p) => p.pedidoId));
      if (completosPrevios.current && [...completos].some((id) => !completosPrevios.current!.has(id))) reproducirCampanaCocina();
      completosPrevios.current = completos;
      setPedidos(r.pedidos);
      setUmbrales(r.umbrales);
      setError(null);
    } catch (e: any) {
      setError(e?.mensaje || e?.message || 'No se pudo cargar el despacho');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, verAtendidos]);

  useEventos('pedido:nuevo', () => void cargar());
  useEventos('cocina:comanda', () => void cargar());
  useEventos('pedido:estado', () => void cargar());
  useTiempoReal(['pedido:progreso'], () => void cargar());

  const alternar = async (p: PedidoDespacho) => {
    if (!puedeMarcar) return;
    setOcupado(p.pedidoId);
    try {
      await marcarPedidoAtendido(p.pedidoId, !p.atendido);
      await cargar();
    } catch (e: any) {
      setError(e?.mensaje || e?.message || 'No se pudo marcar el pedido');
    } finally {
      setOcupado(null);
    }
  };

  // Antigüedad: el más viejo primero (el servidor ya lo ordena; se reafirma por si llega un evento en desorden)
  const visibles = [...pedidos]
    .filter((p) => verAtendidos || !p.atendido)
    .sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
  const abiertoPedido = pedidos.find((p) => p.pedidoId === abierto) ?? null;

  return (
    <div data-testid="vista-despacho" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontSize: '20px' }}>Despacho</h2>
        <span style={{ color: 'var(--cp-soft)', fontSize: '14px' }}>
          {visibles.filter((p) => !p.atendido).length} por despachar
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={verAtendidos}
          onClick={() => setVerAtendidos((v) => !v)}
          style={{ ...boton(verAtendidos), marginLeft: 'auto' }}
        >
          Ver atendidos
        </button>
      </div>

      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</div>}
      {cargando && <div role="status">Cargando pedidos…</div>}
      {!cargando && visibles.length === 0 && !error && (
        <div data-testid="despacho-vacio" style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-soft)', fontSize: '18px' }}>
          No hay pedidos por despachar.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '14px' }}>
        {visibles.map((p) => (
          <article
            key={p.pedidoId}
            data-testid={`pedido-despacho-${p.pedidoId}`}
            data-atendido={p.atendido}
            data-completo={p.completo}
            role="button"
            tabIndex={0}
            aria-label={`Abrir el pedido ${p.codigo}`}
            onClick={() => setAbierto(p.pedidoId)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setAbierto(p.pedidoId);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              borderRadius: '16px',
              background: 'var(--cp-white, #fff)',
              border: `3px solid ${p.completo && !p.atendido ? VERDE : 'var(--cp-line, #E3D6C6)'}`,
              opacity: p.atendido ? 0.55 : 1,
              cursor: 'pointer',
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '22px' }}>{p.codigo}</strong>
              <span style={{ fontWeight: 800, fontSize: '13px', padding: '2px 10px', borderRadius: '9999px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}>
                {MODALIDAD[p.modalidad] ?? p.modalidad}
              </span>
              <TiempoEspera desde={p.creado_en} minutosRespaldo={p.minutos} umbrales={umbrales} style={{ marginLeft: 'auto' }} />
            </header>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{destino(p) || 'Sin nombre'}</div>
            <EstadoPedido p={p} />
            <EstadoAreas p={p} />
            <footer style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'auto' }}>
              {p.atendido && <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Atendido{p.atendido_por ? ` por ${p.atendido_por}` : ''}</span>}
              {puedeMarcar && (
                <span style={{ marginLeft: 'auto' }}>
                  <CheckAtendido p={p} alCambiar={alternar} ocupado={ocupado === p.pedidoId} />
                </span>
              )}
            </footer>
          </article>
        ))}
      </div>

      {abiertoPedido && (
        <DetalleGrande
          p={abiertoPedido}
          umbrales={umbrales}
          alCerrar={() => setAbierto(null)}
          alCambiar={alternar}
          ocupado={ocupado === abiertoPedido.pedidoId}
        />
      )}
    </div>
  );
}
