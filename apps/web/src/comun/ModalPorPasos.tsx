import { ReactNode, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './Boton';
import { useDialogoAccesible } from './useDialogoAccesible';
import '../admin/cierre/pendientes-cierre.css'; // reutiliza .ad-dialogo / .ad-cabecera / .ad-cuerpo / .ad-pie / .ad-cerrar
import './modal-pasos.css';

export interface PasoModal {
  id: string;
  /** Texto corto del indicador de progreso. */
  titulo: string;
  contenido: ReactNode;
  /** Devuelve el mensaje de lo que falta, o null si el paso está completo. */
  validar?: () => string | null;
}

export interface ModalPorPasosProps {
  titulo: string;
  pasos: PasoModal[];
  /** Resumen final: si se pasa, se agrega un último paso «Resumen» antes de finalizar. */
  resumen?: ReactNode;
  alCerrar: () => void;
  /** Se llama al «Finalizar» cuando todos los pasos validan. Si lanza, el mensaje se muestra y el modal sigue abierto. */
  alFinalizar: () => void | Promise<void>;
  textoFinalizar?: string;
  /** Error externo (p. ej. del servidor); se muestra junto a los de validación. */
  error?: string | null;
  /** true mientras se envía: bloquea botones, Esc y fondo. */
  enviando?: boolean;
}

/** Asistente por pasos: progreso, Atrás/Siguiente/Finalizar y validación por paso. Para modales largos y lineales. */
export function ModalPorPasos({
  titulo, pasos, resumen, alCerrar, alFinalizar, textoFinalizar = 'Finalizar', error, enviando = false,
}: ModalPorPasosProps) {
  const todos: PasoModal[] = resumen ? [...pasos, { id: 'resumen', titulo: 'Resumen', contenido: resumen }] : pasos;
  const [indice, setIndice] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const alTeclear = useDialogoAccesible(ref, alCerrar, enviando);
  const tituloId = useId();
  const ultimo = indice === todos.length - 1;
  const actual = todos[indice];

  const siguiente = () => {
    const e = actual.validar?.() ?? null;
    setAviso(e);
    if (!e) setIndice(indice + 1);
  };
  const finalizar = async () => {
    for (let i = 0; i < todos.length; i++) {
      const e = todos[i].validar?.() ?? null;
      if (e) { setIndice(i); return setAviso(e); }
    }
    setAviso(null);
    try {
      await alFinalizar();
    } catch (err: any) {
      setAviso(err?.mensaje || err?.message || 'No se pudo completar.');
    }
  };

  if (typeof document === 'undefined') return null;
  const mensaje = aviso ?? error ?? null;
  return createPortal(
    <>
      <div className="mpp-fondo" onClick={enviando ? undefined : alCerrar} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tituloId} className="ad-dialogo mpp-dialogo"
        onKeyDown={alTeclear} tabIndex={-1}>
        <div className="ad-cabecera">
          <h2 id={tituloId} className="ad-titulo" style={{ margin: 0 }}>{titulo}</h2>
          <button type="button" className="ad-cerrar" aria-label="Cerrar" disabled={enviando} onClick={alCerrar}>×</button>
        </div>
        <div className="mpp-progreso">
          <div className="mpp-texto" aria-live="polite">Paso {indice + 1} de {todos.length} · {actual.titulo}</div>
          <ol className="mpp-pasos" aria-label="Progreso">
            {todos.map((p, i) => (
              <li key={p.id} aria-current={i === indice ? 'step' : undefined}
                className={i === indice ? 'mpp-paso mpp-actual' : i < indice ? 'mpp-paso mpp-hecho' : 'mpp-paso'}>
                <span>{i + 1}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="ad-cuerpo mpp-cuerpo" key={actual.id}>
          <h3 className="mpp-h">{actual.titulo}</h3>
          {actual.contenido}
          {mensaje && <div role="alert" className="mpp-error">{mensaje}</div>}
        </div>
        <div className="ad-pie mpp-pie">
          {indice === 0 ? (
            <Boton variante="secundario" disabled={enviando} onClick={alCerrar}>Cancelar</Boton>
          ) : (
            <Boton variante="secundario" disabled={enviando} onClick={() => { setAviso(null); setIndice(indice - 1); }}>Atrás</Boton>
          )}
          {ultimo ? (
            <Boton variante="primario" cargando={enviando} disabled={enviando} onClick={finalizar}>{textoFinalizar}</Boton>
          ) : (
            <Boton variante="primario" onClick={siguiente}>Siguiente</Boton>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
