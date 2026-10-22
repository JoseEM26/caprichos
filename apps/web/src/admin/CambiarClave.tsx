import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { api, ErrorApi } from '../comun/api';
import { Campo } from '../comun/Campo';
import { Boton } from '../comun/Boton';
import { Icono } from '../comun/Icono';

export function CambiarClave() {
  const { usuario, marcarClaveCambiada, salir } = useSesion();
  const navigate = useNavigate();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const [mostrarClaves, setMostrarClaves] = useState(false);

  // Validación de reglas
  const tieneMinimo8 = nueva.length >= 8;
  const tieneLetra = /[a-zA-Z]/.test(nueva);
  const tieneNumero = /\d/.test(nueva);
  const esDistintaDeActual = nueva.length > 0 && actual.length > 0 && nueva !== actual;
  const coinciden = nueva.length > 0 && nueva === confirmacion;

  const formularioValido =
    actual.length > 0 &&
    tieneMinimo8 &&
    tieneLetra &&
    tieneNumero &&
    esDistintaDeActual &&
    coinciden;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorApi('');

    if (!formularioValido) {
      if (!coinciden) {
        setErrorApi('Las contraseñas no coinciden.');
      } else if (!tieneMinimo8 || !tieneLetra || !tieneNumero) {
        setErrorApi(
          'La nueva contraseña debe tener mínimo 8 caracteres con al menos una letra y un número.',
        );
      } else if (!esDistintaDeActual) {
        setErrorApi('La nueva contraseña debe ser distinta de la actual.');
      }
      return;
    }

    setCargando(true);
    try {
      await api.post('/auth/cambiar-contrasena', {
        contrasenaActual: actual,
        contrasenaNueva: nueva,
      });

      marcarClaveCambiada();
      navigate('/admin', { replace: true });
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorApi(err.message || 'Error al cambiar la contraseña.');
      } else {
        setErrorApi(err?.message || 'Error de conexión con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  };

  const handleCancelar = async () => {
    await salir();
    navigate('/admin/ingresar', { replace: true });
  };

  const renderRegla = (cumple: boolean, texto: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: cumple ? 700 : 500,
        color: cumple ? 'var(--cp-green)' : 'var(--cp-soft)',
      }}
    >
      <Icono nombre={cumple ? 'check' : 'punto'} tamano={14} />
      <span>{texto}</span>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--cp-cream)',
      }}
    >
      <div
        role="dialog"
        aria-label="Crea tu contraseña nueva"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '20px',
          boxShadow: '0 10px 30px rgba(11, 44, 62, 0.12)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '28px',
              color: 'var(--cp-navy)',
            }}
          >
            Bienvenido, {usuario?.nombres || 'colaborador'}
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '13px',
              lineHeight: '18px',
              color: 'var(--cp-soft)',
            }}
          >
            Por seguridad, en tu primer ingreso debes crear una contraseña
            personal para tu cuenta. La clave inicial quedará anulada.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <Campo
            id="clave-actual"
            etiqueta="Contraseña actual"
            type={mostrarClaves ? 'text' : 'password'}
            placeholder="Escribe la clave actual"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            required
            autoFocus
          />

          <Campo
            id="clave-nueva"
            etiqueta="Contraseña nueva"
            type={mostrarClaves ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres, letra y número"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
          />

          <Campo
            id="clave-confirmacion"
            etiqueta="Escríbela otra vez"
            type={mostrarClaves ? 'text' : 'password'}
            placeholder="Confirma la contraseña nueva"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setMostrarClaves((v) => !v)}
            style={{
              alignSelf: 'flex-start',
              minHeight: '36px',
              padding: '0 12px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {mostrarClaves ? 'Ocultar contraseñas' : 'Ver contraseñas'}
          </button>

          {/* Lista de reglas visuales */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '10px 12px',
              background: 'var(--cp-sand)',
              borderRadius: '12px',
            }}
          >
            {renderRegla(tieneMinimo8, 'Mínimo 8 caracteres')}
            {renderRegla(
              tieneLetra && tieneNumero,
              'Al menos una letra y un número',
            )}
            {renderRegla(
              esDistintaDeActual,
              'Distinta de la contraseña actual',
            )}
            {renderRegla(coinciden, 'Ambas contraseñas coinciden')}
          </div>

          {errorApi && (
            <div
              role="alert"
              style={{
                border: '1.5px solid var(--cp-rust)',
                background: '#FBEDE9',
                color: 'var(--cp-rust)',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {errorApi}
            </div>
          )}

          <Boton
            type="submit"
            variante="primario"
            tamano="grande"
            cargando={cargando}
            disabled={!formularioValido}
            style={{ width: '100%', marginTop: '6px' }}
          >
            Guardar y entrar al panel
          </Boton>

          <Boton
            type="button"
            variante="texto"
            onClick={handleCancelar}
            style={{ width: '100%', color: 'var(--cp-soft)' }}
          >
            Volver al inicio de sesión
          </Boton>
        </form>
      </div>
    </div>
  );
}
