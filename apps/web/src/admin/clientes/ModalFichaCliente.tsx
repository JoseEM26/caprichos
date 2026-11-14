import { useEffect, useState } from 'react';
import { InsigniaGasta, InsigniaVerificacion } from './InsigniasVerificacion';
import type { ClienteItem, FichaCliente, MovimientoPuntosItem, PedidoCliente } from './tipos';
import { obtenerFichaCliente, listarHistorialPuntos, listarComprasCliente } from './clientesApi';
import { DetalleCompra } from './DetalleCompra';
import { useSesion } from '../../comun/sesion';
import { ModalAjustarPuntos } from './ModalAjustarPuntos';

interface PropsModalFichaCliente {
  abierto: boolean;
  cliente: ClienteItem | null;
  alCerrar: () => void;
  alPuntosActualizados: () => void;
}

function useEsAdmin(): boolean {
  try {
    const { usuario } = useSesion();
    return usuario?.rol?.toUpperCase() === 'ADMIN';
  } catch {
    return false;
  }
}

export function ModalFichaCliente({
  abierto,
  cliente,
  alCerrar,
  alPuntosActualizados,
}: PropsModalFichaCliente) {
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoPuntosItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const esAdmin = useEsAdmin();
  const [abrirAjuste, setAbrirAjuste] = useState(false);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [masCompras, setMasCompras] = useState<PedidoCliente[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [paginaCompras, setPaginaCompras] = useState(1);
  const [saldoPuntos, setSaldoPuntos] = useState(cliente?.puntos ?? 0);

  useEffect(() => {
    if (!abierto || !cliente) return;
    setSaldoPuntos(cliente.puntos);
    setCargando(true);
    Promise.all([
      obtenerFichaCliente(cliente.id).catch(() => null),
      listarHistorialPuntos(cliente.id).catch(() => []),
    ])
      .then(([f, movs]) => {
        if (f) {
          setFicha(f);
          setHayMas(f.pedidos.length >= 20);
          setMasCompras([]);
          setPaginaCompras(1);
          setAbiertas({});
          setSaldoPuntos(f.puntos);
        }
        setMovimientos(movs || []);
      })
      .finally(() => setCargando(false));
  }, [abierto, cliente]);

  if (!abierto || !cliente) return null;

  const nombre = ficha?.nombre || cliente.nombre;
  const pedidosCount = ficha?.pedidos?.length ?? cliente.pedidos;
  const info = `${cliente.tipo}${ficha?.ruc ? ` · RUC ${ficha.ruc}` : ''}${ficha?.telefono ? ` · Cel. ${ficha.telefono}` : ''} · ${saldoPuntos.toFixed(2)} puntos · ${pedidosCount} pedidos`;

  const pedidos = [...(ficha?.pedidos || []), ...masCompras];
  const verMas = async () => {
    const r = await listarComprasCliente(cliente.id, paginaCompras + 1).catch(() => null);
    if (!r) return;
    setMasCompras((a) => [...a, ...r.pedidos]);
    setPaginaCompras(r.pagina);
    setHayMas(r.hayMas);
  };
  const verif = ficha && ficha.verificado !== undefined ? ficha : cliente;

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Historial del cliente"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(670px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
            {nombre}
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: 20,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <InsigniaVerificacion cliente={verif} />
          <InsigniaGasta cliente={{ ...verif, puedeGastarPuntos: verif.puedeGastarPuntos && saldoPuntos > 0 }} saldo={saldoPuntos} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>{info}</div>
          {esAdmin && <button
            type="button"
            onClick={() => setAbrirAjuste(true)}
            style={{
              minHeight: 36,
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: 9999,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Ajustar puntos
          </button>}
        </div>

        <div style={{ fontWeight: 800, marginTop: 4 }}>Historial de compras</div>

        {cargando && (
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando historial...</div>
        )}

        {!cargando && pedidos.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
            Este cliente aún no tiene compras.
          </div>
        )}

        {!cargando && pedidos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pedidos.map((o) => (
              <div key={o.id} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--cp-line)', padding: '6px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 100px', gap: 6, fontSize: 13 }}>
                  <b>{o.id}</b>
                  <span>{o.modalidad} · {o.estado}</span>
                  <span>{o.total}</span>
                  <span style={{ color: 'var(--cp-soft)' }}>{o.pago}</span>
                </div>
                {o.puntos && (
                  <span data-testid="puntos-pedido" style={{ fontSize: 12, color: o.puntos.estado === 'NO_SUMA' ? 'var(--cp-rust)' : 'var(--cp-green)' }}>
                    Puntos: {o.puntos.estado === 'SUMADO' ? `+${(o.puntos.puntos ?? 0).toFixed(2)} · ` : ''}
                    {o.puntos.texto}
                  </span>
                )}
                {o.pedidoId && (
                  <>
                    <button
                      type="button"
                      aria-expanded={Boolean(abiertas[o.pedidoId])}
                      onClick={() => setAbiertas((a) => ({ ...a, [o.pedidoId!]: !a[o.pedidoId!] }))}
                      style={{ alignSelf: 'flex-start', minHeight: 32, border: 0, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      {abiertas[o.pedidoId] ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    {abiertas[o.pedidoId] && <DetalleCompra clienteId={cliente.id} pedidoId={o.pedidoId} />}
                  </>
                )}
              </div>
            ))}
            {hayMas && (
              <button type="button" onClick={verMas} style={{ minHeight: 36, border: '1.5px solid var(--cp-navy)', borderRadius: 9999, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>
                Ver más compras
              </button>
            )}
          </div>
        )}

        {movimientos.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Historial de puntos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
              {movimientos.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--cp-line)',
                    padding: '6px 0',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700 }}>{m.tipo}</span>
                    <span style={{ color: 'var(--cp-soft)', marginLeft: 6 }}>{m.motivo}</span>
                    {m.fecha && (
                      <span style={{ color: 'var(--cp-soft)', marginLeft: 6 }}>
                        · {new Date(m.fecha).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontWeight: 800,
                      color: m.tipo === 'SUMA' ? 'var(--cp-ok, #2E7D32)' : 'var(--cp-rust, #C73E2A)',
                    }}
                  >
                    {m.tipo === 'SUMA' ? `+${m.puntos}` : `-${m.puntos}`} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {esAdmin && <ModalAjustarPuntos
        abierto={abrirAjuste}
        clienteId={cliente.id}
        clienteNombre={nombre}
        saldoActual={saldoPuntos}
        alCerrar={() => setAbrirAjuste(false)}
        alAjustarExitoso={(nuevoSaldo) => {
          setSaldoPuntos(nuevoSaldo);
          alPuntosActualizados();
          listarHistorialPuntos(cliente.id).then((movs) => setMovimientos(movs || []));
        }}
      />}
    </>
  );
}
