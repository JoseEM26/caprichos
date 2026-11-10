import { useEffect, useState } from 'react';
import { Insignia } from '../../comun/Insignia';
import { MiGanado, miGanado, soles } from './planillaApi';
import './asistencia.css';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const etiquetaDia = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

/** «Lo que llevo ganado»: por día y acumulado del período actual. Solo lo propio; estimado hasta que el admin pague. */
export function TarjetaGanado() {
  const [g, setG] = useState<MiGanado | null>(null);
  useEffect(() => {
    miGanado().then(setG).catch(() => setG(null));
  }, []);
  if (!g) return null;
  if (!g.conSueldo) {
    return (
      <section aria-label="Lo que llevo ganado" className="ma-lista">
        <h3 className="as-sub">Lo que llevo ganado</h3>
        <p className="as-ayuda" data-testid="ganado-sin-sueldo">Tu sueldo aún no está configurado. Cuando el administrador lo registre, aquí verás lo que vas ganando cada día.</p>
      </section>
    );
  }
  const dias = (g.dias ?? []).filter((d) => d.trabajadaH > 0 || d.ganado > 0 || d.feriado);
  const pagado = g.estado === 'PAGADO';
  return (
    <section aria-label="Lo que llevo ganado" className="ma-lista" data-testid="tarjeta-ganado">
      <h3 className="as-sub">Lo que llevo ganado ({g.periodo?.desde} a {g.periodo?.hasta})</h3>
      <div className="ma-card">
        <div className="ma-ganado-total">
          <span>{g.modalidad === 'SEMANAL' ? 'Acumulado de la semana' : 'Acumulado del mes'}</span>
          <strong>{soles(g.acumulado)}</strong>
          <Insignia variante={pagado ? 'exito' : 'aviso'}>{pagado ? 'Pagado' : 'Estimado'}</Insignia>
        </div>
        {pagado ? (
          <p className="as-ayuda">Período pagado. Neto recibido (después de consumos, descuentos y adelantos): <strong>{soles(g.neto)}</strong></p>
        ) : (
          <p className="as-ayuda">Estimado: puede cambiar hasta que el administrador cierre el período.</p>
        )}
        {dias.length === 0 && <p className="as-ayuda">Todavía no tienes horas trabajadas en este período.</p>}
        {dias.map((d) => (
          <div key={d.jornada} className="ma-ganado-dia">
            <span>
              <b>{etiquetaDia(d.jornada)}</b>
              <small>{d.trabajadaH} h trabajadas</small>
            </span>
            {d.feriado && d.recargo !== 1 && <Insignia variante="acento">Feriado ×{d.recargo}</Insignia>}
            <strong>{soles(d.ganado)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
