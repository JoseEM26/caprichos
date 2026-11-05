import type { FormEvent, RefObject } from 'react';
import { botonPrimarioReserva, botonSecundarioReserva, campoReserva, etiquetaReserva } from './estilosReserva';

export interface ErroresDatos {
  nombre?: string;
  telefono?: string;
}

interface PasoDatosProps {
  nombre: string;
  telefono: string;
  nota: string;
  resumen: string;
  errores: ErroresDatos;
  enviando: boolean;
  errorServidor: string | null;
  campoTrampaRef: RefObject<HTMLInputElement>;
  onCambio: (campo: 'nombre' | 'telefono' | 'nota', valor: string) => void;
  onAtras: () => void;
  onEnviar: () => void;
}

/** Paso 3: nombre, celular, nota opcional, resumen y envío. Los errores del servidor se muestran aquí mismo. */
export function PasoDatos({
  nombre,
  telefono,
  nota,
  resumen,
  errores,
  enviando,
  errorServidor,
  campoTrampaRef,
  onCambio,
  onAtras,
  onEnviar,
}: PasoDatosProps) {
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (!enviando) onEnviar();
  };

  return (
    <form onSubmit={alEnviar} noValidate aria-labelledby="reserva-paso-datos">
      <h3 id="reserva-paso-datos" style={{ ...etiquetaReserva, fontSize: 16, margin: '0 0 6px' }}>
        Tus datos
      </h3>
      <p style={{ fontSize: 14, color: 'var(--cp-navy)', margin: '0 0 14px', fontWeight: 700 }}>{resumen}</p>

      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
          Nombre
          <input
            type="text"
            name="nombre"
            autoComplete="name"
            value={nombre}
            maxLength={60}
            onChange={(e) => onCambio('nombre', e.target.value)}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={errores.nombre ? 'reserva-error-nombre' : undefined}
            style={campoReserva}
          />
        </label>
        {errores.nombre && (
          <p id="reserva-error-nombre" aria-live="polite" style={{ margin: '-6px 0 0', fontSize: 13, color: 'var(--cp-rust)', fontWeight: 700 }}>
            {errores.nombre}
          </p>
        )}

        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
          Celular (WhatsApp)
          <input
            type="tel"
            name="telefono"
            inputMode="tel"
            autoComplete="tel-national"
            value={telefono}
            maxLength={16}
            placeholder="987 654 321"
            onChange={(e) => onCambio('telefono', e.target.value)}
            aria-invalid={errores.telefono ? true : undefined}
            aria-describedby={errores.telefono ? 'reserva-error-telefono' : 'reserva-ayuda-telefono'}
            style={campoReserva}
          />
        </label>
        {errores.telefono ? (
          <p id="reserva-error-telefono" aria-live="polite" style={{ margin: '-6px 0 0', fontSize: 13, color: 'var(--cp-rust)', fontWeight: 700 }}>
            {errores.telefono}
          </p>
        ) : (
          <p id="reserva-ayuda-telefono" style={{ margin: '-6px 0 0', fontSize: 12, color: 'var(--cp-soft)' }}>
            Te confirmaremos por este número.
          </p>
        )}

        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
          Nota (opcional)
          <textarea
            name="nota"
            rows={2}
            maxLength={200}
            value={nota}
            placeholder="Cumpleaños, silla para bebé, zona preferida…"
            onChange={(e) => onCambio('nota', e.target.value)}
            style={{ ...campoReserva, resize: 'vertical', minHeight: 64 }}
          />
        </label>
      </div>

      {/* Campo trampa: oculto para las personas, lo llenan los robots. Si viene con texto, el servidor no guarda nada. */}
      <div aria-hidden="true" style={{ height: 0, overflow: 'hidden' }}>
        <label>
          No llenar este campo
          <input ref={campoTrampaRef} type="text" name="empresa" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {errorServidor && (
        <p role="alert" style={{ margin: '14px 0 0', padding: '10px 12px', borderRadius: 12, background: 'color-mix(in srgb, var(--cp-rust) 12%, transparent)', color: 'var(--cp-rust)', fontSize: 14, fontWeight: 700 }}>
          {errorServidor}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onAtras} disabled={enviando} style={{ ...botonSecundarioReserva, opacity: enviando ? 0.5 : 1 }}>
          Atrás
        </button>
        <button type="submit" disabled={enviando} aria-busy={enviando || undefined} style={{ ...botonPrimarioReserva, opacity: enviando ? 0.7 : 1 }}>
          {enviando ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );
}
