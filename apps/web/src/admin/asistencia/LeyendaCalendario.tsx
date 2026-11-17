import { ESTADO_DIA, TIPO_DIA } from './calendarioDia';

/** Leyenda plegable del calendario: qué significa cada marca del día (tipo de día y cómo te fue). */
export function LeyendaCalendario() {
  return (
    <details className="mc-leyenda-plegable" data-testid="leyenda-calendario">
      <summary>Leyenda del calendario</summary>
      <div className="mc-leyenda-cuerpo">
        <ul className="mc-leyenda" aria-label="Leyenda">
          <li><span className="mc-chip mc-tipo-trabaja"><span aria-hidden="true">{TIPO_DIA.TRABAJA.icono}</span> 14:00–22:00</span> Tu horario: de entrada a salida.</li>
          <li><span className="mc-chip mc-tipo-descanso"><span aria-hidden="true">{TIPO_DIA.DESCANSO.icono}</span> Descanso</span> No te toca turno ese día.</li>
          <li><span className="mc-chip mc-tipo-feriado"><span aria-hidden="true">{TIPO_DIA.FERIADO.icono}</span> Feriado ×2</span> Feriado: se paga con recargo ×N (las horas que trabajas ese día se pagan así).</li>
          <li><span className="mc-chip mc-tipo-vac"><span aria-hidden="true">{TIPO_DIA.VACACIONES.icono}</span> Vacaciones</span> Días de vacaciones tomadas: se pagan como día normal.</li>
          <li><span className="mc-chip mc-tipo-cobertura"><span aria-hidden="true">{TIPO_DIA.COBERTURA.icono}</span> Cobertura</span> Cubres el turno de otra persona.</li>
          <li><span className="mc-chip mc-tipo-reemplazo"><span aria-hidden="true">{TIPO_DIA.REEMPLAZO.icono}</span> Reemplazo</span> Tu turno lo cubre otra persona.</li>
        </ul>
        <p className="mc-leyenda-sub">Cómo te fue ese día:</p>
        <ul className="mc-leyenda" aria-label="Estados del día">
          {['CUMPLIO', 'TARDANZA', 'SALIO_ANTES', 'FALTA', 'A_REVISAR'].map((k) => (
            <li key={k}><span className={`mc-chip mc-${ESTADO_DIA[k].clase}`}><span aria-hidden="true">{ESTADO_DIA[k].icono}</span> {ESTADO_DIA[k].texto}</span></li>
          ))}
        </ul>
      </div>
    </details>
  );
}
