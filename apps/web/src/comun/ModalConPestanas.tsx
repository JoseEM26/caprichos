import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogoAccesible } from './useDialogoAccesible';
import './modal-pestanas.css';

export interface PestanaModal {
  id: string;
  etiqueta: string;
  /** Conteo o marca junto a la etiqueta (p. ej. 3). Se oculta si es null/undefined. */
  insignia?: number | string | null;
  contenido: ReactNode;
  /** false = el contenido se desmonta al salir de la pestaña (por defecto se conserva su estado). */
  persistente?: boolean;
}

export interface ModalConPestanasProps {
  titulo: string;
  subtitulo?: ReactNode;
  pestanas: PestanaModal[];
  /** Pestaña inicial (no controlada). Por defecto, la primera. */
  pestanaInicial?: string;
  /** Modo controlado: pestaña activa y aviso de cambio. */
  pestanaActiva?: string;
  alCambiarPestana?: (id: string) => void;
  alCerrar: () => void;
  /** true = ni Esc, ni la X, ni el fondo cierran (p. ej. mientras se guarda). */
  bloquearCierre?: boolean;
  /** Botones junto a la X del encabezado (ayuda «?», etc.). */
  accionesEncabezado?: ReactNode;
  /** Franja fija entre la barra de pestañas y el cuerpo (avisos, panel de ayuda). */
  bajoPestanas?: ReactNode;
  /** Pie fijo: acciones (Cerrar, Guardar…). */
  pie?: ReactNode;
  /** Ancho máximo en px (por defecto 960). */
  ancho?: number;
}

const idPest = (base: string, id: string) => `${base}-t-${id}`;
const idPanel = (base: string, id: string) => `${base}-p-${id}`;

/** Barra role="tablist" con flechas, Inicio y Fin. En celular hace scroll horizontal. */
export function BarraPestanas({ pestanas, activa, alCambiar, base, etiqueta }: {
  pestanas: PestanaModal[]; activa: string; alCambiar: (id: string) => void; base: string; etiqueta?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    refs.current[activa]?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [activa]);
  const alTeclear = (e: KeyboardEvent) => {
    const n = pestanas.length;
    const i = pestanas.findIndex((p) => p.id === activa);
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    alCambiar(pestanas[j].id);
    refs.current[pestanas[j].id]?.focus();
  };
  return (
    <div className="mcp-barra" role="tablist" aria-label={etiqueta ?? 'Secciones'} onKeyDown={alTeclear}>
      {pestanas.map((p) => (
        <button key={p.id} type="button" role="tab" id={idPest(base, p.id)} className="mcp-pestana"
          ref={(el) => { refs.current[p.id] = el; }}
          aria-selected={p.id === activa} aria-controls={idPanel(base, p.id)}
          tabIndex={p.id === activa ? 0 : -1} data-foco-inicial={p.id === activa ? '' : undefined}
          onClick={() => alCambiar(p.id)}>
          {p.etiqueta}
          {p.insignia != null && p.insignia !== '' && <span className="mcp-insignia">{p.insignia}</span>}
        </button>
      ))}
    </div>
  );
}

/** Paneles role="tabpanel": se montan al primer uso y los inactivos quedan ocultos (hidden). */
export function PanelesPestanas({ pestanas, activa, base }: { pestanas: PestanaModal[]; activa: string; base: string }) {
  const [vistas, setVistas] = useState<Set<string>>(() => new Set([activa]));
  useEffect(() => {
    setVistas((v) => (v.has(activa) ? v : new Set(v).add(activa)));
  }, [activa]);
  return (
    <>
      {pestanas.map((p) => {
        const esActiva = p.id === activa;
        const montar = esActiva || (p.persistente !== false && vistas.has(p.id));
        return (
          <div key={p.id} role="tabpanel" id={idPanel(base, p.id)} aria-labelledby={idPest(base, p.id)}
            className="mcp-panel" hidden={!esActiva} tabIndex={0}>
            {montar ? p.contenido : null}
          </div>
        );
      })}
    </>
  );
}

/** Pestañas sin modal (para formularios en línea). Controlado o no. */
export function Pestanas({ pestanas, pestanaInicial, pestanaActiva, alCambiarPestana, etiqueta }: {
  pestanas: PestanaModal[]; pestanaInicial?: string; pestanaActiva?: string; alCambiarPestana?: (id: string) => void; etiqueta?: string;
}) {
  const base = useId();
  const [interna, setInterna] = useState(pestanaInicial ?? pestanas[0]?.id ?? '');
  const activa = pestanaActiva ?? interna;
  const cambiar = (id: string) => { setInterna(id); alCambiarPestana?.(id); };
  return (
    <div className="mcp-enlinea">
      <BarraPestanas pestanas={pestanas} activa={activa} alCambiar={cambiar} base={base} etiqueta={etiqueta} />
      <PanelesPestanas pestanas={pestanas} activa={activa} base={base} />
    </div>
  );
}

/**
 * Modal con pestañas: encabezado fijo (título + X), barra de pestañas, cuerpo con scroll propio y pie fijo.
 * Altura fija (hasta 90dvh) para que no salte al cambiar de pestaña. Esc cierra, foco atrapado y devuelto.
 */
export function ModalConPestanas({
  titulo, subtitulo, pestanas, pestanaInicial, pestanaActiva, alCambiarPestana, alCerrar,
  bloquearCierre = false, accionesEncabezado, bajoPestanas, pie, ancho = 960,
}: ModalConPestanasProps) {
  const base = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const [interna, setInterna] = useState(pestanaInicial ?? pestanas[0]?.id ?? '');
  const activa = pestanaActiva ?? interna;
  const cambiar = (id: string) => { setInterna(id); alCambiarPestana?.(id); };
  const alTeclear = useDialogoAccesible(dialogoRef, alCerrar, bloquearCierre);
  const tituloId = `${base}-titulo`;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="mcp-fondo" onClick={bloquearCierre ? undefined : alCerrar} />
      <div ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby={tituloId} className="mcp-dialogo"
        style={{ maxWidth: ancho }} onKeyDown={alTeclear} tabIndex={-1}>
        <div className="mcp-cabecera">
          <div className="mcp-titulos">
            <h2 id={tituloId} className="mcp-titulo">{titulo}</h2>
            {subtitulo && <div className="mcp-subtitulo">{subtitulo}</div>}
          </div>
          {accionesEncabezado}
          <button type="button" className="mcp-cerrar" aria-label="Cerrar" disabled={bloquearCierre} onClick={alCerrar}>×</button>
        </div>
        <BarraPestanas pestanas={pestanas} activa={activa} alCambiar={cambiar} base={base} />
        {bajoPestanas}
        <div className="mcp-cuerpo">
          <PanelesPestanas pestanas={pestanas} activa={activa} base={base} />
        </div>
        {pie && <div className="mcp-pie">{pie}</div>}
      </div>
    </>,
    document.body,
  );
}
