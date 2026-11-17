import { useEffect, useState } from 'react';
import { Insignia } from '../../comun/Insignia';
import { avisosTurnos, configurarAvisoTurno, type DestinatarioAviso } from '../asistencia/turnosApi';

const ETIQUETA_ROL: Record<string, string> = { ADMIN: 'Administración', SUPERVISOR: 'Supervisión' };

const canalDe = (c: DestinatarioAviso['canal']) => {
  if (c.celular) return { texto: 'WhatsApp', variante: 'exito' as const };
  if (c.correo) return { texto: 'Correo (no tiene celular)', variante: 'aviso' as const };
  return { texto: 'Sin celular ni correo', variante: 'peligro' as const };
};

/**
 * Configuración: quién recibe los avisos de reemplazos y cambios de turno (al pedir, al aceptar y al aprobar o rechazar).
 * Solo Administración cambia la casilla; por WhatsApp si la persona tiene celular, y por correo si no.
 */
export function TarjetaAvisosTurnos() {
  const [lista, setLista] = useState<DestinatarioAviso[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  useEffect(() => {
    avisosTurnos()
      .then((r) => setLista(Array.isArray(r) ? r : []))
      .catch((e: any) => setError(e?.mensaje ?? 'No pudimos cargar la lista de avisos.'));
  }, []);

  const cambiar = async (p: DestinatarioAviso, activo: boolean) => {
    setOcupado(p.partyId);
    setError(null);
    try {
      await configurarAvisoTurno(p.partyId, activo);
      setLista((l) => (l ?? []).map((x) => (x.partyId === p.partyId ? { ...x, avisos: activo } : x)));
    } catch (e: any) {
      setError(e?.mensaje ?? 'No se pudo guardar el cambio.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className="tarjeta-config" aria-label="Quién recibe avisos de reemplazos y cambios de turno">
      <h3>Quién recibe avisos de reemplazos y cambios de turno</h3>
      <p>Se avisa cuando alguien pide un cambio, cuando el reemplazo acepta y cuando se aprueba o se rechaza (con el motivo).</p>
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      {lista && lista.length === 0 && <p>No hay personal de Administración o Supervisión activo.</p>}
      <ul className="ma-lista">
        {(lista ?? []).map((p) => {
          const canal = canalDe(p.canal);
          return (
            <li key={p.partyId}>
              <label>
                <input
                  type="checkbox"
                  checked={p.avisos}
                  disabled={ocupado === p.partyId}
                  onChange={(e) => void cambiar(p, e.target.checked)}
                />{' '}
                {p.nombre} <small>{ETIQUETA_ROL[p.rol] ?? p.rol}</small>
              </label>{' '}
              <Insignia variante={canal.variante}>{canal.texto}</Insignia>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
