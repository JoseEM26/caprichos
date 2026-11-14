import { RejillaComandas } from './RejillaComandas';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { despacharCompleto, devolverComanda, listarDespacho } from './cocinaApi';
import { estaSilenciado, reproducirCampanaCocina, setSilenciado } from './audioAlerta';
import { TiempoEspera } from './TiempoEspera';
import { InsigniaMesa, textoMesa } from './InsigniaMesa';
import { detalleLinea, textoSabores } from './cocinaTipos';
import type { AreaDespacho, LineaComanda, PedidoDespacho, UmbralesCocina } from './cocinaTipos';
import { ResumenPagoDespacho } from './ResumenPagoDespacho';

const VERDE = '#2F7A45';
const NAVY = '#0B2C3E';
/** Colores explícitos del texto de la tarjeta de Despacho (nunca heredados del contenedor oscuro). */
export const OXIDO = '#B2500F';
export const SUAVE = '#2C4C5D';
export const DIVISOR = '#E3D6C6';
export const AVISO_FONDO = '#FFE08A';
export const AVISO_BORDE = '#D99E39';
/** Fondo de la tarjeta: claro y fijo, así el texto nunca hereda un color claro del contenedor (pantalla completa es oscura). */
export const FONDO_TARJETA = '#FFFDF9';
export const FONDO_TARJETA_DESPACHADO = '#EFE6D8';
/** Color de franja izquierda por modalidad (es el mismo fondo de su insignia). */
export const colorModalidad = (modalidad: string) => (MODALIDAD[modalidad] ?? { fondo: '#2C4C5D' }).fondo;

const clamp2: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' };
// Cada modalidad con su propio color (texto siempre con contraste ≥ 4.5:1)
export const MODALIDAD: Record<string, { texto: string; icono: string; fondo: string; color: string }> = {
  MESA: { texto: 'En mesa', icono: '🍽️', fondo: '#0B2C3E', color: '#FBF4EC' },
  LOCAL: { texto: 'En el local', icono: '🍽️', fondo: '#0B2C3E', color: '#FBF4EC' },
  COMER_LOCAL: { texto: 'Comer en el local', icono: '🍽️', fondo: '#2F7A45', color: '#FFFFFF' },
  LLEVAR: { texto: 'Para llevar', icono: '🛍️', fondo: '#D99E39', color: '#0B2C3E' },
  RECOGER: { texto: 'Recoger', icono: '🛍️', fondo: '#D99E39', color: '#0B2C3E' },
  DELIVERY: { texto: 'Delivery', icono: '🛵', fondo: '#B2500F', color: '#FFFFFF' },
};

export { detalleLinea };

/** Detalle de la línea («Grande · Stevia») con las opciones resaltadas (manual o menos pedida) en negrita ámbar y ⭐ de texto. */
function detalleConResaltado(l: LineaComanda) {
  const resaltadas = new Set(
    (l.opciones || []).filter((o) => typeof o === 'object' && o?.pocoPedida === true).map((o) => (o as { nombre: string }).nombre),
  );
  return detalleLinea(l).map((t, i) => (
    <Fragment key={i}>
      {i > 0 && ' · '}
      {resaltadas.has(t) ? (
        <span data-testid="opcion-resaltada" style={{ fontWeight: 800, color: '#0B2C3E', background: '#FFE08A', border: '2px solid #D99E39', borderRadius: 6, padding: '0 5px' }}>
          ⭐ {t}
        </span>
      ) : t}
    </Fragment>
  ));
}

/** Quién o dónde: mesa, cliente o ambos. */
function destino(p: PedidoDespacho): string {
  const mesa = p.enEsperaMesa ? 'En espera de mesa' : p.modalidad === 'MESA' && p.mesa ? (textoMesa(p) ?? '') : '';
  return [mesa, p.cliente].filter(Boolean).join(' · ');
}

const boton = (activo: boolean): CSSProperties => ({
  minHeight: '48px',
  padding: '0 18px',
  borderRadius: '12px',
  border: '1.5px solid var(--cp-navy)',
  background: activo ? 'var(--cp-navy)' : FONDO_TARJETA,
  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: '15px',
  cursor: 'pointer',
});

