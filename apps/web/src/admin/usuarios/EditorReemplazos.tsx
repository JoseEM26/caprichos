import { useEffect, useMemo, useState } from 'react';
import { api } from '../../comun/api';
import { Campo } from '../../comun/Campo';
import { Combo } from '../../comun/Combo';
import { DIAS, type HorarioEstado, type ReemplazosEstado } from './horario';
import { ETIQUETAS_ROLES } from './CrearUsuarioModal';
import type { PersonalHorario } from './tipos';

interface Props {
  valor: ReemplazosEstado;
  alCambiar: (r: ReemplazosEstado) => void;
  horario: HorarioEstado;
  rol: string;
  /** partyId de la persona (en edición) para no ofrecerla como su propio reemplazo */
  partyIdPropio?: string;
  deshabilitado?: boolean;
  alCargarPersonal?: (p: PersonalHorario[]) => void;
}

/** «¿Quién lo reemplaza?» por día. Opcional: se puede dejar todo vacío. */
export function EditorReemplazos({ valor, alCambiar, horario, rol, partyIdPropio, deshabilitado, alCargarPersonal }: Props) {
  const [personal, setPersonal] = useState<PersonalHorario[]>([]);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [todosLosDias, setTodosLosDias] = useState(false);

  useEffect(() => {
    api
      .get<PersonalHorario[]>('/admin/usuarios/horarios')
      .then((d) => {
        const lista = Array.isArray(d) ? d : [];
        setPersonal(lista);
        alCargarPersonal?.(lista);
      })
      .catch(() => setError('No se pudo cargar la lista de personal.'));
  }, []);

  const candidatos = useMemo(
    () =>
      personal
        .filter((p) => p.partyId !== partyIdPropio)
        .sort((a, b) => Number(b.rol === rol) - Number(a.rol === rol)),
    [personal, partyIdPropio, rol],
  );

  const dias = DIAS.filter((d) => todosLosDias || !horario[d.dia].trabaja);
  const q = busqueda.trim().toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Opcional. Quién cubre a esta persona los días que no trabaja. El personal del mismo rol aparece primero.
      </div>
      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 600 }}>{error}</div>}
      <Campo
        id="reemplazo-buscar"
        etiqueta="Buscar persona"
        placeholder="Nombre o apellido"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        disabled={deshabilitado}
      />
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', minHeight: '44px', fontSize: '13px', fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={todosLosDias}
          onChange={(e) => setTodosLosDias(e.target.checked)}
          style={{ width: '22px', height: '22px' }}
        />
        Mostrar también los días que sí trabaja (por si falta)
      </label>
      {dias.length === 0 && (
        <div style={{ fontSize: '13px', fontWeight: 700 }}>Trabaja todos los días: no hay descansos que cubrir.</div>
      )}
      {dias.map((d) => {
        const opciones = [
          { valor: '', etiqueta: 'Sin reemplazo' },
          ...candidatos
            .filter((p) => p.partyId === valor[d.dia] || !q || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q))
            .map((p) => ({
              valor: p.partyId,
              etiqueta: `${p.nombres} ${p.apellidos}`.trim(),
              subtitulo: `${ETIQUETAS_ROLES[p.rol]?.split(' (')[0] ?? p.rol} · ${
                p.horarios.some((h) => h.dia === d.dia) ? 'Trabaja ese día' : 'Descansa ese día'
              }`,
            })),
        ];
        return (
          <div key={d.dia} data-testid={`reemplazo-${d.dia}`}>
            <Combo
              etiqueta={`${d.nombre}: ¿quién lo reemplaza?`}
              opciones={opciones}
              valor={valor[d.dia] ?? ''}
              alCambiar={(v) => alCambiar({ ...valor, [d.dia]: v })}
              deshabilitado={deshabilitado}
            />
          </div>
        );
      })}
    </div>
  );
}
