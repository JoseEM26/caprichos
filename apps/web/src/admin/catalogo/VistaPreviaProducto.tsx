/**
 * Vista previa de un producto «como se ve en la carta» (ventana real de la carta, en solo lectura).
 *
 * Uso desde otros componentes (p. ej. el editor de «Opciones y tamaños»):
 *   const { abrir, ventana } = useVistaPrevia(gruposGenerales);
 *   <button onClick={() => abrir({ ...productoGuardado, tamanos: tamanosEnBorrador, grupos: gruposEnBorrador })}>…</button>
 *   {ventana}            // colócalo una vez en el JSX
 * O directamente el botón ya hecho (44 px, ojo SVG):
 *   <BotonVistaPrevia borrador={() => ({ ...p, tamanos, grupos })} sinGuardar />
 * `borrador` acepta un ProductoAdmin o cualquier BorradorProducto (aProductoCarta.ts); se evalúa al hacer clic,
 * así siempre refleja el estado actual del formulario. `sinGuardar` muestra «Vista previa de tus cambios sin guardar».
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CarritoProvider } from '../../carta/CarritoContext';
import { TarjetaProducto } from '../../carta/TarjetaProducto';
import { VentanaProductoCarta } from '../../carta/VentanaProductoCarta';
import { ConmutadorDispositivo, MarcoDispositivo } from '../../comun/MarcoDispositivo';
import { aProductoCarta, avisosProducto } from './aProductoCarta';
import type { BorradorProducto } from './aProductoCarta';
import type { GrupoOpcionItem, ProductoAdmin } from './catalogoApi';
import './vista-previa-producto.css';

type Borrador = BorradorProducto | ProductoAdmin;

interface VentanaProps {
  borrador: Borrador;
  gruposGenerales?: GrupoOpcionItem[];
  sinGuardar?: boolean;
  onCerrar: () => void;
}

const FOCO = 'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

export function VistaPreviaProducto({ borrador, gruposGenerales = [], sinGuardar = false, onCerrar }: VentanaProps) {
  const [celular, setCelular] = useState(true);
  const [abierta, setAbierta] = useState(true);
  const raiz = useRef<HTMLDivElement>(null);
  const d = borrador as BorradorProducto;

  // imagen elegida y no subida: URL local, liberada al cerrar
  const urlLocal = useMemo(() => (d.fotoArchivo ? URL.createObjectURL(d.fotoArchivo) : null), [d.fotoArchivo]);
  useEffect(() => () => { if (urlLocal) URL.revokeObjectURL(urlLocal); }, [urlLocal]);

  const producto = useMemo(
    () => aProductoCarta({ ...d, fotoUrl: urlLocal ?? d.fotoUrl }, gruposGenerales),
    [d, urlLocal, gruposGenerales],
  );
  const avisos = avisosProducto(d);
  const oculto = Boolean(d.oculto);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    raiz.current?.querySelector<HTMLElement>('[data-vpp-cerrar]')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCerrar();
      } else if (e.key === 'Tab' && raiz.current) {
        const f = Array.from(raiz.current.querySelectorAll<HTMLElement>(FOCO));
        if (f.length === 0) return;
        const primero = f[0];
        const ultimo = f[f.length - 1];
        const activo = document.activeElement;
        if (!raiz.current.contains(activo)) { e.preventDefault(); primero.focus(); }
        else if (e.shiftKey && activo === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    document.addEventListener('keydown', alTeclear, true);
    return () => { document.removeEventListener('keydown', alTeclear, true); previo?.focus?.(); };
  }, [onCerrar]);

  return createPortal(
    <div className="vpp-fondo" onClick={onCerrar}>
      <div
        ref={raiz}
        className="vpp-ventana"
        role="dialog"
        aria-modal="true"
        aria-label="Así se ve en la carta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vpp-cabeza">
          <div>
            <h2>Así se ve en la carta</h2>
            <span className="mdv-nota">{d.nombre ? `${d.nombre} · ` : ''}Vista previa de solo lectura</span>
          </div>
          <ConmutadorDispositivo celular={celular} onCambiar={setCelular} />
          <div className="mdv-conmutador" role="group" aria-label="Vista">
            <button type="button" className="mdv-btn" aria-pressed={!abierta} data-testid="btn-vista-tarjeta" onClick={() => setAbierta(false)}>Tarjeta en la carta</button>
            <button type="button" className="mdv-btn" aria-pressed={abierta} data-testid="btn-vista-abierta" onClick={() => setAbierta(true)}>Ventana al tocarla</button>
          </div>
        </div>
        <div className="vpp-cuerpo">
          {sinGuardar && <div className="vpp-aviso">Vista previa de tus cambios sin guardar</div>}
          {oculto && <div className="vpp-aviso vpp-aviso--alerta" role="status">Este producto no aparece en la carta.</div>}
          {avisos.filter((a) => !a.includes('oculto')).length > 0 && (
            <div className="vpp-aviso" role="status">
              Para tener en cuenta:
              <ul>{avisos.filter((a) => !a.includes('oculto')).map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
          <div data-testid="vpp-escenario" className={`vpp-escenario${celular ? ' vpp-escenario--celular' : ''}`}>
            <MarcoDispositivo celular={celular}>
              <CarritoProvider>
                {abierta ? (
                  <VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => setAbierta(false)} soloLectura esMovilPreview={celular} />
                ) : (
                  <div onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); setAbierta(true); }} style={{ maxWidth: celular ? '100%' : 320, margin: '0 auto' }}>
                    <TarjetaProducto producto={producto} />
                  </div>
                )}
              </CarritoProvider>
            </MarcoDispositivo>
          </div>
        </div>
        <div className="vpp-pie">
          <span className="vpp-aviso">Vista previa: no se agrega al pedido</span>
          <button type="button" className="vpp-btn vpp-btn--lleno" data-vpp-cerrar onClick={onCerrar}>Cerrar vista previa</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Hook: `abrir(borrador)` muestra la ventana; pon `ventana` una vez en el JSX. */
