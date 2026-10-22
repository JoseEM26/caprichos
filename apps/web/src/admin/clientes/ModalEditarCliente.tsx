import { useEffect, useState } from 'react';
import type { ClienteItem } from './tipos';
import { editarCliente } from './clientesApi';

interface PropsModalEditarCliente {
  abierto: boolean;
  cliente: ClienteItem | null;
  alCerrar: () => void;
  alGuardarExitoso: () => void;
}

export function ModalEditarCliente({
  abierto,
  cliente,
  alCerrar,
  alGuardarExitoso,
}: PropsModalEditarCliente) {
  const [nombre, setNombre] = useState(cliente?.nombre || '');
  const [telefono, setTelefono] = useState(cliente?.telefono && cliente.telefono !== '—' ? cliente.telefono : '');
  const [correo, setCorreo] = useState(cliente?.correo && cliente.correo !== 'sin correo' ? cliente.correo : '');
  const [cumpleanos, setCumpleanos] = useState(cliente?.cumpleanos && cliente.cumpleanos !== '—' ? cliente.cumpleanos : '');
  const [envioFijo, setEnvioFijo] = useState(cliente?.envioFijo !== null && cliente?.envioFijo !== undefined ? String(cliente.envioFijo) : '');
  const [descuentoEnvio, setDescuentoEnvio] = useState(cliente?.descuentoEnvio !== null && cliente?.descuentoEnvio !== undefined ? String(cliente.descuentoEnvio) : '');
  const [errorMsg, setErrorMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  // Sync state if cliente changes
  useEffect(() => {
    if (cliente) {
      setNombre(cliente.nombre || '');
      setTelefono(cliente.telefono && cliente.telefono !== '—' ? cliente.telefono : '');
      setCorreo(cliente.correo && cliente.correo !== 'sin correo' ? cliente.correo : '');
      setCumpleanos(cliente.cumpleanos && cliente.cumpleanos !== '—' ? cliente.cumpleanos : '');
      setEnvioFijo(cliente.envioFijo !== null && cliente.envioFijo !== undefined ? String(cliente.envioFijo) : '');
      setDescuentoEnvio(cliente.descuentoEnvio !== null && cliente.descuentoEnvio !== undefined ? String(cliente.descuentoEnvio) : '');
      setErrorMsg('');
    }
  }, [cliente]);

  if (!abierto || !cliente) return null;

  const validar = () => {
    setErrorMsg('');
    if (nombre.trim().length < 2) {
      setErrorMsg('Escribe el nombre.');
      return;
    }
    if (correo.trim() && correo.trim() !== 'sin correo' && !/.+@.+\..+/.test(correo.trim())) {
      setErrorMsg('El correo no parece válido. Es opcional.');
      return;
    }
    const envN = envioFijo.trim().replace(',', '.');
    if (envN && envN !== '—' && !/^\d+(\.\d+)?$/.test(envN)) {
      setErrorMsg('El envío fijo es un monto en soles, por ejemplo 2.50. Déjalo en blanco si no tiene.');
      return;
    }
    const descN = descuentoEnvio.trim().replace(',', '.');
    if (descN && descN !== '—' && (!/^\d+(\.\d+)?$/.test(descN) || Number(descN) > 100)) {
      setErrorMsg('El descuento de envío es un porcentaje entre 0 y 100. Déjalo en blanco si no tiene.');
      return;
    }

    setMostrarConfirmacion(true);
  };

  const ejecutarGuardado = async () => {
    setGuardando(true);
    setErrorMsg('');
    try {
      const ef = envioFijo.trim();
      const de = descuentoEnvio.trim();
      await editarCliente(cliente.id, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        correo: correo.trim() || undefined,
        cumpleanos: cumpleanos.trim() || undefined,
        envioFijo: ef && ef !== '—' ? parseFloat(ef.replace(',', '.')) : null,
        descuentoEnvio: de && de !== '—' ? parseFloat(de.replace(',', '.')) : null,
      });
      setMostrarConfirmacion(false);
      alGuardarExitoso();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo guardar los cambios.');
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
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar: ${cliente.nombre}`}
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(620px, calc(100% - 24px))',
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
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 20,
              lineHeight: '26px',
            }}
          >
            Editar: {cliente.nombre}
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: 20,
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

        <div>
          <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Nombre
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              borderRadius: 12,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Teléfono
          </label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              borderRadius: 12,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Correo (opcional)
          </label>
          <input
            type="text"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              borderRadius: 12,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Cumpleaños
          </label>
          <input
            type="text"
            value={cumpleanos}
            onChange={(e) => setCumpleanos(e.target.value)}
            placeholder="DD/MM o YYYY-MM-DD"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              borderRadius: 12,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Envío fijo (s/)
          </label>
          <input
            type="text"
            value={envioFijo}
            onChange={(e) => setEnvioFijo(e.target.value)}
            placeholder="—"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              borderRadius: 12,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
            Descuento de envío (%)
          </label>
          <input
            type="text"
            value={descuentoEnvio}
            onChange={(e) => setDescuentoEnvio(e.target.value)}
            placeholder="—"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              borderRadius: 12,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: 14,
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
              minHeight: 52,
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
            Guardar
          </button>
          <button
            type="button"
            onClick={alCerrar}
            disabled={guardando}
            style={{
              flex: 1,
              minHeight: 52,
              border: '1.5px solid var(--cp-navy)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
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
              zIndex: 80,
              background: 'rgba(11,44,62,0.6)',
            }}
          />
          <div
            role="alertdialog"
            aria-label="Confirmar acción"
            style={{
              position: 'fixed',
              zIndex: 90,
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
              ¿Guardar los cambios?
            </div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
              Se actualizarán los datos del cliente {cliente.nombre}.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={ejecutarGuardado}
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
