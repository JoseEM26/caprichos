import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import type { DireccionCliente } from '../tipos';

const botonQuitar: CSSProperties = {
  flex: 'none',
  minHeight: 44,
  minWidth: 44,
  padding: '0 12px',
  border: '1.5px solid var(--cp-navy)',
  borderRadius: 12,
  background: 'transparent',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: 14,
};

/** Libreta de direcciones del cliente. Se guardan solas al pedir delivery; aquí solo se quitan (no se borran). */
export function MisDirecciones() {
  const [direcciones, setDirecciones] = useState<DireccionCliente[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [aQuitar, setAQuitar] = useState<DireccionCliente | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let vigente = true;
    api
      .get<{ direcciones: DireccionCliente[] }>('/carta/cuenta/direcciones')
      .then((r) => {
        if (vigente) setDirecciones(Array.isArray(r?.direcciones) ? r.direcciones : []);
      })
      .catch(() => {
        if (!vigente) return;
        setDirecciones([]);
        setErrorCarga(true);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const quitar = async () => {
    if (!aQuitar) return;
    const id = aQuitar.id;
    setQuitando(true);
    setMensaje('');
    try {
      await api.delete(`/carta/cuenta/direcciones/${id}`);
    } catch (err) {
      // 404: ya no estaba (por ejemplo, quitada desde otro dispositivo); igual sale de la lista
      if (!(err instanceof ErrorApi && err.statusCode === 404)) {
        setMensaje(err instanceof Error ? err.message : 'No se pudo quitar la dirección. Intenta de nuevo.');
        setAQuitar(null);
        setQuitando(false);
        return;
      }
    }
    setDirecciones((lista) => (lista ?? []).filter((d) => d.id !== id));
    setAQuitar(null);
    setQuitando(false);
  };

  return (
    <div
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: 16,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>Mis direcciones</div>

      {direcciones === null ? (
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando...</div>
      ) : direcciones.length === 0 ? (
        <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>
          {errorCarga
            ? 'No pudimos cargar tus direcciones. Intenta de nuevo más tarde.'
            : 'Aún no tienes direcciones guardadas. Se guardan solas cuando pides delivery.'}
        </div>
      ) : (
        direcciones.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--cp-line)', paddingTop: 10 }}>
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{d.direccion}</span>
              {d.referencia && <span style={{ fontSize: 12, color: 'var(--cp-soft)', overflowWrap: 'anywhere' }}>{d.referencia}</span>}
            </div>
            <button type="button" onClick={() => setAQuitar(d)} aria-label={`Quitar dirección ${d.direccion}`} style={botonQuitar}>
              Quitar
            </button>
          </div>
        ))
      )}

      {mensaje && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
          {mensaje}
        </div>
      )}

      <Confirmar
        abierto={aQuitar !== null}
        titulo="¿Quitar esta dirección?"
        mensaje={aQuitar ? `${aQuitar.direccion}. Dejará de aparecer entre tus direcciones; tus pedidos anteriores no cambian.` : undefined}
        textoSi="Sí, quitar"
        peligro
        cargando={quitando}
        alConfirmar={quitar}
        alCancelar={() => setAQuitar(null)}
      />
    </div>
  );
}
