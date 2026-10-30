import { useEffect, useState } from 'react';
import { api } from '../../comun/api';
import { useCuenta } from './CuentaContext';

export interface NotificacionItem {
  id: string;
  t: string; // Título
  x: string; // Descripción
  fresh?: boolean;
  code?: string;
  hasCode?: boolean;
  hasTicket?: boolean;
  tCode?: string;
  tNote?: string;
  tVence?: string;
  askBday?: boolean;
}

interface PropsNotificacionesCliente {
  abierto: boolean;
  alCerrar: () => void;
  alUsarCupon?: (codigo: string) => void;
}

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * Campanita de notificaciones del cliente con cupón de cumpleaños (FT-CLI-02, mockup Main.dc.html).
 */
export function NotificacionesCliente({ abierto, alCerrar, alUsarCupon }: PropsNotificacionesCliente) {
  const { cliente, refrescar } = useCuenta();
  const [lista, setLista] = useState<NotificacionItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [bdayInput, setBdayInput] = useState('');
  const [guardandoBday, setGuardandoBday] = useState(false);

  useEffect(() => {
    if (!abierto || !cliente) return;
    setCargando(true);
    api
      .get<{ notificaciones: NotificacionItem[] }>('/carta/cuenta/notificaciones')
      .then((res) => setLista(res.notificaciones || []))
      .catch(() => setLista([]))
      .finally(() => setCargando(false));
  }, [abierto, cliente]);

  if (!abierto) return null;

  const guardarCumple = async () => {
    if (!bdayInput) return;
    setGuardandoBday(true);
    try {
      await api.post('/carta/cuenta/cumpleanos', { cumpleanos: bdayInput });
      await refrescar();
      // Recargar notificaciones
      const res = await api.get<{ notificaciones: NotificacionItem[] }>('/carta/cuenta/notificaciones');
      setLista(res.notificaciones || []);
      setBdayInput('');
    } catch {
      // Manejo silencioso o feedback local
    } finally {
      setGuardandoBday(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          background: 'rgba(0,0,0,0.25)',
        }}
      />
      <div
        role="dialog"
        aria-label="Notificaciones"
        style={{
          position: 'fixed',
          zIndex: 80,
          top: 64,
          right: 12,
          width: 'min(380px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 88px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: 'var(--card, var(--cp-cream, #FFFBF5))',
          color: 'var(--ink, var(--cp-navy, #0B2C3E))',
          border: '1.5px solid var(--ink, var(--cp-navy, #0B2C3E))',
          borderRadius: 16,
          boxShadow: '0 12px 34px rgba(0,0,0,0.28)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 17 }}>
            Notificaciones
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar las notificaciones"
            style={{
              width: 44,
              height: 44,
              border: 0,
              background: 'transparent',
              color: 'var(--ink, var(--cp-navy, #0B2C3E))',
              fontSize: 20,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {cargando ? (
          <div style={{ fontSize: 13, color: 'var(--soft, #5A6D7C)', textAlign: 'center', padding: 12 }}>
            Cargando notificaciones...
          </div>
        ) : lista.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--soft, #5A6D7C)', textAlign: 'center', padding: 12 }}>
            No tienes notificaciones por ahora.
          </div>
        ) : (
          lista.map((n) => (
            <div
              key={n.id}
              style={{
                border: `1.5px solid ${n.fresh ? 'var(--ink, #0B2C3E)' : 'var(--line, #E5D6C5)'}`,
                background: n.fresh ? 'rgba(226, 106, 44, 0.12)' : 'var(--card, #FFFFFF)',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <b style={{ fontSize: 14, lineHeight: '19px' }}>{n.t}</b>
                {n.fresh && (
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 11,
                      fontWeight: 800,
                      borderRadius: 9999,
                      background: 'var(--price, var(--cp-orange, #E26A2C))',
                      color: '#fff',
                      padding: '1px 8px',
                    }}
                  >
                    Nueva
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--soft, #5A6D7C)' }}>{n.x}</div>

              {n.hasTicket && (
                <div
                  style={{
                    border: '1.5px dashed var(--ink, #0B2C3E)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--bg, #FFFFFF)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 800, fontSize: 18, letterSpacing: '0.06em' }}>
                      {n.tCode}
                    </div>
                    {n.tNote && <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--soft, #5A6D7C)' }}>{n.tNote}</div>}
                  </div>
                  {n.tVence && (
                    <div style={{ flex: 'none', textAlign: 'right', fontSize: 12, lineHeight: '16px', fontWeight: 800, color: 'var(--price, #E26A2C)' }}>
                      Vence: {n.tVence}
                    </div>
                  )}
                </div>
              )}

              {n.hasCode && (
                <button
                  type="button"
                  onClick={() => {
                    alUsarCupon?.(n.code || '');
                    alCerrar();
                  }}
                  style={{
                    minHeight: 44,
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--ink, var(--cp-navy, #0B2C3E))',
                    color: 'var(--bg, var(--cp-cream, #FFFBF5))',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  Usar el cupón {n.code}
                </button>
              )}

              {n.askBday && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="date"
                    value={bdayInput}
                    onChange={(e) => setBdayInput(e.target.value)}
                    max={hoyISO()}
                    aria-label="Tu fecha de cumpleaños"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      minHeight: 44,
                      borderRadius: 10,
                      border: '1.5px solid var(--line, #E5D6C5)',
                      background: 'var(--bg, #FFFFFF)',
                      color: 'var(--ink, #0B2C3E)',
                      padding: '0 10px',
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={guardarCumple}
                    disabled={guardandoBday || !bdayInput}
                    style={{
                      flex: 'none',
                      minHeight: 44,
                      padding: '0 14px',
                      border: 0,
                      borderRadius: 10,
                      background: 'var(--ink, var(--cp-navy, #0B2C3E))',
                      color: 'var(--bg, var(--cp-cream, #FFFBF5))',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: 'Montserrat, sans-serif',
                    }}
                  >
                    {guardandoBday ? '...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
