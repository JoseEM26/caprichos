import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from '../../comun/Boton';
import { useDialogoAccesible } from '../../comun/useDialogoAccesible';
import { usePulsacionLarga } from '../../comun/usePulsacionLarga';
import '../cierre/pendientes-cierre.css'; // marco común .ad-dialogo / .ad-cabecera / .ad-cuerpo / .ad-pie
import '../../comun/modal-pasos.css'; // .mpp-fondo
import './destacadas.css';

export interface AccionHoja {
  id: string;
  etiqueta: string;
  icono: string;
  peligro?: boolean;
  deshabilitada?: boolean;
  alElegir: () => void;
}

/** Hoja de acciones: sube desde abajo en celular y es modal centrado en PC. */
export function HojaAcciones({ titulo, subtitulo, acciones, alCerrar }: {
  titulo: string; subtitulo?: string; acciones: AccionHoja[]; alCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const alTeclear = useDialogoAccesible(ref, alCerrar);
  return createPortal(
    <>
      <div className="mpp-fondo" onClick={alCerrar} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tituloId} className="ad-dialogo dst-hoja"
        onKeyDown={alTeclear} tabIndex={-1}>
        <div className="ad-cabecera">
          <h2 id={tituloId} className="ad-titulo" style={{ margin: 0 }}>{titulo}</h2>
          <button type="button" className="ad-cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button>
        </div>
        {subtitulo && <p className="dst-hoja-sub">{subtitulo}</p>}
        <div className="ad-cuerpo">
          {acciones.map((a) => (
            <button key={a.id} type="button" className="dst-accion" data-peligro={a.peligro ? 'true' : undefined}
              disabled={a.deshabilitada} onClick={a.alElegir}>
              <span className="dst-accion-ico" aria-hidden="true">{a.icono}</span>
              {a.etiqueta}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Modal de edición de un texto (nombre del círculo o pie de la foto). */
export function ModalTexto({ titulo, etiqueta, inicial, placeholder, vistaPrevia, alGuardar, alCerrar, idCampo }: {
  titulo: string; etiqueta: string; inicial: string; placeholder?: string; vistaPrevia?: string;
  alGuardar: (valor: string) => void; alCerrar: () => void; idCampo: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const alTeclear = useDialogoAccesible(ref, alCerrar);
  const [valor, setValor] = useState(inicial);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    alGuardar(valor);
  };
  return createPortal(
    <>
      <div className="mpp-fondo" onClick={alCerrar} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tituloId} className="ad-dialogo"
        onKeyDown={alTeclear} tabIndex={-1}>
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="ad-cabecera">
            <h2 id={tituloId} className="ad-titulo" style={{ margin: 0 }}>{titulo}</h2>
            <button type="button" className="ad-cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button>
          </div>
          <div className="ad-cuerpo" style={{ paddingBottom: 12 }}>
            {vistaPrevia && <img className="dst-modal-foto" src={vistaPrevia} alt="" />}
            <label className="dst-campo" htmlFor={idCampo}>
              {etiqueta}
              <input id={idCampo} type="text" value={valor} placeholder={placeholder} data-foco-inicial=""
                onChange={(e) => setValor(e.target.value)} />
            </label>
          </div>
          <div className="ad-pie">
            <Boton type="button" variante="secundario" onClick={alCerrar}>Cancelar</Boton>
            <Boton type="submit" variante="primario">Guardar</Boton>
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
}

/** Círculo de la fila: toque corto selecciona, pulsación larga o «⋯» abre la hoja. */
export function CirculoItem({ titulo, portada, seleccionado, apagado, conteo, aviso, arrastrable, arrastrando, alSeleccionar, alVer, alMenu, alArrastrar, alSoltar, alTerminarArrastre }: {
  titulo: string; portada: string; seleccionado: boolean; apagado: boolean; conteo: string; aviso: string;
  arrastrable: boolean; arrastrando: boolean;
  alSeleccionar: () => void; alVer: () => void; alMenu: () => void;
  alArrastrar: (e: DragEvent<HTMLDivElement>) => void; alSoltar: (e: DragEvent<HTMLDivElement>) => void; alTerminarArrastre: () => void;
}) {
  const lp = usePulsacionLarga(alMenu);
  return (
    <div className="dst-circulo" data-arrastrando={arrastrando ? 'true' : undefined}
      draggable={arrastrable} onDragStart={alArrastrar} onDragOver={(e) => e.preventDefault()} onDrop={alSoltar} onDragEnd={alTerminarArrastre}>
      <button type="button" className="dst-circulo-toque dst-lp" data-apagado={apagado ? 'true' : undefined}
        aria-pressed={seleccionado} onClick={alSeleccionar} {...lp}>
        <span className="dst-anillo" data-sel={seleccionado ? 'true' : undefined}>
          <span className="dst-anillo-in">
            {portada ? (
              <img src={portada} alt="" draggable={false} />
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                <circle cx="12" cy="13.5" r="3.5" />
              </svg>
            )}
          </span>
        </span>
        <span className="dst-nombre">{titulo || '(sin nombre)'}</span>
        <span className="dst-sub">{conteo}</span>
      </button>
      {aviso && <span className="dst-oculto">{aviso}</span>}
      <div className="dst-mini">
        <button type="button" className="dst-btn" onClick={alVer}>▶ Ver</button>
        <button type="button" className="dst-btn" aria-label={`Más opciones de ${titulo || 'la destacada'}`} onClick={alMenu}>⋯</button>
      </div>
    </div>
  );
}

/** Foto de la grilla: toque corto la ve en el visor, pulsación larga o «⋯» abre la hoja. */
export function FotoItem({ n, url, pie, esPortada, puedeSubir, puedeBajar, alVer, alMenu, alEditarPie, alMover }: {
  n: number; url: string; pie: string; esPortada: boolean; puedeSubir: boolean; puedeBajar: boolean;
  alVer: () => void; alMenu: () => void; alEditarPie: () => void; alMover: (dir: -1 | 1) => void;
}) {
  const lp = usePulsacionLarga(alMenu);
  return (
    <div className="dst-foto">
      <button type="button" className="dst-foto-toque dst-lp" aria-label={`Ver la imagen ${n}`} onClick={alVer} {...lp}>
        <img src={url} alt="" draggable={false} />
        <span className="dst-foto-num">{n}</span>
        {esPortada && <span className="dst-foto-portada">Portada</span>}
      </button>
      <button type="button" className="dst-foto-pie dst-foto-pie-btn" data-vacio={pie ? undefined : 'true'}
        aria-label={`Texto de la imagen ${n}`} onClick={alEditarPie}>
        {pie || 'Sin texto. Toca para escribirlo'}
      </button>
      <div className="dst-foto-fila">
        <button type="button" className="dst-btn" aria-label="Subir" disabled={!puedeSubir} onClick={() => alMover(-1)}>‹</button>
        <button type="button" className="dst-btn" aria-label={`Más opciones de la imagen ${n}`} onClick={alMenu}>⋯</button>
        <button type="button" className="dst-btn" aria-label="Bajar" disabled={!puedeBajar} onClick={() => alMover(1)}>›</button>
      </div>
    </div>
  );
}