/** Semáforo de un área: lista (verde), ya salió (gris) o falta (ámbar). Siempre con texto, no solo color. */
function estadoArea(a: AreaDespacho): { texto: string; icono: string; fondo: string; color: string } {
  if (a.despachada) return { texto: 'Ya salió', icono: '📦', fondo: '#D9CBB5', color: NAVY };
  if (a.listo) return { texto: 'Lista', icono: '✓', fondo: VERDE, color: '#fff' };
  return { texto: 'Falta', icono: '⏳', fondo: '#E67929', color: NAVY };
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
    <div data-testid={`areas-${p.pedidoId}`} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '380px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px', overflowWrap: 'anywhere' }}>
      {p.areas.map((a) => {
        const e = estadoArea(a);
        return (
          <section
            key={a.areaId}
            data-testid={`area-${p.pedidoId}-${a.areaId}`}
            data-listo={a.listo}
            aria-label={`Área ${a.areaNombre}`}
            style={{ borderLeft: `6px solid ${a.despachada ? 'var(--cp-line, #E3D6C6)' : a.listo ? VERDE : '#E67929'}`, paddingLeft: '12px' }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <strong style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '18px', fontWeight: 900, letterSpacing: '0.02em', textTransform: 'uppercase', color: NAVY }}>{a.areaNombre}</strong>
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
                  style={{ ...boton(false), marginLeft: 'auto', minHeight: '48px', fontSize: '14px', borderColor: OXIDO, color: OXIDO }}
                >
                  Devolver al área
                </button>
              )}
            </header>
            <ul data-testid={`lineas-${p.pedidoId}-${a.areaId}`} style={{ margin: 0, padding: 0, listStyle: 'none', color: NAVY }}>
              {a.lineas.map((l) => (
                <li key={l.id} data-testid="linea-despacho" style={{ display: 'flex', gap: '8px', alignItems: 'baseline', padding: '8px 0', borderTop: `1px solid ${DIVISOR}`, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>
                  <span data-testid="linea-cantidad" style={{ flex: 'none', minWidth: '34px', fontSize: '18px', fontWeight: 900, color: OXIDO }}>{l.cantidad}×</span>
                  <div style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
                    <div data-testid="linea-nombre" style={{ fontSize: '17px', fontWeight: 800, lineHeight: 1.25, color: NAVY }}>{l.nombre}</div>
                    {textoSabores(l) && (
                      <div data-testid="linea-sabores" style={{ fontSize: '16px', fontWeight: 800, color: NAVY }}>
                        {textoSabores(l)}
                      </div>
                    )}
                    {detalleLinea(l).length > 0 && <div data-testid="linea-detalle" style={{ fontSize: '14px', fontWeight: 600, color: SUAVE }}>{detalleConResaltado(l)}</div>}
                    {l.nota && (
                      <div data-testid="linea-nota" style={{ fontSize: '14px', fontWeight: 800, background: AVISO_FONDO, color: NAVY, border: `1px solid ${AVISO_BORDE}`, display: 'inline-block', padding: '1px 8px', marginTop: '2px', borderRadius: '6px' }}>Nota: {l.nota}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export interface GrupoDespacho {
  clave: string;
  /** El pedido original (o, si no está a la vista, el primer extra). */
  principal: PedidoDespacho;
  /** Original primero y luego sus extras por hora. */
  partes: PedidoDespacho[];
}

const todoListoGrupo = (g: GrupoDespacho) => {
  const pend = g.partes.filter((x) => !x.despachado);
  return pend.length > 0 && pend.every((x) => x.completo);
};

/** Une cada pedido extra con su original por pedidoOrigenId (raíz de la cuenta). Sin extras: un grupo por pedido. */
export function agruparDespacho(pedidos: PedidoDespacho[]): GrupoDespacho[] {
  const porClave = new Map<string, PedidoDespacho[]>();
  for (const p of pedidos) {
    const k = p.pedidoOrigenId ?? p.pedidoId;
    porClave.set(k, [...(porClave.get(k) ?? []).filter((x) => x.pedidoId !== p.pedidoId), p]);
  }
  return [...porClave.entries()].map(([clave, ps]) => {
    const partes = ps.sort((a, b) => Number(!!a.pedidoOrigenId) - Number(!!b.pedidoOrigenId) || new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
    return { clave, principal: partes[0], partes };
  });
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

  const despacharGrupo = (g: GrupoDespacho) =>
    ejecutar(
      g.clave,
      async () => {
        for (const x of g.partes.filter((y) => !y.despachado)) await despacharCompleto(x.pedidoId, false);
      },
      'No se pudo despachar la cuenta',
    );

  const confirmar = async () => {
    const pe = pendiente;
    if (!pe) return;
    if (pe.tipo === 'parcial') await ejecutar(pe.p.pedidoId, () => despacharCompleto(pe.p.pedidoId, true), 'No se pudo despachar lo que está listo');
    else await ejecutar(pe.p.pedidoId, () => devolverComanda(pe.p.pedidoId, pe.area.areaId), 'No se pudo devolver al área');
    setPendiente(null);
  };

  // Una tarjeta por cuenta: el pedido original y sus extras (pedidoOrigenId) juntos. Si el original no está en la lista
  // (ya despachado y oculto), el extra queda solo con su propio código. Primero lo listo para salir, luego el más viejo.
  const grupos: GrupoDespacho[] = agruparDespacho(pedidos.filter((p) => verDespachados || !p.despachado)).sort(
    (a, b) =>
      Number(a.partes.every((x) => x.despachado)) - Number(b.partes.every((x) => x.despachado)) ||
      Number(todoListoGrupo(b)) - Number(todoListoGrupo(a)) ||
      new Date(a.principal.creado_en).getTime() - new Date(b.principal.creado_en).getTime(),
  );
  const visibles = grupos;
  const enDespacho = pedidos.filter((p) => !p.despachado);
  const listosParaSalir = enDespacho.filter((p) => p.completo).length;

  return (
    <div data-testid="vista-despacho" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', borderRadius: '14px', background: FONDO_TARJETA, color: NAVY }}>
        <h2 style={{ margin: 0, color: NAVY, fontFamily: 'Montserrat, sans-serif', fontSize: '22px' }}>Despacho</h2>
        <span data-testid="contador-en-despacho" style={{ fontWeight: 800, fontSize: '15px', padding: '4px 14px', borderRadius: '9999px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}>
          {enDespacho.length} en despacho
        </span>
        {listosParaSalir > 0 && (
          <span style={{ fontWeight: 800, fontSize: '15px', padding: '4px 14px', borderRadius: '9999px', background: '#EAF6EC', color: '#1F5C32', border: `2px solid ${VERDE}` }}>{listosParaSalir} completos para despachar</span>
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

      {error && <div role="alert" style={{ color: '#8A3D0B', background: FONDO_TARJETA, padding: '8px 12px', borderRadius: '10px', fontWeight: 700, fontSize: '16px' }}>{error}</div>}
      {cargando && <div role="status" style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: '10px', background: FONDO_TARJETA, color: NAVY, fontWeight: 700 }}>Cargando pedidos…</div>}
      {!cargando && visibles.length === 0 && !error && (
        <div data-testid="despacho-vacio" style={{ padding: '24px', textAlign: 'center', color: NAVY, background: FONDO_TARJETA, borderRadius: '14px', fontSize: '18px' }}>
          No hay pedidos por despachar.
        </div>
      )}

      <RejillaComandas anchoColumna={340}>
        {grupos.map((g) => {
          const p = g.principal;
          const multi = g.partes.length > 1;
          const m = MODALIDAD[p.modalidad] ?? { texto: p.modalidad, icono: '📦', fondo: '#2C4C5D', color: '#FFFFFF' };
          const trabajando = !!ocupado && (ocupado === g.clave || g.partes.some((x) => x.pedidoId === ocupado));
          const pendientes = g.partes.filter((x) => !x.despachado);
          const todoListo = pendientes.length > 0 && pendientes.every((x) => x.completo);
          const despachadoTodo = pendientes.length === 0;
          return (
            <article
              key={g.clave}
              data-testid={`pedido-despacho-${p.pedidoId}`}
              data-despachado={despachadoTodo}
              data-completo={multi ? todoListo : p.completo}
              data-partes={g.partes.length}
              aria-label={`Pedido ${p.codigo}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '14px',
                borderRadius: '14px',
                boxSizing: 'border-box',
                width: '100%',
                minWidth: 0,
                maxWidth: '100%',
                overflowWrap: 'anywhere',
                background: despachadoTodo ? FONDO_TARJETA_DESPACHADO : FONDO_TARJETA,
                color: NAVY,
                border: `2px solid ${(multi ? todoListo : p.completo && !p.despachado) ? VERDE : '#E3D6C6'}`,
                borderLeft: `10px solid ${m.fondo}`,
              }}
            >
              <header style={{ display: 'flex', alignItems: 'center', columnGap: '8px', rowGap: '4px', flexWrap: 'wrap' }}>
                <strong data-testid={`codigo-${p.pedidoId}`} style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '18px', fontWeight: 900, color: NAVY, overflowWrap: 'anywhere' }}>{p.codigo}</strong>
                <span
                  data-testid={`modalidad-${p.pedidoId}`}
                  style={{ fontWeight: 800, fontSize: '14px', padding: '3px 10px', borderRadius: '9999px', whiteSpace: 'nowrap', background: m.fondo, color: m.color }}
                >
                  <span aria-hidden="true">{m.icono} </span>
                  {m.texto}
                </span>
                {multi && (
                  <span data-testid={`grupo-cuenta-${p.pedidoId}`} style={{ fontWeight: 800, fontSize: '13px', padding: '3px 10px', borderRadius: '9999px', background: '#FFE08A', border: '2px solid #D99E39', color: NAVY, whiteSpace: 'nowrap' }}>
                    + {g.partes.length - 1} {g.partes.length - 1 === 1 ? 'extra' : 'extras'}
                  </span>
                )}
                {p.esPersonal && (
                  <span
                    data-testid={`personal-${p.pedidoId}`}
                    style={{ fontWeight: 800, fontSize: '15px', padding: '3px 12px', borderRadius: '9999px', background: '#fff', border: '2px solid #0B2C3E', color: '#0B2C3E' }}
                  >
                    👤 PERSONAL
                  </span>
                )}
                <TiempoEspera desde={p.creado_en} minutosRespaldo={p.minutos} umbrales={umbrales} style={{ marginLeft: 'auto', fontSize: '16px' }} />
              </header>
              <InsigniaMesa modalidad={p.modalidad} mesa={p.mesa} enEsperaMesa={p.enEsperaMesa} testId={`mesa-${p.pedidoId}`} />
              <div data-testid={`nombre-${p.pedidoId}`} title={destino(p) || 'Sin nombre'} style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '24px', fontWeight: 900, lineHeight: 1.15, color: NAVY, ...clamp2 }}>{destino(p) || 'Sin nombre'}</div>
              {p.modalidad === 'DELIVERY' && (p.direccion || p.referencia) && (
                <div style={{ fontSize: '15px', color: '#2C4C5D', overflowWrap: 'anywhere' }}>{[p.direccion, p.referencia].filter(Boolean).join(' · ')}</div>
              )}

              {g.partes.map((x, i) => {
                const faltan = x.areas.filter((a) => !a.listo);
                const algoListo = x.areas.some((a) => a.listo && !a.despachada);
                const etiqueta = x.pedidoOrigenId ? `Extra ${i}` : 'Pedido original';
                return (
                  <section
                    key={x.pedidoId}
                    data-testid={multi ? `parte-${x.pedidoId}` : undefined}
                    data-completo={x.completo}
                    aria-label={multi ? `${etiqueta} ${x.codigo}` : undefined}
                    style={multi ? { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '12px', border: `2px solid ${x.despachado ? '#E3D6C6' : x.completo ? VERDE : '#E3D6C6'}`, background: x.despachado ? FONDO_TARJETA_DESPACHADO : '#FFFFFF' } : { display: 'flex', flexDirection: 'column', gap: '8px' }}
                  >
                    {multi && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong data-testid={`etiqueta-parte-${x.pedidoId}`} style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', color: x.pedidoOrigenId ? OXIDO : NAVY }}>{etiqueta}</strong>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: SUAVE }}>{x.codigo}</span>
                        <TiempoEspera desde={x.creado_en} minutosRespaldo={x.minutos} umbrales={umbrales} style={{ marginLeft: 'auto', fontSize: '14px' }} />
                      </div>
                    )}
                    {x.nota && <div style={{ fontSize: '15px', fontWeight: 700, background: '#FFF3C4', color: NAVY, padding: '4px 8px', borderRadius: '6px' }}>Nota: {x.nota}</div>}
                    {x.pago && <ResumenPagoDespacho pedidoId={x.pedidoId} pago={x.pago} esPersonal={x.esPersonal} telefono={x.modalidad === 'DELIVERY' ? x.telefono : null} />}
                    <span
                      data-testid={`estado-pedido-${x.pedidoId}`}
                      style={{
                        alignSelf: 'flex-start',
                        fontWeight: 900,
                        fontSize: '15px',
                        padding: '4px 14px',
                        borderRadius: '9999px',
                        background: x.despachado ? '#D9CBB5' : x.completo ? VERDE : '#E67929',
                        color: x.despachado || !x.completo ? NAVY : '#fff',
                      }}
                    >
                      {x.despachado ? 'DESPACHADO' : x.completo ? 'COMPLETO' : `Faltan ${faltan.length} de ${x.areas.length}`}
                    </span>

                    <Areas p={x} puedeDevolver={puedeDespachar && puedeDevolver} alDevolver={(pe, area) => setPendiente({ tipo: 'devolver', p: pe, area })} ocupado={trabajando} />

                    {!x.despachado && puedeDespachar && (
                      <footer style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          type="button"
                          data-testid={`despachar-${x.pedidoId}`}
                          disabled={!x.completo || trabajando}
                          onClick={() => void despacharTodo(x)}
                          style={{
                            minHeight: '52px',
                            borderRadius: '14px',
                            border: 'none',
                            background: x.completo ? VERDE : '#E3D6C6',
                            color: x.completo ? '#fff' : '#2C4C5D',
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 900,
                            fontSize: multi ? '17px' : '20px',
                            cursor: !x.completo || trabajando ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {multi ? `Despachar ${etiqueta.toLowerCase()}` : 'Todo completo · despachar'}
                        </button>
                        {!x.completo && (
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2C4C5D' }}>Falta: {faltan.map((a) => a.areaNombre).join(', ')}</div>
                        )}
                        {!x.completo && algoListo && (
                          <button
                            type="button"
                            data-testid={`despachar-parcial-${x.pedidoId}`}
                            disabled={trabajando}
                            onClick={() => setPendiente({ tipo: 'parcial', p: x })}
                            style={boton(false)}
                          >
                            Despachar lo que está listo
                          </button>
                        )}
                      </footer>
                    )}
                  </section>
                );
              })}

              {multi && !despachadoTodo && puedeDespachar && (
                <button
                  type="button"
                  data-testid={`despachar-todo-${p.pedidoId}`}
                  disabled={!todoListo || trabajando}
                  onClick={() => void despacharGrupo(g)}
                  style={{
                    minHeight: '56px',
                    borderRadius: '14px',
                    border: 'none',
                    background: todoListo ? VERDE : '#E3D6C6',
                    color: todoListo ? '#fff' : '#2C4C5D',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 900,
                    fontSize: '20px',
                    cursor: !todoListo || trabajando ? 'not-allowed' : 'pointer',
                  }}
                >
                  Despachar todo
                </button>
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
