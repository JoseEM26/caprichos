import { useEffect, useState } from 'react';
import type { ClienteItem, FichaCliente, MovimientoPuntosItem } from './tipos';
import { obtenerFichaCliente, listarHistorialPuntos } from './clientesApi';
import { ModalAjustarPuntos } from './ModalAjustarPuntos';

interface PropsModalFichaCliente {
  abierto: boolean;
  cliente: ClienteItem | null;
  alCerrar: () => void;
  alPuntosActualizados: () => void;
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
  const [abrirAjuste, setAbrirAjuste] = useState(false);
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
          setSaldoPuntos(f.puntos);
        }
        setMovimientos(movs || []);
      })
      .finally(() => setCargando(false));
  }, [abierto, cliente]);

  if (!abierto || !cliente) return null;

  const nombre = ficha?.nombre || cliente.nombre;
  const dniMasc = ficha?.dniMascara || cliente.dni;
  const pedidosCount = ficha?.pedidos?.length ?? cliente.pedidos;
  const info = `${cliente.tipo} · DNI ${dniMasc} · ${saldoPuntos.toFixed(2)} puntos · ${pedidosCount} pedidos`;

  const pedidos = ficha?.pedidos || [];

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>{info}</div>
          <button
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
          </button>
        </div>

        <div style={{ fontWeight: 800, marginTop: 4 }}>Pedidos de este turno</div>

        {cargando && (
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando historial...</div>
        )}

        {!cargando && pedidos.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
            Sin pedidos hoy. El historial completo de pedidos pasados llega con la base de datos real.
          </div>
        )}

        {!cargando && pedidos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pedidos.map((o) => (
              <div
                key={o.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 80px 100px',
                  gap: 6,
                  fontSize: 13,
                  borderTop: '1px solid var(--cp-line)',
                  padding: '6px 0',
                }}
              >
                <b>{o.id}</b>
                <span>{o.modalidad} · {o.estado}</span>
                <span>{o.total}</span>
                <span style={{ color: 'var(--cp-soft)' }}>{o.pago}</span>
              </div>
            ))}
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

      <ModalAjustarPuntos
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
      />
    </>
  );
}
