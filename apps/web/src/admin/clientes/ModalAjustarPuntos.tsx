import { useState } from 'react';
import { ajustarPuntos } from './clientesApi';

interface PropsModalAjustarPuntos {
  abierto: boolean;
  clienteId: string;
  clienteNombre: string;
  saldoActual: number;
  alCerrar: () => void;
  alAjustarExitoso: (nuevoSaldo: number) => void;
}

export function ModalAjustarPuntos({
  abierto,
  clienteId,
  clienteNombre,
  saldoActual,
  alCerrar,
  alAjustarExitoso,
}: PropsModalAjustarPuntos) {
  const [tipo, setTipo] = useState<'SUMA' | 'REVERSA'>('SUMA');
  const [puntos, setPuntos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  if (!abierto) return null;

  const numPuntos = parseFloat(puntos.replace(',', '.')) || 0;

  const validar = () => {
    setErrorMsg('');
    if (isNaN(numPuntos) || numPuntos <= 0) {
      setErrorMsg('Ingresa una cantidad válida de puntos mayor a 0.');
      return;
    }
    if (tipo === 'REVERSA' && numPuntos > saldoActual) {
      setErrorMsg(`No se puede restar más puntos del saldo actual (${saldoActual.toFixed(2)} pts).`);
      return;
    }
    if (motivo.trim().length < 3) {
      setErrorMsg('Escribe el motivo del ajuste (mínimo 3 caracteres).');
      return;
    }

    setMostrarConfirmacion(true);
  };

  const ejecutarAjuste = async () => {
    setGuardando(true);
    setErrorMsg('');
    try {
      const res = await ajustarPuntos(clienteId, {
        puntos: numPuntos,
        tipo,
        motivo: motivo.trim(),
      });
      setMostrarConfirmacion(false);
      alAjustarExitoso(res.nuevoSaldo);
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo realizar el ajuste de puntos.');
      setMostrarConfirmacion(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustar puntos"
        style={{
          position: 'fixed',
          zIndex: 75,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18 }}>
            Ajustar puntos: {clienteNombre}
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Saldo actual: <b>{saldoActual.toFixed(2)} puntos</b>
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Tipo de ajuste</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setTipo('SUMA')}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: tipo === 'SUMA' ? 'var(--cp-navy)' : 'transparent',
                color: tipo === 'SUMA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Sumar puntos
            </button>
            <button
              type="button"
              onClick={() => setTipo('REVERSA')}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: tipo === 'REVERSA' ? 'var(--cp-navy)' : 'transparent',
                color: tipo === 'REVERSA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              − Restar puntos
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="aj-pts" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Cantidad de puntos
          </label>
          <input
            id="aj-pts"
            type="number"
            step="0.01"
            min="0"
            value={puntos}
            onChange={(e) => setPuntos(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 44,
              borderRadius: 10,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: 14,
              color: 'var(--cp-navy)',
            }}
          />
        </div>

        <div>
          <label htmlFor="aj-motivo" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Motivo del ajuste (obligatorio, queda en auditoría)
          </label>
          <input
            id="aj-motivo"
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: Cortesía por demora, corrección de pedido..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 44,
              borderRadius: 10,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: 14,
              color: 'var(--cp-navy)',
            }}
          />
        </div>

        {errorMsg && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={validar}
            disabled={guardando}
            style={{
              flex: 1,
              minHeight: 48,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Ajustar puntos
          </button>
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            style={{
              flex: 1,
              minHeight: 48,
              border: '1.5px solid var(--cp-navy)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      {mostrarConfirmacion && (
        <>
          <div
            onClick={() => setMostrarConfirmacion(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 85,
              background: 'rgba(11,44,62,0.6)',
            }}
          />
          <div
            role="alertdialog"
            aria-label="Confirmar acción"
            style={{
              position: 'fixed',
              zIndex: 95,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(420px, calc(100% - 24px))',
              background: 'var(--cp-cream)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.45)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 20,
                lineHeight: '26px',
              }}
            >
              ¿{tipo === 'SUMA' ? 'Sumar' : 'Restar'} {numPuntos} puntos a {clienteNombre}?
            </div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
              Motivo: &quot;{motivo.trim()}&quot;. Esta acción quedará registrada en el historial y en la auditoría.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={ejecutarAjuste}
                disabled={guardando}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setMostrarConfirmacion(false)}
                disabled={guardando}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
