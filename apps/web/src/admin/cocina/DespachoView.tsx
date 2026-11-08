import { RejillaComandas } from './RejillaComandas';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { despacharCompleto, devolverComanda, listarDespacho } from './cocinaApi';
import { estaSilenciado, reproducirCampanaCocina, setSilenciado } from './audioAlerta';
import { TiempoEspera } from './TiempoEspera';
import { textoSabores } from './cocinaTipos';
import type { AreaDespacho, LineaComanda, PedidoDespacho, UmbralesCocina } from './cocinaTipos';
import { ResumenPagoDespacho } from './ResumenPagoDespacho';

const VERDE = '#2F7A45';
const MODALIDAD: Record<string, { texto: string; icono: string }> = {
  MESA: { texto: 'Mesa', icono: '🍽️' },
  LOCAL: { texto: 'Local', icono: '🍽️' },
  COMER_LOCAL: { texto: 'Comer en el local', icono: '🍽️' },
  LLEVAR: { texto: 'Para llevar', icono: '🛍️' },
  RECOGER: { texto: 'Recoger', icono: '🛍️' },
  DELIVERY: { texto: 'Delivery', icono: '🛵' },
};

/** Tamaño, opciones y personas de la línea, en texto corrido. */
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
  minHeight: '48px',
  padding: '0 18px',
  borderRadius: '12px',
  border: '1.5px solid var(--cp-navy)',
  background: activo ? 'var(--cp-navy)' : 'transparent',
  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: '15px',
  cursor: 'pointer',
});

/** Semáforo de un área: lista (verde), ya salió (gris) o falta (ámbar). Siempre con texto, no solo color. */
function estadoArea(a: AreaDespacho): { texto: string; icono: string; fondo: string; color: string } {
  if (a.despachada) return { texto: 'Ya salió', icono: '📦', fondo: 'var(--cp-sand, #EDE1D1)', color: 'var(--cp-navy)' };
  if (a.listo) return { texto: 'Lista', icono: '✓', fondo: VERDE, color: '#fff' };
  return { texto: 'Falta', icono: '⏳', fondo: 'var(--cp-orange, #E67929)', color: 'var(--cp-navy)' };
}

