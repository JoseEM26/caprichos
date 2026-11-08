import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEventos } from '../../../comun/socket';
import { Confirmar } from '../../../comun/Confirmar';
import { salonApi } from '../api';
import type { MesaSalon, PedidoEnEspera, PisoPlano, PisoSalon } from '../tipos';
import { SelectorMesasCroquis } from './SelectorMesasCroquis';
import './lista-espera.css';

/** Minutos de espera de un pedido, contados desde su hora de llegada a la lista. */
export function minutosEspera(desde: string, ahora: number = Date.now()): number {
  return Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60000));
}

/** Color por espera: verde menos de 10 min, óxido de 10 a 19, rojo desde 20. */
export function colorEspera(min: number): 'verde' | 'oxido' | 'rojo' {
  return min >= 20 ? 'rojo' : min >= 10 ? 'oxido' : 'verde';
}

export interface AvisoMesaLibre {
  mesaId: string;
}

/**
 * Estado de la lista de espera (FIFO, el que más espera primero) con tiempo real:
 * recarga con `salon:espera` y `salon:mesa`; cuando una mesa pasa a LIBRE y hay lista, deja el aviso «Mesa N libre».
 * Quien lo usa lo pasa a <ListaEsperaMesa> y puede leer `total` (p. ej. para ofrecer «Asignar» en una mesa libre).
 */
