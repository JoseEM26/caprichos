import { FormEvent, ReactNode, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Confirmar } from './Confirmar';
import { useDialogoAccesible } from './useDialogoAccesible';
import './modal-pestanas.css';

/**
 * Formulario de acción en una ventana encima de la página (mismo estilo que ModalConPestanas).
 * Esc, × y el fondo cierran; si hay texto escrito (`sucio`) piden confirmación antes de descartar.
 * Los botones de acción van en `pie`; `bloqueado` (enviando) impide cerrar.
 */
export function ModalFormulario({ titulo, etiqueta, sucio = false, bloqueado = false, alCerrar, alEnviar, pie, children }: {
  titulo: string;
  /** Nombre accesible del formulario (por defecto, el título). */
  etiqueta?: string;
  sucio?: boolean;
  bloqueado?: boolean;
  alCerrar: () => void;
  alEnviar: (e: FormEvent) => void;
  pie: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [descartar, setDescartar] = useState(false);
  const pedirCierre = () => (sucio ? setDescartar(true) : alCerrar());
  const alTeclear = useDialogoAccesible(ref, pedirCierre, bloqueado || descartar);

  return createPortal(
    <>
      <div className="mcp-fondo" onClick={bloqueado ? undefined : pedirCierre} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="mcp-dialogo mcp-formulario" onKeyDown={alTeclear} tabIndex={-1}>
        <form aria-label={etiqueta ?? titulo} onSubmit={alEnviar} className="mcp-formulario-form">
          <div className="mcp-cabecera">
            <div className="mcp-titulos"><h2 id={`${id}-t`} className="mcp-titulo">{titulo}</h2></div>
            <button type="button" className="mcp-cerrar" onClick={pedirCierre} disabled={bloqueado} aria-label="Cerrar">×</button>
          </div>
          <div className="mcp-cuerpo">{children}</div>
          <div className="mcp-pie">{pie}</div>
        </form>
      </div>
      <Confirmar
        abierto={descartar}
        titulo="¿Descartar lo escrito?"
        mensaje="Si cierras, se pierde lo que escribiste."
        textoSi="Sí, descartar"
        textoNo="No, seguir"
        focoInicialNo
        alConfirmar={alCerrar}
        alCancelar={() => setDescartar(false)}
      />
    </>,
    document.body,
  );
}
