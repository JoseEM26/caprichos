import { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { Reserva } from '../tipos';

export interface ModalCancelarReservaProps {
  abierto: boolean;
  reserva: Reserva | null;
  alCerrar: () => void;
  alCancelarReserva: (id: string, motivo: string) => Promise<void>;
  error?: string | null;
  alLimpiarError?: () => void;
}

export function ModalCancelarReserva({
  abierto,
  reserva,
  alCerrar,
  alCancelarReserva,
  error,
  alLimpiarError,
}: ModalCancelarReservaProps) {
  const [motivo, setMotivo] = useState('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (!abierto || !reserva) return null;

  const handleValidarYAbrirConfirmar = () => {
    alLimpiarError?.();
    if (!motivo.trim() || motivo.trim().length < 5) {
      setErrorValidacion(
        'El motivo de cancelación es obligatorio y debe tener al menos 5 caracteres.',
      );
      return;
    }
    setErrorValidacion(null);
    setConfirmarAbierto(true);
  };

  const ejecutarCancelar = async () => {
    setCargando(true);
    try {
      await alCancelarReserva(reserva.id, motivo.trim());
      setConfirmarAbierto(false);
      setMotivo('');
      alCerrar();
    } catch {
      setConfirmarAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 85,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={alCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cancelar reserva de ${reserva.nombre}`}
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--cp-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                }}
              >
                Cancelar reserva
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                {reserva.nombre} · {reserva.personas} personas
              </div>
            </div>
            <button
              onClick={alCerrar}
              aria-label="Cerrar ventana"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              x
            </button>
          </div>

          {/* Formulario */}
          <div
            style={{
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="motivo-cancelar-reserva"
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              >
                Motivo de la cancelación (mínimo 5 caracteres)
              </label>
              <textarea
                id="motivo-cancelar-reserva"
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setErrorValidacion(null);
                  alLimpiarError?.();
                }}
                placeholder="Ej.: Cliente avisó por WhatsApp que no podrá asistir, cambio de fecha..."
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: `1.5px solid ${
                    errorValidacion || error ? 'var(--cp-rust)' : 'var(--cp-line)'
                  }`,
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '10px 12px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                La reserva no se elimina: quedará registrada como CANCELADA con este motivo en el historial (RN-CAP-014).
              </span>
            </div>

            {/* Error de validación local */}
            {errorValidacion && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  background: '#FBEDE9',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '10px',
                  color: 'var(--cp-rust)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {errorValidacion}
              </div>
            )}

            {/* Error del servidor */}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  background: '#FBEDE9',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '10px',
                  color: 'var(--cp-rust)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Pie */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'var(--cp-cream)',
            }}
          >
            <Boton type="button" variante="secundario" onClick={alCerrar}>
              Volver
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              disabled={motivo.trim().length < 5}
              onClick={handleValidarYAbrirConfirmar}
            >
              Cancelar reserva
            </Boton>
          </div>
        </div>
      </div>

      {/* Confirmar obligatoria Sí/No */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo={`¿Confirmar cancelación de reserva?`}
        mensaje={`La reserva de ${reserva.nombre} pasará a estado CANCELADA con el motivo "${motivo.trim()}". La marca en el plano se retirará. ¿Deseas confirmar?`}
        textoSi="Sí, cancelar reserva"
        textoNo="No, volver"
        peligro
        cargando={cargando}
        alConfirmar={ejecutarCancelar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
