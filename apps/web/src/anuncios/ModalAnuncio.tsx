import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useDialogoAccesible } from '../comun/useDialogoAccesible';
import { COLORES_ANUNCIO } from './tipos';
import type { AnuncioPublico } from './tipos';
import './anuncios.css';

export type MotivoCierre = 'MANUAL' | 'AUTO' | 'ENTENDIDO';

/** Contenido visual del anuncio según su plantilla. Lo usa el modal real y la vista previa del editor. */
export function TarjetaAnuncio({ anuncio: a, alClicBoton, alEntendido, idTitulo = 'anu-titulo' }: {
  anuncio: AnuncioPublico;
  /** Cambiarlo cuando haya dos tarjetas a la vez (vista previa en el editor). */
  idTitulo?: string;
  alClicBoton?: () => void;
  alEntendido?: () => void;
}) {
  const c = COLORES_ANUNCIO[a.color] ?? COLORES_ANUNCIO.CREMA;
  const estilo = { '--anu-fondo': c.fondo, '--anu-texto': c.texto, '--anu-acento': c.acento } as CSSProperties;
  const d = a.detalle ?? {};
  const interno = a.plantilla === 'COMUNICADO_INTERNO';
  const boton = a.botonTexto && a.botonEnlace ? (
    <button type="button" className="anu-boton" onClick={alClicBoton}>{a.botonTexto}</button>
  ) : null;

  if (a.plantilla === 'SOLO_IMAGEN') {
    return (
      <div className="anu-tarjeta anu-solo-imagen" style={estilo}>
        {a.imagen && <img src={a.imagen} alt={a.titulo} className="anu-img-completa" />}
        {boton}
      </div>
    );
  }

  return (
    <div className={`anu-tarjeta anu-${a.plantilla.toLowerCase().replace(/_/g, '-')}`} style={estilo}>
      {a.imagen && <img src={a.imagen} alt="" className={a.plantilla === 'PROMOCION' ? 'anu-img anu-img-grande' : 'anu-img'} />}
      <div className="anu-cuerpo">
        {a.plantilla === 'AVISO' && <span className="anu-icono" aria-hidden="true">{d.icono || '!'}</span>}
        {interno && <span className="anu-etiqueta">Comunicado interno</span>}
        {a.plantilla === 'BIENVENIDA' && <span className="anu-etiqueta">¡Bienvenido!</span>}
        <h2 id={idTitulo} className="anu-titulo">{a.titulo}</h2>
        {a.plantilla === 'PROMOCION' && d.precio && <p className="anu-precio">{d.precio}</p>}
        {a.plantilla === 'PROMOCION' && d.cupon && <p className="anu-cupon">Cupón: <strong>{d.cupon}</strong></p>}
        {a.plantilla === 'EVENTO' && (d.fecha || d.lugar) && (
          <p className="anu-datos">
            {d.fecha && <span>{d.fecha}</span>}
            {d.lugar && <span>{d.lugar}</span>}
          </p>
        )}
        {a.texto && <p className={interno ? 'anu-texto anu-texto-largo' : 'anu-texto'}>{a.texto}</p>}
        <div className="anu-acciones">
          {boton}
          {interno && <button type="button" className="anu-boton anu-boton-entendido" data-foco-inicial onClick={alEntendido}>Entendido</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * Ventana emergente de un anuncio: accesible (role=dialog, foco atrapado, Esc cierra si se permite),
 * con barra de cuenta regresiva cuando se cierra sola (se detiene mientras el puntero está encima).
 */
export function ModalAnuncio({ anuncio, alCerrar, alClicBoton, alMontar }: {
  anuncio: AnuncioPublico;
  alCerrar: (motivo: MotivoCierre) => void;
  /** Se llama al pulsar el botón del anuncio (el contenedor navega y registra el clic). */
  alClicBoton?: (enlace: string) => void;
  alMontar?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const total = Math.max(0, anuncio.cierreSegundos) * 1000;
  const [restante, setRestante] = useState(total);
  const pausado = useRef(false);
  const cerrado = useRef(false);
  const cerrar = (m: MotivoCierre) => {
    if (cerrado.current) return;
    cerrado.current = true;
    alCerrar(m);
  };
  const interno = anuncio.plantilla === 'COMUNICADO_INTERNO';
  // Un comunicado que exige «Entendido» no se cierra con X, Esc ni fondo.
  const puedeCerrar = anuncio.puedeCerrar;
  const alTeclear = useDialogoAccesible(ref, () => cerrar('MANUAL'), !puedeCerrar);

  useEffect(() => { alMontar?.(); }, []);

  useEffect(() => {
    if (total <= 0) return;
    const t = setInterval(() => {
      if (!pausado.current) setRestante((r) => Math.max(0, r - 100));
    }, 100);
    return () => clearInterval(t);
  }, [total]);

  useEffect(() => {
    if (total > 0 && restante <= 0) cerrar('AUTO');
  }, [restante]);

  const segundos = Math.ceil(restante / 1000);
  return createPortal(
    <div className="anu-fondo" onClick={puedeCerrar ? () => cerrar('MANUAL') : undefined} data-testid="anuncio-fondo">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={anuncio.plantilla === 'SOLO_IMAGEN' ? undefined : 'anu-titulo'}
        aria-label={anuncio.plantilla === 'SOLO_IMAGEN' ? anuncio.titulo : undefined}
        className="anu-dialogo" tabIndex={-1} onKeyDown={alTeclear} onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => { pausado.current = true; }} onMouseLeave={() => { pausado.current = false; }}>
        {puedeCerrar && (
          <button type="button" className="anu-x" aria-label="Cerrar anuncio" data-foco-inicial={interno ? undefined : ''} onClick={() => cerrar('MANUAL')}>×</button>
        )}
        <TarjetaAnuncio anuncio={anuncio}
          alClicBoton={() => anuncio.botonEnlace && alClicBoton?.(anuncio.botonEnlace)}
          alEntendido={() => cerrar('ENTENDIDO')} />
        {total > 0 && (
          <div className="anu-barra" role="progressbar" aria-label={`Se cierra solo en ${segundos} segundos`}
            aria-valuemin={0} aria-valuemax={anuncio.cierreSegundos} aria-valuenow={segundos}>
            <div className="anu-barra-relleno" style={{ width: `${(restante / total) * 100}%` }} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
