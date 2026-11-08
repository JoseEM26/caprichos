import { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { ErrorApi } from '../../../comun/api';
import { haceLegible } from '../../../comun/tiempoLegible';
import { despacharPedido } from '../../cocina/cocinaApi';
import { salonApi } from '../api';
import type { MesaSalon, ProductoProgreso } from '../tipos';
import { ModalForzarLiberarMesa } from './ModalForzarLiberarMesa';
import { nombreMesaSalon } from './CambioDeMesa';

export interface VistaPreviaMesaProps {
  mesa: MesaSalon;
  /** Permiso mesas/liberar: muestra «Forzar liberación» */
  puedeForzar: boolean;
  alCerrar: () => void;
  /** Omitidos en Nuevo pedido: solo quedan Forzar liberación y Cerrar */
  alAbrirCuenta?: (mesa: MesaSalon) => void;
  alCambiarMesa?: (mesa: MesaSalon) => void;
  /** Tras forzar la liberación: el padre recarga el salón */
  alCambiar: () => void;
  /** Permiso cocina/despachar: muestra las casillas de entrega y «Marcar como entregado» */
  puedeDespachar?: boolean;
  /** Permiso mesas/abrir: muestra «Agregar mesa» y «Quitar mesa» (con pedido abierto) */
  puedeAbrirMesas?: boolean;
  /** Todas las mesas del mismo pedido (incluida esta). Sin él, «Quitar mesa» solo ve esta mesa. */
  mesasDelPedido?: MesaSalon[];
  /** Pasa el pedido a modo «sumar mesas» en el croquis (lo arma el padre) */
  alAgregarMesa?: (mesa: MesaSalon) => void;
}

/** Orden de las mesas de un pedido igual que el servidor: la principal primero, luego por orden. */
function mesasEnOrden(mesas: MesaSalon[]): MesaSalon[] {
  return [...mesas].sort((a, b) => {
    const principal = Number(!!b.pedido?.esPrincipal) - Number(!!a.pedido?.esPrincipal);
    return principal || (a.pedido?.orden ?? 0) - (b.pedido?.orden ?? 0);
  });
}

/** Una línea del pedido en la lista de entrega, con su área y las unidades listas sin entregar. */
interface FilaEntrega {
  lineaId: string;
  nombre: string;
  cantidad: number;
  area: string;
  listas: number;
  despachadas: number;
  /** Listas y todavía sin entregar: lo que se despacha al marcar la fila */
  pendientes: number;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const VERDE_ENTREGADO = '#2F7A45';

function IconoEntregado() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, color: VERDE_ENTREGADO }}>
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Texto y color del estado de una línea: en preparación, parcial, listo o entregado. */
function estadoFila(f: FilaEntrega): { texto: string; color: string } {
  if (f.despachadas >= f.cantidad) return { texto: 'Entregado', color: VERDE_ENTREGADO };
  if (f.listas === 0) return { texto: 'En preparación', color: 'var(--cp-soft)' };
  if (f.listas < f.cantidad) return { texto: `${f.listas} de ${f.cantidad} listos`, color: 'var(--cp-orange)' };
  return { texto: 'Listo', color: VERDE_ENTREGADO };
}

/**
 * Vista previa de una mesa ocupada (mantener 2 s en el croquis): quién, cuánto, qué pidió y qué falta.
 * Desde aquí se marca lo entregado, se abre la cuenta, se cambia de mesa y, con permiso, se fuerza la liberación.
 */
