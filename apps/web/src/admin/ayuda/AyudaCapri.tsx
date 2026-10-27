import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEsMovil } from '../../carta/useEsMovil';
import { MascotaCapri } from '../../mascota';
import { useAyuda } from './useAyuda';
import { formatearTextoAyuda } from './formatearTextoAyuda';
import './AyudaCapri.css';

export interface AyudaCapriProps {
  ruta?: string;
}

export function AyudaCapri({ ruta }: AyudaCapriProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const esMovil = useEsMovil();

  const rutaActual = ruta ?? location.pathname;
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
      {!abierto && (
        <button
          type="button"
          className="ayuda-fab"
          onClick={abrir}
          aria-label="Abrir la ayuda de Capri"
          aria-expanded={false}
        >
          <span className="tip">¿Necesitas ayuda? Pregúntame cómo se hace.</span>
          <span className="av" aria-hidden="true">
            <MascotaCapri
              estado={estadoCapri}
              tamano={esMovil ? 76 : 88}
              forzarFallback2D={false}
            />
          </span>
        </button>
      )}

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
          className="ayuda-panel"
          role="dialog"
          aria-label="Ayuda de Capri"
          aria-modal={esMovil}
        >
          {/* Cabecera */}
          <div className="ayuda-ph">
            <div className="av" aria-hidden="true">
              <MascotaCapri
                estado={estadoCapri}
                tamano={52}
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
                              Ir a {enlace.texto}
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
