import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icono } from '../comun/Icono';
import { esIos, estaInstalada, suscribirInstalar } from './instalar';
import { ElegirAppInstalar } from './ElegirAppInstalar';

// objetivo táctil mínimo de 44 px
const TACTIL = 44;
const ANCHO_ANGOSTO = 480;

// trazos propios (el set de Icono es del admin y no trae teléfono ni compartir)
const PATH_DESCARGA = ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'];
const PATH_TELEFONO = ['M7 2h10v20H7z', 'M11 18h2'];
const PATH_COMPARTIR = ['M12 3v12', 'M8 7l4-4 4 4', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'];

function Trazo({ paths, tamano = 22 }: { paths: string[]; tamano?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const estiloBotonCabecera: CSSProperties = {
  flex: 'none',
  minHeight: TACTIL,
  boxSizing: 'border-box',
  borderRadius: 12,
  border: '1.5px solid var(--cp-navy)',
  background: 'transparent',
  color: 'var(--cp-navy)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 13,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const estiloBotonSecundario: CSSProperties = {
  minHeight: TACTIL,
  padding: '0 16px',
  border: 0,
  background: 'transparent',
  color: 'var(--cp-soft)',
  fontWeight: 700,
  fontSize: 14,
  textDecoration: 'underline',
};

const estiloPaso: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 14,
  lineHeight: '20px',
  color: 'var(--cp-navy)',
};

const estiloNumero: CSSProperties = {
  flex: 'none',
  width: 24,
  height: 24,
  borderRadius: 12,
  background: 'var(--cp-navy)',
  color: 'var(--cp-cream)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 13,
  lineHeight: '24px',
  textAlign: 'center',
};

function Paso({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ ...estiloPaso, listStyle: 'none' }}>
      <span style={estiloNumero} aria-hidden="true">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Instrucciones() {
  if (esIos()) {
    return (
      <section aria-label="Cómo instalarla en iPhone o iPad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontSize: 15, fontWeight: 800 }}>Cómo instalarla en tu iPhone o iPad</h3>
        <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Paso n={1}>
            Toca el botón <strong>Compartir</strong> <Trazo paths={PATH_COMPARTIR} tamano={18} /> de la barra de abajo.
          </Paso>
          <Paso n={2}>
            Elige <strong>«Añadir a pantalla de inicio»</strong>.
          </Paso>
          <Paso n={3}>
            Confirma tocando <strong>«Añadir»</strong>.
          </Paso>
        </ol>
        <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>
          Abre esta página en Safari: desde Chrome u otro navegador de iPhone no se puede instalar.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Cómo instalarla" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontSize: 15, fontWeight: 800 }}>Cómo instalarla</h3>
      <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Paso n={1}>
          Abre el menú <strong>⋮</strong> del navegador (arriba a la derecha).
        </Paso>
        <Paso n={2}>
          Elige <strong>«Instalar app»</strong>, <strong>«Instalar Caprichos»</strong> o <strong>«Añadir a pantalla de inicio»</strong>. En computadora también sale un ícono de instalar al final de la barra de direcciones.
        </Paso>
      </ol>
      <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>
        Si usas el navegador dentro de WhatsApp o Facebook, ábrelo en Chrome.
      </p>
    </section>
  );
}

/**
 * Botón «Instalar app» y su ventana para elegir QUÉ app instalar (carta, panel o asistencia). Se ve mientras la app no esté
 * instalada; con `siempre` se ve también ya instalada (panel del local: ahí sirve para reinstalar o buscar cambios).
 * `abrirInicial` + `sinBoton` abren solo la ventana (pestaña abierta con ?instalar=...).
 */
export function BotonInstalarApp({ siempre = false, abrirInicial = false, sinBoton = false }: { siempre?: boolean; abrirInicial?: boolean; sinBoton?: boolean } = {}) {
  const [, actualizar] = useReducer((n: number) => n + 1, 0);
  const [abierto, setAbierto] = useState(abrirInicial);
  const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && window.innerWidth <= ANCHO_ANGOSTO);
  const disparador = useRef<HTMLButtonElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => suscribirInstalar(actualizar), []);

  useEffect(() => {
    const alRedimensionar = () => setAngosto(window.innerWidth <= ANCHO_ANGOSTO);
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

  // Foco dentro del diálogo, Esc para cerrar, Tab sin salir, y al cerrar vuelve al botón.
  useEffect(() => {
    if (!abierto) return;
    dialogo.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAbierto(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogo.current) return;
      const enfocables = dialogo.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      disparador.current?.focus();
    };
  }, [abierto]);

  if (!siempre && !abrirInicial && estaInstalada()) return null;

  return (
    <>
      {!sinBoton && <button
        ref={disparador}
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-label={angosto ? 'Instalar app Caprichos' : undefined}
        title="Instalar app Caprichos"
        style={{ ...estiloBotonCabecera, width: angosto ? TACTIL : undefined, padding: angosto ? 0 : '0 14px', justifyContent: 'center' }}
      >
        <Trazo paths={PATH_DESCARGA} tamano={20} />
        {!angosto && <span>Instalar app</span>}
      </button>}

      {abierto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setAbierto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              background: 'rgba(11, 44, 62, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              boxSizing: 'border-box',
            }}
          >
            <div
              ref={dialogo}
              role="dialog"
              aria-modal="true"
              aria-labelledby="instalar-app-titulo"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 440,
                maxHeight: 'calc(100dvh - 32px)',
                overflowY: 'auto',
                boxSizing: 'border-box',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                border: '1px solid var(--cp-line)',
                borderRadius: 20,
                padding: '24px 20px 20px',
                boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                outline: 'none',
              }}
            >
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: TACTIL,
                  height: TACTIL,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cp-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre="cerrar" tamano={22} />
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', paddingTop: 4 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--cp-orange)', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trazo paths={PATH_TELEFONO} tamano={28} />
                </span>
                <h2 id="instalar-app-titulo" style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 19, lineHeight: '24px', paddingRight: 28 }}>
                  ¿Qué app quieres instalar?
                </h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
                  Puedes tener las tres a la vez. Cada una se abre directo en lo suyo.
                </p>
              </div>

              <ElegirAppInstalar instrucciones={<Instrucciones />} />

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button type="button" onClick={() => setAbierto(false)} style={estiloBotonSecundario}>
                  Ahora no
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