export function VistaPreviaMesa({
  mesa,
  puedeForzar,
  alCerrar,
  alAbrirCuenta,
  alCambiarMesa,
  alCambiar,
  puedeDespachar = false,
  puedeAbrirMesas = false,
  mesasDelPedido,
  alAgregarMesa,
}: VistaPreviaMesaProps) {
  const [forzando, setForzando] = useState(false);
  // «Quitar mesa»: primero se elige cuál (lista), después Sí/No
  const [eligiendoQuitar, setEligiendoQuitar] = useState(false);
  const [mesaQuitar, setMesaQuitar] = useState<MesaSalon | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);
  // Líneas marcadas para entregar (solo seleccionan; el envío pide confirmación Sí/No)
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [errorEntrega, setErrorEntrega] = useState<string | null>(null);
  const pedido = mesa.pedido;
  const filas: FilaEntrega[] = (pedido?.progreso?.areas ?? []).flatMap((a) =>
    (a.productos ?? [])
      .filter((p): p is ProductoProgreso & { lineaId: string } => !!p.lineaId)
      .map((p) => {
        const listas = p.listas ?? 0;
        const despachadas = p.despachadas ?? 0;
        return {
          lineaId: p.lineaId,
          nombre: p.nombre,
          cantidad: p.cantidad,
          area: a.nombre,
          listas,
          despachadas,
          pendientes: Math.max(0, listas - despachadas),
        };
      }),
  );
  const todoEntregado = filas.length > 0 && filas.every((f) => f.despachadas >= f.cantidad);
  const marcables = filas.filter((f) => f.pendientes > 0);
  const elegidas = marcables.filter((f) => seleccion.has(f.lineaId));

  const alternar = (lineaId: string) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(lineaId)) next.delete(lineaId);
      else next.add(lineaId);
      return next;
    });

  const entregar = async () => {
    if (!pedido || elegidas.length === 0) return;
    setEntregando(true);
    setErrorEntrega(null);
    try {
      await despacharPedido(
        pedido.id,
        elegidas.map((f) => ({ lineaId: f.lineaId, unidades: f.pendientes })),
      );
      setSeleccion(new Set());
      setConfirmandoEntrega(false);
      alCambiar();
    } catch (err) {
      setErrorEntrega(err instanceof ErrorApi ? err.message : 'No se pudo marcar como entregado');
      setConfirmandoEntrega(false);
    } finally {
      setEntregando(false);
    }
  };
  const nombre = nombreMesaSalon(mesa);
  const hace = haceLegible(pedido?.creadoEn);
  // Mesas del pedido en su orden; si el padre no las pasa, solo está esta
  const mesasPedido = mesasEnOrden(mesasDelPedido?.length ? mesasDelPedido : [mesa]);
  const sinMesasParaQuitar = mesasPedido.length <= 1;
  const otrasDe = (quitada: MesaSalon) => mesasPedido.filter((m) => m.id !== quitada.id);
  const siguientePrincipal = mesaQuitar?.pedido?.esPrincipal ? otrasDe(mesaQuitar)[0] : undefined;

  const quitarMesa = async () => {
    if (!pedido || !mesaQuitar) return;
    setQuitando(true);
    setErrorQuitar(null);
    try {
      await salonApi.quitarMesaPedido(pedido.id, mesaQuitar.id);
      setMesaQuitar(null);
      setEligiendoQuitar(false);
      alCerrar();
      alCambiar();
    } catch (err) {
      setErrorQuitar(err instanceof ErrorApi ? err.message : 'No se pudo quitar la mesa. Intenta de nuevo.');
      setMesaQuitar(null);
    } finally {
      setQuitando(false);
    }
  };

  const cliente = pedido?.cliente || null;
  const mozo = pedido?.mozo || null;

  return (
    <>
      <div
        className="salon-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 84,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={alCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${nombre}`}
          className="salon-panel"
          style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--cp-line)' }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
              }}
            >
              {nombre}
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '2px' }}>
              {cliente ?? mozo ?? 'Sin nombre'}
              {mozo && cliente ? ` · Mozo: ${mozo}` : ''}
              {hace ? ` · Pidió ${hace}` : ''}
            </div>
          </div>

          <div style={{ padding: '14px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filas.length > 0 && (
              <section
                data-testid="vista-previa-productos"
                aria-label="Productos"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--cp-line)', paddingTop: '10px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: todoEntregado ? VERDE_ENTREGADO : 'var(--cp-navy)',
                    }}
                  >
                    {todoEntregado && <IconoEntregado />}
                    {todoEntregado ? 'Todo entregado' : 'Productos'}
                  </div>
                  {puedeDespachar && marcables.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSeleccion(new Set(marcables.map((f) => f.lineaId)))}
                      style={{
                        minHeight: '44px',
                        padding: '0 8px',
                        border: 0,
                        background: 'none',
                        color: 'var(--cp-navy)',
                        fontSize: '13px',
                        fontWeight: 800,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Seleccionar todo lo listo
                    </button>
                  )}
                </div>

                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filas.map((f) => {
                    const entregado = f.despachadas >= f.cantidad;
                    const marcable = f.pendientes > 0;
                    const estado = estadoFila(f);
                    return (
                      <li
                        key={f.lineaId}
                        data-testid="vista-previa-fila"
                        data-estado={estado.texto}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', opacity: entregado ? 0.6 : 1 }}
                      >
                        {puedeDespachar && (
                          <label
                            style={{
                              minWidth: '44px',
                              minHeight: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              cursor: marcable ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={entregado || seleccion.has(f.lineaId)}
                              disabled={!marcable}
                              aria-disabled={!marcable}
                              title={entregado ? 'Entregado' : marcable ? undefined : 'Aún en preparación'}
                              aria-label={`${f.cantidad} × ${f.nombre}`}
                              onChange={() => alternar(f.lineaId)}
                              style={{ width: '22px', height: '22px', margin: 0, accentColor: 'var(--cp-navy)', cursor: 'inherit' }}
                            />
                          </label>
                        )}
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: '14px',
                            color: entregado ? 'var(--cp-soft)' : 'var(--cp-navy)',
                          }}
                        >
                          {`${f.cantidad} × ${f.nombre}`}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--cp-soft)',
                            border: '1px solid var(--cp-line)',
                            borderRadius: '999px',
                            padding: '2px 8px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {f.area}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: estado.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entregado && <IconoEntregado />}
                          {estado.texto}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {puedeDespachar && elegidas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmandoEntrega(true)}
                    disabled={entregando}
                    style={{
                      minHeight: '44px',
                      border: 0,
                      borderRadius: '12px',
                      background: 'var(--cp-navy)',
                      color: 'var(--cp-white)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {`Marcar como entregado (${elegidas.length})`}
                  </button>
                )}
              </section>
            )}
            {errorEntrega && (
              <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
                {errorEntrega}
              </div>
            )}

            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--cp-navy)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(pedido?.lineas ?? []).map((l, i) => (
                <li key={i}>
                  <strong>
                    {l.cantidad} x {l.nombre}
                  </strong>
                  {(l.detalle || (l.opciones && l.opciones.length > 0)) && (
                    <span style={{ color: 'var(--cp-soft)', fontSize: '12px' }}>
                      {' '}
                      {[l.detalle, ...(l.opciones ?? [])].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-navy)' }}>
              Total {soles(Number(pedido?.total ?? 0))}
            </div>
            {pedido?.codigo && <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Pedido {pedido.codigo}</div>}
          </div>

          {eligiendoQuitar && (
            <div
              role="group"
              aria-label="Mesas del pedido"
              style={{ padding: '12px 22px', borderTop: '1px solid var(--cp-line)', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--cp-navy)' }}>¿Qué mesa quitas del pedido?</div>
              {mesasPedido.map((m) => (
                <Boton key={m.id} variante="secundario" onClick={() => setMesaQuitar(m)}>
                  {`Quitar ${nombreMesaSalon(m)}${m.pedido?.esPrincipal ? ' (principal)' : ''}`}
                </Boton>
              ))}
              <Boton variante="texto" onClick={() => setEligiendoQuitar(false)}>
                Volver
              </Boton>
            </div>
          )}
          {errorQuitar && (
            <div role="alert" style={{ padding: '0 22px 10px', fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
              {errorQuitar}
            </div>
          )}

          <div
            style={{
              padding: '12px 22px',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              background: 'var(--cp-cream)',
            }}
          >
            {alAbrirCuenta && (
              <Boton variante="primario" onClick={() => alAbrirCuenta(mesa)} disabled={!pedido}>
                Ver cuenta y cobrar
              </Boton>
            )}
            {alCambiarMesa && (
              <Boton variante="secundario" onClick={() => alCambiarMesa(mesa)} disabled={!pedido}>
                Cambiar de mesa
              </Boton>
            )}
            {puedeAbrirMesas && alAgregarMesa && (
              <Boton variante="secundario" onClick={() => alAgregarMesa(mesa)} disabled={!pedido}>
                Agregar mesa
              </Boton>
            )}
            {puedeAbrirMesas && pedido && (
              <Boton
                variante="secundario"
                onClick={() => setEligiendoQuitar(true)}
                disabled={sinMesasParaQuitar}
                title={sinMesasParaQuitar ? 'El pedido necesita al menos una mesa. Para cambiarla, usa «Cambiar de mesa».' : undefined}
              >
                Quitar mesa
              </Boton>
            )}
            {puedeForzar && (
              <Boton variante="peligro" onClick={() => setForzando(true)}>
                Liberar mesa
              </Boton>
            )}
            <Boton variante="texto" onClick={alCerrar}>
              Cerrar
            </Boton>
          </div>
        </div>
      </div>

      <Confirmar
        abierto={mesaQuitar !== null}
        titulo={mesaQuitar ? `¿Quitar ${nombreMesaSalon(mesaQuitar)} del pedido?` : ''}
        mensaje={
          mesaQuitar
            ? siguientePrincipal
              ? `${nombreMesaSalon(mesaQuitar)} queda libre. Es la principal: ${nombreMesaSalon(siguientePrincipal)} pasa a serlo. El pedido sigue en sus otras mesas.`
              : `${nombreMesaSalon(mesaQuitar)} queda libre. El pedido sigue en ${otrasDe(mesaQuitar).map(nombreMesaSalon).join(' y ')}. No se anula ni se cobra.`
            : ''
        }
        textoConfirmar="Sí, quitar mesa"
        textoNo="No, volver"
        cargando={quitando}
        alConfirmar={quitarMesa}
        alCancelar={() => setMesaQuitar(null)}
      />

      <Confirmar
        abierto={confirmandoEntrega}
        titulo="Marcar como entregado"
        mensaje={elegidas.length === 1 ? "¿Marcar 1 producto como entregado en la mesa?" : `¿Marcar ${elegidas.length} productos como entregados en la mesa?`}
        textoConfirmar="Sí"
        textoNo="No"
        cargando={entregando}
        alConfirmar={entregar}
        alCancelar={() => setConfirmandoEntrega(false)}
      />

      {forzando && (
        <ModalForzarLiberarMesa
          mesa={mesa}
          alCerrar={() => setForzando(false)}
          alForzar={async (mesaId) => {
            await salonApi.liberarMesaManual(mesaId, undefined, true);
            setForzando(false);
            alCerrar();
            alCambiar();
          }}
        />
      )}
    </>
  );
}