export function useListaEspera() {
  const [items, setItems] = useState<PedidoEnEspera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [aviso, setAviso] = useState<AvisoMesaLibre | null>(null);

  const recargar = useCallback(async () => {
    // ponytail: sin listarEspera (pruebas con api simulada) la lista se toma como vacía
    if (typeof salonApi.listarEspera !== 'function') {
      setCargando(false);
      return;
    }
    try {
      const res = await salonApi.listarEspera();
      setItems(res?.items ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
    const cada = setInterval(() => void recargar(), 30000);
    return () => clearInterval(cada);
  }, [recargar]);

  useEventos('salon:espera', recargar);
  const alMesa = useCallback(
    (d: { mesaId?: string; estado?: string }) => {
      void recargar();
      if (d?.estado === 'LIBRE' && d.mesaId) setAviso({ mesaId: String(d.mesaId) });
      else if (d?.estado === 'OCUPADA') setAviso((a) => (a && a.mesaId === String(d.mesaId) ? null : a));
    },
    [recargar],
  );
  useEventos('salon:mesa', alMesa);

  return { items, total: items.length, cargando, error, aviso, descartarAviso: () => setAviso(null), recargar };
}

export type EstadoListaEspera = ReturnType<typeof useListaEspera>;

export interface ListaEsperaMesaProps {
  espera: EstadoListaEspera;
  pisos: PisoSalon[];
  planos?: PisoPlano[] | null;
  /** Después de asignar: la vista refresca sus mesas. */
  alAsignado?: () => void;
  /** Mesa libre que el usuario tocó en el plano: se ofrece asignarle un pedido de la lista. */
  mesaOfrecida?: string | null;
  alCerrarOferta?: () => void;
}

const nombreMesa = (m: MesaSalon) => m.nombre || `Mesa ${m.numero}`;

/**
 * Panel «Lista de espera (N)»: pedidos de mesa que esperan afuera, en orden de llegada.
 * Asignar = el pedido pasa a estar dentro de una mesa libre (confirmación Sí/No antes).
 */
export function ListaEsperaMesa({ espera, pisos, planos, alAsignado, mesaOfrecida, alCerrarOferta }: ListaEsperaMesaProps) {
  const { items, total, cargando, error, aviso, descartarAviso, recargar } = espera;
  const [ahora, setAhora] = useState(() => Date.now());
  // elegir: pedido al que se le busca mesa libre en el croquis · confirmar: par ya decidido, falta el Sí
  const [elegir, setElegir] = useState<PedidoEnEspera | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState<{ pedido: PedidoEnEspera; mesaId: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorAsignar, setErrorAsignar] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const mesas = useMemo(() => pisos.flatMap((p) => p.mesas ?? []), [pisos]);
  const mesaPorId = useCallback((id: string | null | undefined) => mesas.find((m) => m.id === id) ?? null, [mesas]);
  const ocupadas = useMemo(
    () => Object.fromEntries(mesas.filter((m) => m.estado === 'OCUPADA').map((m) => [m.id, { nombre: m.pedido?.codigo ?? null }])),
    [mesas],
  );
  // Mesa ocupada elegida: pide la confirmación fuerte (el pedido que la ocupa pasa a la lista de espera)
  const mesaConfirmar = confirmar ? mesaPorId(confirmar.mesaId) : null;
  const ocupadaConfirmar = mesaConfirmar?.estado === 'OCUPADA' ? mesaConfirmar : null;

  const primero = items[0] ?? null;
  const mesaAviso = aviso ? mesaPorId(aviso.mesaId) : null;
  const mesaOferta = mesaOfrecida ? mesaPorId(mesaOfrecida) : null;

  const cerrarTodo = () => {
    setElegir(null);
    setSeleccion([]);
    setConfirmar(null);
    setErrorAsignar(null);
  };

  const asignar = async () => {
    if (!confirmar) return;
    setEnviando(true);
    setErrorAsignar(null);
    try {
      if (ocupadaConfirmar) await salonApi.asignarEspera(confirmar.pedido.pedidoId, confirmar.mesaId, true);
      else await salonApi.asignarEspera(confirmar.pedido.pedidoId, confirmar.mesaId);
      cerrarTodo();
      descartarAviso();
      alCerrarOferta?.();
      await recargar();
      alAsignado?.();
    } catch (e: any) {
      // 409: la mesa ya se ocupó o el pedido ya salió de la lista: se refresca y se vuelve a elegir
      setErrorAsignar(e?.message || 'No se pudo asignar la mesa. Intenta de nuevo.');
      setConfirmar(null);
      await recargar();
      alAsignado?.();
    } finally {
      setEnviando(false);
    }
  };

  const textoPedido = (p: PedidoEnEspera) => `${p.nombre || 'Cliente'} (${minutosEspera(p.desde, ahora)} min)`;

  return (
    <section className="le" aria-label="Lista de espera de mesa">
      {aviso && mesaAviso && primero && (
        <div className="le-aviso" role="status" aria-live="polite">
          <p className="le-aviso-texto">
            <strong>{nombreMesa(mesaAviso)} libre</strong> — asignar a <strong>{primero.nombre || 'Cliente'}</strong> (esperando{' '}
            {minutosEspera(primero.desde, ahora)} min)
          </p>
          <div className="le-aviso-acciones">
            <button
              type="button"
              className="le-btn le-btn--principal"
              aria-label={`Asignar ${nombreMesa(mesaAviso)} a ${primero.nombre || 'Cliente'}`}
              onClick={() => setConfirmar({ pedido: primero, mesaId: mesaAviso.id })}
            >
              Asignar
            </button>
            <button type="button" className="le-btn" onClick={descartarAviso}>
              Después
            </button>
          </div>
        </div>
      )}

      <header className="le-cabecera">
        <h3 className="le-titulo">
          Lista de espera <span className="le-contador" aria-label={`${total} en la lista`}>{total}</span>
        </h3>
      </header>

      {cargando && <p className="le-vacio">Cargando la lista de espera…</p>}
      {!cargando && error && (
        <p className="le-error" role="alert">
          No pudimos cargar la lista de espera.{' '}
          <button type="button" className="le-enlace" onClick={() => void recargar()}>
            Reintentar
          </button>
        </p>
      )}
      {!cargando && !error && total === 0 && <p className="le-vacio">Nadie espera mesa por ahora.</p>}

      {total > 0 && (
        <ol className="le-lista">
          {items.map((p, i) => {
            const min = minutosEspera(p.desde, ahora);
            return (
              <li key={p.pedidoId} className="le-tarjeta">
                <div className="le-datos">
                  <span className="le-nombre">
                    {i === 0 && <span className="le-primero">Sigue</span>}
                    {p.nombre || 'Cliente'}
                    {p.movidoDesde && <span className="le-movido">Movido desde {p.movidoDesde}</span>}
                  </span>
                  <span className="le-meta">
                    {p.personas ? `${p.personas} pers. · ` : ''}
                    {p.productos} prod. · S/ {p.total.toFixed(2)} · {p.codigo}
                  </span>
                </div>
                <span className={`le-min le-min--${colorEspera(min)}`} aria-label={`Espera ${min} minutos`}>
                  {min} min
                </span>
                <button
                  type="button"
                  className="le-btn le-btn--principal"
                  aria-label={`Asignar mesa a ${p.nombre || 'Cliente'}`}
                  onClick={() => {
                    setErrorAsignar(null);
                    setSeleccion([]);
                    setElegir(p);
                  }}
                >
                  Asignar mesa
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {errorAsignar && !elegir && !mesaOferta && (
        <p className="le-error" role="alert">
          {errorAsignar}
        </p>
      )}

      {/* Elegir una mesa LIBRE en el croquis para un pedido de la lista */}
      {elegir && !confirmar && (
        <div className="le-fondo" role="dialog" aria-modal="true" aria-label={`Elige la mesa para ${elegir.nombre || 'el cliente'}`}>
          <div className="le-modal">
            <h3 className="le-titulo">Mesa para {elegir.nombre || 'el cliente'}</h3>
            <p className="le-meta">Toca una mesa libre. Si eliges una ocupada, su pedido pasa a la lista de espera (te pediremos confirmar).</p>
            {errorAsignar && (
              <p className="le-error" role="alert">
                {errorAsignar}
              </p>
            )}
            <SelectorMesasCroquis
              pisos={pisos}
              planos={planos ?? undefined}
              seleccionadas={seleccion}
              onCambio={(ids) => setSeleccion(ids.slice(-1))}
              personas={elegir.personas ?? undefined}
              ocupadas={ocupadas}
              alTocarOcupada={(m) => setConfirmar({ pedido: elegir, mesaId: m.id })}
            />
            <div className="le-modal-acciones">
              <button type="button" className="le-btn" onClick={cerrarTodo}>
                Cancelar
              </button>
              <button
                type="button"
                className="le-btn le-btn--principal"
                disabled={seleccion.length === 0}
                onClick={() => setConfirmar({ pedido: elegir, mesaId: seleccion[0] })}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tocó una mesa libre en el plano: elegir qué pedido de la lista se sienta ahí */}
      {mesaOferta && !confirmar && (
        <div className="le-fondo" role="dialog" aria-modal="true" aria-label={`Asignar pedido de la lista a ${nombreMesa(mesaOferta)}`}>
          <div className="le-modal">
            <h3 className="le-titulo">Sentar en {nombreMesa(mesaOferta)}</h3>
            {total === 0 ? (
              <p className="le-vacio">No hay pedidos en la lista de espera.</p>
            ) : (
              <ul className="le-opciones">
                {items.map((p, i) => (
                  <li key={p.pedidoId}>
                    <button
                      type="button"
                      className="le-opcion"
                      onClick={() => setConfirmar({ pedido: p, mesaId: mesaOferta.id })}
                    >
                      <span className="le-nombre">
                        {i === 0 && <span className="le-primero">Sigue</span>}
                        {p.nombre || 'Cliente'}
                      </span>
                      <span className={`le-min le-min--${colorEspera(minutosEspera(p.desde, ahora))}`}>
                        {minutosEspera(p.desde, ahora)} min
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errorAsignar && (
              <p className="le-error" role="alert">
                {errorAsignar}
              </p>
            )}
            <div className="le-modal-acciones">
              <button
                type="button"
                className="le-btn"
                onClick={() => {
                  cerrarTodo();
                  alCerrarOferta?.();
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmar && !ocupadaConfirmar && (
        <Confirmar
          abierto
          titulo="¿Asignar esta mesa?"
          mensaje={`${textoPedido(confirmar.pedido)} pasa a ${mesaConfirmar ? nombreMesa(mesaConfirmar) : 'la mesa elegida'}. La mesa queda ocupada con su pedido.`}
          textoConfirmar="Sí, asignar"
          textoNo="No"
          cargando={enviando}
          alConfirmar={asignar}
          alCancelar={() => setConfirmar(null)}
        />
      )}

      {/* Mesa ocupada: confirmación fuerte. El foco empieza en «No»; Enter no confirma, solo pulsar «Sí» a propósito. */}
      {confirmar && ocupadaConfirmar && (
        <div className="le-fondo le-fondo--fuerte" role="alertdialog" aria-modal="true" aria-label="Esta mesa está ocupada">
          <div className="le-modal le-modal--fuerte" data-testid="le-confirmar-ocupada">
            <h3 className="le-titulo le-titulo--fuerte">Esta mesa está ocupada</h3>
            <p className="le-texto">
              {nombreMesa(ocupadaConfirmar)} la ocupa hoy <strong>{ocupadaConfirmar.pedido?.cliente || 'otro cliente'}</strong>
              {ocupadaConfirmar.pedido?.codigo ? ` (${ocupadaConfirmar.pedido.codigo})` : ''}.
            </p>
            <p className="le-texto">
              Si continúas, el pedido de <strong>{ocupadaConfirmar.pedido?.cliente || 'otro cliente'}</strong> (
              {ocupadaConfirmar.pedido?.codigo ?? 'sin código'}) pasará a la <strong>LISTA DE ESPERA</strong> y{' '}
              <strong>{confirmar.pedido.nombre || 'el cliente'}</strong> ocupará la mesa. No se pierde ningún pedido, solo cambia la mesa.
            </p>
            <div className="le-modal-acciones">
              <button type="button" className="le-btn le-btn--grande" autoFocus disabled={enviando} onClick={() => setConfirmar(null)}>
                No
              </button>
              <button
                type="button"
                className="le-btn le-btn--grande le-btn--peligro"
                disabled={enviando}
                onClick={() => void asignar()}
              >
                Sí, mover a la lista de espera y asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
