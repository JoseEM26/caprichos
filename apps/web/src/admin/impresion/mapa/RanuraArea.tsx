import { useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AreaMapa, EquipoMapa, MapaImpresionDatos, RolEquipoMapa } from '../impresionApi';
import { TEXTO_ESTADO, luzDeMaquina, subRanura, textoLuz, tieneMaquina, type NivelLuz } from './flujo';

/** Nombre llano de cada máquina dentro de una ranura de área (lo que ve el dueño). */
export const TITULO_MAQUINA: Record<RolEquipoMapa, string> = {
  ETIQUETERA: 'Etiquetera de stickers',
  TICKETERA: 'Ticketera de tickets',
};
const MAQUINA_LLANA: Record<RolEquipoMapa, string> = { ETIQUETERA: 'etiquetera', TICKETERA: 'ticketera' };

/** Destino de «Vincular un equipo nuevo»: la sección Equipos y estado, donde están los pasos. */
export const URL_VINCULAR = '?tab=impresion&seccion=equipos';

/** Lo que se lee del equipo en la sub-ranura: «Nombre · Lista», o «Sin conexión». */
function textoEquipo(e: EquipoMapa, rol: RolEquipoMapa): string {
  return `${e.nombre} · ${e.conectado ? TEXTO_ESTADO[e.roles.find((r) => r.rol === rol)?.estado ?? ''] ?? '' : 'sin conexión'}`;
}

function LuzMaquina({ nivel }: { nivel: NivelLuz }) {
  return <span className={`mapa-luz mapa-luz--${nivel}`} aria-hidden="true" />;
}

