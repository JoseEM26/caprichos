import { useState } from 'react';
import { registrarClienteMostrador } from './clientesApi';

interface PropsModalNuevoCliente {
  abierto: boolean;
  alCerrar: () => void;
  alGuardarExitoso: () => void;
}

export function ModalNuevoCliente({
  abierto,
  alCerrar,
  alGuardarExitoso,
}: PropsModalNuevoCliente) {
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [cumpleanos, setCumpleanos] = useState('');
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  if (!abierto) return null;

  const esEmpresa = dni.length === 11;
  const subtituloDoc = dni.length === 11
    ? 'Empresa (RUC de 11 dígitos)'
    : 'Persona (DNI de 8 dígitos)';

  const validarYConfirmar = () => {
    setErrorMsg('');
    const n = nombre.trim();
    const d = dni.trim();
    const c = correo.trim();

    if (n.length < 2) {
      setErrorMsg('Escribe el nombre.');
      return;
    }
    if (!(d.length === 8 || d.length === 11)) {
      setErrorMsg('El DNI tiene 8 dígitos (o el RUC de una empresa, 11).');
      return;
    }
    if (!esEmpresa && !/^\d{4}-\d{2}-\d{2}$/.test(cumpleanos.trim())) {
      setErrorMsg('Elige el cumpleaños del cliente en el calendario.');
      return;
    }
    if (c && !/.+@.+\..+/.test(c)) {
      setErrorMsg('El correo no parece válido. Es opcional.');
      return;
    }
    if (!aceptaDatos) {
      setErrorMsg('El cliente debe aceptar que se guarden sus datos.');
      return;
    }

    setMostrarConfirmacion(true);
  };

  const ejecutarRegistro = async () => {
    setGuardando(true);
    setErrorMsg('');
    try {
      await registrarClienteMostrador({
        nombre: nombre.trim(),
        dni: dni.trim(),
        telefono: telefono.trim() || undefined,
        correo: correo.trim() || undefined,
        cumpleanos: cumpleanos.trim() || undefined,
        aceptaDatos: true,
      });
      setMostrarConfirmacion(false);
      alGuardarExitoso();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo registrar el cliente.');
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
        aria-label="Nuevo cliente"
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
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignSelf: 'stretch', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
            Nuevo cliente
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
          <label
            htmlFor="nc-n"
            style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
          >
            Nombre (obligatorio)
          </label>
          <input
            id="nc-n"
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setErrorMsg('');
            }}
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
          <label
            htmlFor="nc-d"
            style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
          >
            DNI o RUC (obligatorio)
          </label>
          <input
            id="nc-d"
            type="text"
            value={dni}
            onChange={(e) => {
              setDni(e.target.value.replace(/\D/g, '').slice(0, 11));
              setErrorMsg('');
            }}
            placeholder="8 dígitos, o 11 si es empresa"
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

        <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{subtituloDoc}</div>

        <div>
          <label
            htmlFor="nc-t"
            style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
          >
            Teléfono
          </label>
          <input
            id="nc-t"
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
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
          <label
            htmlFor="nc-e"
            style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
          >
            Correo personal (opcional)
          </label>
          <input
            id="nc-e"
            type="text"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
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
          <label
            htmlFor="nc-b"
            style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
          >
            Cumpleaños (obligatorio para personas)
          </label>
          <input
            id="nc-b"
            type="date"
            value={cumpleanos}
            onChange={(e) => setCumpleanos(e.target.value)}
            aria-label="Cumpleaños"
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

        <button
          type="button"
          onClick={() => setAceptaDatos(!aceptaDatos)}
          role="checkbox"
          aria-checked={aceptaDatos}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            textAlign: 'left',
            minHeight: 44,
            padding: '4px 0',
            border: 0,
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontSize: 12,
            lineHeight: '17px',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 22,
              height: 22,
              borderRadius: 6,
              border: '2px solid var(--cp-navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
            }}
          >
            {aceptaDatos ? '✓' : ''}
          </span>
          <span>
            El cliente acepta que Caprichos guarde su documento y sus datos para su cuenta y sus puntos.
          </span>
        </button>

        {errorMsg && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={validarYConfirmar}
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
            Registrar cliente
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
              ¿Registrar a {nombre.trim()}?
            </div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
              Queda en Clientes. Si es persona, el cliente crea su contraseña después, en la carta.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={ejecutarRegistro}
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
