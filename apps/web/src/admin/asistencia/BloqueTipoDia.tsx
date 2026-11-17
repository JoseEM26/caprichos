import type { DiaCalendario } from './miCalendarioApi';
import { TIPO_DIA, marcaDia, textoRecargo } from './calendarioDia';
import { horasMin } from './tiposMarca';

/** Qué tipo de día es, su horario programado y lo que se paga (feriado con recargo, descanso, cobertura). */
export function BloqueTipoDia({ dia }: { dia: DiaCalendario }) {
  const marca = marcaDia(dia);
  const p = dia.programado;
  const tipo = dia.tipoDia;
  const recargo = dia.recargo ?? null;
  const feriado = dia.feriado ?? null;
  return (
    <div className="mc-bloque-dia" data-testid="tipo-dia">
      {marca && (
        <p className="mc-tipo-linea">
          <span className={`mc-chip mc-tipo-${marca.clase}`}><span aria-hidden="true">{marca.icono}</span> {tipo ? TIPO_DIA[tipo]?.texto ?? marca.texto : marca.texto}</span>
        </p>
      )}

      {feriado && (
        <div className="mc-aviso-tipo" data-testid="feriado-dia">
          <p><b>{feriado}</b></p>
          {dia.pagaRecargo && recargo
            ? <p>Te pagan {textoRecargo(recargo)} las horas trabajadas ese día.</p>
            : <p>Feriado sin recargo: esas horas se pagan normal.</p>}
          {!p && <p className="mc-sub">No tienes turno este día. Si trabajas, esas horas se pagan {recargo ? textoRecargo(recargo) : 'normal'}.</p>}
        </div>
      )}

      {tipo === 'DESCANSO' && (
        <div className="mc-aviso-tipo" data-testid="descanso-dia">
          <p><b>Hoy te toca descanso.</b> {dia.motivoDescanso && <small>({dia.motivoDescanso})</small>}</p>
          {dia.trabajoEnDescanso && (
            <p>Marcaste igual: se ve como descanso trabajado y se paga solo si el admin lo aprueba.</p>
          )}
        </div>
      )}

      {tipo === 'REEMPLAZO' && (
        <div className="mc-aviso-tipo" data-testid="reemplazo-dia">
          <p><b>Tu turno lo cubrió otra persona.</b> {dia.motivoDescanso && <small>({dia.motivoDescanso})</small>}</p>
        </div>
      )}

      {tipo === 'COBERTURA' && (
        <p className="mc-aviso-tipo" data-testid="cobertura-dia">Cubres el turno de otra persona en este horario.</p>
      )}

      {tipo === 'VACACIONES' && (
        <p className="mc-aviso-tipo" data-testid="vacaciones-dia">Día de vacaciones: se paga como día normal.</p>
      )}

      {dia.cobertura?.rol === 'CUBIERTO' && dia.cobertura.parcial && (
        <p className="mc-sub" data-testid="cobertura-parcial">Te cubrieron una parte de tu turno: te queda el horario de abajo.</p>
      )}

      {p && (
        <dl className="mc-horario" aria-label="Horario programado" data-testid="horario-dia">
          <div><dt>Horario</dt><dd>De {p.entrada} a {p.salida}</dd></div>
          <div><dt>Duración programada</dt><dd>{p.duracionMin != null ? horasMin(p.duracionMin) : 'sin dato'}</dd></div>
          {p.almuerzo && <div><dt>Almuerzo</dt><dd>{p.almuerzo.desde} a {p.almuerzo.hasta} (se paga)</dd></div>}
        </dl>
      )}
    </div>
  );
}
