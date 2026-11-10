import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { TipoMarca } from './asistenciaApi';
import {
  ETIQUETA_ROL,
  InconsistenciaPersona,
  Solicitud,
  cancelarSolicitud,
  crearSolicitud,
  miInconsistencias,
  misSolicitudes,
} from './correccionesApi';

export interface PedidoCorreccion {
  jornada: string;
  /** Marca que probablemente falta: prellena la primera fila. */
  tipo?: TipoMarca | null;
}

const TIPOS: TipoMarca[] = ['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA'];
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.response?.mensaje ?? (e as any)?.message ?? fallback;
const VARIANTE: Record<string, VarianteInsignia> = { PENDIENTE: 'aviso', APROBADA: 'exito', RECHAZADA: 'peligro', CANCELADA: 'neutro' };
const ETIQUETA_SOL: Record<string, string> = {
  PENDIENTE: 'Pendiente de aprobación', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
};

/**
 * «Mi asistencia»: inconsistencias detectadas (se corrigen con la mente fresca al día siguiente), formulario de
 * solicitud de corrección y mis solicitudes. La corrección NO cuenta hasta que el administrador la aprueba.
 */
export function CorreccionesAsistencia({ pedido, alAbrir, alCerrar }: { pedido: PedidoCorreccion | null; alAbrir: (p: PedidoCorreccion) => void; alCerrar: () => void }) {
  const [inconsistencias, setInconsistencias] = useState<InconsistenciaPersona[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [i, s] = await Promise.all([miInconsistencias().catch(() => []), misSolicitudes().catch(() => [])]);
    setInconsistencias(i);
    setSolicitudes(s);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cancelar = async (id: number) => {
    try {
      await cancelarSolicitud(id);
      setAviso('Solicitud cancelada.');
      await cargar();
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo cancelar la solicitud.'));
    }
  };

  return (
    <>
      {inconsistencias.length > 0 && (
        <section aria-label="Inconsistencias de asistencia" className="ma-card ma-inconsistencia" data-testid="bloque-inconsistencias">
          <h3 className="as-sub">Inconsistencia detectada: revisa y corrige tu asistencia</h3>
          <p className="as-ayuda">Estas jornadas ya cerraron y sus marcas no cuadran. Indica la hora real: el administrador la aprobará (no cuenta hasta entonces).</p>
          <ul className="ma-lista-sin">
            {inconsistencias.map((i) => (
              <li key={i.jornada} className="ma-item">
                <span>
                  <b>{i.texto}</b>
                  {i.rechazo && <small className="ma-rechazo">Rechazada: {i.rechazo}</small>}
                  {i.estado === 'ENVIADA' && <small>Corrección enviada, pendiente de aprobación</small>}
                </span>
                {i.estado === 'ENVIADA'
                  ? <Insignia variante="aviso">Enviada</Insignia>
                  : <Boton type="button" variante="secundario" onClick={() => alAbrir({ jornada: i.jornada, tipo: i.falta })}>Corregir {i.etiqueta}</Boton>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pedido && (
        <FormularioSolicitud
          key={`${pedido.jornada}-${pedido.tipo ?? ''}`}
          pedido={pedido}
          alCerrar={alCerrar}
          alEnviado={async () => { setAviso('Corrección enviada. Queda pendiente de aprobación del administrador.'); alCerrar(); await cargar(); }}
        />
      )}

      {aviso && <div role="status" className="ma-resultado ma-resultado--ok"><span>{aviso}</span></div>}
      {error && <div role="alert" className="ma-resultado ma-resultado--error"><span>{error}</span></div>}

      {solicitudes.length > 0 && (
        <section aria-label="Mis solicitudes de corrección" className="ma-lista">
          <h3 className="as-sub">Mis solicitudes de corrección</h3>
          {solicitudes.map((s) => (
            <div key={s.id} className="ma-item ma-item--col">
              <span>
                <b>{s.etiqueta}</b> · {s.items.map((x) => `${x.hora} ${ETIQUETA_ROL[x.tipo]}`).join(', ')}
                <small>{s.motivo}</small>
                {s.estado === 'RECHAZADA' && s.motivoResolucion && <small className="ma-rechazo">Motivo del rechazo: {s.motivoResolucion}</small>}
              </span>
              <Insignia variante={VARIANTE[s.estado] ?? 'neutro'}>{ETIQUETA_SOL[s.estado] ?? s.estado}</Insignia>
              {s.estado === 'PENDIENTE' && <Boton type="button" variante="texto" onClick={() => void cancelar(s.id)}>Cancelar solicitud</Boton>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function FormularioSolicitud({ pedido, alCerrar, alEnviado }: { pedido: PedidoCorreccion; alCerrar: () => void; alEnviado: () => Promise<void> }) {
  const [jornada, setJornada] = useState(pedido.jornada);
  const [items, setItems] = useState<Array<{ tipo: TipoMarca; hora: string }>>([{ tipo: pedido.tipo ?? 'SALIDA', hora: '' }]);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido = items.every((i) => /^\d{2}:\d{2}$/.test(i.hora)) && motivo.trim().length >= 5 && Boolean(jornada);
  const cambiar = (n: number, parte: Partial<{ tipo: TipoMarca; hora: string }>) => setItems((xs) => xs.map((x, i) => (i === n ? { ...x, ...parte } : x)));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await crearSolicitud({ jornada, items, motivo: motivo.trim() });
      await alEnviado();
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo enviar la solicitud.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="ma-card" aria-label="Pedir corrección de asistencia" onSubmit={(e) => void enviar(e)}>
      <h3 className="as-sub">Pedir corrección</h3>
      <p className="as-ayuda">Me olvidé de marcar o marqué mal: pon la hora real de cada marca. No cuenta hasta que el administrador la apruebe.</p>
      <label className="as-campo">Jornada
        <input type="date" value={jornada} onChange={(e) => setJornada(e.target.value)} required />
      </label>
      {items.map((it, n) => (
        <div key={n} className="ma-fila-item">
          <label className="as-campo">Marca
            <select value={it.tipo} onChange={(e) => cambiar(n, { tipo: e.target.value as TipoMarca })}>
              {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_ROL[t]}</option>)}
            </select>
          </label>
          <label className="as-campo">Hora real
            <input type="time" value={it.hora} onChange={(e) => cambiar(n, { hora: e.target.value })} required />
          </label>
          {items.length > 1 && <Boton type="button" variante="texto" onClick={() => setItems((xs) => xs.filter((_, i) => i !== n))}>Quitar</Boton>}
        </div>
      ))}
      {items.length < 8 && <Boton type="button" variante="secundario" onClick={() => setItems((xs) => [...xs, { tipo: 'SALIDA', hora: '' }])}>Agregar otra marca</Boton>}
      <label className="as-campo">Motivo (mínimo 5 caracteres)
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={2} required />
      </label>
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      <Boton type="submit" tamano="grande" disabled={!valido || enviando}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</Boton>
      <Boton type="button" variante="texto" onClick={alCerrar}>Cancelar</Boton>
    </form>
  );
}
