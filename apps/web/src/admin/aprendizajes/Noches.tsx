import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { aprendizajesApi, ESTADO_HISTORICO, fechaCorta, mensajeError, type EstadoNoche, type Resumen } from './aprendizajesApi';

const ESTADO_NOCHE: Record<EstadoNoche, { texto: string; clase: string }> = {
  OK: { texto: 'Todo bien', clase: 'ok' },
  TOPE: { texto: 'Se llegó al tope de gasto', clase: 'tope' },
  SIN_IA: { texto: 'Sin IA disponible', clase: 'sinia' },
  ERROR: { texto: 'Falló', clase: 'error' },
  EN_CURSO: { texto: 'En curso', clase: 'curso' },
};
const usd = (n: number) => `US$ ${n.toFixed(2)}`;

export function Noches({ puedeAprobar, alCambiar }: { puedeAprobar: boolean; alCambiar: () => void }) {
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorEjecutar, setErrorEjecutar] = useState<string | null>(null);
  const [confirmHist, setConfirmHist] = useState(false);
  const [cargandoHist, setCargandoHist] = useState(false);
  const [errorHist, setErrorHist] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    return aprendizajesApi.resumen().then(setR, (e) => setError(mensajeError(e)));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <EstadoError mensaje={error} alReintentar={cargar} />;
  if (!r) return <Cargando mensaje="Cargando noches" />;

  const n = r.ultimaNoche;
  const ultimas = r.noches.slice(-14);
  const maximo = Math.max(r.topeUsd, ...ultimas.map((x) => x.usd), 0.01);

  return (
    <div className="ap-seccion">
      {n ? (
        <section className="ap-tarjeta" aria-label="Última noche">
          <div className="ap-cab">
            <h3>Última noche ({fechaCorta(n.fecha)})</h3>
            <span className={`ap-estado ap-estado--${ESTADO_NOCHE[n.estado].clase}`}>{ESTADO_NOCHE[n.estado].texto}</span>
          </div>
          <dl className="ap-datos">
            <div><dt>Chats leídos</dt><dd>{n.chatsLeidos}</dd></div>
            <div><dt>Descartados por fuera de tema</dt><dd>{n.descartadosFueraTema}</dd></div>
            <div><dt>Propuestas</dt><dd>{n.propuestas}</dd></div>
            <div><dt>Tokens</dt><dd>{n.tokens}</dd></div>
            <div><dt>Gasto</dt><dd>{usd(n.usd)} de {usd(r.topeUsd)}</dd></div>
          </dl>
        </section>
      ) : <p className="ap-meta">Todavía no se analizó ninguna noche.</p>}

      <section className="ap-tarjeta" aria-label="Gasto por noche">
        <h3>Gasto por noche (últimas 14)</h3>
        {ultimas.length === 0 ? <p className="ap-meta">Sin datos todavía.</p> : (
          <ul className="ap-barras">
            {ultimas.map((x) => (
              <li key={x.fecha} title={`${fechaCorta(x.fecha)}: ${usd(x.usd)}, ${x.propuestas} propuestas`}>
                <span className={`ap-barra ap-barra--${ESTADO_NOCHE[x.estado].clase}`} style={{ height: `${Math.max(2, (x.usd / maximo) * 100)}%` }} />
                <span className="ap-barra__valor">{x.usd.toFixed(2)}</span>
                <span className="ap-barra__fecha">{x.fecha.slice(8)}/{x.fecha.slice(5, 7)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ap-meta">Tope por noche: {usd(r.topeUsd)}</p>
      </section>

      {r.historico && (
        <section className="ap-tarjeta" aria-label="Historial completo" data-testid="historico">
          <h3>Todo el historial</h3>
          <p className="ap-meta">
            {ESTADO_HISTORICO[r.historico.estado] ?? r.historico.estado}
            {r.historico.diasTotales > 0 && ` · ${r.historico.diasProcesados} de ${r.historico.diasTotales} días`}
            {` · gastado ${usd(r.historico.usd)}`}
          </p>
          {r.historico.estado === 'EN_CURSO' && (
            <Boton type="button" variante="secundario" onClick={() => { cargar(); }}>Actualizar avance</Boton>
          )}
        </section>
      )}

      {puedeAprobar && (
        <div className="ap-acciones">
          <Boton type="button" onClick={() => { setErrorEjecutar(null); setConfirmando(true); }}>Analizar ayer ahora</Boton>
          {r.historico && r.historico.estado !== 'EN_CURSO' && r.historico.estado !== 'OK' && (
            <Boton type="button" variante="secundario" onClick={() => { setErrorHist(null); setConfirmHist(true); }}>
              {r.historico.estado === 'NUNCA' ? 'Analizar todo el historial' : 'Continuar el historial'}
            </Boton>
          )}
        </div>
      )}
      <Confirmar abierto={confirmHist} titulo="¿Analizar todo el historial?" mensaje="Se leerán, sin datos personales, todos los chats que atendió una persona desde el inicio. Corre en segundo plano, con tope de gasto propio; las propuestas llegan a «Por revisar»." textoSi="Sí, analizar"
        cargando={cargandoHist} error={errorHist}
        alCancelar={() => setConfirmHist(false)}
        alConfirmar={async () => {
          setCargandoHist(true); setErrorHist(null);
          try { await aprendizajesApi.ejecutarHistorico(); setConfirmHist(false); await cargar(); }
          catch (e) { setErrorHist(mensajeError(e)); } finally { setCargandoHist(false); }
        }} />
      <Confirmar abierto={confirmando} titulo="¿Analizar ayer ahora?" mensaje="Se leerán los chats de ayer y se gastará de la cuota de IA." textoSi="Sí, analizar"
        cargando={cargando} error={errorEjecutar}
        alCancelar={() => setConfirmando(false)}
        alConfirmar={async () => {
          setCargando(true); setErrorEjecutar(null);
          try { await aprendizajesApi.ejecutarAhora(); setConfirmando(false); await cargar(); alCambiar(); }
          catch (e) { setErrorEjecutar(mensajeError(e)); } finally { setCargando(false); }
        }} />
    </div>
  );
}
