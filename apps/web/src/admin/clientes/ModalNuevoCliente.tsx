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
  const [esEmpresa, setEsEmpresa] = useState(false);
  const [ruc, setRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [cumpleanos, setCumpleanos] = useState('');
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  if (!abierto) return null;


  const validarYConfirmar = () => {
    setErrorMsg('');
    const n = nombre.trim();
    const tel = telefono.replace(/[\s-]/g, '').replace(/^\+51/, '');
    const c = correo.trim();

    if (n.length < 2) {
      setErrorMsg('Escribe el nombre.');
      return;
    }
    if (esEmpresa && ruc.length !== 11) {
      setErrorMsg('El RUC tiene 11 dígitos.');
      return;
    }
    if (!esEmpresa && !/^9\d{8}$/.test(tel)) {
      setErrorMsg('Escribe el celular del cliente: 9 dígitos y empieza con 9.');
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
        ...(esEmpresa
          ? { ruc, telefono: telefono.trim() || undefined }
          : { telefono: telefono.replace(/[\s-]/g, '').replace(/^\+51/, '') }),
        correo: correo.trim() || undefined,
        cumpleanos: esEmpresa ? undefined : cumpleanos.trim() || undefined,
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

        <div role="group" aria-label="Tipo de cliente" style={{ display: 'flex', gap: 8 }}>
          {([[false, 'Persona'], [true, 'Empresa']] as const).map(([v, t]) => (
            <button
              key={t}
              type="button"
              aria-pressed={esEmpresa === v}
              onClick={() => { setEsEmpresa(v); setErrorMsg(''); }}
              style={{
                minHeight: 44,
                padding: '0 16px',
                borderRadius: 9999,
                border: `1.5px solid ${esEmpresa === v ? 'var(--cp-navy)' : 'var(--cp-line)'}`,
                background: esEmpresa === v ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: esEmpresa === v ? 'var(--cp-white)' : 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
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

        {esEmpresa && (
          <div>
            <label htmlFor="nc-r" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
              RUC (obligatorio)
            </label>
            <input
              id="nc-r"
              type="text"
              inputMode="numeric"
              value={ruc}
              onChange={(e) => { setRuc(e.target.value.replace(/\D/g, '').slice(0, 11)); setErrorMsg(''); }}
              placeholder="11 dígitos"
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
        )}

        <div>
          <label
            htmlFor="nc-t"
            style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
          >
            {esEmpresa ? 'Celular (opcional)' : 'Celular (obligatorio)'}
          </label>
          <input
            id="nc-t"
            type="text"
            value={telefono}
            inputMode="numeric"
            placeholder="Ej.: 987654321"
            onChange={(e) => { setTelefono(e.target.value); setErrorMsg(''); }}
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
            Cumpleaños (opcional)
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
            El cliente acepta que Caprichos guarde su celular y sus datos para su cuenta y sus puntos.
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
              Queda en Clientes. Si es persona, el cliente crea su contraseña después, en la carta, con el mismo celular.
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
