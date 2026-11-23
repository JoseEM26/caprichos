import { useEffect, useState } from 'react';
import { FichaClienteChat, obtenerFichaCliente } from './mensajesApi';

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: 'America/Lima' });

/** Historial breve del cliente del chat: últimos pedidos, puntos y lo que más pide. Solo lectura. */
export function FichaCliente({ conversacionId }: { conversacionId: string }) {
  const [ficha, setFicha] = useState<FichaClienteChat | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    setFicha(null);
    setFallo(false);
    obtenerFichaCliente(conversacionId)
      .then((f) => vigente && setFicha(f))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [conversacionId]);

  return (
    <section className="msg-seccion" aria-label="Historial del cliente">
      <span className="msg-seccion-titulo">Historial del cliente</span>
      {fallo && <span className="msg-panel-nota">No se pudo cargar el historial.</span>}
      {!fallo && !ficha && <span className="msg-panel-nota">Cargando…</span>}
      {ficha && (
        <>
          {ficha.puntos !== null && (
            <div className="msg-dato">
              <span className="msg-dato-etiqueta">Puntos</span>
              <span className="msg-dato-valor">{ficha.puntos}</span>
            </div>
          )}
          {ficha.frecuentes.length > 0 && (
            <div className="msg-dato">
              <span className="msg-dato-etiqueta">Lo que más pide</span>
              <span className="msg-dato-valor">{ficha.frecuentes.map((f) => `${f.nombre} (${f.cantidad})`).join(', ')}</span>
            </div>
          )}
          {ficha.pedidos.length === 0 ? (
            <span className="msg-panel-nota">Aún no tiene pedidos.</span>
          ) : (
            <ul className="msg-ficha-pedidos" aria-label="Últimos pedidos">
              {ficha.pedidos.map((p) => (
                <li key={p.codigo}>
                  <b>{p.codigo}</b> · {fechaCorta(p.fecha)} · S/ {p.total.toFixed(2)} · {p.estado}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
