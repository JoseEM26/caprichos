import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EstadoAdminImpresion, RolImpresora } from '@caprichos/compartido';
import { MaquinasImpresion, NOMBRE_MAQUINA, maquinasConProblema, programaApagado } from './useEstadoMaquinas';
import { ColaImpresion, haceCuanto } from './ColaImpresion';
import { PanelInstalarPrograma } from './PanelInstalarPrograma';
import { PruebaImpresion } from './PruebaImpresion';
import './chip-impresion.css';

type Vista = 'estado' | 'cola' | 'instalar';
const VISTAS: Array<[Vista, string]> = [['estado', 'Estado'], ['cola', 'Cola'], ['instalar', 'Instalar']];
const ROLES: RolImpresora[] = ['ETIQUETERA', 'TICKETERA'];
export const URL_CONFIG_IMPRESION = '/admin/configuracion?tab=impresion&seccion=equipos';

/**
 * Chip único de impresión: icono + un punto por máquina + «N en cola». Al pulsarlo abre un panel
 * (desplegable en PC, hoja inferior en celular) con tres vistas: Estado, Cola e Instalar.
 */
export function IndicadoresMaquinas({
  maquinas,
  pendientes = 0,
  estado = null,
  alCambiarCola,
}: {
  maquinas: MaquinasImpresion | null;
  pendientes?: number;
  estado?: EstadoAdminImpresion | null;
  /** Se avisa al cerrar el panel para que quien lo usa recargue el estado. */
  alCambiarCola?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>('estado');
  const adentro = useRef(false);
  const idPanel = useId();

  const cerrar = () => {
    setAbierto(false);
    alCambiarCola?.();
  };

  useEffect(() => {
    if (!abierto) return;
    // Los avisos Sí/No de la cola van en un portal: el clic se marca «adentro» por el árbol de React.
    const fuera = () => {
      if (adentro.current) adentro.current = false;
      else cerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Con un aviso Sí/No encima, Escape cierra solo ese aviso.
      if (document.querySelector('[aria-modal="true"]')) return;
      cerrar();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!maquinas) return null;

  const fallan = maquinasConProblema(maquinas);
  const alerta = pendientes > 0 && fallan.length > 0;
  const tono = alerta ? 'alerta' : fallan.length > 0 ? 'falla' : 'ok';
  const resumen = ROLES.map((r) => `${NOMBRE_MAQUINA[r]} ${maquinas[r].conectada ? 'conectada' : 'sin conexión'}`).join(', ');
  const textoCola = pendientes > 0 ? `${pendientes} en cola` : '';

  const alternar = () => {
    if (abierto) return cerrar();
    setVista('estado');
    setAbierto(true);
  };

  return (
    <div className="ci-raiz" data-testid="indicadores-maquinas" onMouseDown={() => { adentro.current = true; }}>
      <button
        type="button"
        className={`ci-chip ci-${tono}`}
        data-testid="chip-impresion"
        data-tono={tono}
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        aria-label={`Impresión: ${resumen}${textoCola ? `, ${textoCola}` : ''}`}
        onClick={alternar}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
        </svg>
        <span className="ci-etq">Impresión</span>
        {ROLES.map((r) => (
          <span
            key={r}
            aria-hidden="true"
            data-testid={`punto-${r.toLowerCase()}`}
            className={`ci-punto ${maquinas[r].conectada ? 'ci-punto-ok' : 'ci-punto-mal'}`}
          />
        ))}
        {textoCola && <span className="ci-num" data-testid="chip-cola">{textoCola}</span>}
      </button>

      {abierto && (
        <>
          <div className="ci-velo" aria-hidden="true" onClick={cerrar} />
          <div id={idPanel} className="ci-panel" role="dialog" aria-label="Impresión" data-testid="panel-impresion">
            <div className="ci-cab">
              <div role="tablist" aria-label="Vistas de impresión" className="ci-tabs">
                {VISTAS.map(([v, t]) => (
                  <button key={v} type="button" role="tab" aria-selected={vista === v} className="ci-tab" onClick={() => setVista(v)}>{t}</button>
                ))}
              </div>
              <button type="button" className="ci-x" aria-label="Cerrar impresión" onClick={cerrar}>
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {vista === 'estado' && (
              <div className="ci-cuerpo" data-testid="vista-estado">
                {alerta && (
                  <div role="alert" data-testid="franja-impresion" className="ci-aviso">
                    <strong>Impresora sin conexión: {pendientes} etiqueta(s) en cola.</strong>{' '}
                    Revisa que la PC de la etiquetera esté encendida con el programa de impresión abierto.
                    <div className="ci-acciones">
                      <button type="button" className="cola-btn ci-btn-fuerte" onClick={() => setVista('cola')}>Gestionar cola</button>
                    </div>
                  </div>
                )}
                {ROLES.map((r) => {
                  const m = maquinas[r];
                  return (
                    <div key={r} className="ci-maq" data-testid={`maquina-${r.toLowerCase()}`}>
                      <strong>
                        <span aria-hidden="true" className={`ci-punto ${m.conectada ? 'ci-punto-ok' : 'ci-punto-mal'}`} />{' '}
                        {NOMBRE_MAQUINA[r]}: {m.conectada ? 'conectada' : 'sin conexión'}
                      </strong>
                      {!m.conectada && m.motivo && <div className="ci-motivo">{m.motivo}</div>}
                      <PruebaImpresion rol={r} maquina={m} />
                    </div>
                  );
                })}
                {estado && (
                  <div className="ci-prog" data-testid="estado-programa">
                    <strong>{estado.agente === 'conectado' ? 'Programa conectado' : 'Programa sin conexión'}</strong>
                    <span>
                      Impresora: {estado.impresora || 'desconectada'}
                      {estado.ultimoLatido ? ` · último latido ${haceCuanto(estado.ultimoLatido)}` : ' · sin latidos'}
                    </span>
                  </div>
                )}
                <div className="ci-acciones">
                  <button type="button" className="cola-btn" onClick={() => setVista('cola')}>
                    Ver cola{pendientes > 0 ? ` (${pendientes})` : ''}
                  </button>
                  {/* Siempre disponible: también sirve para volver a descargarlo o vincular otra PC con el programa ya corriendo */}
                  <button type="button" className={`cola-btn${programaApagado(maquinas) ? ' ci-btn-fuerte' : ''}`} onClick={() => setVista('instalar')}>
                    Instalar programa de impresión
                  </button>
                  <Link to={URL_CONFIG_IMPRESION} className="cola-btn ci-enlace" onClick={cerrar}>Ver impresión</Link>
                </div>
              </div>
            )}
            {vista === 'cola' && (
              <div className="ci-cuerpo" data-testid="vista-cola">
                <ColaImpresion incrustado alCerrar={() => setVista('estado')} />
              </div>
            )}
            {vista === 'instalar' && (
              <div className="ci-cuerpo" data-testid="vista-instalar">
                <PanelInstalarPrograma incrustado alCerrar={() => setVista('estado')} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
