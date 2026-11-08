import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { ahoraServidorMs } from '../cocina/tiempoEnVivo';
import { useAhora } from '../pedidos/PastillaEspera';
import {
  EleccionAgotado,
  HorarioDia,
  horaLima,
  resolverRegreso,
  textoRestante,
} from '../../comun/agotadoTiempo';

interface Props {
  nombre: string;
  /** «Cambiar tiempo» de un agotado que ya existe (cambia el título y el motivo previo). */
  cambio?: boolean;
  motivoInicial?: string | null;
  horario: HorarioDia[] | null;
  alConfirmar: (hastaIso: string | null, motivo: string) => void | Promise<void>;
  alCancelar: () => void;
}

const ATAJOS: Array<{ clave: string; texto: string; e: EleccionAgotado }> = [
  { clave: '30', texto: '30 min', e: { tipo: 'min', min: 30 } },
  { clave: '60', texto: '1 h', e: { tipo: 'min', min: 60 } },
  { clave: '120', texto: '2 h', e: { tipo: 'min', min: 120 } },
  { clave: 'cierre', texto: 'Hasta el cierre de hoy', e: { tipo: 'cierre' } },
  { clave: 'manana', texto: 'Hasta mañana a la apertura', e: { tipo: 'manana' } },
];

const caja: React.CSSProperties = {
  minHeight: 44, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--cp-line)',
  background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left',
};
const cajaOn: React.CSSProperties = { ...caja, background: 'var(--cp-navy)', color: 'var(--cp-white)', borderColor: 'var(--cp-navy)' };
const campo: React.CSSProperties = { minHeight: 44, padding: '0 10px', borderRadius: 10, border: '1px solid var(--cp-line)', fontSize: 16, width: '100%', boxSizing: 'border-box' };

/** Ventana de «Agotado»: hasta que lo reactive una persona o por un tiempo; termina con la confirmación Sí/No. */
export function AgotarProductoModal({ nombre, cambio, motivoInicial, horario, alConfirmar, alCancelar }: Props) {
  const ahora = useAhora();
  const [clave, setClave] = useState('indef');
  const [horas, setHoras] = useState('0');
  const [minutos, setMinutos] = useState('45');
  const [hhmm, setHhmm] = useState('');
  const [dia, setDia] = useState<'hoy' | 'manana'>('hoy');
  const [motivo, setMotivo] = useState(motivoInicial ?? '');
  const [guardando, setGuardando] = useState(false);

  const eleccion: EleccionAgotado =
    clave === 'indef' ? { tipo: 'indefinido' }
    : clave === 'dur' ? { tipo: 'dur', horas: Number(horas), min: Number(minutos) }
    : clave === 'hora' ? { tipo: 'hora', hhmm, dia }
    : ATAJOS.find((a) => a.clave === clave)!.e;

  const r = resolverRegreso(eleccion, ahora, horario);
  const error = 'error' in r ? r.error : null;
  const hasta = 'hasta' in r ? r.hasta : null;

  const resumen = error
    ? ''
    : hasta === null
      ? `«${nombre}» se agotará y seguirá agotado hasta que lo reactives tú.`
      : `«${nombre}» se agotará por ${textoRestante(Math.max(1, Math.round((hasta - ahora) / 60000)))} y volverá a estar disponible a las ${horaLima(hasta)}${
          new Date(hasta).toDateString() !== new Date(ahora).toDateString() ? ' (de otro día)' : ''
        }.`;

  const sinHorario = !horario?.length;

  return (
    <Confirmar
      abierto
      titulo={cambio ? `Cambiar el tiempo de «${nombre}»` : `Agotar «${nombre}»`}
      mensaje={resumen || undefined}
      textoSi="Sí, agotar"
      textoNo="No"
      deshabilitarConfirmar={!!error}
      cargando={guardando}
      alCancelar={alCancelar}
      alConfirmar={async () => {
        // Se recalcula con la hora de este instante: «30 min» cuenta desde que se confirma.
        const rr = resolverRegreso(eleccion, ahoraServidorMs(), horario);
        if ('error' in rr) return;
        setGuardando(true);
        try {
          await alConfirmar(rr.hasta === null ? null : new Date(rr.hasta).toISOString(), motivo.trim());
        } finally {
          setGuardando(false);
        }
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }} role="group" aria-label="¿Hasta cuándo?">
        <button type="button" style={clave === 'indef' ? cajaOn : caja} aria-pressed={clave === 'indef'} onClick={() => setClave('indef')}>
          Agotado hasta que lo reactive yo
        </button>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>O agotado por un tiempo</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ATAJOS.map((a) => {
            const x = resolverRegreso(a.e, ahora, horario);
            const apagado = 'error' in x;
            return (
              <button
                key={a.clave}
                type="button"
                style={{ ...(clave === a.clave ? cajaOn : caja), opacity: apagado ? 0.5 : 1 }}
                aria-pressed={clave === a.clave}
                disabled={apagado}
                title={apagado ? (x as { error: string }).error : undefined}
                onClick={() => setClave(a.clave)}
              >
                {a.texto}
              </button>
            );
          })}
          <button type="button" style={clave === 'dur' ? cajaOn : caja} aria-pressed={clave === 'dur'} onClick={() => setClave('dur')}>
            Personalizado
          </button>
          <button type="button" style={clave === 'hora' ? cajaOn : caja} aria-pressed={clave === 'hora'} onClick={() => setClave('hora')}>
            A una hora exacta
          </button>
        </div>
        {sinHorario && <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>No se pudo leer el horario del local: «cierre» y «apertura» no están disponibles.</div>}

        {clave === 'dur' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
              Horas
              <input style={campo} type="number" inputMode="numeric" min={0} max={168} value={horas} onChange={(e) => setHoras(e.target.value)} />
            </label>
            <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
              Minutos
              <input style={campo} type="number" inputMode="numeric" min={0} max={59} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
            </label>
          </div>
        )}
        {clave === 'hora' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
              Hora
              <input style={campo} type="time" value={hhmm} onChange={(e) => setHhmm(e.target.value)} />
            </label>
            <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
              Día
              <select style={campo} value={dia} onChange={(e) => setDia(e.target.value as 'hoy' | 'manana')}>
                <option value="hoy">Hoy</option>
                <option value="manana">Mañana</option>
              </select>
            </label>
          </div>
        )}
        {error && clave !== 'indef' && (
          <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: 13, fontWeight: 700 }}>{error}</div>
        )}

        <label style={{ fontSize: 12, fontWeight: 700 }}>
          Motivo (opcional)
          <input style={campo} maxLength={120} placeholder="Ej.: se acabó la masa" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
      </div>
    </Confirmar>
  );
}
