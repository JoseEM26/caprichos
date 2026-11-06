import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import type { DireccionCliente } from '../tipos';

/** Cuántas direcciones se ven antes de «Ver todas». */
const VISIBLES = 2;

/** Etiqueta de origen, solo cuando el dato existente la dice (WhatsApp o la carta). */
const ORIGEN: Record<string, string> = { WHATSAPP: 'Enviada por WhatsApp', CARTA: 'Guardada en la carta' };

const ESTILOS = `
.cp-dir-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cp-dir-lista--scroll{max-height:216px;overflow-y:auto;overscroll-behavior:contain;padding-right:4px}
.cp-dir-item{display:flex;align-items:center;gap:8px;min-height:48px;padding:4px 4px 4px 10px;background:var(--cp-cream);border:1px solid var(--cp-line);border-radius:12px;transition:background .15s,border-color .15s}
.cp-dir-item:hover{background:var(--cp-sand);border-color:var(--cp-line2)}
.cp-dir-texto{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.cp-dir-linea{flex:1;min-width:0;font-weight:700;font-size:14px;color:var(--cp-navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-dir-origen{flex:none;font-size:11px;font-weight:700;color:var(--cp-soft);background:var(--cp-white);border:1px solid var(--cp-line);border-radius:999px;padding:2px 8px;white-space:nowrap}
.cp-dir-quitar{flex:none;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:10px;background:transparent;color:var(--cp-soft);cursor:pointer}
.cp-dir-quitar:hover{background:#FBE3D6;color:var(--cp-rust)}
.cp-dir-quitar:focus-visible,.cp-dir-ver:focus-visible{outline:2px solid var(--cp-orange);outline-offset:2px}
.cp-dir-ver{align-self:flex-start;min-height:36px;padding:0 4px;border:0;background:transparent;color:var(--cp-navy);font-weight:800;font-size:13px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.cp-dir-vacio{display:flex;align-items:center;gap:10px;padding:12px;border:1px dashed var(--cp-line2);border-radius:12px;font-size:13px;line-height:18px;color:var(--cp-soft)}
`;

function etiquetaDe(d: DireccionCliente): string | null {
  return ORIGEN[d.origen] ?? null;
}

/** Libreta de direcciones del cliente. Se guardan solas al pedir delivery; aquí solo se quitan (no se borran). */
export function MisDirecciones() {
  const [direcciones, setDirecciones] = useState<DireccionCliente[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [aQuitar, setAQuitar] = useState<DireccionCliente | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [verTodas, setVerTodas] = useState(false);

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

  const total = direcciones?.length ?? 0;
  const hayMas = total > VISIBLES;
  const mostradas = direcciones && !verTodas ? direcciones.slice(0, VISIBLES) : direcciones ?? [];

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
      <style>{ESTILOS}</style>
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>Mis direcciones</div>

      {direcciones === null ? (
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando...</div>
      ) : total === 0 ? (
        <div className="cp-dir-vacio">
          <Icono nombre="mapa" tamano={18} style={{ color: 'var(--cp-orange)' }} />
          <span>
            {errorCarga
              ? 'No pudimos cargar tus direcciones. Intenta de nuevo más tarde.'
              : 'Aún no tienes direcciones guardadas. Se guardan solas cuando pides delivery.'}
          </span>
        </div>
      ) : (
        <>
          <ul
            className={verTodas && hayMas ? 'cp-dir-lista cp-dir-lista--scroll' : 'cp-dir-lista'}
            id="mis-direcciones-lista"
            aria-label="Direcciones guardadas"
          >
            {mostradas.map((d) => {
              const etiqueta = etiquetaDe(d);
              const texto = d.alias?.trim() || d.direccion;
              return (
                <li key={d.id} className="cp-dir-item" title={d.referencia ? `${texto} · ${d.referencia}` : texto}>
                  <Icono nombre="mapa" tamano={16} style={{ color: 'var(--cp-orange)' }} />
                  <div className="cp-dir-texto">
                    <span className="cp-dir-linea">{texto}</span>
                    {etiqueta && <span className="cp-dir-origen">{etiqueta}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAQuitar(d)}
                    aria-label={`Quitar dirección ${d.direccion}`}
                    title="Quitar"
                    className="cp-dir-quitar"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>

          {hayMas && (
            <button
              type="button"
              className="cp-dir-ver"
              aria-expanded={verTodas}
              aria-controls="mis-direcciones-lista"
              onClick={() => setVerTodas((v) => !v)}
            >
              {verTodas ? 'Ver menos' : `Ver todas (${total})`}
            </button>
          )}
        </>
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
