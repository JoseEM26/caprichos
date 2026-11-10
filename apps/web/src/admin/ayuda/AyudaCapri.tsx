import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEsMovil } from '../../carta/useEsMovil';
import { MascotaCapri } from '../../mascota';
import { useArrastrable } from '../../comun/useArrastrable';
import { useAyuda } from './useAyuda';
import { formatearTextoAyuda } from './formatearTextoAyuda';
import './AyudaCapri.css';

/** Hueco de la barra superior del panel donde vive Capri minimizada (junto a la campana y «Instalar»). */
export const ID_SLOT_CAPRI = 'capri-slot-barra';

export interface AyudaCapriProps {
  ruta?: string;
}

const PARAMS_SECCION = ['tab', 'pestana', 'seccion'];

/** Ruta + solo los parámetros que eligen sección (se ignoran `campo`, filtros, ids…: no deben recargar el contexto). */
export function rutaConSeccion(pathname: string, search: string): string {
  const entrada = new URLSearchParams(search);
  const salida = new URLSearchParams();
  for (const k of PARAMS_SECCION) {
    const v = entrada.get(k);
    if (v) salida.set(k, v);
  }
  const q = salida.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function AyudaCapri({ ruta }: AyudaCapriProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const esMovil = useEsMovil();

  // Capri conoce la sección abierta (pestaña de Configuración, de Asistencia…): va en la ruta que se le manda
  const rutaActual = ruta ?? rutaConSeccion(location.pathname, location.search);
  const {
    abierto,
    estadoCapri,
    mensajes,
    sugerencias,
    cargando,
    abrir,
    cerrar,
    enviar,
  } = useAyuda(rutaActual);

  const [pregunta, setPregunta] = useState('');

  // Capri minimizada: no tapa botones de la pantalla (p. ej. Enviar en Mensajes). Se recuerda por navegador.
  const [minimizada, setMinimizada] = useState<boolean>(() => {
    try {
      const guardado = localStorage.getItem('capri_minimizada');
      if (guardado !== null) return guardado === '1';
    } catch {
      /* sin almacenamiento */
    }
    return location.pathname.startsWith('/admin/mensajes');
  });
  const cambiarMinimizada = (valor: boolean) => {
    setMinimizada(valor);
    try {
      localStorage.setItem('capri_minimizada', valor ? '1' : '0');
    } catch {
      /* sin almacenamiento */
    }
  };
  // Slot en la barra superior: si existe, la Capri minimizada va ahí (portal); si no (otra pantalla/pruebas), flota como siempre
  const [slot, setSlot] = useState<HTMLElement | null>(() => document.getElementById(ID_SLOT_CAPRI));
  useEffect(() => {
    const el = document.getElementById(ID_SLOT_CAPRI);
    if (el !== slot) setSlot(el);
  });
  const contenedorRef = useRef<HTMLDivElement>(null);
  const arr = useArrastrable(contenedorRef, { clave: 'capri.posicion', dep: `${minimizada}-${abierto}` });
  const alAbrir = () => {
    if (arr.permitirClic()) abrir();
  };
  const finMensajesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;

    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrar();
      }
    };

    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [abierto, cerrar]);

  // Desplazar al final de mensajes cuando cambien
  useEffect(() => {
    if (abierto && finMensajesRef.current && typeof finMensajesRef.current.scrollIntoView === 'function') {
      finMensajesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, cargando, abierto]);

  // Foco en el input al abrir
  useEffect(() => {
    if (abierto && inputRef.current) {
      inputRef.current.focus();
    }
  }, [abierto]);

  const manejarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto || cargando) return;

    setPregunta('');
    enviar(texto);
  };

  const manejarNavegacion = (rutaDestino: string) => {
    navigate(rutaDestino);
    if (esMovil) {
      cerrar();
    }
  };

  // No mostrar el asistente de ayuda en la pantalla de inicio de sesión
  if (location.pathname.startsWith('/admin/ingresar')) {
    return null;
  }

  return (
    <>
      {/* Botón flotante FAB (visible solo cuando el panel está cerrado) */}
      {!abierto && !minimizada && (
        <div
          ref={contenedorRef}
          className={`ayuda-fab-wrap${arr.movida ? ' ayuda-movida' : ''}${arr.moviendo ? ' ayuda-moviendo' : ''}`}
          style={arr.estilo}
        >
          {arr.moviendo && <span className="ayuda-suelta" aria-hidden="true">Suelta donde quieras</span>}
          <button
            type="button"
            className="ayuda-min"
            onClick={() => cambiarMinimizada(true)}
            aria-label="Minimizar a Capri"
            title="Minimizar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="ayuda-fab"
            onClick={alAbrir}
            {...arr.props}
            aria-label="Abrir la ayuda de Capri. Arrástrala para moverla"
            aria-expanded={false}
          >
            <span className="tip">¿Necesitas ayuda? Pregúntame cómo se hace.</span>
            <span className="av" aria-hidden="true">
              <MascotaCapri
                estado={estadoCapri}
                tamano={esMovil ? 104 : 128}
                forzarFallback2D={false}
              />
            </span>
          </button>
        </div>
      )}

      {/* Capri minimizada: botón redondo pequeño y, aparte, el botón para agrandarla */}
      {!abierto && minimizada && slot &&
        createPortal(
          <button
            type="button"
            className="ayuda-fab-barra"
            onClick={abrir}
            aria-label="Abrir ayuda de Capri"
            title="Ayuda de Capri"
          >
            <MascotaCapri estado="reposo" tamano={34} forzarFallback2D />
          </button>,
          slot,
        )}

      {!abierto && minimizada && !slot && (
        <div
          ref={contenedorRef}
          className={`ayuda-mini-wrap${arr.movida ? ' ayuda-movida' : ''}${arr.moviendo ? ' ayuda-moviendo' : ''}`}
          style={arr.estilo}
        >
          {arr.moviendo && <span className="ayuda-suelta" aria-hidden="true">Suelta donde quieras</span>}
          <button
            type="button"
            className="ayuda-fab-mini"
            onClick={alAbrir}
            {...arr.props}
            aria-label="Abrir la ayuda de Capri. Arrástrala para moverla"
            title="Ayuda de Capri"
          >
            <MascotaCapri estado="reposo" tamano={44} forzarFallback2D />
          </button>
          <button
            type="button"
            className="ayuda-max"
            onClick={() => cambiarMinimizada(false)}
            aria-label="Agrandar a Capri"
            title="Agrandar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <span className="ayuda-sr-only" role="status" aria-live="polite">{arr.anuncio}</span>

      {/* Fondo oscuro traslúcido en celular */}
      {abierto && esMovil && (
        <div
          className="ayuda-backdrop"
          onClick={cerrar}
          aria-hidden="true"
        />
      )}

      {/* Panel de Ayuda */}
      {abierto && (
        <section
          className={`ayuda-panel${arr.movida && arr.lado === 'izq' ? ' ayuda-panel--izq' : ''}`}
          role="dialog"
          aria-label="Ayuda de Capri"
          aria-modal={esMovil}
        >
          {/* Cabecera */}
          <div className="ayuda-ph">
            <div className="av" aria-hidden="true">
              <MascotaCapri
                estado={estadoCapri}
                tamano={76}
                forzarFallback2D={false}
              />
            </div>
            <div>
              <h4>Capri · Ayuda del sistema</h4>
              <small>Te explico cómo se hace. No cambio nada por ti.</small>
            </div>
            <button
              type="button"
              className="ayuda-x"
              onClick={cerrar}
              aria-label="Cerrar la ayuda"
            >
              ×
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div className="ayuda-msgs" role="log" aria-live="polite">
            {mensajes.map((m) => {
              const esYo = m.emisor === 'usuario';
              return (
                <div key={m.id} className={`ayuda-m ${esYo ? 'yo' : 'bot'}`}>
                  {esYo ? (
                    m.texto
                  ) : (
                    <>
                      <div>{formatearTextoAyuda(m.texto)}</div>

                      {/* Aviso obligatorio en respuestas instructivas */}
                      {m.id !== 'bienvenida' && (
                        <div className="ayuda-aviso">
                          Yo solo te guío. Tú haces el cambio y confirmas con Sí o No en la pantalla.
                        </div>
                      )}

                      {/* Botones de navegación (solo enlaces de lista blanca) */}
                      {m.enlaces && m.enlaces.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {m.enlaces.map((enlace, idx) => (
                            <button
                              key={`${enlace.ruta}-${idx}`}
                              type="button"
                              className="ayuda-go"
                              onClick={() => manejarNavegacion(enlace.ruta)}
                            >
                              {/^ir a /i.test(enlace.texto) ? enlace.texto : `Ir a ${enlace.texto}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Indicador de pensamiento mientras se espera respuesta */}
            {cargando && (
              <div className="ayuda-m bot" aria-label="Capri está pensando">
                <span className="ayuda-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
            <div ref={finMensajesRef} />
          </div>

          {/* Preguntas sugeridas dinámicas */}
          {sugerencias.length > 0 && (
            <div className="ayuda-sug" role="group" aria-label="Preguntas sugeridas">
              {sugerencias.map((sug, idx) => (
                <button
                  key={`${sug}-${idx}`}
                  type="button"
                  onClick={() => enviar(sug)}
                  disabled={cargando}
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          <div className="ayuda-pie">
            {arr.movida && (
              <button type="button" onClick={arr.restaurar}>Volver a la esquina original</button>
            )}
            {minimizada && slot && (
              <button type="button" onClick={() => cambiarMinimizada(false)}>
                Dejar flotante
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                cerrar();
                cambiarMinimizada(true);
              }}
            >
              Ocultar por ahora
            </button>
          </div>

          {/* Entrada de texto */}
          <form className="ayuda-in" onSubmit={manejarEnvio}>
            <label htmlFor="ayuda-input-pregunta" className="ayuda-sr-only">
              Escribe tu pregunta
            </label>
            <input
              ref={inputRef}
              id="ayuda-input-pregunta"
              type="text"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder="Escribe tu duda, por ejemplo: cómo anulo un pedido"
              maxLength={500}
              autoComplete="off"
              disabled={cargando}
            />
            <button
              type="submit"
              disabled={cargando || !pregunta.trim()}
              aria-label="Enviar pregunta"
            >
              Enviar
            </button>
          </form>
        </section>
      )}
    </>
  );
}

export default AyudaCapri;
