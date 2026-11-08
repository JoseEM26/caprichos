import { useRef, type KeyboardEvent } from 'react';
import { ModuloMapaImpresion } from './mapa/ModuloMapaImpresion';
import { SeccionEquipos } from './SeccionEquipos';
import { SeccionColaPruebas } from './SeccionColaPruebas';
import { ImpresionFacil } from './facil/ImpresionFacil';
import { PrioridadTickets } from './PrioridadTickets';
import { useSesion } from '../../comun/sesion';
import { SECCIONES_AVANZADAS, saludEquipos, type SeccionImpresion } from './seccionesImpresion';
import { useEstadoMaquinas } from './useEstadoMaquinas';
import './modulo-impresion.css';

type SeccionAvanzada = (typeof SECCIONES_AVANZADAS)[number];

const TEXTO_SECCION: Record<SeccionAvanzada, { nombre: string; ayuda: string; icono: string }> = {
  mapa: {
    nombre: 'Mapa',
    ayuda: 'Qué sale y dónde',
    icono: 'M4 5h5v5H4zM15 5h5v5h-5zM9.5 16.5h5M6.5 10v3.5h11V10',
  },
  equipos: {
    nombre: 'Equipos y estado',
    ayuda: 'Agente de Caja, impresoras y llaves',
    icono: 'M3 5h18v11H3zM8 20h8M12 16v4',
  },
  cola: {
    nombre: 'Cola y pruebas',
    ayuda: 'Trabajos, reintentos y pruebas',
    icono: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
};

/** Luz de salud de los equipos, para el título de Impresión (verde, ámbar, roja o gris sin datos). */
export function SaludImpresion() {
  const { maquinas } = useEstadoMaquinas();
  const salud = saludEquipos(maquinas);
  return (
    <span className={`imp-salud imp-salud--${salud.nivel}`} data-testid="imp-salud" data-nivel={salud.nivel}>
      <span className="imp-salud-luz" aria-hidden="true" />
      {salud.texto}
    </span>
  );
}

/**
 * Módulo único Impresión de Configuración: mapa, equipos y estado, y cola con pruebas.
 * La sección la decide la URL (?seccion=) en la pantalla de Configuración.
 */
export function ModuloImpresion({
  seccion,
  alCambiarSeccion,
}: {
  seccion: SeccionImpresion;
  alCambiarSeccion: (s: SeccionImpresion) => void;
}) {
  const botones = useRef<Partial<Record<SeccionAvanzada, HTMLButtonElement | null>>>({});
  const { tiene, usuario } = useSesion();
  const puedeEditar = (usuario?.rol || '').toUpperCase() === 'ADMIN' || tiene('configuracion/editar');

  const elegir = (s: SeccionAvanzada, conFoco: boolean) => {
    alCambiarSeccion(s);
    if (conFoco) botones.current[s]?.focus();
  };

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = SECCIONES_AVANZADAS.length;
    const i = SECCIONES_AVANZADAS.indexOf(seccion as SeccionAvanzada);
    let j: number | null = null;
    if (e.key === 'ArrowRight') j = (i + 1) % n;
    else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = n - 1;
    if (j === null) return;
    e.preventDefault();
    elegir(SECCIONES_AVANZADAS[j], true);
  };

  if (seccion === 'facil') {
    return (
      <div className="imp-modulo">
        <PrioridadTickets puedeEditar={puedeEditar} />
        <ImpresionFacil alVistaAvanzada={() => alCambiarSeccion('mapa')} />
      </div>
    );
  }

  return (
    <div className="imp-modulo">
      <button type="button" className="imp-volver" data-testid="imp-volver-facil" onClick={() => alCambiarSeccion('facil')}>
        ← Volver a la pantalla fácil (3 pasos)
      </button>
      <div role="tablist" aria-label="Secciones de Impresión" className="imp-tabs">
        {SECCIONES_AVANZADAS.map((s) => {
          const activa = s === seccion;
          return (
            <button
              key={s}
              ref={(el) => {
                botones.current[s] = el;
              }}
              id={`imp-tab-${s}`}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls="imp-panel"
              tabIndex={activa ? 0 : -1}
              data-testid={`imp-tab-${s}`}
              className={`imp-tab${activa ? ' imp-tab--activa' : ''}`}
              onClick={() => elegir(s, false)}
              onKeyDown={alTeclear}
            >
              <svg className="imp-tab-icono" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d={TEXTO_SECCION[s].icono} />
              </svg>
              <span className="imp-tab-texto">
                <span className="imp-tab-nombre">{TEXTO_SECCION[s].nombre}</span>
                <span className="imp-tab-ayuda">{TEXTO_SECCION[s].ayuda}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="imp-panel" aria-labelledby={`imp-tab-${seccion}`} tabIndex={0} className="imp-panel">
        {seccion === 'mapa' && <ModuloMapaImpresion />}
        {seccion === 'equipos' && <SeccionEquipos />}
        {seccion === 'cola' && <SeccionColaPruebas />}
      </div>
    </div>
  );
}
