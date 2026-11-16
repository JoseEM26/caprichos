import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ETIQUETA_TIPO_CAL, type FilaCal } from './calendarioApi';
import { cambiarHoraMarca, type CronoMarca } from './correccionesApi';
import { sumarDias } from './CronogramaTab';

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
export const MOTIVO_FALLA = 'Falla del sistema al marcar (GPS)';
/** Minutos de una hora «HH:MM»; la madrugada (antes de las 04:00) cuenta como del mismo día laboral. */
const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); const m = a * 60 + b; return a < 4 ? m + 1440 : m; };

/** Cómo queda la fila al cambiar la hora: «Entrada 14:12 → 14:00 · Tardanza 12 min → 0 min». */
export function vistaPrevia(fila: FilaCal, marca: CronoMarca, hora: string): string {
  const nombre = ETIQUETA_TIPO_CAL[marca.rol ?? ''] ?? 'Marca';
  let t = `${nombre} ${marca.hora} → ${hora || '—'}`;
  if (marca.rol === 'ENTRADA' && fila.turno && hora) {
    t += ` · Tardanza ${fila.tardanzaMin} min → ${Math.max(0, aMin(hora) - aMin(fila.turno.entrada))} min`;
  }
  return t;
}

/** Cambiar la hora de una marca existente (sustituye a la lista: se muestra en el mismo detalle, con «← Volver»). */
export function CambiarHoraMarca({ fila, marca, alVolver, alGuardar, onError }: {
  fila: FilaCal; marca: CronoMarca; alVolver: () => void; alGuardar: () => Promise<void>; onError: (m: string | null) => void;
}) {
  const [hora, setHora] = useState(marca.hora);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = /^\d{2}:\d{2}$/.test(hora) && hora !== marca.hora && motivo.trim().length >= 10;
  const guardar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const dia = hora < '04:00' ? sumarDias(fila.fecha, 1) : fila.fecha;
      await cambiarHoraMarca(marca.id, `${dia}T${hora}:00-05:00`, motivo.trim(), marca.rol);
      onError(null);
      await alGuardar();
      alVolver();
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo cambiar la hora.'));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="ca-correccion" aria-label={`Cambiar la hora de la marca de las ${marca.hora}`}>
      <Boton type="button" variante="texto" onClick={alVolver}>← Volver a las marcas</Boton>
      <h4>Cambiar la hora: {ETIQUETA_TIPO_CAL[marca.rol ?? ''] ?? 'Marca'} de las {marca.hora}</h4>
      <div className="as-form">
        <label className="as-campo">Hora correcta
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        <label className="as-campo">Motivo (mínimo 10 caracteres)
          <input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
        </label>
      </div>
      <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setMotivo(MOTIVO_FALLA)}>{MOTIVO_FALLA}</Boton>
      <p role="status" className="as-ayuda" data-testid="vista-previa"><b>Así queda:</b> {vistaPrevia(fila, marca, hora)}</p>
      <small className="as-ayuda">La marca original no se borra: queda anulada en el historial con tu nombre y el motivo, y la nueva hora la reemplaza. La tardanza y las horas se recalculan.</small>
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      <div className="as-acciones">
        <Boton type="button" disabled={!valido || ocupado} onClick={() => void guardar()}>{ocupado ? 'Guardando…' : 'Guardar nueva hora'}</Boton>
        <Boton type="button" variante="secundario" onClick={alVolver}>Cancelar</Boton>
      </div>
    </section>
  );
}
