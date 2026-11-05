import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ErrorApi } from '../../comun/api';
import { useCuentaOpcional } from '../cuenta/CuentaContext';
import { useEsMovil } from '../useEsMovil';
import { PasoDatos } from './PasoDatos';
import type { ErroresDatos } from './PasoDatos';
import { PasoFechaHora } from './PasoFechaHora';
import { PasoPersonas } from './PasoPersonas';
import { celularValido, fechaLegible, horaLegible, horaPasada } from './fechasReserva';
import { enviarSolicitudReserva, guardarDatosRecordados, leerDatosRecordados } from './reservasCartaApi';
import type { OpcionesReserva } from './reservasCartaApi';
import { TACTIL_RESERVA, botonPrimarioReserva, botonSecundarioReserva } from './estilosReserva';

const PASOS = ['Personas', 'Día y hora', 'Tus datos'];
/** Códigos del servidor que se corrigen en el paso de día y hora */
const CODIGOS_PASO_FECHA = ['HORA_PASADA', 'FUERA_DE_HORARIO'];

interface HojaReservarProps {
  opciones: OpcionesReserva;
  onCerrar: () => void;
}

type Paso = 1 | 2 | 3 | 'exito';

/**
 * Hoja de «Reservar mesa»: 3 pasos y una pantalla de éxito. Se dibuja en document.body para no heredar
 * el zoom del celular de la carta. Es una solicitud: el local la aprueba y avisa por WhatsApp.
 */