/** Selector «+ Asignar equipo»: elige uno de los equipos ya vinculados y lo pone en esta área. */
function AsignarEquipo({
  area,
  rol,
  mapa,
  onMover,
}: {
  area: AreaMapa;
  rol: RolEquipoMapa;
  mapa: MapaImpresionDatos;
  onMover: (equipoId: string, areaId: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState('');
  const idSelect = useId();
  // Los que ya están en esta área no se ofrecen: ya atienden lo de la área.
  const candidatos = mapa.equipos.filter((e) => e.areaId !== area.id);
  const ahora = (e: EquipoMapa) =>
    e.areaId === null ? 'ahora imprime lo de Caja' : `ahora imprime lo de ${mapa.areas.find((a) => a.id === e.areaId)?.nombre ?? 'otra área'}`;
  const maquinas = (e: EquipoMapa) => {
    const lista = (['ETIQUETERA', 'TICKETERA'] as RolEquipoMapa[]).filter((r) => tieneMaquina(e, r)).map((r) => MAQUINA_LLANA[r]);
    return lista.length ? `tiene ${lista.join(' y ')}` : 'sin máquinas declaradas';
  };

  if (!abierto) {
    return (
      <button type="button" className="mapa-asignar" onClick={() => setAbierto(true)}>
        + Asignar equipo
      </button>
    );
  }

  return (
    <div className="mapa-asignar-panel" role="group" aria-label={`Asignar equipo a ${MAQUINA_LLANA[rol]} de ${area.nombre}`}>
      {candidatos.length === 0 ? (
        <p className="mapa-ranura-vacia">Todos los equipos ya imprimen lo de {area.nombre}. Vincula uno nuevo.</p>
      ) : (
        <>
          <label htmlFor={idSelect} className="mapa-asignar-etiqueta">
            Equipo que atiende la {MAQUINA_LLANA[rol]} de {area.nombre}
          </label>
          <select id={idSelect} value={elegido} onChange={(e) => setElegido(e.target.value)} className="mapa-asignar-select">
            <option value="">Elige un equipo</option>
            {candidatos.map((e) => (
              <option key={e.deviceKeyId} value={e.deviceKeyId}>
                {`${e.nombre} · ${textoLuz(e).toLowerCase()} · ${maquinas(e)} · ${ahora(e)}`}
              </option>
            ))}
          </select>
          <div className="mapa-asignar-acciones">
            <button
              type="button"
              className="mapa-asignar-ok"
              disabled={elegido === ''}
              onClick={() => {
                onMover(elegido, area.id);
                setAbierto(false);
                setElegido('');
              }}
            >
              Asignar a {area.nombre}
            </button>
            <button type="button" className="mapa-asignar-no" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** «Reemplazar este equipo»: elige otro equipo vinculado y le cede esta máquina (el actual se desactiva). */
function ReemplazarEquipo({
  actual,
  mapa,
  onReemplazar,
}: {
  actual: EquipoMapa;
  mapa: MapaImpresionDatos;
  onReemplazar: (viejoId: string, nuevoId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState('');
  const idSelect = useId();
  const otros = mapa.equipos.filter((e) => e.deviceKeyId !== actual.deviceKeyId);
  if (!abierto) {
    return (
      <button type="button" className="mapa-asignar mapa-asignar--secundario" onClick={() => setAbierto(true)}>
        Reemplazar este equipo
      </button>
    );
  }
  return (
    <div className="mapa-asignar-panel" role="group" aria-label={`Reemplazar ${actual.nombre}`}>
      {otros.length === 0 ? (
        <p className="mapa-ranura-vacia">No hay otro equipo vinculado. Vincula uno nuevo para reemplazarlo.</p>
      ) : (
        <>
          <label htmlFor={idSelect} className="mapa-asignar-etiqueta">
            Equipo que ocupará el lugar de «{actual.nombre}»
          </label>
          <select id={idSelect} value={elegido} onChange={(e) => setElegido(e.target.value)} className="mapa-asignar-select">
            <option value="">Elige un equipo</option>
            {otros.map((e) => (
              <option key={e.deviceKeyId} value={e.deviceKeyId}>
                {`${e.nombre} · ${textoLuz(e).toLowerCase()} · ${e.areaId === null ? 'ahora en Caja' : `ahora en ${mapa.areas.find((a) => a.id === e.areaId)?.nombre ?? 'otra área'}`}`}
              </option>
            ))}
          </select>
          <div className="mapa-asignar-acciones">
            <button
              type="button"
              className="mapa-asignar-ok"
              disabled={elegido === ''}
              onClick={() => {
                onReemplazar(actual.deviceKeyId, elegido);
                setAbierto(false);
                setElegido('');
              }}
            >
              Reemplazar
            </button>
            <button type="button" className="mapa-asignar-no" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Una máquina de un área (etiquetera o ticketera): quién la atiende, o que sale en Caja. */
function SubRanura({
  area,
  rol,
  mapa,
  puedeEditar,
  onMover,
  onReemplazar,
}: {
  area: AreaMapa;
  rol: RolEquipoMapa;
  mapa: MapaImpresionDatos;
  puedeEditar: boolean;
  onMover: (equipoId: string, areaId: string | null) => void;
  onReemplazar: (viejoId: string, nuevoId: string) => void;
}) {
  const st = subRanura(mapa, area.id, rol);
  const titulo = TITULO_MAQUINA[rol];
  return (
    <div className="mapa-maquina" data-maquina={rol} data-area={area.id} data-estado={st.tipo}>
      <h5 className="mapa-maquina-titulo">{titulo}</h5>
      {st.tipo === 'equipo' && (
        <p className="mapa-maquina-linea">
          <LuzMaquina nivel={luzDeMaquina(st.equipo, rol)} />
          <span>{textoEquipo(st.equipo, rol)}</span>
        </p>
      )}
      {st.tipo === 'sin_maquina' && (
        <p className="mapa-maquina-linea mapa-maquina-linea--aviso">
          Este equipo no tiene {MAQUINA_LLANA[rol]}: sale en Caja.
        </p>
      )}
      {st.tipo === 'sin_equipo' && (
        <p className="mapa-maquina-linea mapa-maquina-linea--aviso">Sin impresora propia: sale en la de Caja</p>
      )}
      {st.tipo === 'equipo' && puedeEditar && <ReemplazarEquipo actual={st.equipo} mapa={mapa} onReemplazar={onReemplazar} />}
      {st.tipo !== 'equipo' && puedeEditar && <AsignarEquipo area={area} rol={rol} mapa={mapa} onMover={onMover} />}
      {st.tipo !== 'equipo' && <Link className="mapa-vincular" to={URL_VINCULAR}>Vincular un equipo nuevo</Link>}
    </div>
  );
}

/**
 * Ranura de un área (Bebidas, Salados, Postres): dos sub-ranuras, Etiquetera de stickers y Ticketera de tickets.
 * La asignación es por equipo: el equipo del área se muestra en la máquina que declara.
 */
export function RanuraArea({
  area,
  mapa,
  puedeEditar,
  sobre,
  refNodo,
  arrastre,
  onMover,
  onReemplazar,
  renderEquipo,
}: {
  area: AreaMapa;
  mapa: MapaImpresionDatos;
  puedeEditar: boolean;
  sobre: boolean;
  refNodo: (el: HTMLElement | null) => void;
  /** Eventos de soltar un equipo (arrastrar) sobre la ranura. */
  arrastre: HTMLAttributes<HTMLElement>;
  onMover: (equipoId: string, areaId: string | null) => void;
  /** Pide reemplazar el equipo viejo por el nuevo (el padre confirma antes). */
  onReemplazar: (viejoId: string, nuevoId: string) => void;
  renderEquipo: (e: EquipoMapa) => ReactNode;
}) {
  const equipos = mapa.equipos.filter((e) => e.areaId === area.id);
  return (
    <section
      ref={refNodo}
      aria-label={`Ranura ${area.nombre}`}
      className={`mapa-ranura ${sobre ? 'mapa-ranura--sobre' : ''}`}
      {...arrastre}
    >
      <h4 className="mapa-ranura-titulo">{area.nombre}</h4>
      <SubRanura area={area} rol="ETIQUETERA" mapa={mapa} puedeEditar={puedeEditar} onMover={onMover} onReemplazar={onReemplazar} />
      <SubRanura area={area} rol="TICKETERA" mapa={mapa} puedeEditar={puedeEditar} onMover={onMover} onReemplazar={onReemplazar} />
      {equipos.map((e) => renderEquipo(e))}
    </section>
  );
}