export function useVistaPrevia(gruposGenerales: GrupoOpcionItem[] = []): {
  abrir: (borrador: Borrador, opts?: { sinGuardar?: boolean }) => void;
  ventana: ReactNode;
} {
  const [estado, setEstado] = useState<{ borrador: Borrador; sinGuardar: boolean } | null>(null);
  const cerrar = useRef(() => setEstado(null)).current;
  return {
    abrir: (borrador, opts) => setEstado({ borrador, sinGuardar: Boolean(opts?.sinGuardar) }),
    ventana: estado ? (
      <VistaPreviaProducto borrador={estado.borrador} gruposGenerales={gruposGenerales} sinGuardar={estado.sinGuardar} onCerrar={cerrar} />
    ) : null,
  };
}

const Ojo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

interface BotonProps {
  /** Borrador o función que lo devuelve (se evalúa al hacer clic). */
  borrador: Borrador | (() => Borrador);
  gruposGenerales?: GrupoOpcionItem[];
  sinGuardar?: boolean;
  etiqueta?: string;
  /** Distingue varios botones iguales en la misma pantalla (lectores de pantalla). */
  nombreProducto?: string;
  bloque?: boolean;
}

export function BotonVistaPrevia({ borrador, gruposGenerales, sinGuardar, etiqueta = 'Ver cómo se ve en la carta', nombreProducto, bloque }: BotonProps) {
  const { abrir, ventana } = useVistaPrevia(gruposGenerales);
  return (
    <>
      <button
        type="button"
        className="vpp-btn"
        style={bloque ? { width: '100%' } : undefined}
        aria-label={nombreProducto ? `${etiqueta}: ${nombreProducto}` : undefined}
        onClick={() => abrir(typeof borrador === 'function' ? borrador() : borrador, { sinGuardar })}
      >
        <Ojo />
        {etiqueta}
      </button>
      {ventana}
    </>
  );
}
