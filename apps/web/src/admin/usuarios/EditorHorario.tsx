import { Boton } from '../../comun/Boton';
import { DIAS, copiarATodos, formatoHoras, horasTurno, totalHorasSemana, type HorarioEstado } from './horario';

interface Props {
  valor: HorarioEstado;
  alCambiar: (h: HorarioEstado) => void;
  deshabilitado?: boolean;
}

const estiloHora = {
  minHeight: '44px',
  width: '100%',
  borderRadius: '8px',
  border: '1.5px solid var(--cp-line)',
  padding: '0 8px',
  boxSizing: 'border-box' as const,
};

/** Un renglón por día: interruptor «Trabaja», entrada y salida. Turnos que cruzan medianoche permitidos. */
export function EditorHorario({ valor, alCambiar, deshabilitado }: Props) {
  const cambiar = (dia: number, parche: Partial<HorarioEstado[number]>) =>
    alCambiar({ ...valor, [dia]: { ...valor[dia], ...parche } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {DIAS.map((d) => {
        const e = valor[d.dia];
        return (
          <div
            key={d.dia}
            style={{
              border: '1px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '8px 10px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <label
              style={{ flex: '1 1 130px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontWeight: 800, fontSize: '14px' }}
            >
              <input
                type="checkbox"
                role="switch"
                aria-label={`Trabaja el ${d.nombre.toLowerCase()}`}
                checked={e.trabaja}
                disabled={deshabilitado}
                onChange={(ev) => cambiar(d.dia, { trabaja: ev.target.checked })}
                style={{ width: '22px', height: '22px' }}
              />
              {d.nombre}
            </label>
            {e.trabaja ? (
              <>
                <label style={{ flex: '1 1 90px', fontSize: '12px', fontWeight: 700 }}>
                  Entrada
                  <input
                    type="time"
                    aria-label={`Entrada del ${d.nombre.toLowerCase()}`}
                    value={e.entrada}
                    disabled={deshabilitado}
                    onChange={(ev) => cambiar(d.dia, { entrada: ev.target.value })}
                    style={estiloHora}
                  />
                </label>
                <label style={{ flex: '1 1 90px', fontSize: '12px', fontWeight: 700 }}>
                  Salida
                  <input
                    type="time"
                    aria-label={`Salida del ${d.nombre.toLowerCase()}`}
                    value={e.salida}
                    disabled={deshabilitado}
                    onChange={(ev) => cambiar(d.dia, { salida: ev.target.value })}
                    style={estiloHora}
                  />
                </label>
                <label style={{ flex: '1 1 90px', fontSize: '12px', fontWeight: 700 }}>
                  Almuerzo: inicio
                  <input
                    type="time"
                    aria-label={`Inicio del almuerzo del ${d.nombre.toLowerCase()}`}
                    value={e.almuerzoInicio ?? ''}
                    disabled={deshabilitado}
                    onChange={(ev) => cambiar(d.dia, { almuerzoInicio: ev.target.value })}
                    style={estiloHora}
                  />
                </label>
                <label style={{ flex: '1 1 90px', fontSize: '12px', fontWeight: 700 }}>
                  Almuerzo: fin
                  <input
                    type="time"
                    aria-label={`Fin del almuerzo del ${d.nombre.toLowerCase()}`}
                    value={e.almuerzoFin ?? ''}
                    disabled={deshabilitado}
                    onChange={(ev) => cambiar(d.dia, { almuerzoFin: ev.target.value })}
                    style={estiloHora}
                  />
                </label>
                <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    {formatoHoras(horasTurno(e.entrada, e.salida))}
                    {e.salida < e.entrada ? ' (termina al día siguiente)' : ''}
                  </span>
                  <Boton
                    type="button"
                    variante="texto"
                    tamano="pequeno"
                    disabled={deshabilitado}
                    onClick={() => alCambiar(copiarATodos(valor, d.dia))}
                  >
                    Copiar a todos los días
                  </Boton>
                </div>
              </>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Descansa</span>
            )}
          </div>
        );
      })}
      <div role="status" style={{ fontWeight: 800, fontSize: '14px' }}>
        Total por semana: {formatoHoras(totalHorasSemana(valor))}
      </div>
    </div>
  );
}
