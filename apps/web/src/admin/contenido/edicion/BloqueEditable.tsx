import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useSeleccionEd } from './LienzoEdicion';
import { IndicadorSubida } from '../../../comun/IndicadorSubida';
import { useSubidaArchivo } from '../../../comun/useSubidaArchivo';

export interface BloqueEditableProps {
  clave: string;
  etiqueta: string;
  oculto?: boolean;
  /** Sin estas props no aparece el botón de mover. */
  puedeSubir?: boolean;
  puedeBajar?: boolean;
  onSubir?: () => void;
  onBajar?: () => void;
  /** Se suelta aquí otro bloque (clave de origen). `puedeSoltar` filtra qué bloques se aceptan. */
  onSoltar?: (desde: string) => void;
  puedeSoltar?: (desde: string) => boolean;
  /** Mostrar / Ocultar. */
  onOcultar?: () => void;
  /** Cambiar foto: recibe el archivo elegido. */
  /** Sube y aplica la foto. Si rechaza, el bloque muestra el error con Reintentar. */
  onFoto?: (archivo: File) => void | Promise<void>;
  /** Botones propios de este bloque (tamaño, duplicar, eliminar…). */
  acciones?: ReactNode;
  /** Ventana pequeña anclada al bloque. */
  popover?: ReactNode;
  estilo?: CSSProperties;
  debajo?: boolean;
  children: ReactNode;
}

/** Contorno y barra flotante de un bloque editable (sección o elemento de la carta). */
export function BloqueEditable(p: BloqueEditableProps) {
  const s = useSeleccionEd();
  const entrada = useRef<HTMLInputElement>(null);
  const subidaFoto = useSubidaArchivo();
  const envoltura = useRef<HTMLDivElement>(null);
  const seleccionado = s?.sel === p.clave;
  const aceptar = (desde: string | null) => !!desde && desde !== p.clave && !!p.onSoltar && (p.puedeSoltar?.(desde) ?? true);

  return (
    <div
      ref={envoltura}
      className="ed-bloque"
      role="group"
      aria-label={p.etiqueta}
      data-clave={p.clave}
      data-edicion="bloque"
      data-sel={seleccionado ? '1' : undefined}
      data-oculto={p.oculto ? '1' : undefined}
      style={p.estilo}
      onFocus={(e) => {
        e.stopPropagation();
        if (s && s.sel !== p.clave) s.setSel(p.clave);
      }}
      onDragOver={(e) => {
        if (aceptar(s?.arrastre.current ?? null)) {
          e.preventDefault();
          e.stopPropagation();
          envoltura.current?.setAttribute('data-sobre', '1');
        }
      }}
      onDragLeave={() => envoltura.current?.removeAttribute('data-sobre')}
      onDrop={(e) => {
        envoltura.current?.removeAttribute('data-sobre');
        const desde = s?.arrastre.current ?? e.dataTransfer?.getData('text/plain') ?? null;
        if (!aceptar(desde)) return; // lo recibe el bloque que lo contiene, si lo acepta
        e.preventDefault();
        e.stopPropagation();
        if (s) s.arrastre.current = null;
        p.onSoltar!(desde!);
      }}
    >
      {p.oculto && <span className="ed-oculta">Oculta</span>}
      <div className="ed-contenido">{p.children}</div>
      {seleccionado && (
        <div className={`ed-capa ${p.debajo ? 'ed-capa--debajo' : 'ed-capa--dentro'}`} data-edicion="barra">
          <div className="ed-barra" role="toolbar" aria-label={`Acciones de ${p.etiqueta}`}>
            <span className="ed-etiqueta">{p.etiqueta}</span>
            {p.onSoltar && (
              <button
                type="button"
                className="ed-btn ed-btn--mover"
                draggable
                aria-label={`Arrastrar ${p.etiqueta}`}
                onDragStart={(e) => {
                  if (s) s.arrastre.current = p.clave;
                  e.dataTransfer?.setData('text/plain', p.clave);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  if (s) s.arrastre.current = null;
                }}
              >
                Mover
              </button>
            )}
            {p.onSubir && (
              <button type="button" className="ed-btn" disabled={p.puedeSubir === false} aria-label={`Subir ${p.etiqueta}`} onClick={p.onSubir}>
                Subir
              </button>
            )}
            {p.onBajar && (
              <button type="button" className="ed-btn" disabled={p.puedeBajar === false} aria-label={`Bajar ${p.etiqueta}`} onClick={p.onBajar}>
                Bajar
              </button>
            )}
            {p.onOcultar && (
              <button type="button" className="ed-btn" aria-label={`${p.oculto ? 'Mostrar' : 'Ocultar'} ${p.etiqueta}`} onClick={p.onOcultar}>
                {p.oculto ? 'Mostrar' : 'Ocultar'}
              </button>
            )}
            {p.onFoto && (
              <>
                <button type="button" className="ed-btn" aria-label={`Cambiar foto de ${p.etiqueta}`} onClick={() => entrada.current?.click()}>
                  Cambiar foto
                </button>
                <input
                  ref={entrada}
                  type="file"
                  accept="image/*"
                  aria-label={`Elegir foto para ${p.etiqueta}`}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  disabled={subidaFoto.subiendo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void subidaFoto.ejecutar(async () => { await p.onFoto!(f); });
                  }}
                />
                <IndicadorSubida estado={subidaFoto.estado} error={subidaFoto.error} onReintentar={subidaFoto.reintentar} />
              </>
            )}
            {p.acciones}
          </div>
          {p.popover && (
            <div className="ed-pop" data-edicion="pop" role="dialog" aria-label={`Opciones de ${p.etiqueta}`}>
              {p.popover}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Botón de la barra flotante (44 px) para las acciones propias de cada vista. */
export function BotonBarra({ children, onClick, peligro, pulsado, ...resto }: { children: ReactNode; onClick: () => void; peligro?: boolean; pulsado?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button type="button" className={`ed-btn${peligro ? ' ed-btn--peligro' : ''}`} aria-pressed={pulsado} onClick={onClick} {...resto}>
      {children}
    </button>
  );
}
