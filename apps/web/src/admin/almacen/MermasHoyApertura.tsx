import { useCallback, useEffect, useState } from 'react';
import { almacenApi, type MermaHoy } from './almacenApi';
import { ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import './apertura-dia.css';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

/** Anular exige el permiso de movimientos de almacén (ADMIN incluido). Sin sesión disponible, no se ofrece. */
function usePuedeAnular(): boolean {
  try {
    const { tiene, usuario } = useSesion();
    return usuario?.rol === 'ADMIN' || tiene('almacen/movimientos');
  } catch {
    return false;
  }
}

/** «Mermas de hoy»: todo lo que se botó de productos desde esta pantalla, con motivo, hora y quién. Se puede anular. */
export function MermasHoyApertura({ recarga = 0 }: { recarga?: number }) {
  const puedeAnular = usePuedeAnular();
  const [mermas, setMermas] = useState<MermaHoy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setMermas((await almacenApi.mermasHoy()).mermas);
    } catch {
      setMermas(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, recarga]);

  const anular = async (m: MermaHoy) => {
    if (!window.confirm(`¿Anular la merma de ${m.cantidad} de ${m.producto}${m.sabor ? ` · ${m.sabor}` : ''}? Se devuelve al stock.`)) return;
    setAnulando(m.id);
    setError(null);
    try {
      await almacenApi.anularMovimiento(m.id, 'Merma registrada por error');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo anular la merma.');
    } finally {
      setAnulando(null);
    }
  };

  if (mermas === null) return null;
  return (
    <section className="ap-mermas-hoy" aria-label="Mermas de hoy">
      <h2 className="ap-mermas-titulo">Mermas de hoy</h2>
      {mermas.length === 0 ? (
        <p className="ap-ayuda">Hoy no se ha botado nada.</p>
      ) : (
        <ul className="ap-mermas-lista">
          {mermas.map((m) => (
            <li key={m.id} className={`ap-merma-fila${m.anulada ? ' ap-merma-fila--anulada' : ''}`} data-testid="merma-hoy">
              <div className="ap-merma-fila-txt">
                <b>
                  {m.producto}
                  {m.sabor ? ` · ${m.sabor}` : ''}
                </b>
                <span className="ap-merma-chip">−{m.cantidad}</span>
                <span>
                  {m.motivo}
                  {m.nota ? ` · ${m.nota}` : ''}
                </span>
                <small>
                  {hora(m.en)}
                  {m.por ? ` · ${m.por}` : ''}
                  {m.anulada ? ' · anulada' : ''}
                </small>
              </div>
              {puedeAnular && !m.anulada && (
                <button type="button" className="ap-boton-texto" disabled={anulando === m.id} onClick={() => void anular(m)}>
                  Anular
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div role="alert" className="ap-mensaje ap-mensaje--error">
          {error}
        </div>
      )}
    </section>
  );
}