function Areas({
  p,
  puedeDevolver,
  alDevolver,
  ocupado,
}: {
  p: PedidoDespacho;
  puedeDevolver: boolean;
  alDevolver: (p: PedidoDespacho, a: AreaDespacho) => void;
  ocupado: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {p.areas.map((a) => {
        const e = estadoArea(a);
        return (
          <section
            key={a.areaId}
            data-testid={`area-${p.pedidoId}-${a.areaId}`}
            data-listo={a.listo}
            aria-label={`Área ${a.areaNombre}`}
            style={{ borderLeft: `6px solid ${a.despachada ? 'var(--cp-line, #E3D6C6)' : a.listo ? VERDE : 'var(--cp-orange, #E67929)'}`, paddingLeft: '12px' }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <strong style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '18px', textTransform: 'uppercase' }}>{a.areaNombre}</strong>
              <span
                data-testid={`estado-area-${p.pedidoId}-${a.areaId}`}
                style={{ fontWeight: 800, fontSize: '14px', padding: '3px 12px', borderRadius: '9999px', background: e.fondo, color: e.color }}
              >
                <span aria-hidden="true">{e.icono} </span>
                {e.texto}
              </span>
              {puedeDevolver && a.listo && !p.despachado && (
                <button
                  type="button"
                  data-testid={`devolver-${p.pedidoId}-${a.areaId}`}
                  disabled={ocupado}
                  onClick={() => alDevolver(p, a)}
                  style={{ ...boton(false), marginLeft: 'auto', minHeight: '48px', fontSize: '14px', borderColor: 'var(--cp-rust)', color: 'var(--cp-rust)' }}
                >
                  Devolver al área
                </button>
              )}
            </header>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '18px', lineHeight: 1.35 }}>
              {a.lineas.map((l) => (
                <li key={l.id} style={{ marginBottom: '6px' }}>
                  <strong>{l.cantidad}×</strong> {l.nombre}
                  {textoSabores(l) && (
                    <div data-testid="linea-sabores" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-navy)' }}>
                      {textoSabores(l)}
                    </div>
                  )}
                  {detalleLinea(l).length > 0 && <div style={{ fontSize: '14px', color: 'var(--cp-soft)' }}>{detalleLinea(l).join(' · ')}</div>}
                  {l.nota && (
                    <div style={{ fontSize: '14px', fontWeight: 700, background: '#FFF3C4', display: 'inline-block', padding: '0 6px', borderRadius: '4px' }}>{l.nota}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

type Pendiente = { tipo: 'parcial'; p: PedidoDespacho } | { tipo: 'devolver'; p: PedidoDespacho; area: AreaDespacho };

/**
 * Pantalla Despacho: el LISTO final del pedido. Una tarjeta por pedido con cada área en semáforo; el botón grande
 * «Todo completo · despachar» solo se activa cuando todas las áreas están listas. Si algo se manda aparte,
 * «Despachar lo que está listo» (con confirmación) deja el resto pendiente. Tiempo real por socket.
 */
export function DespachoView({ puedeDespachar = true, puedeDevolver = true }: { puedeDespachar?: boolean; puedeDevolver?: boolean }) {
  const [pedidos, setPedidos] = useState<PedidoDespacho[]>([]);
  const [umbrales, setUmbrales] = useState<UmbralesCocina | undefined>();
  const [verDespachados, setVerDespachados] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [silenciado, setSilencio] = useState(() => estaSilenciado());
  const completosPrevios = useRef<Set<string> | null>(null);
  const despachadosRef = useRef(verDespachados);
  despachadosRef.current = verDespachados;

  const cargar = useCallback(async () => {
    try {
      const r = await listarDespacho(despachadosRef.current);
      // Aviso sonoro cuando un pedido pasa a completo (todas sus áreas listas) y espera a Despacho
      const completos = new Set(r.pedidos.filter((p) => p.completo && !p.despachado).map((p) => p.pedidoId));
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
  }, [cargar, verDespachados]);

  useEventos('pedido:nuevo', () => void cargar());
  useEventos('cocina:comanda', () => void cargar());
  useEventos('pedido:estado', () => void cargar());
  useEventos('pedido:editado', () => void cargar());
  useTiempoReal(['pedido:progreso'], () => void cargar());

  const ejecutar = async (id: string, accion: () => Promise<unknown>, fallo: string) => {
    setOcupado(id);
    try {
      await accion();
      setError(null);
      await cargar();
    } catch (e: any) {
      setError(e?.mensaje || e?.message || fallo);
    } finally {
      setOcupado(null);
    }
  };

  const despacharTodo = (p: PedidoDespacho) => ejecutar(p.pedidoId, () => despacharCompleto(p.pedidoId, false), 'No se pudo despachar el pedido');

  const confirmar = async () => {
    const pe = pendiente;
    if (!pe) return;
    if (pe.tipo === 'parcial') await ejecutar(pe.p.pedidoId, () => despacharCompleto(pe.p.pedidoId, true), 'No se pudo despachar lo que está listo');
    else await ejecutar(pe.p.pedidoId, () => devolverComanda(pe.p.pedidoId, pe.area.areaId), 'No se pudo devolver al área');
    setPendiente(null);
  };

  // Primero lo que ya está completo y espera (listo para salir), luego por antigüedad: el más viejo arriba
  const visibles = [...pedidos]
    .filter((p) => verDespachados || !p.despachado)
    .sort(
      (a, b) =>
        Number(!!a.despachado) - Number(!!b.despachado) ||
        Number(b.completo) - Number(a.completo) ||
        new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime(),
    );
  const enDespacho = pedidos.filter((p) => !p.despachado);
  const listosParaSalir = enDespacho.filter((p) => p.completo).length;

  return (
    <div data-testid="vista-despacho" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontSize: '22px' }}>Despacho</h2>
        <span data-testid="contador-en-despacho" style={{ fontWeight: 800, fontSize: '15px', padding: '4px 14px', borderRadius: '9999px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}>
          {enDespacho.length} en despacho
        </span>
        {listosParaSalir > 0 && (
          <span style={{ fontWeight: 800, fontSize: '15px', color: VERDE }}>{listosParaSalir} completos para despachar</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            role="switch"
            aria-checked={!silenciado}
            onClick={() => {
              setSilenciado(!silenciado);
              setSilencio(!silenciado);
            }}
            style={boton(!silenciado)}
          >
            {silenciado ? '🔇 Sonido apagado' : '🔔 Sonido'}
          </button>
          <button type="button" role="switch" aria-checked={verDespachados} onClick={() => setVerDespachados((v) => !v)} style={boton(verDespachados)}>
            Ver despachados
          </button>
        </span>
      </div>

      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700, fontSize: '16px' }}>{error}</div>}
      {cargando && <div role="status">Cargando pedidos…</div>}
      {!cargando && visibles.length === 0 && !error && (
        <div data-testid="despacho-vacio" style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-soft)', fontSize: '18px' }}>
          No hay pedidos por despachar.
        </div>
      )}

      <RejillaComandas anchoColumna={340}>
        {visibles.map((p) => {
          const m = MODALIDAD[p.modalidad] ?? { texto: p.modalidad, icono: '📦' };
          const faltan = p.areas.filter((a) => !a.listo);
          const algoListo = p.areas.some((a) => a.listo && !a.despachada);
          const trabajando = ocupado === p.pedidoId;
          return (
            <article
              key={p.pedidoId}
              data-testid={`pedido-despacho-${p.pedidoId}`}
              data-despachado={!!p.despachado}
              data-completo={p.completo}
              aria-label={`Pedido ${p.codigo}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                borderRadius: '14px',
                background: 'var(--cp-white, #fff)',
                border: `3px solid ${p.completo && !p.despachado ? VERDE : 'var(--cp-line, #E3D6C6)'}`,
                opacity: p.despachado ? 0.55 : 1,
              }}
            >
              <header style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '26px' }}>{p.codigo}</strong>
                <span
                  data-testid={`modalidad-${p.pedidoId}`}
                  style={{ fontWeight: 800, fontSize: '15px', padding: '3px 12px', borderRadius: '9999px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}
                >
                  <span aria-hidden="true">{m.icono} </span>
                  {m.texto}
                </span>
                <TiempoEspera desde={p.creado_en} minutosRespaldo={p.minutos} umbrales={umbrales} style={{ marginLeft: 'auto', fontSize: '16px' }} />
              </header>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{destino(p) || 'Sin nombre'}</div>
              {p.modalidad === 'DELIVERY' && (p.direccion || p.referencia) && (
                <div style={{ fontSize: '15px', color: 'var(--cp-soft)' }}>{[p.direccion, p.referencia].filter(Boolean).join(' · ')}</div>
              )}
              {p.nota && <div style={{ fontSize: '15px', fontWeight: 700, background: '#FFF3C4', padding: '4px 8px', borderRadius: '6px' }}>Nota: {p.nota}</div>}
              {p.pago && <ResumenPagoDespacho pedidoId={p.pedidoId} pago={p.pago} telefono={p.modalidad === 'DELIVERY' ? p.telefono : null} />}
              <span
                data-testid={`estado-pedido-${p.pedidoId}`}
                style={{
                  alignSelf: 'flex-start',
                  fontWeight: 900,
                  fontSize: '15px',
                  padding: '4px 14px',
                  borderRadius: '9999px',
                  background: p.despachado ? 'var(--cp-sand, #EDE1D1)' : p.completo ? VERDE : 'var(--cp-orange, #E67929)',
                  color: p.despachado || !p.completo ? 'var(--cp-navy)' : '#fff',
                }}
              >
                {p.despachado ? 'DESPACHADO' : p.completo ? 'COMPLETO' : `Faltan ${faltan.length} de ${p.areas.length}`}
              </span>

              <Areas p={p} puedeDevolver={puedeDespachar && puedeDevolver} alDevolver={(pe, area) => setPendiente({ tipo: 'devolver', p: pe, area })} ocupado={trabajando} />

              {!p.despachado && puedeDespachar && (
                <footer style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    data-testid={`despachar-${p.pedidoId}`}
                    disabled={!p.completo || trabajando}
                    onClick={() => void despacharTodo(p)}
                    style={{
                      minHeight: '52px',
                      borderRadius: '14px',
                      border: 'none',
                      background: p.completo ? VERDE : 'var(--cp-line, #E3D6C6)',
                      color: p.completo ? '#fff' : 'var(--cp-soft)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 900,
                      fontSize: '20px',
                      cursor: !p.completo || trabajando ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Todo completo · despachar
                  </button>
                  {!p.completo && (
                    <div style={{ fontSize: '14px', color: 'var(--cp-soft)' }}>Falta: {faltan.map((a) => a.areaNombre).join(', ')}</div>
                  )}
                  {!p.completo && algoListo && (
                    <button
                      type="button"
                      data-testid={`despachar-parcial-${p.pedidoId}`}
                      disabled={trabajando}
                      onClick={() => setPendiente({ tipo: 'parcial', p })}
                      style={boton(false)}
                    >
                      Despachar lo que está listo
                    </button>
                  )}
                </footer>
              )}
            </article>
          );
        })}
      </RejillaComandas>

      <Confirmar
        abierto={!!pendiente}
        titulo={pendiente?.tipo === 'devolver' ? 'Devolver al área' : 'Despachar lo que está listo'}
        mensaje={
          pendiente?.tipo === 'devolver'
            ? `${pendiente.area.areaNombre} vuelve a su pantalla de cocina como pendiente y ${pendiente.p.codigo} deja de estar completo. ¿Devolver?`
            : pendiente
              ? `Se manda aparte lo que ya está listo de ${pendiente.p.codigo} y queda pendiente: ${pendiente.p.areas.filter((a) => !a.listo).map((a) => a.areaNombre).join(', ')}. El pedido sigue En despacho hasta completarse. ¿Despachar lo que está listo?`
              : ''
        }
        textoConfirmar={pendiente?.tipo === 'devolver' ? 'Sí, devolver' : 'Sí, despachar'}
        textoNo="No"
        cargando={!!ocupado}
        alConfirmar={confirmar}
        alCancelar={() => setPendiente(null)}
      />
    </div>
  );
}