export function HojaReservar({ opciones, onCerrar }: HojaReservarProps) {
  const movil = useEsMovil();
  const cuenta = useCuentaOpcional();
  const cliente = cuenta?.cliente ?? null;
  const tope = Math.max(1, opciones.personasMax);

  const recordados = useMemo(() => leerDatosRecordados(), []);
  const [paso, setPaso] = useState<Paso>(1);
  const [personas, setPersonas] = useState(() => Math.min(2, tope));
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [nombre, setNombre] = useState(() => cliente?.nombre || recordados.nombre);
  const [telefono, setTelefono] = useState(() => cliente?.telefono || recordados.telefono);
  const [nota, setNota] = useState('');
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [confirmada, setConfirmada] = useState<{ personas: number; fecha: string; hora: string; telefono: string } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const campoTrampa = useRef<HTMLInputElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  // Si la cuenta carga después de abrir la hoja, se rellenan los datos vacíos con los de la cuenta
  useEffect(() => {
    if (!cliente) return;
    setNombre((n) => n || cliente.nombre);
    setTelefono((t) => t || cliente.telefono || '');
  }, [cliente?.nombre, cliente?.telefono]);

  // Foco: entra al título y al cerrar vuelve al botón que abrió la hoja
  useEffect(() => {
    focoPrevio.current = document.activeElement as HTMLElement | null;
    tituloRef.current?.focus();
    return () => focoPrevio.current?.focus?.();
  }, []);
  useEffect(() => {
    if (paso === 'exito') tituloRef.current?.focus();
  }, [paso]);

  const nombreLimpio = nombre.trim();
  const celular = celularValido(telefono);
  const errores: ErroresDatos = {};
  if (intentoEnvio) {
    if (nombreLimpio.length < 2) errores.nombre = 'Escribe tu nombre (al menos 2 letras).';
    if (!celular) errores.telefono = 'Escribe un celular de 9 dígitos que empiece con 9.';
  }

  const fechaValida = Boolean(fecha && hora && !horaPasada(fecha, hora));
  const resumen = `${personas} ${personas === 1 ? 'persona' : 'personas'} · ${fecha ? fechaLegible(fecha) : ''} · ${hora ? horaLegible(hora) : ''}`;

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCerrar();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    // Foco atrapado: Tab y Shift+Tab no salen de la hoja
    const enfocables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), [tabindex="0"]',
      ),
    );
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === tituloRef.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  const enviar = async () => {
    setIntentoEnvio(true);
    if (nombreLimpio.length < 2 || !celular) return;
    if (!fechaValida) {
      setErrorServidor('Esa hora ya no está disponible. Elige otra fecha u hora.');
      setPaso(2);
      return;
    }
    setEnviando(true);
    setErrorServidor(null);
    try {
      await enviarSolicitudReserva({
        nombre: nombreLimpio,
        telefono: celular,
        personas,
        fecha,
        hora,
        nota: nota.trim() || undefined,
        empresa: campoTrampa.current?.value ?? '',
      });
      guardarDatosRecordados({ nombre: nombreLimpio, telefono: celular });
      setConfirmada({ personas, fecha, hora, telefono: celular });
      setPaso('exito');
    } catch (err) {
      const codigo = err instanceof ErrorApi ? err.codigo : '';
      setErrorServidor(err instanceof ErrorApi ? err.message : 'No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo otra vez.');
      if (CODIGOS_PASO_FECHA.includes(codigo)) setPaso(2);
    } finally {
      setEnviando(false);
    }
  };

  const estiloOverlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 70,
    backgroundColor: 'rgba(11, 44, 62, 0.6)',
    display: 'flex',
    alignItems: movil ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: movil ? 0 : 16,
    boxSizing: 'border-box',
  };
  const estiloPanel: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: movil ? '100%' : 520,
    maxHeight: movil ? '92vh' : '90vh',
    overflowX: 'hidden',
    overflowY: 'auto',
    boxSizing: 'border-box',
    backgroundColor: 'var(--cp-cream)',
    color: 'var(--cp-navy)',
    borderRadius: movil ? '20px 20px 0 0' : 20,
    boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
    padding: movil ? '16px 16px calc(18px + env(safe-area-inset-bottom, 0px))' : 24,
    fontFamily: 'var(--fuente-texto)',
    outline: 'none',
  };

  const indice = paso === 'exito' ? PASOS.length : paso;

  return createPortal(
    <div style={estiloOverlay}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="reserva-titulo" style={estiloPanel} onKeyDown={alTeclear}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2
            id="reserva-titulo"
            ref={tituloRef}
            tabIndex={-1}
            style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 20, lineHeight: '26px', outline: 'none' }}
          >
            {paso === 'exito' ? 'Solicitud enviada' : 'Reservar mesa'}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ ...botonSecundarioReserva, flex: 'none', width: TACTIL_RESERVA, padding: 0, fontSize: 22, lineHeight: '22px' }}
          >
            ×
          </button>
        </div>

        {paso !== 'exito' && (
          <ol aria-label={`Paso ${indice} de ${PASOS.length}`} style={{ display: 'flex', alignItems: 'center', gap: 6, listStyle: 'none', padding: 0, margin: '0 0 18px' }}>
            {PASOS.map((nombrePaso, i) => {
              const n = i + 1;
              const activo = paso === n;
              const hecho = paso > n;
              return (
                <li key={nombrePaso} aria-current={activo ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < PASOS.length - 1 ? 1 : 'none', minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: 13,
                      background: activo || hecho ? 'var(--cp-navy)' : 'var(--cp-white)',
                      color: activo || hecho ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      border: '1.5px solid var(--cp-navy)',
                    }}
                  >
                    {n}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: activo ? 800 : 600, color: activo ? 'var(--cp-navy)' : 'var(--cp-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    {nombrePaso}
                  </span>
                  {i < PASOS.length - 1 && (
                    <span aria-hidden="true" style={{ flex: 1, minWidth: 8, height: 2, background: hecho ? 'var(--cp-orange)' : 'var(--cp-line)' }} />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {paso === 1 && (
          <>
            <PasoPersonas personas={personas} personasMax={opciones.personasMax} onCambio={setPersonas} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={() => setPaso(2)} style={botonPrimarioReserva}>
                Siguiente
              </button>
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <PasoFechaHora opciones={opciones} fecha={fecha} hora={hora} onFecha={setFecha} onHora={setHora} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
              <button type="button" onClick={() => setPaso(1)} style={botonSecundarioReserva}>
                Atrás
              </button>
              <button type="button" onClick={() => setPaso(3)} disabled={!fechaValida} style={{ ...botonPrimarioReserva, opacity: fechaValida ? 1 : 0.5 }}>
                Siguiente
              </button>
            </div>
            {errorServidor && (
              <p role="alert" style={{ margin: '14px 0 0', padding: '10px 12px', borderRadius: 12, background: 'color-mix(in srgb, var(--cp-rust) 12%, transparent)', color: 'var(--cp-rust)', fontSize: 14, fontWeight: 700 }}>
                {errorServidor}
              </p>
            )}
            {!fechaValida && opciones.horarios.length > 0 && (
              <p aria-live="polite" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--cp-soft)' }}>
                Elige un día y una hora para seguir.
              </p>
            )}
          </>
        )}

        {paso === 3 && (
          <PasoDatos
            nombre={nombre}
            telefono={telefono}
            nota={nota}
            resumen={resumen}
            errores={errores}
            enviando={enviando}
            errorServidor={errorServidor}
            campoTrampaRef={campoTrampa}
            onCambio={(campo, valor) => {
              if (campo === 'nombre') setNombre(valor);
              else if (campo === 'telefono') setTelefono(valor);
              else setNota(valor);
            }}
            onAtras={() => setPaso(2)}
            onEnviar={enviar}
          />
        )}

        {paso === 'exito' && confirmada && (
          <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
            <style>{`
              @keyframes cpReservaCheck { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
              .cp-reserva-check { animation: cpReservaCheck 0.5s ease-out both; }
              @media (prefers-reduced-motion: reduce) { .cp-reserva-check { animation: none; } }
            `}</style>
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" style={{ display: 'block', margin: '6px auto 14px' }}>
              <circle cx="36" cy="36" r="34" fill="var(--cp-greenbg)" />
              <path
                className="cp-reserva-check"
                d="M22 37 L32 47 L50 27"
                pathLength={1}
                strokeDasharray={1}
                fill="none"
                stroke="var(--cp-ok)"
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16 }}>
              {confirmada.personas} {confirmada.personas === 1 ? 'persona' : 'personas'} · {fechaLegible(confirmada.fecha)} · {horaLegible(confirmada.hora)}
            </p>
            <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: '22px' }}>
              El local te confirmará por WhatsApp al {confirmada.telefono}.
            </p>
            <button type="button" onClick={onCerrar} style={{ ...botonPrimarioReserva, flex: 'none', width: '100%' }}>
              Listo
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
